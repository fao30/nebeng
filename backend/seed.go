package main

import (
	"log"
	"time"
)

// Seed creates demo accounts and trips around Jabodetabek / Jawa Barat when
// the store is empty. All demo passwords are "demo123".
func Seed(s *Store) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.Users) > 0 {
		return
	}
	mk := func(name, email, phone, car, plate string) *User {
		salt := randomToken(16)
		u := &User{ID: newID("usr"), Name: name, Email: email, Phone: phone, CarModel: car, CarPlate: plate,
			Salt: salt, PassHash: hashPassword("demo123", salt), CreatedAt: time.Now(),
			IdentityStatus: KYCApproved} // demo accounts are pre-verified
		if car != "" {
			u.VehicleStatus = KYCApproved
		}
		s.Users[u.ID] = u
		return u
	}
	budi := mk("Budi Santoso", "budi@demo.id", "081200000001", "Toyota Avanza", "B 1234 XYZ")
	rina := mk("Rina Wijaya", "rina@demo.id", "081200000002", "Honda Brio", "D 4321 ABC")
	sari := mk("Sari Lestari", "sari@demo.id", "081200000003", "", "")
	mk("Andi Pratama", "andi@demo.id", "081200000004", "", "")

	p := func(lat, lng float64, label string) Point { return Point{Lat: lat, Lng: lng, Label: label} }
	day := func(d, h, m int) time.Time {
		loc, _ := time.LoadLocation("Asia/Jakarta")
		n := time.Now().In(loc)
		return time.Date(n.Year(), n.Month(), n.Day()+d, h, m, 0, 0, loc)
	}
	type opt struct {
		luggage  int
		nego     bool
		instant  bool
		am       Amenities
		segments []int64
	}
	trip := func(driver *User, o, d Point, stops []Point, at time.Time, seats int, price int64, op opt, notes string) *Trip {
		if stops == nil {
			stops = []Point{}
		}
		t := &Trip{ID: newID("trp"), DriverID: driver.ID, Origin: o, Destination: d, Stops: stops, DepartAt: at, Seats: seats,
			Luggage: op.luggage > 0, MaxLuggage: op.luggage, PricePerSeat: price, SegmentPrices: op.segments,
			Negotiable: op.nego, InstantBooking: op.instant, Amenities: op.am,
			Kind: AutoKind(o, d), Vehicle: driver.CarModel, Plate: driver.CarPlate,
			Notes: notes, Status: TripScheduled, CreatedAt: time.Now()}
		normalizeTrip(t)
		s.Trips[t.ID] = t
		return t
	}
	monas := p(-6.1754, 106.8272, "Monas, Jakarta Pusat")
	sudirman := p(-6.2088, 106.8229, "Sudirman, Jakarta Selatan")
	bogor := p(-6.5971, 106.8060, "Kebun Raya Bogor")
	bandung := p(-6.9025, 107.6188, "Gedung Sate, Bandung")
	sukabumi := p(-6.9277, 106.9300, "Alun-alun Sukabumi")
	dago := p(-6.8853, 107.6135, "Dago, Bandung")
	stBandung := p(-6.9147, 107.6020, "Stasiun Bandung")
	depok := p(-6.4025, 106.7942, "Margonda, Depok")
	kuningan := p(-6.2297, 106.8295, "Kuningan, Jakarta Selatan")
	cianjur := p(-6.8168, 107.1425, "Alun-alun Cianjur")

	semanggi := p(-6.2196, 106.8143, "Semanggi, Jakarta Selatan")
	bekasi := p(-6.2475, 106.9910, "Bekasi Barat")
	cikarang := p(-6.2617, 107.1528, "Cikarang Utara, Bekasi")
	cawang := p(-6.2425, 106.8731, "Cawang, Jakarta Timur")
	purwakarta := p(-6.5569, 107.4431, "Rest Area KM 97, Purwakarta")
	tambun := p(-6.2628, 107.0571, "Tambun, Bekasi")
	// Driver meeting-point notes (titik kumpul).
	monas.Note = "Pintu Barat Daya, dekat halte TransJakarta"
	purwakarta.Note = "Depan musala rest area"
	cawang.Note = "Halte Cawang UKI, sisi timur"
	semanggi.Note = "Lobi Plaza Semanggi"
	bekasi.Note = "Depan Stasiun Bekasi, pintu utara"

	monasTrip := trip(budi, monas, bandung, []Point{cawang, purwakarta}, day(1, 7, 0), 3, 0,
		opt{luggage: 3, nego: true, instant: true, segments: []int64{15000, 60000, 45000},
			am: Amenities{Max2Back: true, Parcel: true}},
		"Lewat tol Cipularang. Stop di Cawang dan rest area KM 97, bisa turun di mana saja sepanjang rute.")
	trip(budi, bogor, sudirman, nil, day(1, 6, 30), 4, 45000,
		opt{nego: true, am: Amenities{Max2Back: true}}, "Berangkat pagi, lewat Jagorawi. Tidak bisa bawa koper.")
	trip(rina, sukabumi, bogor, nil, day(2, 8, 0), 2, 60000,
		opt{luggage: 1, instant: true, am: Amenities{Pets: true, BabySeat: true}}, "Harga pas, maksimal 1 koper kecil.")
	trip(rina, dago, stBandung, nil, day(0, 23, 0), 3, 20000,
		opt{nego: true, am: Amenities{Smoking: true}}, "Dalam kota Bandung.")
	trip(rina, bandung, cianjur, nil, day(3, 16, 0), 3, 50000,
		opt{luggage: 2, nego: true, am: Amenities{Parcel: true, Cargo: true}}, "")
	ckTrip := trip(budi, semanggi, cikarang, []Point{bekasi}, day(1, 17, 30), 3, 0,
		opt{luggage: 2, nego: true, instant: true, segments: []int64{25000, 20000}, am: Amenities{Parcel: true}},
		"Pulang kantor, stop di Bekasi Barat.")

	req := func(u *User, o, d Point, at time.Time, seats, luggage int, budget int64, notes string) {
		r := &RideRequest{ID: newID("req"), PassengerID: u.ID, Origin: o, Destination: d, DepartAt: at,
			Seats: seats, Luggage: luggage, Budget: budget, Notes: notes, Status: RequestOpen, CreatedAt: time.Now()}
		s.Requests[r.ID] = r
	}
	req(sari, depok, kuningan, day(1, 6, 45), 1, 0, 35000, "Ke kantor, jam masuk 08.00")
	req(sari, cianjur, bandung, day(2, 9, 0), 2, 2, 100000, "Berdua dengan adik, bawa 2 koper")
	req(sari, kuningan, tambun, day(1, 17, 45), 1, 1, 35000, "Pulang kerja, bawa 1 koper kecil")

	// A confirmed booking with a chat, and one under negotiation, so the
	// admin CRM has something to show.
	andi := s.Users[s.byEmailLocked("andi@demo.id")]
	book := func(t *Trip, u *User, pick, drop Point, seats, lug int, status string, offers []Offer, chat [][2]string) {
		now := time.Now()
		sp := spanFor(t, pick, drop)
		list := pricePerSeat(t, sp) * int64(seats)
		route := t.Route()
		from, to := pick, drop
		b := &Booking{ID: newID("bkg"), TripID: t.ID, PassengerID: u.ID, Source: SourcePassenger,
			Pickup: route[sp.Start], Dropoff: route[sp.End], PassengerFrom: &from, PassengerTo: &to,
			Seats: seats, Luggage: lug, SegStart: sp.Start, SegEnd: sp.End, FromPos: sp.FromPos, ToPos: sp.ToPos,
			ListPrice: list, PickupAt: etaAt(t, sp.FromPos), Status: status, Offers: offers, CreatedAt: now, UpdatedAt: now}
		if status == BookingAccepted {
			b.AgreedPrice = offers[len(offers)-1].Price
		}
		s.Bookings[b.ID] = b
		for i, m := range chat {
			sender := u.ID
			if m[0] == "d" {
				sender = t.DriverID
			}
			id := newID("msg")
			s.Messages[id] = &Message{ID: id, BookingID: b.ID, SenderID: sender, Text: m[1], At: now.Add(time.Duration(i-len(chat)) * 7 * time.Minute)}
		}
	}
	book(monasTrip, sari, monas, purwakarta, 2, 1, BookingAccepted,
		[]Offer{{By: ByPassenger, Price: 150000, Message: "Berdua dengan adik", At: time.Now().Add(-time.Hour)}},
		[][2]string{{"p", "Pak, saya pakai baju biru, nunggu di halte ya"}, {"d", "Siap, mobil Avanza hitam, B 1234 XYZ. Jam 7 tepat jalan."}, {"p", "Oke, terima kasih Pak"}})
	book(ckTrip, andi, semanggi, tambun, 1, 1, BookingNegotiating,
		[]Offer{{By: ByPassenger, Price: 25000, Message: "Boleh 25 ribu?", At: time.Now().Add(-time.Hour)}},
		[][2]string{{"p", "Pak, kopernya kecil kok, muat di kabin"}})

	s.reindex()
	s.Changed()
	log.Println("seed: demo data created (password: demo123)")
}
