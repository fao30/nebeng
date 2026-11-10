package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Store keeps everything in memory and snapshots it to a JSON file.
// It is intentionally simple so the API runs with zero external services;
// swap it for Postgres when moving to production.
type Store struct {
	mu       sync.RWMutex
	Users    map[string]*User        `json:"users"`
	Trips    map[string]*Trip        `json:"trips"`
	Bookings map[string]*Booking     `json:"bookings"`
	Requests map[string]*RideRequest `json:"requests"`
	Messages map[string]*Message     `json:"messages"`
	Settings *Settings               `json:"settings"`

	path    string
	dirty   chan struct{}
	byEmail map[string]string
	byShare map[string]string
}

func NewStore(path string) *Store {
	s := &Store{
		Users:    map[string]*User{},
		Trips:    map[string]*Trip{},
		Bookings: map[string]*Booking{},
		Requests: map[string]*RideRequest{},
		Messages: map[string]*Message{},
		path:     path,
		dirty:    make(chan struct{}, 1),
	}
	if path != "" {
		if b, err := os.ReadFile(path); err == nil {
			if err := json.Unmarshal(b, s); err != nil {
				log.Printf("store: cannot parse %s: %v (starting empty)", path, err)
			} else {
				log.Printf("store: loaded %d users, %d trips from %s", len(s.Users), len(s.Trips), path)
			}
		}
		go s.saver()
	}
	if s.Messages == nil {
		s.Messages = map[string]*Message{}
	}
	if s.Settings == nil || s.Settings.valid() != nil {
		s.Settings = defaultSettings()
	}
	cfg.Store(s.Settings)
	for _, t := range s.Trips {
		normalizeTrip(t)
	}
	for _, b := range s.Bookings {
		if t := s.Trips[b.TripID]; t != nil && b.SegEnd == 0 {
			sp := spanFor(t, b.Pickup, b.Dropoff)
			b.SegStart, b.SegEnd, b.FromPos, b.ToPos = sp.Start, sp.End, sp.FromPos, sp.ToPos
		}
	}
	s.reindex()
	return s
}

func (s *Store) reindex() {
	s.byEmail = map[string]string{}
	s.byShare = map[string]string{}
	for id, u := range s.Users {
		s.byEmail[u.Email] = id
	}
	for id, t := range s.Trips {
		if t.ShareToken != "" {
			s.byShare[t.ShareToken] = id
		}
	}
}

// byEmailLocked looks up a user id by email without the index (used during seeding).
func (s *Store) byEmailLocked(email string) string {
	for id, u := range s.Users {
		if u.Email == email {
			return id
		}
	}
	return ""
}

// Changed marks the store dirty; must be called with mu held (write).
func (s *Store) Changed() {
	if s.path == "" {
		return
	}
	select {
	case s.dirty <- struct{}{}:
	default:
	}
}

func (s *Store) saver() {
	for range s.dirty {
		time.Sleep(300 * time.Millisecond) // coalesce bursts
		s.mu.RLock()
		b, err := json.Marshal(s)
		s.mu.RUnlock()
		if err != nil {
			log.Printf("store: marshal: %v", err)
			continue
		}
		_ = os.MkdirAll(filepath.Dir(s.path), 0o755)
		tmp := s.path + ".tmp"
		if err := os.WriteFile(tmp, b, 0o600); err == nil {
			_ = os.Rename(tmp, s.path)
		} else {
			log.Printf("store: write: %v", err)
		}
	}
}

func (s *Store) publicUser(id string, withContact bool) *PublicUser {
	u := s.Users[id]
	if u == nil {
		return nil
	}
	// Before a booking is confirmed, others only see a short name and the car
	// model: no surname, phone number or licence plate.
	p := &PublicUser{ID: u.ID, Name: shortName(u.Name), CarModel: u.CarModel}
	if withContact {
		p.Name, p.Phone, p.CarPlate = u.Name, u.Phone, u.CarPlate
	}
	return p
}

// shortName turns "Budi Santoso" into "Budi S.".
func shortName(name string) string {
	parts := strings.Fields(name)
	if len(parts) < 2 {
		return name
	}
	r := []rune(parts[len(parts)-1])
	return parts[0] + " " + string(r[0]) + "."
}

// isParticipant: driver, or passenger with an accepted booking.
func (s *Store) participantRole(t *Trip, uid string) string {
	if t.DriverID == uid {
		return ByDriver
	}
	for _, b := range s.Bookings {
		if b.TripID == t.ID && b.PassengerID == uid && b.Status == BookingAccepted {
			return ByPassenger
		}
	}
	return ""
}

// ---------- live location hub ----------

type LiveHub struct {
	mu        sync.Mutex
	positions map[string]map[string]Position // tripID -> userID -> pos
	subs      map[string]map[chan []byte]struct{}
}

func NewLiveHub() *LiveHub {
	return &LiveHub{
		positions: map[string]map[string]Position{},
		subs:      map[string]map[chan []byte]struct{}{},
	}
}

func (h *LiveHub) Update(tripID string, p Position) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.positions[tripID] == nil {
		h.positions[tripID] = map[string]Position{}
	}
	h.positions[tripID][p.UserID] = p
	msg, _ := json.Marshal(map[string]any{"type": "position", "position": p})
	h.broadcastLocked(tripID, msg)
}

func (h *LiveHub) Event(tripID string, payload map[string]any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	msg, _ := json.Marshal(payload)
	h.broadcastLocked(tripID, msg)
}

func (h *LiveHub) broadcastLocked(tripID string, msg []byte) {
	for ch := range h.subs[tripID] {
		select {
		case ch <- msg:
		default: // slow consumer: drop
		}
	}
}

func (h *LiveHub) Snapshot(tripID string) []Position {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := []Position{}
	for _, p := range h.positions[tripID] {
		out = append(out, p)
	}
	return out
}

func (h *LiveHub) Subscribe(tripID string) chan []byte {
	h.mu.Lock()
	defer h.mu.Unlock()
	ch := make(chan []byte, 32)
	if h.subs[tripID] == nil {
		h.subs[tripID] = map[chan []byte]struct{}{}
	}
	h.subs[tripID][ch] = struct{}{}
	return ch
}

func (h *LiveHub) Unsubscribe(tripID string, ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subs[tripID], ch)
}
