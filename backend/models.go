package main

import "time"

type Point struct {
	Lat   float64 `json:"lat"`
	Lng   float64 `json:"lng"`
	Label string  `json:"label"`
	Note  string  `json:"note,omitempty"` // landmark / patokan written by the user
}

type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	CarModel  string    `json:"car_model"`
	CarPlate  string    `json:"car_plate"`
	IsAdmin   bool      `json:"is_admin"`
	PassHash  string    `json:"pass_hash,omitempty"`
	Salt      string    `json:"salt,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// PublicUser is what other users may see.
type PublicUser struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Phone    string `json:"phone,omitempty"`
	CarModel string `json:"car_model,omitempty"`
	CarPlate string `json:"car_plate,omitempty"`
}

const (
	KindIntra = "dalam_kota"
	KindInter = "antar_kota"

	TripScheduled = "scheduled"
	TripOngoing   = "ongoing"
	TripCompleted = "completed"
	TripCancelled = "cancelled"
)

type Amenities struct {
	Max2Back bool `json:"max2_back"` // at most two people in the back seat
	Pets     bool `json:"pets"`
	Smoking  bool `json:"smoking"`
	BabySeat bool `json:"baby_seat"`
	Parcel   bool `json:"parcel"` // takes parcels / titipan
	Cargo    bool `json:"cargo"`  // bulky items
}

type Trip struct {
	ID          string    `json:"id"`
	DriverID    string    `json:"driver_id"`
	Origin      Point     `json:"origin"`
	Destination Point     `json:"destination"`
	Stops       []Point   `json:"stops"` // intermediate stop points, in order
	DepartAt    time.Time `json:"depart_at"`
	Seats       int       `json:"seats"`       // max passengers
	Luggage     bool      `json:"luggage"`     // accepts suitcases
	MaxLuggage  int       `json:"max_luggage"` // max suitcases at once
	// SegmentPrices[i] is the price per seat between route[i] and route[i+1].
	SegmentPrices  []int64    `json:"segment_prices"`
	PricePerSeat   int64      `json:"price_per_seat"` // full route = sum of segments
	Negotiable     bool       `json:"negotiable"`
	InstantBooking bool       `json:"instant_booking"` // book at list price without driver approval
	Amenities      Amenities  `json:"amenities"`
	Kind           string     `json:"kind"`
	Vehicle        string     `json:"vehicle"`
	Notes          string     `json:"notes"`
	Status         string     `json:"status"`
	ShareToken     string     `json:"share_token,omitempty"`
	StartedAt      *time.Time `json:"started_at,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

const (
	BookingNegotiating = "negotiating"
	BookingAccepted    = "accepted"
	BookingRejected    = "rejected"
	BookingCancelled   = "cancelled"

	SourcePassenger   = "passenger_booking" // passenger asked to join a trip
	SourceDriverOffer = "driver_offer"      // driver offered a trip on a ride request

	ByPassenger = "passenger"
	ByDriver    = "driver"
)

type Offer struct {
	By      string    `json:"by"`
	Price   int64     `json:"price"`
	Message string    `json:"message"`
	At      time.Time `json:"at"`
}

type Booking struct {
	ID          string     `json:"id"`
	TripID      string     `json:"trip_id"`
	PassengerID string     `json:"passenger_id"`
	RequestID   string     `json:"request_id,omitempty"`
	Source      string     `json:"source"`
	Pickup      Point      `json:"pickup"`
	Dropoff     Point      `json:"dropoff"`
	Seats       int        `json:"seats"`
	Luggage     int        `json:"luggage"` // suitcases
	SegStart    int        `json:"seg_start"`
	SegEnd      int        `json:"seg_end"`
	FromPos     float64    `json:"from_pos"`
	ToPos       float64    `json:"to_pos"`
	ListPrice   int64      `json:"list_price"` // driver's price for this span × seats
	PickupAt    time.Time  `json:"pickup_at"`
	OfferedTime *time.Time `json:"offered_time,omitempty"` // driver-proposed pickup time
	Status      string     `json:"status"`
	Offers      []Offer    `json:"offers"`
	AgreedPrice int64      `json:"agreed_price"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// Route returns origin, stops and destination in travel order.
func (t *Trip) Route() []Point {
	r := make([]Point, 0, len(t.Stops)+2)
	r = append(r, t.Origin)
	r = append(r, t.Stops...)
	return append(r, t.Destination)
}

func (b *Booking) LastOffer() *Offer {
	if len(b.Offers) == 0 {
		return nil
	}
	return &b.Offers[len(b.Offers)-1]
}

const (
	RequestOpen      = "open"
	RequestMatched   = "matched"
	RequestCancelled = "cancelled"
)

type RideRequest struct {
	ID          string    `json:"id"`
	PassengerID string    `json:"passenger_id"`
	Origin      Point     `json:"origin"`
	Destination Point     `json:"destination"`
	DepartAt    time.Time `json:"depart_at"`
	Seats       int       `json:"seats"`
	Luggage     int       `json:"luggage"`
	Budget      int64     `json:"budget"`
	Notes       string    `json:"notes"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

type Position struct {
	UserID  string    `json:"user_id"`
	Name    string    `json:"name"`
	Role    string    `json:"role"` // driver | passenger
	Lat     float64   `json:"lat"`
	Lng     float64   `json:"lng"`
	Heading float64   `json:"heading"`
	Speed   float64   `json:"speed"`
	At      time.Time `json:"at"`
}

// Message is a chat message between the driver and passenger of a booking.
type Message struct {
	ID        string    `json:"id"`
	BookingID string    `json:"booking_id"`
	SenderID  string    `json:"sender_id"`
	Text      string    `json:"text"`
	At        time.Time `json:"at"`
}
