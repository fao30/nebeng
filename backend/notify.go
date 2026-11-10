package main

import (
	"encoding/json"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Notification is one entry in a user's notification log.
type Notification struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	Type      string     `json:"type"`
	Title     string     `json:"title"`
	Body      string     `json:"body,omitempty"`
	Link      string     `json:"link,omitempty"`
	TripID    string     `json:"trip_id,omitempty"`
	BookingID string     `json:"booking_id,omitempty"`
	Count     int        `json:"count,omitempty"` // chat messages folded into one entry
	At        time.Time  `json:"at"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
}

// SavedRoute is a route a passenger searched for; new trips on it trigger a notification.
type SavedRoute struct {
	From Point     `json:"from"`
	To   Point     `json:"to"`
	At   time.Time `json:"at"`
}

const (
	NotifBookingRequest   = "booking_request"   // driver: a passenger asks for a seat
	NotifBookingInstant   = "booking_instant"   // both: instant booking confirmed
	NotifBookingOffer     = "booking_offer"     // passenger: a driver offers a trip for their request
	NotifBookingCounter   = "booking_counter"   // other side: new price offer
	NotifBookingAccepted  = "booking_accepted"  // other side: deal
	NotifBookingRejected  = "booking_rejected"  // other side: declined
	NotifBookingCancelled = "booking_cancelled" // other side: cancelled
	NotifChat             = "chat"
	NotifTripStarted      = "trip_started"
	NotifTripCompleted    = "trip_completed"
	NotifTripCancelled    = "trip_cancelled"
	NotifTripReminder     = "trip_reminder"
	NotifTripNew          = "trip_new"    // passenger: new trip on a saved route / open request
	NotifRequestNew       = "request_new" // driver: passenger request along one of their trips

	maxNotifsPerUser = 150
)

// notify stores a notification and pushes it live. Caller holds the write lock.
func (a *API) notify(n *Notification) {
	if n.UserID == "" {
		return
	}
	s := a.store
	if s.Users[n.UserID] == nil {
		return
	}
	if n.ID == "" {
		n.ID = newID("ntf")
	}
	if n.At.IsZero() {
		n.At = time.Now()
	}
	s.Notifications[n.ID] = n
	a.pruneNotifs(n.UserID)
	s.Changed()
	a.hub.Event("user:"+n.UserID, map[string]any{"type": "notification", "notification": n})
}

// notifyChat folds unread chat messages from one conversation into a single entry.
func (a *API) notifyChat(uid string, b *Booking, sender, text string) {
	for _, n := range a.store.Notifications {
		if n.UserID == uid && n.Type == NotifChat && n.BookingID == b.ID && n.ReadAt == nil {
			n.Count++
			n.Title = "Pesan baru dari " + sender
			if n.Count > 1 {
				n.Title = strconv.Itoa(n.Count) + " pesan baru dari " + sender
			}
			n.Body, n.At = clip(text, 140), time.Now()
			a.store.Changed()
			a.hub.Event("user:"+uid, map[string]any{"type": "notification", "notification": n})
			return
		}
	}
	a.notify(&Notification{UserID: uid, Type: NotifChat, Title: "Pesan baru dari " + sender, Body: clip(text, 140),
		Link: "/trip/" + b.TripID + "?chat=" + b.ID, TripID: b.TripID, BookingID: b.ID, Count: 1})
}

func (a *API) pruneNotifs(uid string) {
	var mine []*Notification
	for _, n := range a.store.Notifications {
		if n.UserID == uid {
			mine = append(mine, n)
		}
	}
	if len(mine) <= maxNotifsPerUser {
		return
	}
	sort.Slice(mine, func(i, j int) bool { return mine[i].At.After(mine[j].At) })
	for _, n := range mine[maxNotifsPerUser:] {
		delete(a.store.Notifications, n.ID)
	}
}

// ---------- text helpers ----------

func clip(s string, n int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) <= n {
		return string(r)
	}
	return string(r[:n-1]) + "…"
}

func place(p Point) string {
	l := strings.TrimSpace(strings.SplitN(p.Label, ",", 2)[0])
	if l == "" {
		return "titik di peta"
	}
	return l
}

func rupiah(v int64) string {
	s := strconv.FormatInt(v, 10)
	var b strings.Builder
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(c)
	}
	return "Rp" + b.String()
}

var hariID = [...]string{"Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"}
var bulanID = [...]string{"Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"}

func (a *API) when(t time.Time) string {
	if a.loc != nil {
		t = t.In(a.loc)
	}
	return hariID[t.Weekday()] + " " + strconv.Itoa(t.Day()) + " " + bulanID[t.Month()-1] + ", " + t.Format("15.04")
}

func (a *API) firstName(uid string) string {
	if u := a.store.Users[uid]; u != nil {
		if f := strings.Fields(u.Name); len(f) > 0 {
			return f[0]
		}
	}
	return "Seseorang"
}

func (b *Booking) leg() string { return place(b.Pickup) + " → " + place(b.Dropoff) }

// ---------- event hooks (caller holds the write lock) ----------

func (a *API) onBookingCreated(t *Booking, trip *Trip) {
	b := t
	who := a.firstName(b.PassengerID)
	price := rupiah(b.Offers[0].Price)
	seats := strconv.Itoa(b.Seats) + " kursi"
	if b.Status == BookingAccepted {
		a.notify(&Notification{UserID: trip.DriverID, Type: NotifBookingInstant, Title: who + " memesan langsung " + seats,
			Body: b.leg() + " · " + a.when(b.PickupAt) + " · " + price, Link: "/trip/" + trip.ID, TripID: trip.ID, BookingID: b.ID})
		a.notify(&Notification{UserID: b.PassengerID, Type: NotifBookingInstant, Title: "Kursi Anda terkonfirmasi",
			Body: b.leg() + " · " + a.when(b.PickupAt) + " · " + price, Link: "/trip/" + trip.ID, TripID: trip.ID, BookingID: b.ID})
		return
	}
	body := b.leg() + " · " + a.when(b.PickupAt) + " · tawar " + price
	if m := strings.TrimSpace(b.Offers[0].Message); m != "" {
		body += ` · "` + clip(m, 80) + `"`
	}
	a.notify(&Notification{UserID: trip.DriverID, Type: NotifBookingRequest, Title: who + " minta " + seats + " di trip Anda",
		Body: body, Link: "/trip/" + trip.ID, TripID: trip.ID, BookingID: b.ID})
}

func (a *API) onDriverOffer(b *Booking, trip *Trip) {
	a.notify(&Notification{UserID: b.PassengerID, Type: NotifBookingOffer, Title: a.firstName(trip.DriverID) + " menawarkan tumpangan",
		Body: b.leg() + " · jemput " + a.when(b.PickupAt) + " · " + rupiah(b.Offers[0].Price),
		Link: "/minta", TripID: trip.ID, BookingID: b.ID})
}

// onBookingResponse notifies the other side of an accept / counter / reject / cancel.
func (a *API) onBookingResponse(b *Booking, trip *Trip, actor, action string) {
	other := trip.DriverID
	if actor == trip.DriverID {
		other = b.PassengerID
	}
	who := a.firstName(actor)
	role := "Penumpang"
	if actor == trip.DriverID {
		role = "Driver"
	}
	n := &Notification{UserID: other, Link: "/trip/" + trip.ID, TripID: trip.ID, BookingID: b.ID}
	switch action {
	case "accept":
		n.Type, n.Title = NotifBookingAccepted, role+" "+who+" menerima pesanan"
		n.Body = b.leg() + " · " + a.when(b.PickupAt) + " · deal " + rupiah(b.AgreedPrice)
		if other == b.PassengerID {
			n.Body += " · nomor & pelat sudah terlihat"
		}
	case "counter":
		last := b.LastOffer()
		n.Type, n.Title = NotifBookingCounter, who+" menawar "+rupiah(last.Price)
		n.Body = b.leg()
		if m := strings.TrimSpace(last.Message); m != "" {
			n.Body += ` · "` + clip(m, 80) + `"`
		}
	case "reject":
		n.Type, n.Title = NotifBookingRejected, role+" "+who+" menolak pesanan"
		n.Body = b.leg() + " · " + a.when(b.PickupAt)
		if other == b.PassengerID {
			n.Body += " · coba cari trip lain"
			n.Link = "/cari"
		}
	case "cancel":
		n.Type, n.Title = NotifBookingCancelled, role+" "+who+" membatalkan pesanan"
		n.Body = b.leg() + " · " + a.when(b.PickupAt)
	default:
		return
	}
	if other == b.PassengerID && b.Source == SourceDriverOffer && action != "accept" {
		n.Link = "/minta"
	}
	a.notify(n)
}

func (a *API) onTripStatus(t *Trip, action string, affected []*Booking) {
	route := place(t.Origin) + " → " + place(t.Destination)
	for _, b := range affected {
		n := &Notification{UserID: b.PassengerID, TripID: t.ID, BookingID: b.ID, Link: "/trip/" + t.ID}
		switch action {
		case "start":
			n.Type, n.Title = NotifTripStarted, "Trip dimulai, driver sedang menuju"
			n.Body = "Jemput di " + place(b.Pickup) + " sekitar " + b.PickupAt.In(a.locOr()).Format("15.04") + " · lacak posisi driver secara live"
			if t.ShareToken != "" {
				n.Link = "/live/" + t.ShareToken
			}
		case "complete":
			if b.DroppedAt != nil && b.DroppedAt.Before(time.Now().Add(-time.Second)) {
				continue // already told when they got off
			}
			n.Type, n.Title = NotifTripCompleted, "Trip selesai. Terima kasih sudah nebeng!"
			n.Body = b.leg() + " · " + rupiah(b.AgreedPrice) + " · beri rating driver"
			n.Link = "/trip/" + t.ID + "?rate=" + b.ID
		case "cancel":
			n.Type, n.Title = NotifTripCancelled, "Driver membatalkan trip"
			n.Body = route + " · " + a.when(t.DepartAt) + " · cari trip lain"
			n.Link = "/cari"
		}
		a.notify(n)
	}
	if action == "complete" {
		a.notify(&Notification{UserID: t.DriverID, Type: NotifTripCompleted, Title: "Trip selesai",
			Body: route + " · " + strconv.Itoa(len(affected)) + " penumpang diantar · beri rating penumpang", Link: "/trip/" + t.ID, TripID: t.ID})
	}
}

func (a *API) locOr() *time.Location {
	if a.loc != nil {
		return a.loc
	}
	return time.Local
}

// matchRadius: how far a request or saved route may be from a trip's points.
func matchRadius(t *Trip) float64 {
	if t.Kind == KindInter {
		return 15
	}
	return 5
}

// onTripCreated tells passengers about a new trip along their open request or a saved route.
func (a *API) onTripCreated(t *Trip) {
	s := a.store
	route := t.Route()
	r := matchRadius(t)
	told := map[string]bool{t.DriverID: true}
	for _, req := range s.Requests {
		if req.Status != RequestOpen || told[req.PassengerID] || math.Abs(req.DepartAt.Sub(t.DepartAt).Hours()) > 12 {
			continue
		}
		o, d := req.Origin, req.Destination
		if pi, di, _, _, ok := bestStops(route, &o, &d, r, r); ok {
			told[req.PassengerID] = true
			a.notify(&Notification{UserID: req.PassengerID, Type: NotifTripNew, Title: "Ada trip baru untuk permintaan Anda",
				Body: place(route[pi]) + " → " + place(route[di]) + " · " + a.when(t.DepartAt) + " · " + rupiah(pricePerSeat(t, spanIdx(pi, di))) + "/kursi",
				Link: tripLink(t, &o, &d), TripID: t.ID})
		}
	}
	for _, u := range s.Users {
		if told[u.ID] {
			continue
		}
		for _, sr := range u.SavedRoutes {
			f, to := sr.From, sr.To
			if pi, di, _, _, ok := bestStops(route, &f, &to, r, r); ok {
				told[u.ID] = true
				a.notify(&Notification{UserID: u.ID, Type: NotifTripNew, Title: "Trip baru di rute yang Anda cari",
					Body: place(f) + " → " + place(to) + ": naik di " + place(route[pi]) + ", " + a.when(t.DepartAt) + " · " + rupiah(pricePerSeat(t, spanIdx(pi, di))) + "/kursi",
					Link: tripLink(t, &f, &to), TripID: t.ID})
				break
			}
		}
	}
}

// onRequestCreated tells drivers whose upcoming trip passes the request.
func (a *API) onRequestCreated(req *RideRequest) {
	for _, t := range a.store.Trips {
		if t.Status != TripScheduled || t.DriverID == req.PassengerID || math.Abs(req.DepartAt.Sub(t.DepartAt).Hours()) > 12 {
			continue
		}
		r := matchRadius(t)
		o, d := req.Origin, req.Destination
		if _, _, _, _, ok := bestStops(t.Route(), &o, &d, r, r); ok {
			body := place(o) + " → " + place(d) + " · " + a.when(req.DepartAt) + " · " + strconv.Itoa(req.Seats) + " orang"
			if req.Budget > 0 {
				body += " · budget " + rupiah(req.Budget)
			}
			a.notify(&Notification{UserID: t.DriverID, Type: NotifRequestNew, Title: a.firstName(req.PassengerID) + " mencari tumpangan searah trip Anda",
				Body: body, Link: "/driver/permintaan", TripID: t.ID})
		}
	}
}

func tripLink(t *Trip, from, to *Point) string {
	q := "/trip/" + t.ID
	if from != nil && to != nil {
		q += "?p=" + urlPoint(*from) + "&d=" + urlPoint(*to)
	}
	return q
}

// reminders: one hour before departure, remind the driver and confirmed passengers.
func (a *API) reminders(stop <-chan struct{}) {
	tick := time.NewTicker(time.Minute)
	defer tick.Stop()
	for {
		a.sendReminders(time.Now())
		select {
		case <-stop:
			return
		case <-tick.C:
		}
	}
}

func (a *API) sendReminders(now time.Time) {
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, t := range s.Trips {
		if t.Status != TripScheduled || t.Reminded || t.DepartAt.Before(now) || t.DepartAt.Sub(now) > time.Hour {
			continue
		}
		t.Reminded = true
		s.Changed()
		mins := int(math.Round(t.DepartAt.Sub(now).Minutes()))
		count := 0
		for _, b := range s.Bookings {
			if b.TripID != t.ID || b.Status != BookingAccepted {
				continue
			}
			count++
			a.notify(&Notification{UserID: b.PassengerID, Type: NotifTripReminder, Title: "Trip berangkat " + strconv.Itoa(mins) + " menit lagi",
				Body: "Siap di " + place(b.Pickup) + " sekitar " + b.PickupAt.In(a.locOr()).Format("15.04"), Link: "/trip/" + t.ID, TripID: t.ID, BookingID: b.ID})
		}
		body := place(t.Origin) + " → " + place(t.Destination) + " · " + strconv.Itoa(count) + " penumpang terkonfirmasi"
		a.notify(&Notification{UserID: t.DriverID, Type: NotifTripReminder, Title: "Trip Anda berangkat " + strconv.Itoa(mins) + " menit lagi",
			Body: body, Link: "/trip/" + t.ID, TripID: t.ID})
	}
}

// ---------- endpoints ----------

func (a *API) listNotifications(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := []*Notification{}
	unread := 0
	for _, n := range s.Notifications {
		if n.UserID == uid {
			items = append(items, n)
			if n.ReadAt == nil {
				unread++
			}
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].At.After(items[j].At) })
	writeJSON(w, 200, map[string]any{"items": items, "unread": unread})
	return nil
}

func (a *API) readNotifications(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		IDs []string `json:"ids"` // empty = all
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	want := map[string]bool{}
	for _, id := range in.IDs {
		want[id] = true
	}
	now := time.Now()
	unread := 0
	for _, n := range s.Notifications {
		if n.UserID != uid || n.ReadAt != nil {
			continue
		}
		if len(want) == 0 || want[n.ID] {
			n.ReadAt = &now
		} else {
			unread++
		}
	}
	s.Changed()
	a.hub.Event("user:"+uid, map[string]any{"type": "read", "unread": unread})
	writeJSON(w, 200, map[string]any{"unread": unread})
	return nil
}

func (a *API) notificationStream(w http.ResponseWriter, r *http.Request, uid string) error {
	return a.streamSSE(w, r, "user:"+uid, map[string]any{"type": "ready"})
}

// saveRoutes stores the passenger's recent searches so new trips on them can be announced.
func (a *API) saveRoutes(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Routes []SavedRoute `json:"routes"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	out := []SavedRoute{}
	for _, sr := range in.Routes {
		cleanPoint(&sr.From)
		cleanPoint(&sr.To)
		if validPoint(sr.From) && validPoint(sr.To) && len(out) < 3 {
			if sr.At.IsZero() {
				sr.At = time.Now()
			}
			out = append(out, sr)
		}
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Users[uid].SavedRoutes = out
	s.Changed()
	writeJSON(w, 200, map[string]any{"routes": out})
	return nil
}

// AdminNotification is a log row for the admin CRM.
type AdminNotification struct {
	*Notification
	UserName  string `json:"user_name"`
	UserEmail string `json:"user_email"`
}

func (a *API) adminNotifications(w http.ResponseWriter, r *http.Request, uid string) error {
	from, to, err := a.dateRange(r)
	if err != nil {
		return err
	}
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	typ := r.URL.Query().Get("type")
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := []AdminNotification{}
	counts := map[string]int{}
	for _, n := range s.Notifications {
		if from != nil && n.At.Before(*from) || to != nil && !n.At.Before(*to) {
			continue
		}
		u := s.Users[n.UserID]
		if q != "" && !matches(q, u) && !strings.Contains(strings.ToLower(n.Title+" "+n.Body), q) {
			continue
		}
		counts[n.Type]++
		if typ != "" && !strings.HasPrefix(n.Type, typ) {
			continue
		}
		row := AdminNotification{Notification: n}
		if u != nil {
			row.UserName, row.UserEmail = u.Name, u.Email
		}
		items = append(items, row)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].At.After(items[j].At) })
	total := len(items)
	if len(items) > 500 {
		items = items[:500]
	}
	writeJSON(w, 200, map[string]any{"items": items, "total": total, "counts": counts})
	return nil
}

func urlPoint(p Point) string {
	b, _ := json.Marshal(Point{Lat: p.Lat, Lng: p.Lng, Label: p.Label})
	return url.QueryEscape(string(b))
}
