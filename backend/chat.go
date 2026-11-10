package main

import (
	"net/http"
	"sort"
	"strings"
	"time"
)

// Chat between the passenger and the driver of one booking. Available while
// the booking is being negotiated or is confirmed; admins can read every chat.

type MessageView struct {
	Message
	SenderName string `json:"sender_name"`
	Role       string `json:"role"` // driver | passenger
}

func (a *API) messagesFor(b *Booking) []MessageView {
	t := a.store.Trips[b.TripID]
	out := []MessageView{}
	for _, m := range a.store.Messages {
		if m.BookingID != b.ID {
			continue
		}
		role := ByPassenger
		if t != nil && m.SenderID == t.DriverID {
			role = ByDriver
		}
		name := ""
		if u := a.store.Users[m.SenderID]; u != nil {
			name = u.Name
		}
		out = append(out, MessageView{Message: *m, SenderName: name, Role: role})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].At.Before(out[j].At) })
	return out
}

// bookingRole returns driver/passenger for the booking, or "" if uid is neither.
func (a *API) bookingRole(b *Booking, uid string) string {
	if b.PassengerID == uid {
		return ByPassenger
	}
	if t := a.store.Trips[b.TripID]; t != nil && t.DriverID == uid {
		return ByDriver
	}
	return ""
}

func (a *API) listMessages(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	b := s.Bookings[r.PathValue("id")]
	if b == nil {
		return errf(404, "pesanan tidak ditemukan")
	}
	if a.bookingRole(b, uid) == "" && !s.Users[uid].IsAdmin {
		return errf(403, "bukan percakapan Anda")
	}
	writeJSON(w, 200, map[string]any{"booking": a.bookingView(b), "messages": a.messagesFor(b)})
	return nil
}

func (a *API) postMessage(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Text string `json:"text"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	in.Text = strings.TrimSpace(in.Text)
	if in.Text == "" {
		return errf(400, "pesan kosong")
	}
	if len([]rune(in.Text)) > 1000 {
		return errf(400, "pesan maksimal 1000 karakter")
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.Bookings[r.PathValue("id")]
	if b == nil {
		return errf(404, "pesanan tidak ditemukan")
	}
	if a.bookingRole(b, uid) == "" {
		return errf(403, "bukan percakapan Anda")
	}
	if b.Status != BookingNegotiating && b.Status != BookingAccepted {
		return errf(409, "percakapan sudah ditutup karena pesanan %s", b.Status)
	}
	m := &Message{ID: newID("msg"), BookingID: b.ID, SenderID: uid, Text: in.Text, At: time.Now()}
	s.Messages[m.ID] = m
	b.UpdatedAt = m.At
	s.Changed()
	role := a.bookingRole(b, uid)
	if t := s.Trips[b.TripID]; t != nil {
		to := t.DriverID
		if uid == t.DriverID {
			to = b.PassengerID
		}
		if uid != to {
			a.notifyChat(to, b, a.firstName(uid), in.Text)
		}
	}
	a.hub.Event("booking:"+b.ID, map[string]any{"type": "message",
		"message": MessageView{Message: *m, SenderName: s.Users[uid].Name, Role: role}})
	writeJSON(w, 201, a.messagesFor(b))
	return nil
}

// bookingStream pushes new chat messages and booking changes in real time
// (Server-Sent Events). EventSource can't send headers, so the token comes
// as ?token=, which the auth middleware accepts.
func (a *API) bookingStream(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	b := s.Bookings[r.PathValue("id")]
	allowed := b != nil && (a.bookingRole(b, uid) != "" || s.Users[uid].IsAdmin)
	s.mu.RUnlock()
	if b == nil {
		return errf(404, "pesanan tidak ditemukan")
	}
	if !allowed {
		return errf(403, "bukan percakapan Anda")
	}
	return a.streamSSE(w, r, "booking:"+b.ID, map[string]any{"type": "ready"})
}

// messageStats: count and last time, for list views. Caller holds a lock.
func (a *API) messageStats(bookingID string) (int, *time.Time) {
	n := 0
	var last *time.Time
	for _, m := range a.store.Messages {
		if m.BookingID == bookingID {
			n++
			if last == nil || m.At.After(*last) {
				at := m.At
				last = &at
			}
		}
	}
	return n, last
}
