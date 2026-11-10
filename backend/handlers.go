package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/mail"
	"sort"
	"strconv"
	"strings"
	"time"
)

type API struct {
	store  *Store
	hub    *LiveHub
	signer Signer
	loc    *time.Location
}

// ---------- helpers ----------

type apiError struct {
	status int
	msg    string
}

func (e apiError) Error() string { return e.msg }

func errf(status int, format string, a ...any) error {
	return apiError{status, fmt.Sprintf(format, a...)}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, err error) {
	var ae apiError
	if errors.As(err, &ae) {
		writeJSON(w, ae.status, map[string]string{"error": ae.msg})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
}

func readJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	if err := dec.Decode(v); err != nil {
		return errf(400, "body JSON tidak valid: %v", err)
	}
	return nil
}

type handlerFunc func(w http.ResponseWriter, r *http.Request) error
type authedFunc func(w http.ResponseWriter, r *http.Request, uid string) error

func (a *API) h(fn handlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := fn(w, r); err != nil {
			writeErr(w, err)
		}
	}
}

func (a *API) auth(fn authedFunc) http.HandlerFunc {
	return a.h(func(w http.ResponseWriter, r *http.Request) error {
		tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if tok == "" {
			tok = r.URL.Query().Get("token")
		}
		uid, err := a.signer.Verify(tok)
		if err != nil {
			return errf(401, "%s", err.Error())
		}
		a.store.mu.RLock()
		_, ok := a.store.Users[uid]
		a.store.mu.RUnlock()
		if !ok {
			return errf(401, "akun tidak ditemukan")
		}
		return fn(w, r, uid)
	})
}

func validPoint(p Point) bool {
	return p.Lat >= -90 && p.Lat <= 90 && p.Lng >= -180 && p.Lng <= 180 && !(p.Lat == 0 && p.Lng == 0)
}

func qFloat(r *http.Request, key string) (float64, bool) {
	v := r.URL.Query().Get(key)
	if v == "" {
		return 0, false
	}
	f, err := strconv.ParseFloat(v, 64)
	return f, err == nil
}

func qPoint(r *http.Request, prefix string) *Point {
	lat, ok1 := qFloat(r, prefix+"_lat")
	lng, ok2 := qFloat(r, prefix+"_lng")
	if !ok1 || !ok2 {
		return nil
	}
	return &Point{Lat: lat, Lng: lng}
}

// qRadii returns the pickup and drop-off search radii (km). Each can be set
// separately with from_radius_km / to_radius_km; radius_km is the fallback.
func qRadii(r *http.Request) (float64, float64) {
	clamp := func(v float64, ok bool, def float64) float64 {
		if !ok || v <= 0 {
			return def
		}
		return math.Min(v, 300)
	}
	bv, bok := qFloat(r, "radius_km")
	base := clamp(bv, bok, 10)
	f, okF := qFloat(r, "from_radius_km")
	t, okT := qFloat(r, "to_radius_km")
	return clamp(f, okF, base), clamp(t, okT, base)
}

func routeKm(route []Point) float64 {
	d := 0.0
	for i := 0; i+1 < len(route); i++ {
		d += HaversineKm(route[i], route[i+1])
	}
	return d
}

// ---------- views ----------

type TripView struct {
	Trip
	Driver           *PublicUser    `json:"driver"`
	SeatsAvailable   int            `json:"seats_available"`
	LuggageAvailable int            `json:"luggage_available"`
	DistanceKm       float64        `json:"distance_km"`
	PickupDistKm     *float64       `json:"pickup_dist_km,omitempty"`
	DropoffDistKm    *float64       `json:"dropoff_dist_km,omitempty"`
	MyRole           string         `json:"my_role,omitempty"`
	Etas             []time.Time    `json:"etas"`
	Quote            *Quote         `json:"quote,omitempty"`
	Bookings         []*BookingView `json:"bookings,omitempty"`
	MyBookings       []*BookingView `json:"my_bookings,omitempty"`
	Participants     []Participant  `json:"participants,omitempty"`
}

type BookingView struct {
	Booking
	Trip      *TripSummary `json:"trip"`
	Passenger *PublicUser  `json:"passenger"`
	Driver    *PublicUser  `json:"driver"`
	Awaiting  string       `json:"awaiting,omitempty"` // whose turn: driver|passenger
	Messages  int          `json:"message_count"`
}

// Participant is someone confirmed on a trip. Only other confirmed
// participants (and the driver) receive this list, phone numbers included.
type Participant struct {
	User     *PublicUser `json:"user"`
	Role     string      `json:"role"`
	Seats    int         `json:"seats,omitempty"`
	Luggage  int         `json:"luggage,omitempty"`
	Pickup   *Point      `json:"pickup,omitempty"`
	Dropoff  *Point      `json:"dropoff,omitempty"`
	PickupAt *time.Time  `json:"pickup_at,omitempty"`
}

// cleanPoint trims user-written text on a point.
func cleanPoint(p *Point) {
	if p == nil {
		return
	}
	trim := func(s string, n int) string {
		s = strings.TrimSpace(s)
		if r := []rune(s); len(r) > n {
			return string(r[:n])
		}
		return s
	}
	p.Label = trim(p.Label, 200)
	p.Note = trim(p.Note, 200)
}

// Quote is the price and availability for one passenger's part of a route.
type Quote struct {
	Span
	PricePerSeat     int64     `json:"price_per_seat"`
	SeatsAvailable   int       `json:"seats_available"`
	LuggageAvailable int       `json:"luggage_available"`
	PickupAt         time.Time `json:"pickup_at"`
	DropoffAt        time.Time `json:"dropoff_at"`
}

// quote for riding from `from` to `to` (nil = trip origin / destination). Caller holds a lock.
func (a *API) quote(t *Trip, from, to *Point) *Quote {
	sp := fullSpan(t)
	if from != nil || to != nil {
		p, d := t.Origin, t.Destination
		if from != nil {
			p = *from
		}
		if to != nil {
			d = *to
		}
		sp = spanFor(t, p, d)
	}
	seats, lug := a.store.available(t, sp)
	return &Quote{Span: sp, PricePerSeat: pricePerSeat(t, sp), SeatsAvailable: seats, LuggageAvailable: lug,
		PickupAt: etaAt(t, sp.FromPos), DropoffAt: etaAt(t, sp.ToPos)}
}

// checkCapacity: caller holds the lock.
func (a *API) checkCapacity(t *Trip, sp Span, seats, luggage int) error {
	if luggage < 0 || seats < 1 {
		return errf(400, "jumlah penumpang atau koper tidak valid")
	}
	availS, availL := a.store.available(t, sp)
	if seats > availS {
		return errf(409, "kursi tersisa di rute Anda hanya %d", max(0, availS))
	}
	if luggage > 0 && !t.Luggage {
		return errf(409, "trip ini tidak menerima koper")
	}
	if luggage > availL {
		return errf(409, "sisa tempat koper di rute Anda hanya %d", max(0, availL))
	}
	return nil
}

type TripSummary struct {
	ID             string      `json:"id"`
	Origin         Point       `json:"origin"`
	Destination    Point       `json:"destination"`
	DepartAt       time.Time   `json:"depart_at"`
	Stops          []Point     `json:"stops"`
	Status         string      `json:"status"`
	Kind           string      `json:"kind"`
	PricePerSeat   int64       `json:"price_per_seat"`
	Luggage        bool        `json:"luggage"`
	MaxLuggage     int         `json:"max_luggage"`
	Seats          int         `json:"seats"`
	SegmentPrices  []int64     `json:"segment_prices"`
	Negotiable     bool        `json:"negotiable"`
	InstantBooking bool        `json:"instant_booking"`
	Amenities      Amenities   `json:"amenities"`
	Vehicle        string      `json:"vehicle"`
	Etas           []time.Time `json:"etas"`
}

type RequestView struct {
	RideRequest
	Passenger     *PublicUser    `json:"passenger"`
	DistanceKm    float64        `json:"distance_km"`
	PickupDistKm  *float64       `json:"pickup_dist_km,omitempty"`
	DropoffDistKm *float64       `json:"dropoff_dist_km,omitempty"`
	Quote         *Quote         `json:"quote,omitempty"` // price on the driver's selected trip
	Offers        []*BookingView `json:"offers,omitempty"`
}

// caller must hold read lock
func (a *API) tripView(t *Trip, viewer string) *TripView {
	role := a.store.participantRole(t, viewer)
	seats, lug := a.store.available(t, fullSpan(t))
	tv := &TripView{
		Trip:             *t,
		Driver:           a.store.publicUser(t.DriverID, role != ""),
		SeatsAvailable:   seats,
		LuggageAvailable: lug,
		DistanceKm:       round1(routeKm(t.Route())),
		MyRole:           role,
		Etas:             etas(t),
	}
	if role == "" {
		tv.ShareToken = ""
	}
	if viewer != "" {
		for _, b := range a.store.Bookings {
			if b.TripID != t.ID {
				continue
			}
			if t.DriverID == viewer {
				tv.Bookings = append(tv.Bookings, a.bookingView(b))
			} else if b.PassengerID == viewer {
				tv.MyBookings = append(tv.MyBookings, a.bookingView(b))
			}
		}
		sortBookings(tv.Bookings)
		sortBookings(tv.MyBookings)
	}
	if role != "" {
		tv.Participants = a.participants(t)
	}
	return tv
}

// participants: the driver and every passenger with a confirmed booking. Caller holds a lock.
func (a *API) participants(t *Trip) []Participant {
	out := []Participant{{User: a.store.publicUser(t.DriverID, true), Role: ByDriver}}
	var bs []*Booking
	for _, b := range a.store.Bookings {
		if b.TripID == t.ID && b.Status == BookingAccepted {
			bs = append(bs, b)
		}
	}
	sort.Slice(bs, func(i, j int) bool { return bs[i].FromPos < bs[j].FromPos })
	for _, b := range bs {
		p, d, at := b.Pickup, b.Dropoff, b.PickupAt
		out = append(out, Participant{User: a.store.publicUser(b.PassengerID, true), Role: ByPassenger,
			Seats: b.Seats, Luggage: b.Luggage, Pickup: &p, Dropoff: &d, PickupAt: &at})
	}
	return out
}

func sortBookings(bs []*BookingView) {
	sort.Slice(bs, func(i, j int) bool { return bs[i].UpdatedAt.After(bs[j].UpdatedAt) })
}

func (a *API) bookingView(b *Booking) *BookingView {
	t := a.store.Trips[b.TripID]
	accepted := b.Status == BookingAccepted
	bv := &BookingView{
		Booking:   *b,
		Passenger: a.store.publicUser(b.PassengerID, accepted),
		Driver:    a.store.publicUser(t.DriverID, accepted),
		Trip:      tripSummary(t),
	}
	bv.Messages, _ = a.messageStats(b.ID)
	if b.Status == BookingNegotiating {
		if lo := b.LastOffer(); lo != nil {
			if lo.By == ByDriver {
				bv.Awaiting = ByPassenger
			} else {
				bv.Awaiting = ByDriver
			}
		}
	}
	return bv
}

func tripSummary(t *Trip) *TripSummary {
	return &TripSummary{ID: t.ID, Origin: t.Origin, Destination: t.Destination, Stops: t.Stops, DepartAt: t.DepartAt,
		Status: t.Status, Kind: t.Kind, PricePerSeat: t.PricePerSeat, Negotiable: t.Negotiable, Vehicle: t.Vehicle,
		Luggage: t.Luggage, MaxLuggage: t.MaxLuggage, Seats: t.Seats, SegmentPrices: t.SegmentPrices,
		InstantBooking: t.InstantBooking, Amenities: t.Amenities, Etas: etas(t)}
}

func round1(f float64) float64 { return float64(int64(f*10+0.5)) / 10 }

// ---------- auth ----------

func (a *API) register(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return errf(400, "nama wajib diisi")
	}
	if _, err := mail.ParseAddress(in.Email); err != nil {
		return errf(400, "email tidak valid")
	}
	if len(in.Password) < 6 {
		return errf(400, "password minimal 6 karakter")
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.byEmail[in.Email]; exists {
		return errf(409, "email sudah terdaftar")
	}
	salt := randomToken(16)
	u := &User{ID: newID("usr"), Name: in.Name, Email: in.Email, Phone: strings.TrimSpace(in.Phone),
		Salt: salt, PassHash: hashPassword(in.Password, salt), CreatedAt: time.Now()}
	s.Users[u.ID] = u
	s.byEmail[u.Email] = u.ID
	s.Changed()
	writeJSON(w, 201, a.session(u))
	return nil
}

func (a *API) login(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	u := s.Users[s.byEmail[strings.ToLower(strings.TrimSpace(in.Email))]]
	if u == nil || !checkPassword(u, in.Password) {
		return errf(401, "email atau password salah")
	}
	writeJSON(w, 200, a.session(u))
	return nil
}

func (a *API) session(u *User) map[string]any {
	return map[string]any{"token": a.signer.Issue(u.ID, 30*24*time.Hour), "user": selfView(u)}
}

func selfView(u *User) User {
	c := *u
	c.PassHash, c.Salt = "", ""
	return c
}

func (a *API) me(w http.ResponseWriter, r *http.Request, uid string) error {
	a.store.mu.RLock()
	defer a.store.mu.RUnlock()
	writeJSON(w, 200, selfView(a.store.Users[uid]))
	return nil
}

func (a *API) updateMe(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Name     *string `json:"name"`
		Phone    *string `json:"phone"`
		CarModel *string `json:"car_model"`
		CarPlate *string `json:"car_plate"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	u := s.Users[uid]
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		u.Name = strings.TrimSpace(*in.Name)
	}
	if in.Phone != nil {
		u.Phone = strings.TrimSpace(*in.Phone)
	}
	if in.CarModel != nil {
		u.CarModel = strings.TrimSpace(*in.CarModel)
	}
	if in.CarPlate != nil {
		u.CarPlate = strings.ToUpper(strings.TrimSpace(*in.CarPlate))
	}
	s.Changed()
	writeJSON(w, 200, selfView(u))
	return nil
}

// ---------- trips ----------

func (a *API) optionalUID(r *http.Request) string {
	tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	uid, _ := a.signer.Verify(tok)
	return uid
}

func (a *API) searchTrips(w http.ResponseWriter, r *http.Request) error {
	viewer := a.optionalUID(r)
	from, to := qPoint(r, "from"), qPoint(r, "to")
	rFrom, rTo := qRadii(r)
	kind := r.URL.Query().Get("kind")
	luggage, _ := strconv.Atoi(r.URL.Query().Get("luggage"))
	seats, _ := strconv.Atoi(r.URL.Query().Get("seats"))
	if seats < 1 {
		seats = 1
	}
	q := r.URL.Query()
	want := func(k string) bool { return q.Get(k) == "1" || q.Get(k) == "true" }
	orderBy := q.Get("order_by")
	var day *time.Time
	if d := r.URL.Query().Get("date"); d != "" {
		t, err := time.ParseInLocation("2006-01-02", d, a.loc)
		if err != nil {
			return errf(400, "format tanggal harus YYYY-MM-DD")
		}
		day = &t
	}
	now := time.Now()
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*TripView{}
	for _, t := range s.Trips {
		if t.Status != TripScheduled || t.DepartAt.Before(now.Add(-time.Hour)) {
			continue
		}
		if kind != "" && t.Kind != kind {
			continue
		}
		if day != nil {
			d := t.DepartAt.In(a.loc)
			if d.Year() != day.Year() || d.YearDay() != day.YearDay() {
				continue
			}
		}
		ok, dFrom, dTo := RouteMatch(t.Route(), from, to, rFrom, rTo)
		if !ok {
			continue
		}
		am := t.Amenities
		if (want("pets") && !am.Pets) || (want("smoking") && !am.Smoking) || (want("baby_seat") && !am.BabySeat) ||
			(want("parcel") && !am.Parcel) || (want("cargo") && !am.Cargo) || (want("max2_back") && !am.Max2Back) ||
			(want("instant") && !t.InstantBooking) {
			continue
		}
		tv := a.tripView(t, viewer)
		tv.Quote = a.quote(t, from, to)
		if tv.Quote.SeatsAvailable < seats {
			continue
		}
		if luggage > 0 && (!t.Luggage || tv.Quote.LuggageAvailable < luggage) {
			continue
		}
		if from != nil {
			v := round1(dFrom)
			tv.PickupDistKm = &v
		}
		if to != nil {
			v := round1(dTo)
			tv.DropoffDistKm = &v
		}
		tv.Bookings, tv.MyBookings = nil, nil
		out = append(out, tv)
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		switch orderBy {
		case "cheapest":
			if a.Quote.PricePerSeat != b.Quote.PricePerSeat {
				return a.Quote.PricePerSeat < b.Quote.PricePerSeat
			}
		case "nearest_pickup":
			if a.PickupDistKm != nil && b.PickupDistKm != nil && *a.PickupDistKm != *b.PickupDistKm {
				return *a.PickupDistKm < *b.PickupDistKm
			}
		case "nearest_dropoff":
			if a.DropoffDistKm != nil && b.DropoffDistKm != nil && *a.DropoffDistKm != *b.DropoffDistKm {
				return *a.DropoffDistKm < *b.DropoffDistKm
			}
		}
		return a.Quote.PickupAt.Before(b.Quote.PickupAt)
	})
	writeJSON(w, 200, out)
	return nil
}

type tripInput struct {
	Origin         Point     `json:"origin"`
	Destination    Point     `json:"destination"`
	Stops          []Point   `json:"stops"`
	DepartAt       time.Time `json:"depart_at"`
	Seats          int       `json:"seats"`
	Luggage        bool      `json:"luggage"`
	MaxLuggage     int       `json:"max_luggage"`
	PricePerSeat   int64     `json:"price_per_seat"`
	SegmentPrices  []int64   `json:"segment_prices"`
	Negotiable     bool      `json:"negotiable"`
	InstantBooking bool      `json:"instant_booking"`
	Amenities      Amenities `json:"amenities"`
	Kind           string    `json:"kind"`
	Vehicle        string    `json:"vehicle"`
	Notes          string    `json:"notes"`
}

func (a *API) createTrip(w http.ResponseWriter, r *http.Request, uid string) error {
	var in tripInput
	if err := readJSON(r, &in); err != nil {
		return err
	}
	cleanPoint(&in.Origin)
	cleanPoint(&in.Destination)
	for i := range in.Stops {
		cleanPoint(&in.Stops[i])
	}
	if !validPoint(in.Origin) || !validPoint(in.Destination) {
		return errf(400, "titik asal dan tujuan wajib dipilih")
	}
	if HaversineKm(in.Origin, in.Destination) < 0.3 {
		return errf(400, "asal dan tujuan terlalu dekat")
	}
	if in.DepartAt.Before(time.Now().Add(-10 * time.Minute)) {
		return errf(400, "waktu berangkat harus di masa depan")
	}
	if in.Seats < 1 || in.Seats > 8 {
		return errf(400, "maksimal penumpang 1–8 orang")
	}
	if len(in.Stops) > 10 {
		return errf(400, "maksimal 10 titik stop")
	}
	for _, st := range in.Stops {
		if !validPoint(st) {
			return errf(400, "titik stop tidak valid")
		}
	}
	if in.Stops == nil {
		in.Stops = []Point{}
	}
	if !in.Luggage {
		in.MaxLuggage = 0
	} else if in.MaxLuggage < 1 || in.MaxLuggage > 20 {
		return errf(400, "jumlah koper 1–20")
	}
	if in.PricePerSeat < 0 {
		return errf(400, "harga tidak valid")
	}
	nseg := len(in.Stops) + 1
	if len(in.SegmentPrices) > 0 && len(in.SegmentPrices) != nseg {
		return errf(400, "harga per segmen harus %d angka (satu untuk tiap ruas rute)", nseg)
	}
	for _, p := range in.SegmentPrices {
		if p < 0 || p > 10_000_000 {
			return errf(400, "harga segmen tidak valid")
		}
	}
	if in.Kind != KindInter && in.Kind != KindIntra {
		in.Kind = AutoKind(in.Origin, in.Destination)
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	u := s.Users[uid]
	if in.Vehicle == "" {
		in.Vehicle = strings.TrimSpace(u.CarModel + " " + u.CarPlate)
	}
	t := &Trip{ID: newID("trp"), DriverID: uid, Origin: in.Origin, Destination: in.Destination,
		Stops: in.Stops, Luggage: in.Luggage, MaxLuggage: in.MaxLuggage, SegmentPrices: in.SegmentPrices,
		DepartAt: in.DepartAt, Seats: in.Seats, PricePerSeat: in.PricePerSeat, Negotiable: in.Negotiable,
		InstantBooking: in.InstantBooking, Amenities: in.Amenities,
		Kind: in.Kind, Vehicle: in.Vehicle, Notes: in.Notes, Status: TripScheduled, CreatedAt: time.Now()}
	normalizeTrip(t)
	s.Trips[t.ID] = t
	s.Changed()
	writeJSON(w, 201, a.tripView(t, uid))
	return nil
}

func (a *API) getTrip(w http.ResponseWriter, r *http.Request) error {
	viewer := a.optionalUID(r)
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	t := s.Trips[r.PathValue("id")]
	if t == nil {
		return errf(404, "trip tidak ditemukan")
	}
	tv := a.tripView(t, viewer)
	tv.Quote = a.quote(t, qPoint(r, "from"), qPoint(r, "to"))
	writeJSON(w, 200, tv)
	return nil
}

func (a *API) tripStatus(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Action string `json:"action"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	t := s.Trips[r.PathValue("id")]
	if t == nil {
		return errf(404, "trip tidak ditemukan")
	}
	if t.DriverID != uid {
		return errf(403, "hanya driver yang bisa mengubah status trip")
	}
	now := time.Now()
	switch in.Action {
	case "start":
		if t.Status != TripScheduled {
			return errf(409, "trip tidak bisa dimulai dari status %s", t.Status)
		}
		t.Status, t.StartedAt = TripOngoing, &now
		a.ensureShare(t)
	case "complete":
		if t.Status != TripOngoing {
			return errf(409, "trip harus berjalan sebelum diselesaikan")
		}
		t.Status, t.CompletedAt = TripCompleted, &now
	case "cancel":
		if t.Status != TripScheduled {
			return errf(409, "hanya trip terjadwal yang bisa dibatalkan")
		}
		t.Status = TripCancelled
		for _, b := range s.Bookings {
			if b.TripID == t.ID && (b.Status == BookingNegotiating || b.Status == BookingAccepted) {
				b.Status, b.UpdatedAt = BookingCancelled, now
				a.reopenRequest(b)
			}
		}
	default:
		return errf(400, "action harus start, complete, atau cancel")
	}
	s.Changed()
	a.hub.Event(t.ID, map[string]any{"type": "status", "status": t.Status})
	writeJSON(w, 200, a.tripView(t, uid))
	return nil
}

func (a *API) ensureShare(t *Trip) {
	if t.ShareToken == "" {
		t.ShareToken = randomToken(12)
		a.store.byShare[t.ShareToken] = t.ID
	}
}

// ---------- bookings & negotiation ----------

func (a *API) createBooking(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Pickup  *Point `json:"pickup"`
		Dropoff *Point `json:"dropoff"`
		Seats   int    `json:"seats"`
		Luggage int    `json:"luggage"`
		Price   int64  `json:"price"`
		Message string `json:"message"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	t := s.Trips[r.PathValue("id")]
	if t == nil {
		return errf(404, "trip tidak ditemukan")
	}
	if t.DriverID == uid {
		return errf(400, "tidak bisa memesan trip sendiri")
	}
	if t.Status != TripScheduled {
		return errf(409, "trip sudah tidak menerima penumpang")
	}
	if in.Seats < 1 {
		in.Seats = 1
	}
	for _, b := range s.Bookings {
		if b.TripID == t.ID && b.PassengerID == uid && (b.Status == BookingNegotiating || b.Status == BookingAccepted) {
			return errf(409, "Anda sudah punya pesanan aktif di trip ini")
		}
	}
	cleanPoint(in.Pickup)
	cleanPoint(in.Dropoff)
	pickup, dropoff := t.Origin, t.Destination
	if in.Pickup != nil && validPoint(*in.Pickup) {
		pickup = *in.Pickup
	}
	if in.Dropoff != nil && validPoint(*in.Dropoff) {
		dropoff = *in.Dropoff
	}
	sp := spanFor(t, pickup, dropoff)
	if err := a.checkCapacity(t, sp, in.Seats, in.Luggage); err != nil {
		return err
	}
	listPrice := pricePerSeat(t, sp) * int64(in.Seats)
	if in.Price <= 0 || !t.Negotiable {
		in.Price = listPrice
	}
	now := time.Now()
	b := &Booking{ID: newID("bkg"), TripID: t.ID, PassengerID: uid, Source: SourcePassenger,
		Pickup: pickup, Dropoff: dropoff, Seats: in.Seats, Luggage: in.Luggage, Status: BookingNegotiating,
		SegStart: sp.Start, SegEnd: sp.End, FromPos: sp.FromPos, ToPos: sp.ToPos, ListPrice: listPrice,
		PickupAt:  etaAt(t, sp.FromPos),
		Offers:    []Offer{{By: ByPassenger, Price: in.Price, Message: in.Message, At: now}},
		CreatedAt: now, UpdatedAt: now}
	// Instant booking: paying the driver's price confirms the seat right away.
	if t.InstantBooking && in.Price >= listPrice {
		b.Status, b.AgreedPrice = BookingAccepted, in.Price
	}
	s.Bookings[b.ID] = b
	s.Changed()
	writeJSON(w, 201, a.bookingView(b))
	return nil
}

func (a *API) respondBooking(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Action  string `json:"action"` // accept | counter | reject | cancel
		Price   int64  `json:"price"`
		Message string `json:"message"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.Bookings[r.PathValue("id")]
	if b == nil {
		return errf(404, "pesanan tidak ditemukan")
	}
	t := s.Trips[b.TripID]
	var role string
	switch uid {
	case b.PassengerID:
		role = ByPassenger
	case t.DriverID:
		role = ByDriver
	default:
		return errf(403, "bukan pesanan Anda")
	}
	last := b.LastOffer()
	now := time.Now()
	myTurn := last != nil && last.By != role

	switch in.Action {
	case "cancel":
		if b.Status != BookingNegotiating && b.Status != BookingAccepted {
			return errf(409, "pesanan sudah %s", b.Status)
		}
		if t.Status == TripCompleted {
			return errf(409, "trip sudah selesai")
		}
		b.Status = BookingCancelled
		a.reopenRequest(b)
	case "reject":
		if b.Status != BookingNegotiating {
			return errf(409, "pesanan tidak sedang dinegosiasikan")
		}
		b.Status = BookingRejected // a rejected driver offer leaves the ride request open
	case "accept":
		if b.Status != BookingNegotiating {
			return errf(409, "pesanan tidak sedang dinegosiasikan")
		}
		if !myTurn {
			return errf(409, "menunggu respon pihak lain")
		}
		if t.Status != TripScheduled && t.Status != TripOngoing {
			return errf(409, "trip sudah %s", t.Status)
		}
		if err := a.checkCapacity(t, Span{FromPos: b.FromPos, ToPos: b.ToPos, Start: b.SegStart, End: b.SegEnd}, b.Seats, b.Luggage); err != nil {
			return err
		}
		b.Status, b.AgreedPrice = BookingAccepted, last.Price
		if b.RequestID != "" {
			if req := s.Requests[b.RequestID]; req != nil {
				req.Status = RequestMatched
			}
			for _, other := range s.Bookings {
				if other.ID != b.ID && other.RequestID == b.RequestID && other.Status == BookingNegotiating {
					other.Status, other.UpdatedAt = BookingRejected, now
				}
			}
		}
	case "counter":
		if b.Status != BookingNegotiating {
			return errf(409, "pesanan tidak sedang dinegosiasikan")
		}
		if !myTurn {
			return errf(409, "menunggu respon pihak lain")
		}
		if !t.Negotiable && b.Source == SourcePassenger && role == ByPassenger {
			return errf(409, "harga trip ini tidak bisa ditawar")
		}
		if in.Price <= 0 {
			return errf(400, "harga tawaran wajib diisi")
		}
		if len(b.Offers) >= 20 {
			return errf(409, "batas negosiasi tercapai")
		}
		b.Offers = append(b.Offers, Offer{By: role, Price: in.Price, Message: in.Message, At: now})
	default:
		return errf(400, "action harus accept, counter, reject, atau cancel")
	}
	b.UpdatedAt = now
	s.Changed()
	writeJSON(w, 200, a.bookingView(b))
	return nil
}

func (a *API) reopenRequest(b *Booking) {
	if b.RequestID == "" {
		return
	}
	if req := a.store.Requests[b.RequestID]; req != nil && req.Status == RequestMatched {
		req.Status = RequestOpen
	}
}

// ---------- ride requests (passenger posts, driver offers) ----------

func (a *API) createRequest(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Origin      Point     `json:"origin"`
		Destination Point     `json:"destination"`
		DepartAt    time.Time `json:"depart_at"`
		Seats       int       `json:"seats"`
		Luggage     int       `json:"luggage"`
		Budget      int64     `json:"budget"`
		Notes       string    `json:"notes"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	cleanPoint(&in.Origin)
	cleanPoint(&in.Destination)
	if !validPoint(in.Origin) || !validPoint(in.Destination) {
		return errf(400, "titik jemput dan antar wajib dipilih")
	}
	if in.DepartAt.Before(time.Now().Add(-10 * time.Minute)) {
		return errf(400, "waktu berangkat harus di masa depan")
	}
	if in.Seats < 1 {
		in.Seats = 1
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	req := &RideRequest{ID: newID("req"), PassengerID: uid, Origin: in.Origin, Destination: in.Destination,
		DepartAt: in.DepartAt, Seats: in.Seats, Luggage: max(0, in.Luggage), Budget: in.Budget, Notes: in.Notes, Status: RequestOpen, CreatedAt: time.Now()}
	s.Requests[req.ID] = req
	s.Changed()
	writeJSON(w, 201, a.requestView(req, uid))
	return nil
}

func (a *API) requestView(req *RideRequest, viewer string) *RequestView {
	rv := &RequestView{RideRequest: *req, Passenger: a.store.publicUser(req.PassengerID, false),
		DistanceKm: round1(HaversineKm(req.Origin, req.Destination))}
	for _, b := range a.store.Bookings {
		if b.RequestID != req.ID {
			continue
		}
		t := a.store.Trips[b.TripID]
		if viewer == req.PassengerID || (t != nil && t.DriverID == viewer) {
			rv.Offers = append(rv.Offers, a.bookingView(b))
		}
	}
	sortBookings(rv.Offers)
	return rv
}

func (a *API) listRequests(w http.ResponseWriter, r *http.Request, uid string) error {
	from, to := qPoint(r, "from"), qPoint(r, "to")
	rFrom, rTo := qRadii(r)
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	var trip *Trip
	if id := r.URL.Query().Get("trip_id"); id != "" {
		trip = s.Trips[id]
		if trip == nil || trip.DriverID != uid {
			return errf(404, "trip tidak ditemukan")
		}
	}
	now := time.Now()
	out := []*RequestView{}
	for _, req := range s.Requests {
		if req.Status != RequestOpen || req.PassengerID == uid || req.DepartAt.Before(now.Add(-time.Hour)) {
			continue
		}
		var dFrom, dTo float64
		if trip != nil {
			ok, df, dt := RouteMatch(trip.Route(), &req.Origin, &req.Destination, rFrom, rTo)
			if !ok {
				continue
			}
			dFrom, dTo = df, dt
		} else {
			if from != nil {
				if dFrom = HaversineKm(*from, req.Origin); dFrom > rFrom {
					continue
				}
			}
			if to != nil {
				if dTo = HaversineKm(*to, req.Destination); dTo > rTo {
					continue
				}
			}
		}
		rv := a.requestView(req, uid)
		if trip != nil {
			rv.Quote = a.quote(trip, &req.Origin, &req.Destination)
		}
		if trip != nil || from != nil {
			v := round1(dFrom)
			rv.PickupDistKm = &v
		}
		if trip != nil || to != nil {
			v := round1(dTo)
			rv.DropoffDistKm = &v
		}
		out = append(out, rv)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DepartAt.Before(out[j].DepartAt) })
	writeJSON(w, 200, out)
	return nil
}

func (a *API) offerOnRequest(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		TripID      string     `json:"trip_id"`
		Price       int64      `json:"price"`
		Message     string     `json:"message"`
		OfferedTime *time.Time `json:"offered_time"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	req := s.Requests[r.PathValue("id")]
	if req == nil {
		return errf(404, "permintaan tidak ditemukan")
	}
	if req.Status != RequestOpen {
		return errf(409, "permintaan sudah tidak terbuka")
	}
	if req.PassengerID == uid {
		return errf(400, "tidak bisa menawari permintaan sendiri")
	}
	if in.TripID == "" {
		return errf(400, "pilih trip Anda dulu (buat trip jika belum ada)")
	}
	t := s.Trips[in.TripID]
	if t == nil || t.DriverID != uid {
		return errf(404, "trip tidak ditemukan")
	}
	if t.Status != TripScheduled {
		return errf(409, "trip harus berstatus terjadwal")
	}
	sp := spanFor(t, req.Origin, req.Destination)
	if err := a.checkCapacity(t, sp, req.Seats, req.Luggage); err != nil {
		return err
	}
	for _, b := range s.Bookings {
		if b.RequestID == req.ID && b.TripID == t.ID && b.Status == BookingNegotiating {
			return errf(409, "Anda sudah menawarkan trip ini")
		}
	}
	listPrice := pricePerSeat(t, sp) * int64(req.Seats)
	if in.Price <= 0 {
		in.Price = listPrice
	}
	pickupAt := etaAt(t, sp.FromPos)
	if in.OfferedTime != nil && !in.OfferedTime.IsZero() {
		pickupAt = *in.OfferedTime
	}
	now := time.Now()
	b := &Booking{ID: newID("bkg"), TripID: t.ID, PassengerID: req.PassengerID, RequestID: req.ID,
		Source: SourceDriverOffer, Pickup: req.Origin, Dropoff: req.Destination, Seats: req.Seats, Luggage: req.Luggage,
		SegStart: sp.Start, SegEnd: sp.End, FromPos: sp.FromPos, ToPos: sp.ToPos, ListPrice: listPrice,
		PickupAt: pickupAt, OfferedTime: in.OfferedTime,
		Status:    BookingNegotiating,
		Offers:    []Offer{{By: ByDriver, Price: in.Price, Message: in.Message, At: now}},
		CreatedAt: now, UpdatedAt: now}
	s.Bookings[b.ID] = b
	s.Changed()
	writeJSON(w, 201, a.bookingView(b))
	return nil
}

func (a *API) cancelRequest(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	req := s.Requests[r.PathValue("id")]
	if req == nil || req.PassengerID != uid {
		return errf(404, "permintaan tidak ditemukan")
	}
	if req.Status != RequestOpen {
		return errf(409, "permintaan sudah %s", req.Status)
	}
	req.Status = RequestCancelled
	now := time.Now()
	for _, b := range s.Bookings {
		if b.RequestID == req.ID && b.Status == BookingNegotiating {
			b.Status, b.UpdatedAt = BookingCancelled, now
		}
	}
	s.Changed()
	writeJSON(w, 200, a.requestView(req, uid))
	return nil
}

// ---------- "my" dashboards ----------

func (a *API) myTrips(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*TripView{}
	for _, t := range s.Trips {
		if t.DriverID == uid {
			out = append(out, a.tripView(t, uid))
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DepartAt.After(out[j].DepartAt) })
	writeJSON(w, 200, out)
	return nil
}

func (a *API) myBookings(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*BookingView{}
	for _, b := range s.Bookings {
		if b.PassengerID == uid {
			out = append(out, a.bookingView(b))
		}
	}
	sortBookings(out)
	writeJSON(w, 200, out)
	return nil
}

func (a *API) myRequests(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*RequestView{}
	for _, req := range s.Requests {
		if req.PassengerID == uid {
			out = append(out, a.requestView(req, uid))
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	writeJSON(w, 200, out)
	return nil
}

// ---------- live sharing ----------

func (a *API) shareLink(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	t := s.Trips[r.PathValue("id")]
	if t == nil {
		return errf(404, "trip tidak ditemukan")
	}
	if s.participantRole(t, uid) == "" {
		return errf(403, "hanya driver/penumpang trip ini yang bisa membagikan lokasi")
	}
	if t.ShareToken == "" {
		a.ensureShare(t)
		s.Changed()
	}
	writeJSON(w, 200, map[string]string{"share_token": t.ShareToken})
	return nil
}

func (a *API) postLocation(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Lat     float64 `json:"lat"`
		Lng     float64 `json:"lng"`
		Heading float64 `json:"heading"`
		Speed   float64 `json:"speed"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	if !validPoint(Point{Lat: in.Lat, Lng: in.Lng}) {
		return errf(400, "koordinat tidak valid")
	}
	s := a.store
	s.mu.RLock()
	t := s.Trips[r.PathValue("id")]
	if t == nil {
		s.mu.RUnlock()
		return errf(404, "trip tidak ditemukan")
	}
	role := s.participantRole(t, uid)
	status := t.Status
	name := s.Users[uid].Name
	s.mu.RUnlock()
	if role == "" {
		return errf(403, "bukan peserta trip ini")
	}
	if status == TripCompleted || status == TripCancelled {
		return errf(409, "trip sudah %s, live sharing berhenti", status)
	}
	a.hub.Update(t.ID, Position{UserID: uid, Name: name, Role: role, Lat: in.Lat, Lng: in.Lng,
		Heading: in.Heading, Speed: in.Speed, At: time.Now()})
	writeJSON(w, 200, map[string]bool{"ok": true})
	return nil
}

type liveSnapshot struct {
	Trip       TripSummary `json:"trip"`
	Driver     *PublicUser `json:"driver"`
	Stops      []liveStop  `json:"stops"`
	Positions  []Position  `json:"positions"`
	ServerTime time.Time   `json:"server_time"`
}

type liveStop struct {
	Name    string `json:"name"`
	Pickup  Point  `json:"pickup"`
	Dropoff Point  `json:"dropoff"`
}

func (a *API) liveTrip(token string) (*Trip, error) {
	tid := a.store.byShare[token]
	t := a.store.Trips[tid]
	if t == nil || token == "" {
		return nil, errf(404, "link live tidak valid")
	}
	return t, nil
}

func (a *API) liveSnapshot(w http.ResponseWriter, r *http.Request) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, err := a.liveTrip(r.PathValue("token"))
	if err != nil {
		return err
	}
	snap := liveSnapshot{
		Trip:       *tripSummary(t),
		Driver:     s.publicUser(t.DriverID, false),
		Positions:  a.hub.Snapshot(t.ID),
		ServerTime: time.Now(),
		Stops:      []liveStop{},
	}
	for _, b := range s.Bookings {
		if b.TripID == t.ID && b.Status == BookingAccepted {
			snap.Stops = append(snap.Stops, liveStop{Name: s.Users[b.PassengerID].Name, Pickup: b.Pickup, Dropoff: b.Dropoff})
		}
	}
	writeJSON(w, 200, snap)
	return nil
}

func (a *API) liveStream(w http.ResponseWriter, r *http.Request) error {
	a.store.mu.RLock()
	t, err := a.liveTrip(r.PathValue("token"))
	a.store.mu.RUnlock()
	if err != nil {
		return err
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		return errf(500, "streaming tidak didukung")
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(200)

	ch := a.hub.Subscribe(t.ID)
	defer a.hub.Unsubscribe(t.ID, ch)

	init, _ := json.Marshal(map[string]any{"type": "snapshot", "positions": a.hub.Snapshot(t.ID)})
	fmt.Fprintf(w, "retry: 3000\ndata: %s\n\n", init)
	flusher.Flush()

	ping := time.NewTicker(20 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return nil
		case msg := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		case <-ping.C:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}
