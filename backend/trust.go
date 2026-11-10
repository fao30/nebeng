package main

import (
	"crypto/rand"
	"math/big"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Trust & safety: boarding codes, drop-off, ratings, reports and blocking.

type Rating struct {
	ID        string    `json:"id"`
	BookingID string    `json:"booking_id"`
	TripID    string    `json:"trip_id"`
	FromID    string    `json:"from_id"`
	ToID      string    `json:"to_id"`
	ToRole    string    `json:"to_role"` // driver | passenger: the role being rated
	Stars     int       `json:"stars"`
	Tags      []string  `json:"tags,omitempty"`
	Comment   string    `json:"comment,omitempty"`
	At        time.Time `json:"at"`
}

type Report struct {
	ID         string     `json:"id"`
	ReporterID string     `json:"reporter_id"`
	TargetID   string     `json:"target_id"`
	TargetRole string     `json:"target_role"` // driver | passenger
	TripID     string     `json:"trip_id"`
	BookingID  string     `json:"booking_id"`
	Category   string     `json:"category"`
	Text       string     `json:"text"`
	Status     string     `json:"status"` // open | reviewing | resolved | dismissed
	AdminNote  string     `json:"admin_note,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	HandledBy  string     `json:"handled_by,omitempty"`
	ClosedAt   *time.Time `json:"closed_at,omitempty"`
}

const (
	ReportOpen      = "open"
	ReportReviewing = "reviewing"
	ReportResolved  = "resolved"
	ReportDismissed = "dismissed"

	NotifBoarded       = "boarded"
	NotifDroppedOff    = "dropped_off"
	NotifRated         = "rated"
	NotifReportNew     = "report_new"
	NotifReportUpdated = "report_updated"
	NotifAccount       = "account"

	maxCodeTries = 5
)

var reportCategories = map[string]string{
	// about a driver
	"dangerous_driving": "Mengemudi berbahaya",
	"different_car":     "Mobil atau pelat berbeda",
	"overcharge":        "Minta bayaran lebih",
	"wrong_route":       "Tidak sesuai rute / titik",
	// about a passenger
	"no_show": "Tidak datang (no-show)",
	"late":    "Terlambat lama",
	"payment": "Tidak membayar / masalah bayar",
	"damage":  "Merusak / mengotori mobil",
	// either side
	"rude":        "Perilaku tidak sopan",
	"harassment":  "Pelecehan atau ancaman",
	"cancel_last": "Membatalkan mendadak",
	"fraud":       "Penipuan / akun palsu",
	"other":       "Lainnya",
}

func randomCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(10000))
	if err != nil {
		return "0000"
	}
	s := strconv.FormatInt(n.Int64(), 10)
	return strings.Repeat("0", 4-len(s)) + s
}

func (a *API) bookingAndTrip(id string) (*Booking, *Trip, error) {
	b := a.store.Bookings[id]
	if b == nil {
		return nil, nil, errf(404, "pesanan tidak ditemukan")
	}
	t := a.store.Trips[b.TripID]
	if t == nil {
		return nil, nil, errf(404, "trip tidak ditemukan")
	}
	return b, t, nil
}

func (a *API) respondBookingView(w http.ResponseWriter, b *Booking) error {
	a.hub.Event("booking:"+b.ID, map[string]any{"type": "booking", "status": b.Status})
	writeJSON(w, 200, a.bookingView(b))
	return nil
}

// ---------- boarding ----------

// boardingCode: the passenger shows this 4-digit code; the driver types it in
// to confirm the passenger is in the car. POST with {"renew":true} for a new one.
func (a *API) boardingCode(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Renew bool `json:"renew"`
	}
	_ = readJSON(r, &in)
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	b, t, err := a.bookingAndTrip(r.PathValue("id"))
	if err != nil {
		return err
	}
	if b.PassengerID != uid {
		return errf(403, "hanya penumpang yang bisa membuat kode naik")
	}
	if b.Status != BookingAccepted {
		return errf(409, "kode naik tersedia setelah pesanan disetujui")
	}
	if b.BoardedAt != nil {
		return errf(409, "Anda sudah tercatat naik")
	}
	if t.Status != TripScheduled && t.Status != TripOngoing {
		return errf(409, "trip sudah %s", t.Status)
	}
	code := s.BoardingCodes[b.ID]
	if code == "" || in.Renew || s.CodeTries[b.ID] >= maxCodeTries {
		code = randomCode()
		s.BoardingCodes[b.ID] = code
		delete(s.CodeTries, b.ID)
		s.Changed()
	}
	writeJSON(w, 200, map[string]any{"code": code})
	return nil
}

// board: the driver enters the passenger's code.
func (a *API) board(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Code string `json:"code"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	b, t, err := a.bookingAndTrip(r.PathValue("id"))
	if err != nil {
		return err
	}
	if t.DriverID != uid {
		return errf(403, "hanya pemilik mobil trip ini yang bisa memasukkan kode")
	}
	if b.Status != BookingAccepted {
		return errf(409, "pesanan belum disetujui")
	}
	if b.BoardedAt != nil {
		return errf(409, "penumpang sudah tercatat naik")
	}
	if t.Status != TripScheduled && t.Status != TripOngoing {
		return errf(409, "trip sudah %s", t.Status)
	}
	code := s.BoardingCodes[b.ID]
	if code == "" {
		return errf(409, "penumpang belum membuat kode naik. Minta penumpang menekan \"Tampilkan kode naik\".")
	}
	if s.CodeTries[b.ID] >= maxCodeTries {
		return errf(429, "terlalu banyak kode salah. Minta penumpang membuat kode baru.")
	}
	if strings.TrimSpace(in.Code) != code {
		s.CodeTries[b.ID]++
		s.Changed()
		left := maxCodeTries - s.CodeTries[b.ID]
		if left <= 0 {
			return errf(429, "kode salah. Minta penumpang membuat kode baru.")
		}
		return errf(400, "kode salah, sisa %d percobaan", left)
	}
	now := time.Now()
	b.BoardedAt, b.UpdatedAt = &now, now
	delete(s.BoardingCodes, b.ID)
	delete(s.CodeTries, b.ID)
	// The first passenger in the car means the trip is under way.
	if t.Status == TripScheduled {
		t.Status, t.StartedAt = TripOngoing, &now
		a.ensureShare(t)
		var others []*Booking
		for _, o := range s.Bookings {
			if o.TripID == t.ID && o.Status == BookingAccepted && o.ID != b.ID {
				others = append(others, o)
			}
		}
		a.onTripStatus(t, "start", others)
		a.hub.Event(t.ID, map[string]any{"type": "status", "status": t.Status})
	}
	s.Changed()
	a.notify(&Notification{UserID: b.PassengerID, Type: NotifBoarded, Title: "Anda sudah naik, selamat jalan!",
		Body: "Pemilik mobil " + a.firstName(t.DriverID) + " mengonfirmasi kode naik Anda di " + place(b.Pickup) + " · turun di " + place(b.Dropoff),
		Link: "/trip/" + t.ID, TripID: t.ID, BookingID: b.ID})
	a.notify(&Notification{UserID: t.DriverID, Type: NotifBoarded, Title: a.firstName(b.PassengerID) + " sudah naik",
		Body: "Kode cocok · turun di " + place(b.Dropoff), Link: "/trip/" + t.ID, TripID: t.ID, BookingID: b.ID})
	return a.respondBookingView(w, b)
}

// dropoff: the driver marks one passenger as delivered. When everyone is
// delivered the trip completes by itself.
func (a *API) dropoff(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	b, t, err := a.bookingAndTrip(r.PathValue("id"))
	if err != nil {
		return err
	}
	if t.DriverID != uid {
		return errf(403, "hanya pemilik mobil trip ini")
	}
	if b.BoardedAt == nil {
		return errf(409, "penumpang belum tercatat naik")
	}
	if b.DroppedAt != nil {
		return errf(409, "penumpang sudah diturunkan")
	}
	now := time.Now()
	b.DroppedAt, b.UpdatedAt = &now, now
	s.Changed()
	a.notify(&Notification{UserID: b.PassengerID, Type: NotifDroppedOff, Title: "Sampai di " + place(b.Dropoff) + ". Beri rating pemilik mobil?",
		Body: "Bagaimana perjalanan bersama " + a.firstName(t.DriverID) + "? Rating Anda membantu penumpang lain.",
		Link: "/trip/" + t.ID + "?rate=" + b.ID, TripID: t.ID, BookingID: b.ID})
	pending := 0
	for _, o := range s.Bookings {
		if o.TripID == t.ID && o.Status == BookingAccepted && o.DroppedAt == nil {
			pending++
		}
	}
	if pending == 0 && t.Status == TripOngoing {
		t.Status, t.CompletedAt = TripCompleted, &now
		a.hub.Event(t.ID, map[string]any{"type": "status", "status": t.Status})
		a.notify(&Notification{UserID: t.DriverID, Type: NotifTripCompleted, Title: "Semua penumpang sudah diantar, trip selesai",
			Body: place(t.Origin) + " → " + place(t.Destination) + " · jangan lupa beri rating penumpang", Link: "/trip/" + t.ID, TripID: t.ID})
	}
	return a.respondBookingView(w, b)
}

// ---------- ratings ----------

func (a *API) rate(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Stars   int      `json:"stars"`
		Tags    []string `json:"tags"`
		Comment string   `json:"comment"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	if in.Stars < 1 || in.Stars > 5 {
		return errf(400, "pilih 1 sampai 5 bintang")
	}
	in.Comment = clip(in.Comment, 500)
	if len(in.Tags) > 6 {
		in.Tags = in.Tags[:6]
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	b, t, err := a.bookingAndTrip(r.PathValue("id"))
	if err != nil {
		return err
	}
	var to, toRole string
	switch uid {
	case b.PassengerID:
		to, toRole = t.DriverID, ByDriver
		if b.RatedByPassenger {
			return errf(409, "Anda sudah memberi rating untuk perjalanan ini")
		}
	case t.DriverID:
		to, toRole = b.PassengerID, ByPassenger
		if b.RatedByDriver {
			return errf(409, "Anda sudah memberi rating untuk penumpang ini")
		}
	default:
		return errf(403, "bukan pesanan Anda")
	}
	if !canRate(b, t) {
		return errf(409, "rating bisa diberikan setelah penumpang diantar atau trip selesai")
	}
	rt := &Rating{ID: newID("rtg"), BookingID: b.ID, TripID: t.ID, FromID: uid, ToID: to, ToRole: toRole,
		Stars: in.Stars, Tags: in.Tags, Comment: in.Comment, At: time.Now()}
	s.Ratings[rt.ID] = rt
	u := s.Users[to]
	if toRole == ByDriver {
		b.RatedByPassenger = true
		u.DriverRatingSum += in.Stars
		u.DriverRatingCount++
	} else {
		b.RatedByDriver = true
		u.PassengerRatingSum += in.Stars
		u.PassengerRatingCount++
	}
	s.Changed()
	who := "Penumpang " + a.firstName(uid)
	if uid == t.DriverID {
		who = "Pemilik mobil " + a.firstName(uid)
	}
	a.notify(&Notification{UserID: to, Type: NotifRated, Title: who + " memberi Anda " + strconv.Itoa(in.Stars) + " bintang",
		Body: strings.Repeat("★", in.Stars) + strings.Repeat("☆", 5-in.Stars) + " · " + b.leg(), Link: "/profil", TripID: t.ID, BookingID: b.ID})
	return a.respondBookingView(w, b)
}

func canRate(b *Booking, t *Trip) bool {
	return b.Status == BookingAccepted && (b.DroppedAt != nil || t.Status == TripCompleted)
}

func avg(sum, n int) float64 {
	if n == 0 {
		return 0
	}
	return round1(float64(sum) / float64(n))
}

// RatingView is a rating as shown on a profile (without who wrote it).
type RatingView struct {
	Stars   int       `json:"stars"`
	Tags    []string  `json:"tags,omitempty"`
	Comment string    `json:"comment,omitempty"`
	ToRole  string    `json:"to_role"`
	From    string    `json:"from"`
	At      time.Time `json:"at"`
}

// myRatings: what others said about me.
func (a *API) myRatings(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []RatingView{}
	for _, rt := range s.Ratings {
		if rt.ToID == uid {
			from := ""
			if u := s.Users[rt.FromID]; u != nil {
				from = shortName(u.Name)
			}
			out = append(out, RatingView{Stars: rt.Stars, Tags: rt.Tags, Comment: rt.Comment, ToRole: rt.ToRole, From: from, At: rt.At})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].At.After(out[j].At) })
	writeJSON(w, 200, out)
	return nil
}

// ---------- reports ----------

func (a *API) createReport(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Category string `json:"category"`
		Text     string `json:"text"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	if reportCategories[in.Category] == "" {
		return errf(400, "pilih alasan laporan")
	}
	in.Text = strings.TrimSpace(in.Text)
	if len([]rune(in.Text)) > 2000 {
		return errf(400, "keterangan maksimal 2000 karakter")
	}
	if in.Category == "other" && in.Text == "" {
		return errf(400, "jelaskan apa yang terjadi")
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	b, t, err := a.bookingAndTrip(r.PathValue("id"))
	if err != nil {
		return err
	}
	var target, role string
	switch uid {
	case b.PassengerID:
		target, role = t.DriverID, ByDriver
	case t.DriverID:
		target, role = b.PassengerID, ByPassenger
	default:
		return errf(403, "bukan pesanan Anda")
	}
	for _, rp := range s.Reports {
		if rp.BookingID == b.ID && rp.ReporterID == uid && (rp.Status == ReportOpen || rp.Status == ReportReviewing) {
			return errf(409, "laporan Anda untuk pesanan ini masih diproses admin")
		}
	}
	now := time.Now()
	rp := &Report{ID: newID("rpt"), ReporterID: uid, TargetID: target, TargetRole: role, TripID: t.ID, BookingID: b.ID,
		Category: in.Category, Text: in.Text, Status: ReportOpen, CreatedAt: now, UpdatedAt: now}
	s.Reports[rp.ID] = rp
	s.Changed()
	label := "penumpang"
	if role == ByDriver {
		label = "pemilik mobil"
	}
	for _, u := range s.Users {
		if u.IsAdmin && u.ID != uid {
			a.notify(&Notification{UserID: u.ID, Type: NotifReportNew, Title: "Laporan baru tentang " + label + " " + a.firstName(target),
				Body: reportCategories[in.Category] + " · dari " + a.firstName(uid) + func() string {
					if in.Text != "" {
						return ` · "` + clip(in.Text, 80) + `"`
					}
					return ""
				}(), Link: "/admin/laporan?id=" + rp.ID, TripID: t.ID, BookingID: b.ID})
		}
	}
	writeJSON(w, 201, a.reportView(rp, false))
	return nil
}

type ReportView struct {
	*Report
	CategoryLabel string       `json:"category_label"`
	Reporter      *AdminUser   `json:"reporter,omitempty"`
	Target        *AdminUser   `json:"target,omitempty"`
	Trip          *TripSummary `json:"trip,omitempty"`
	TargetName    string       `json:"target_name,omitempty"`
	PriorReports  int          `json:"prior_reports"` // other reports against the same person
}

func (a *API) reportView(rp *Report, admin bool) *ReportView {
	v := &ReportView{Report: rp, CategoryLabel: reportCategories[rp.Category]}
	if u := a.store.Users[rp.TargetID]; u != nil {
		v.TargetName = shortName(u.Name)
	}
	if admin {
		v.Reporter, v.Target = a.adminUser(rp.ReporterID), a.adminUser(rp.TargetID)
		if t := a.store.Trips[rp.TripID]; t != nil {
			v.Trip = tripSummary(t)
		}
		for _, o := range a.store.Reports {
			if o.ID != rp.ID && o.TargetID == rp.TargetID {
				v.PriorReports++
			}
		}
	} else {
		c := *rp
		c.HandledBy = ""
		v.Report = &c
	}
	return v
}

func (a *API) myReports(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*ReportView{}
	for _, rp := range s.Reports {
		if rp.ReporterID == uid {
			out = append(out, a.reportView(rp, false))
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	writeJSON(w, 200, out)
	return nil
}

func (a *API) adminReports(w http.ResponseWriter, r *http.Request, uid string) error {
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	status := r.URL.Query().Get("status")
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*ReportView{}
	counts := map[string]int{}
	for _, rp := range s.Reports {
		if !matches(q, s.Users[rp.ReporterID], s.Users[rp.TargetID]) && !strings.Contains(strings.ToLower(rp.Text), q) {
			continue
		}
		counts[rp.Status]++
		if status != "" && rp.Status != status {
			continue
		}
		out = append(out, a.reportView(rp, true))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	writeJSON(w, 200, map[string]any{"items": out, "counts": counts})
	return nil
}

func (a *API) adminUpdateReport(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Status string  `json:"status"`
		Note   *string `json:"admin_note"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	switch in.Status {
	case ReportOpen, ReportReviewing, ReportResolved, ReportDismissed:
	default:
		return errf(400, "status tidak valid")
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	rp := s.Reports[r.PathValue("id")]
	if rp == nil {
		return errf(404, "laporan tidak ditemukan")
	}
	now := time.Now()
	changed := rp.Status != in.Status
	rp.Status, rp.UpdatedAt, rp.HandledBy = in.Status, now, uid
	if in.Note != nil {
		rp.AdminNote = clip(*in.Note, 1000)
	}
	if in.Status == ReportResolved || in.Status == ReportDismissed {
		rp.ClosedAt = &now
	} else {
		rp.ClosedAt = nil
	}
	s.Changed()
	if changed && in.Status != ReportOpen {
		title := map[string]string{
			ReportReviewing: "Laporan Anda sedang ditinjau admin",
			ReportResolved:  "Laporan Anda sudah ditindaklanjuti",
			ReportDismissed: "Laporan Anda ditutup",
		}[in.Status]
		body := reportCategories[rp.Category]
		if rp.AdminNote != "" {
			body += ` · "` + clip(rp.AdminNote, 120) + `"`
		}
		a.notify(&Notification{UserID: rp.ReporterID, Type: NotifReportUpdated, Title: title, Body: body, Link: "/profil", TripID: rp.TripID, BookingID: rp.BookingID})
	}
	writeJSON(w, 200, a.reportView(rp, true))
	return nil
}

// ---------- blocking ----------

func (a *API) adminBlock(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Blocked bool   `json:"blocked"`
		Reason  string `json:"reason"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	in.Reason = clip(in.Reason, 300)
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	u := s.Users[r.PathValue("id")]
	if u == nil {
		return errf(404, "pengguna tidak ditemukan")
	}
	if u.ID == uid {
		return errf(400, "tidak bisa memblokir akun sendiri")
	}
	if u.IsAdmin && in.Blocked {
		return errf(400, "akun admin tidak bisa diblokir")
	}
	if in.Blocked && in.Reason == "" {
		return errf(400, "tulis alasan blokir")
	}
	now := time.Now()
	if in.Blocked {
		u.Blocked, u.BlockedReason, u.BlockedAt, u.BlockedBy = true, in.Reason, &now, uid
		a.cleanupBlocked(u, now)
	} else {
		u.Blocked, u.BlockedReason, u.BlockedAt, u.BlockedBy = false, "", nil, ""
	}
	s.Changed()
	ev := map[string]any{"type": "account", "blocked": u.Blocked}
	if u.Blocked {
		ev["message"] = blockedErr(u).Error()
	}
	a.hub.Event("user:"+u.ID, ev)
	writeJSON(w, 200, a.adminUser(u.ID))
	return nil
}

// cleanupBlocked cancels what a blocked user still has open, so nobody waits
// on them. Caller holds the write lock.
func (a *API) cleanupBlocked(u *User, now time.Time) {
	s := a.store
	for _, t := range s.Trips {
		if t.DriverID != u.ID || t.Status != TripScheduled {
			continue
		}
		var affected []*Booking
		for _, b := range s.Bookings {
			if b.TripID == t.ID && (b.Status == BookingNegotiating || b.Status == BookingAccepted) {
				affected = append(affected, b)
				b.Status, b.UpdatedAt = BookingCancelled, now
				a.reopenRequest(b)
			}
		}
		t.Status = TripCancelled
		a.onTripStatus(t, "cancel", affected)
		a.hub.Event(t.ID, map[string]any{"type": "status", "status": t.Status})
	}
	for _, b := range s.Bookings {
		if b.PassengerID != u.ID || (b.Status != BookingNegotiating && b.Status != BookingAccepted) {
			continue
		}
		t := s.Trips[b.TripID]
		if t == nil || t.Status != TripScheduled {
			continue
		}
		b.Status, b.UpdatedAt = BookingCancelled, now
		a.notify(&Notification{UserID: t.DriverID, Type: NotifBookingCancelled, Title: "Pesanan " + a.firstName(u.ID) + " dibatalkan sistem",
			Body: b.leg() + " · kursi kembali tersedia", Link: "/trip/" + t.ID, TripID: t.ID, BookingID: b.ID})
	}
	for _, rq := range s.Requests {
		if rq.PassengerID == u.ID && rq.Status == RequestOpen {
			rq.Status = RequestCancelled
		}
	}
}

func blockedErr(u *User) error {
	msg := "Akun Anda diblokir oleh admin Nebeng"
	if u.BlockedReason != "" {
		msg += ": " + u.BlockedReason
	}
	return apiError{status: 403, msg: msg + ". Hubungi admin jika ini keliru.", code: "account_blocked"}
}

// TermsVersion: bump when the Terms & Conditions change; users are asked to
// accept the new version on their next visit.
const TermsVersion = "2026-11-10"

func (a *API) acceptTerms(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Version string `json:"version"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	if in.Version != TermsVersion {
		return errf(409, "versi Syarat & Ketentuan sudah berubah, muat ulang halaman")
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	u := s.Users[uid]
	now := time.Now()
	u.TermsVersion, u.TermsAcceptedAt = TermsVersion, &now
	s.Changed()
	writeJSON(w, 200, selfView(u))
	return nil
}
