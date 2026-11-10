package main

import (
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Admin CRM endpoints. Every handler here is wrapped by adminOnly.

func (a *API) adminOnly(fn authedFunc) http.HandlerFunc {
	return a.auth(func(w http.ResponseWriter, r *http.Request, uid string) error {
		a.store.mu.RLock()
		ok := a.store.Users[uid].IsAdmin
		a.store.mu.RUnlock()
		if !ok {
			return errf(403, "khusus admin")
		}
		return fn(w, r, uid)
	})
}

// promoteAdmins marks users listed in ADMIN_EMAILS (comma separated) as admins.
func promoteAdmins(s *Store) {
	list := os.Getenv("ADMIN_EMAILS")
	if list == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, e := range strings.Split(list, ",") {
		if id, ok := s.byEmail[strings.ToLower(strings.TrimSpace(e))]; ok {
			s.Users[id].IsAdmin = true
		}
	}
	s.Changed()
}

func (a *API) getSettings(w http.ResponseWriter, r *http.Request) error {
	writeJSON(w, 200, settings())
	return nil
}

func (a *API) putSettings(w http.ResponseWriter, r *http.Request, uid string) error {
	var in Settings
	if err := readJSON(r, &in); err != nil {
		return err
	}
	if err := in.valid(); err != nil {
		return err
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	in.UpdatedAt = time.Now()
	in.UpdatedBy = s.Users[uid].Name
	s.Settings = &in
	cfg.Store(&in)
	s.Changed()
	writeJSON(w, 200, in)
	return nil
}

type AdminUser struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Email            string     `json:"email"`
	Phone            string     `json:"phone"`
	CarModel         string     `json:"car_model"`
	CarPlate         string     `json:"car_plate"`
	IsAdmin          bool       `json:"is_admin"`
	CreatedAt        time.Time  `json:"created_at"`
	TripsAsDrv       int        `json:"trips_as_driver"`
	Bookings         int        `json:"bookings_as_passenger"`
	Requests         int        `json:"requests"`
	Blocked          bool       `json:"blocked"`
	BlockedReason    string     `json:"blocked_reason,omitempty"`
	BlockedAt        *time.Time `json:"blocked_at,omitempty"`
	DriverRating     float64    `json:"driver_rating"`
	DriverRatings    int        `json:"driver_ratings"`
	PassengerRating  float64    `json:"passenger_rating"`
	PassengerRatings int        `json:"passenger_ratings"`
	ReportsAgainst   int        `json:"reports_against"`
	OpenReports      int        `json:"open_reports"`
}

func (a *API) adminUser(id string) *AdminUser {
	u := a.store.Users[id]
	if u == nil {
		return nil
	}
	au := &AdminUser{ID: u.ID, Name: u.Name, Email: u.Email, Phone: u.Phone, CarModel: u.CarModel,
		CarPlate: u.CarPlate, IsAdmin: u.IsAdmin, CreatedAt: u.CreatedAt,
		Blocked: u.Blocked, BlockedReason: u.BlockedReason, BlockedAt: u.BlockedAt,
		DriverRating: avg(u.DriverRatingSum, u.DriverRatingCount), DriverRatings: u.DriverRatingCount,
		PassengerRating: avg(u.PassengerRatingSum, u.PassengerRatingCount), PassengerRatings: u.PassengerRatingCount}
	for _, rp := range a.store.Reports {
		if rp.TargetID == id {
			au.ReportsAgainst++
			if rp.Status == ReportOpen || rp.Status == ReportReviewing {
				au.OpenReports++
			}
		}
	}
	for _, t := range a.store.Trips {
		if t.DriverID == id {
			au.TripsAsDrv++
		}
	}
	for _, b := range a.store.Bookings {
		if b.PassengerID == id {
			au.Bookings++
		}
	}
	for _, rq := range a.store.Requests {
		if rq.PassengerID == id {
			au.Requests++
		}
	}
	return au
}

func matches(q string, users ...*User) bool {
	if q == "" {
		return true
	}
	for _, u := range users {
		if u == nil {
			continue
		}
		if strings.Contains(strings.ToLower(u.Name+" "+u.Email+" "+u.Phone), q) {
			return true
		}
	}
	return false
}

// dateRange parses date_from / date_to (YYYY-MM-DD, inclusive) in the app timezone.
func (a *API) dateRange(r *http.Request) (*time.Time, *time.Time, error) {
	var from, to *time.Time
	if v := r.URL.Query().Get("date_from"); v != "" {
		t, err := time.ParseInLocation("2006-01-02", v, a.loc)
		if err != nil {
			return nil, nil, errf(400, "date_from harus YYYY-MM-DD")
		}
		from = &t
	}
	if v := r.URL.Query().Get("date_to"); v != "" {
		t, err := time.ParseInLocation("2006-01-02", v, a.loc)
		if err != nil {
			return nil, nil, errf(400, "date_to harus YYYY-MM-DD")
		}
		end := t.AddDate(0, 0, 1)
		to = &end
	}
	return from, to, nil
}

type AdminBooking struct {
	ID           string     `json:"id"`
	Passenger    *AdminUser `json:"passenger"`
	Status       string     `json:"status"`
	Source       string     `json:"source"`
	Seats        int        `json:"seats"`
	Luggage      int        `json:"luggage"`
	Pickup       Point      `json:"pickup"`
	Dropoff      Point      `json:"dropoff"`
	PickupAt     time.Time  `json:"pickup_at"`
	ListPrice    int64      `json:"list_price"`
	AgreedPrice  int64      `json:"agreed_price"`
	LastOffer    int64      `json:"last_offer"`
	Messages     int        `json:"messages"`
	LastActivity time.Time  `json:"last_activity"`
}

type AdminTrip struct {
	*TripSummary
	Driver      *AdminUser      `json:"driver"`
	DistanceKm  float64         `json:"distance_km"`
	Bookings    []*AdminBooking `json:"bookings"`
	SeatsBooked int             `json:"seats_booked"`
	Revenue     int64           `json:"revenue"` // sum of agreed prices
	CreatedAt   time.Time       `json:"created_at"`
}

func (a *API) adminBooking(b *Booking) *AdminBooking {
	n, last := a.messageStats(b.ID)
	ab := &AdminBooking{ID: b.ID, Passenger: a.adminUser(b.PassengerID), Status: b.Status, Source: b.Source,
		Seats: b.Seats, Luggage: b.Luggage, Pickup: b.Pickup, Dropoff: b.Dropoff, PickupAt: b.PickupAt,
		ListPrice: b.ListPrice, AgreedPrice: b.AgreedPrice, Messages: n, LastActivity: b.UpdatedAt}
	if lo := b.LastOffer(); lo != nil {
		ab.LastOffer = lo.Price
	}
	if last != nil && last.After(ab.LastActivity) {
		ab.LastActivity = *last
	}
	return ab
}

func (a *API) adminTrips(w http.ResponseWriter, r *http.Request, uid string) error {
	q := r.URL.Query()
	from, to, err := a.dateRange(r)
	if err != nil {
		return err
	}
	priceMin, _ := strconv.ParseInt(q.Get("price_min"), 10, 64)
	priceMax, _ := strconv.ParseInt(q.Get("price_max"), 10, 64)
	search := strings.ToLower(strings.TrimSpace(q.Get("q")))
	who := q.Get("who") // driver | passenger | "" (both)
	status := q.Get("status")

	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*AdminTrip{}
	for _, t := range s.Trips {
		if status != "" && t.Status != status {
			continue
		}
		if from != nil && t.DepartAt.Before(*from) {
			continue
		}
		if to != nil && !t.DepartAt.Before(*to) {
			continue
		}
		if priceMin > 0 && t.PricePerSeat < priceMin {
			continue
		}
		if priceMax > 0 && t.PricePerSeat > priceMax {
			continue
		}
		var passengers []*User
		var bookings []*Booking
		for _, b := range s.Bookings {
			if b.TripID == t.ID {
				bookings = append(bookings, b)
				passengers = append(passengers, s.Users[b.PassengerID])
			}
		}
		if search != "" {
			hit := false
			if who != "passenger" && matches(search, s.Users[t.DriverID]) {
				hit = true
			}
			if who != "driver" && matches(search, passengers...) {
				hit = true
			}
			if !hit && who == "" && strings.Contains(strings.ToLower(t.Origin.Label+" "+t.Destination.Label), search) {
				hit = true
			}
			if !hit {
				continue
			}
		}
		at := &AdminTrip{TripSummary: tripSummary(t), Driver: a.adminUser(t.DriverID),
			DistanceKm: round1(routeKm(t.Route())), CreatedAt: t.CreatedAt, Bookings: []*AdminBooking{}}
		for _, b := range bookings {
			ab := a.adminBooking(b)
			at.Bookings = append(at.Bookings, ab)
			if b.Status == BookingAccepted {
				at.SeatsBooked += b.Seats
				at.Revenue += b.AgreedPrice
			}
		}
		sort.Slice(at.Bookings, func(i, j int) bool { return at.Bookings[i].LastActivity.After(at.Bookings[j].LastActivity) })
		out = append(out, at)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DepartAt.After(out[j].DepartAt) })
	writeJSON(w, 200, out)
	return nil
}

func (a *API) adminUsers(w http.ResponseWriter, r *http.Request, uid string) error {
	search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	role := r.URL.Query().Get("role")
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*AdminUser{}
	for id, u := range s.Users {
		if !matches(search, u) {
			continue
		}
		au := a.adminUser(id)
		if (role == "driver" && au.TripsAsDrv == 0) || (role == "passenger" && au.Bookings+au.Requests == 0) || (role == "admin" && !au.IsAdmin) ||
			(role == "blocked" && !au.Blocked) || (role == "reported" && au.ReportsAgainst == 0) {
			continue
		}
		out = append(out, au)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	writeJSON(w, 200, out)
	return nil
}

type AdminConversation struct {
	*AdminBooking
	Trip     *TripSummary `json:"trip"`
	Driver   *AdminUser   `json:"driver"`
	LastText string       `json:"last_text"`
	Offers   int          `json:"offers"`
}

// adminConversations lists every booking with its chat activity.
func (a *API) adminConversations(w http.ResponseWriter, r *http.Request, uid string) error {
	search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	onlyChats := r.URL.Query().Get("with_messages") == "1"
	from, to, err := a.dateRange(r)
	if err != nil {
		return err
	}
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*AdminConversation{}
	for _, b := range s.Bookings {
		t := s.Trips[b.TripID]
		if t == nil || !matches(search, s.Users[b.PassengerID], s.Users[t.DriverID]) {
			continue
		}
		ab := a.adminBooking(b)
		if onlyChats && ab.Messages == 0 {
			continue
		}
		if from != nil && ab.LastActivity.Before(*from) {
			continue
		}
		if to != nil && !ab.LastActivity.Before(*to) {
			continue
		}
		c := &AdminConversation{AdminBooking: ab, Trip: tripSummary(t), Driver: a.adminUser(t.DriverID), Offers: len(b.Offers)}
		msgs := a.messagesFor(b)
		if len(msgs) > 0 {
			c.LastText = msgs[len(msgs)-1].Text
		} else if lo := b.LastOffer(); lo != nil {
			c.LastText = lo.Message
		}
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].LastActivity.After(out[j].LastActivity) })
	writeJSON(w, 200, out)
	return nil
}

func (a *API) adminStats(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	st := map[string]any{}
	trips := map[string]int{}
	for _, t := range s.Trips {
		trips[t.Status]++
	}
	bookings := map[string]int{}
	var gmv int64
	seats := 0
	for _, b := range s.Bookings {
		bookings[b.Status]++
		if b.Status == BookingAccepted {
			gmv += b.AgreedPrice
			seats += b.Seats
		}
	}
	openReq := 0
	for _, rq := range s.Requests {
		if rq.Status == RequestOpen {
			openReq++
		}
	}
	st["users"] = len(s.Users)
	st["trips"] = trips
	st["trips_total"] = len(s.Trips)
	st["bookings"] = bookings
	st["seats_booked"] = seats
	st["gmv"] = gmv
	st["open_requests"] = openReq
	st["messages"] = len(s.Messages)
	writeJSON(w, 200, st)
	return nil
}
