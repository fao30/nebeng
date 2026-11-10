package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// KYC: every account verifies identity (ID photo, live selfie, selfie holding
// the ID) before booking or offering rides; car owners also verify the car
// (front photo with plate, STNK). Admins review each submission within 24 h.
// Photos are stored encrypted on disk (AES-256-GCM) and only served to admins
// and the owner.

const (
	KindIdentity = "identity"
	KindVehicle  = "vehicle"

	KYCNone     = ""
	KYCPending  = "pending"
	KYCApproved = "approved"
	KYCRejected = "rejected"

	NotifKYC = "kyc"

	maxPhotoBytes = 8 << 20
	reviewSLA     = 24 * time.Hour
)

var identitySlots = []string{"id_photo", "selfie", "id_selfie"}
var vehicleSlots = []string{"car_front", "stnk"}

type Verification struct {
	ID          string            `json:"id"`
	UserID      string            `json:"user_id"`
	Kind        string            `json:"kind"` // identity | vehicle
	Status      string            `json:"status"`
	DocType     string            `json:"doc_type,omitempty"` // ktp | sim (identity)
	Files       map[string]string `json:"files"`              // slot → file id
	CarModel    string            `json:"car_model,omitempty"`
	CarColor    string            `json:"car_color,omitempty"`
	CarPlate    string            `json:"car_plate,omitempty"`
	SubmittedAt time.Time         `json:"submitted_at"`
	ReviewedAt  *time.Time        `json:"reviewed_at,omitempty"`
	ReviewedBy  string            `json:"reviewed_by,omitempty"`
	Reason      string            `json:"reason,omitempty"` // why it was rejected
}

// ---------- encrypted file storage ----------

type Vault struct {
	dir string
	key []byte
}

func NewVault(dir, secret string) *Vault {
	_ = os.MkdirAll(dir, 0o700)
	k := sha256.Sum256([]byte("nebeng-kyc:" + secret))
	return &Vault{dir: dir, key: k[:]}
}

func (v *Vault) gcm() (cipher.AEAD, error) {
	b, err := aes.NewCipher(v.key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(b)
}

func (v *Vault) path(id string) string { return filepath.Join(v.dir, id+".bin") }

func (v *Vault) Put(data []byte) (string, error) {
	g, err := v.gcm()
	if err != nil {
		return "", err
	}
	nonce := make([]byte, g.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	id := newID("kf")
	out := g.Seal(nonce, nonce, data, []byte(id))
	if err := os.WriteFile(v.path(id), out, 0o600); err != nil {
		return "", err
	}
	return id, nil
}

func (v *Vault) Get(id string) ([]byte, error) {
	if strings.ContainsAny(id, "/\\.") {
		return nil, errors.New("bad id")
	}
	raw, err := os.ReadFile(v.path(id))
	if err != nil {
		return nil, err
	}
	g, err := v.gcm()
	if err != nil {
		return nil, err
	}
	if len(raw) < g.NonceSize() {
		return nil, errors.New("corrupt")
	}
	return g.Open(nil, raw[:g.NonceSize()], raw[g.NonceSize():], []byte(id))
}

func (v *Vault) Delete(id string) { _ = os.Remove(v.path(id)) }

// ---------- helpers ----------

func kycKey(uid, kind string) string { return uid + ":" + kind }

func identityOK(u *User) bool { return u != nil && u.IdentityStatus == KYCApproved }
func vehicleOK(u *User) bool  { return identityOK(u) && u.VehicleStatus == KYCApproved }

func kycStatusText(st string) string {
	switch st {
	case KYCPending:
		return "sedang ditinjau admin (maksimal 1x24 jam)"
	case KYCRejected:
		return "ditolak, silakan kirim ulang"
	default:
		return "belum dikirim"
	}
}

// requireIdentity: booking and posting requests need a verified identity.
func requireIdentity(u *User) error {
	if identityOK(u) {
		return nil
	}
	return apiError{status: 403, code: "kyc_required",
		msg: "Verifikasi identitas dulu sebelum numpang. Status verifikasi Anda: " + kycStatusText(u.IdentityStatus) + "."}
}

// requireVehicle: creating trips and offering rides need a verified identity and car.
func requireVehicle(u *User) error {
	if err := requireIdentity(u); err != nil {
		return err
	}
	if vehicleOK(u) {
		return nil
	}
	return apiError{status: 403, code: "vehicle_required",
		msg: "Aktifkan fitur pemilik mobil dulu: kirim foto mobil tampak depan dan STNK. Status: " + kycStatusText(u.VehicleStatus) + "."}
}

func sniffImage(b []byte) bool {
	ct := http.DetectContentType(b)
	return ct == "image/jpeg" || ct == "image/png" || ct == "image/webp"
}

// ---------- user endpoints ----------

type KYCView struct {
	Identity *Verification `json:"identity"`
	Vehicle  *Verification `json:"vehicle"`
	SLAHours int           `json:"sla_hours"`
}

func (a *API) kycStatus(w http.ResponseWriter, r *http.Request, uid string) error {
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, 200, KYCView{Identity: s.Verifications[kycKey(uid, KindIdentity)], Vehicle: s.Verifications[kycKey(uid, KindVehicle)], SLAHours: 24})
	return nil
}

// kycSubmit receives a multipart form with the photos of one kind.
func (a *API) kycSubmit(w http.ResponseWriter, r *http.Request, uid string) error {
	kind := r.PathValue("kind")
	var slots []string
	switch kind {
	case KindIdentity:
		slots = identitySlots
	case KindVehicle:
		slots = vehicleSlots
	default:
		return errf(404, "jenis verifikasi tidak dikenal")
	}
	r.Body = http.MaxBytesReader(w, r.Body, int64(len(slots))*maxPhotoBytes+1<<20)
	if err := r.ParseMultipartForm(4 << 20); err != nil {
		return errf(400, "foto terlalu besar atau tidak terbaca (maksimal 8 MB per foto)")
	}
	defer r.MultipartForm.RemoveAll()
	photos := map[string][]byte{}
	for _, slot := range slots {
		f, _, err := r.FormFile(slot)
		if err != nil {
			return errf(400, "foto %s belum diisi", slotLabel(slot))
		}
		data, err := io.ReadAll(io.LimitReader(f, maxPhotoBytes+1))
		f.Close()
		if err != nil || len(data) == 0 {
			return errf(400, "foto %s tidak terbaca", slotLabel(slot))
		}
		if len(data) > maxPhotoBytes {
			return errf(400, "foto %s lebih dari 8 MB", slotLabel(slot))
		}
		if !sniffImage(data) {
			return errf(400, "foto %s harus berupa gambar JPG, PNG, atau WEBP", slotLabel(slot))
		}
		photos[slot] = data
	}
	v := &Verification{ID: newID("kyc"), UserID: uid, Kind: kind, Status: KYCPending, Files: map[string]string{}, SubmittedAt: time.Now()}
	if kind == KindIdentity {
		v.DocType = r.FormValue("doc_type")
		if v.DocType != "ktp" && v.DocType != "sim" {
			return errf(400, "pilih jenis dokumen: KTP atau SIM")
		}
	} else {
		v.CarModel = clip(r.FormValue("car_model"), 60)
		v.CarColor = clip(r.FormValue("car_color"), 30)
		v.CarPlate = strings.ToUpper(clip(r.FormValue("car_plate"), 15))
		if v.CarModel == "" || v.CarPlate == "" {
			return errf(400, "isi merek/model mobil dan pelat nomor")
		}
	}

	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	u := s.Users[uid]
	if kind == KindVehicle && u.IdentityStatus != KYCApproved && u.IdentityStatus != KYCPending {
		return errf(409, "kirim verifikasi identitas dulu, lalu data mobil")
	}
	cur := u.IdentityStatus
	if kind == KindVehicle {
		cur = u.VehicleStatus
	}
	if cur == KYCPending {
		return errf(409, "verifikasi Anda masih ditinjau admin (maksimal 1x24 jam)")
	}
	if cur == KYCApproved && kind == KindIdentity {
		return errf(409, "identitas Anda sudah terverifikasi")
	}
	for _, slot := range slots {
		id, err := a.vault.Put(photos[slot])
		if err != nil {
			return errf(500, "gagal menyimpan foto, coba lagi")
		}
		v.Files[slot] = id
	}
	key := kycKey(uid, kind)
	if old := s.Verifications[key]; old != nil {
		for _, id := range old.Files {
			a.vault.Delete(id)
		}
	}
	s.Verifications[key] = v
	if kind == KindIdentity {
		u.IdentityStatus = KYCPending
	} else {
		u.VehicleStatus = KYCPending
	}
	s.Changed()
	what := "identitas"
	if kind == KindVehicle {
		what = "mobil " + v.CarModel + " " + v.CarPlate
	}
	for _, ad := range s.Users {
		if ad.IsAdmin && ad.ID != uid {
			a.notify(&Notification{UserID: ad.ID, Type: NotifKYC, Title: "Verifikasi baru: " + u.Name,
				Body: "Tinjau " + what + " maksimal 1x24 jam", Link: "/admin/verifikasi?id=" + v.ID})
		}
	}
	writeJSON(w, 201, v)
	return nil
}

func slotLabel(slot string) string {
	return map[string]string{
		"id_photo":  "KTP/SIM",
		"selfie":    "wajah (selfie)",
		"id_selfie": "selfie dengan KTP/SIM",
		"car_front": "mobil tampak depan",
		"stnk":      "STNK",
	}[slot]
}

// kycFile serves a decrypted photo to its owner or an admin.
func (a *API) kycFile(w http.ResponseWriter, r *http.Request, uid string) error {
	id := r.PathValue("id")
	s := a.store
	s.mu.RLock()
	owner := ""
	for _, v := range s.Verifications {
		for _, f := range v.Files {
			if f == id {
				owner = v.UserID
			}
		}
	}
	allowed := owner != "" && (owner == uid || s.Users[uid].IsAdmin)
	s.mu.RUnlock()
	if !allowed {
		return errf(404, "foto tidak ditemukan")
	}
	data, err := a.vault.Get(id)
	if err != nil {
		return errf(404, "foto tidak ditemukan")
	}
	w.Header().Set("Content-Type", http.DetectContentType(data))
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, err = io.Copy(w, bytes.NewReader(data))
	return err
}

// ---------- admin ----------

type AdminVerification struct {
	*Verification
	User    *AdminUser `json:"user"`
	Overdue bool       `json:"overdue"`
}

func (a *API) adminVerifications(w http.ResponseWriter, r *http.Request, uid string) error {
	status := r.URL.Query().Get("status")
	kind := r.URL.Query().Get("kind")
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	s := a.store
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []AdminVerification{}
	counts := map[string]int{}
	now := time.Now()
	for _, v := range s.Verifications {
		if kind != "" && v.Kind != kind {
			continue
		}
		if !matches(q, s.Users[v.UserID]) && !strings.Contains(strings.ToLower(v.CarPlate), q) {
			continue
		}
		counts[v.Status]++
		if status != "" && v.Status != status {
			continue
		}
		out = append(out, AdminVerification{Verification: v, User: a.adminUser(v.UserID),
			Overdue: v.Status == KYCPending && now.Sub(v.SubmittedAt) > reviewSLA})
	}
	// Pending first, oldest first (closest to the 24 h limit); then newest reviewed.
	sort.Slice(out, func(i, j int) bool {
		pi, pj := out[i].Status == KYCPending, out[j].Status == KYCPending
		if pi != pj {
			return pi
		}
		if pi {
			return out[i].SubmittedAt.Before(out[j].SubmittedAt)
		}
		return out[i].SubmittedAt.After(out[j].SubmittedAt)
	})
	writeJSON(w, 200, map[string]any{"items": out, "counts": counts})
	return nil
}

func (a *API) adminReviewVerification(w http.ResponseWriter, r *http.Request, uid string) error {
	var in struct {
		Approve bool   `json:"approve"`
		Reason  string `json:"reason"`
	}
	if err := readJSON(r, &in); err != nil {
		return err
	}
	in.Reason = clip(in.Reason, 300)
	if !in.Approve && in.Reason == "" {
		return errf(400, "tulis alasan penolakan supaya pengguna bisa memperbaiki")
	}
	s := a.store
	s.mu.Lock()
	defer s.mu.Unlock()
	var v *Verification
	for _, x := range s.Verifications {
		if x.ID == r.PathValue("id") {
			v = x
		}
	}
	if v == nil {
		return errf(404, "verifikasi tidak ditemukan")
	}
	if v.Status != KYCPending {
		return errf(409, "verifikasi ini sudah ditinjau")
	}
	u := s.Users[v.UserID]
	now := time.Now()
	v.ReviewedAt, v.ReviewedBy = &now, uid
	st := KYCRejected
	if in.Approve {
		st = KYCApproved
		v.Reason = ""
	} else {
		v.Reason = in.Reason
	}
	v.Status = st
	n := &Notification{UserID: u.ID, Type: NotifKYC, Link: "/verifikasi"}
	if v.Kind == KindIdentity {
		u.IdentityStatus = st
		if in.Approve {
			n.Title, n.Body, n.Link = "Identitas Anda terverifikasi", "Sekarang Anda bisa memesan tumpangan dan memasang permintaan.", "/cari"
		} else {
			n.Title, n.Body = "Verifikasi identitas ditolak", "Alasan: "+in.Reason+" · kirim ulang foto Anda"
		}
	} else {
		u.VehicleStatus = st
		if in.Approve {
			u.CarModel, u.CarPlate = v.CarModel, v.CarPlate
			n.Title, n.Body, n.Link = "Fitur pemilik mobil aktif", v.CarModel+" "+v.CarPlate+" terverifikasi. Sekarang Anda bisa membuat trip.", "/driver/trip-baru"
		} else {
			n.Title, n.Body = "Verifikasi mobil ditolak", "Alasan: "+in.Reason+" · kirim ulang foto mobil dan STNK"
		}
	}
	s.Changed()
	a.notify(n)
	writeJSON(w, 200, AdminVerification{Verification: v, User: a.adminUser(u.ID)})
	return nil
}
