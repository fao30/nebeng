package main

import (
	"math"
	"time"
)

// A trip's route is origin -> stops... -> destination. Segment i runs from
// route[i] to route[i+1]. Each segment has its own price per seat, and seats
// and luggage are counted per segment, so a seat freed when a passenger gets
// off at a stop can be sold again for the rest of the route.

// Span is the part of a route a passenger rides: positions are expressed as
// segmentIndex+fraction (see nearestOnRoute); Start/End are the segment
// indexes covered, End exclusive.
type Span struct {
	FromPos float64 `json:"from_pos"`
	ToPos   float64 `json:"to_pos"`
	Start   int     `json:"seg_start"`
	End     int     `json:"seg_end"`
}

func fullSpan(t *Trip) Span {
	n := len(t.Route()) - 1
	return Span{FromPos: 0, ToPos: float64(n), Start: 0, End: n}
}

func spanFor(t *Trip, pickup, dropoff Point) Span {
	route := t.Route()
	n := len(route) - 1
	_, pf := nearestOnRoute(pickup, route)
	_, pt := nearestOnRoute(dropoff, route)
	if pt < pf {
		pt = pf
	}
	start := int(math.Floor(pf))
	end := int(math.Ceil(pt))
	start = max(0, min(start, n-1))
	end = max(start+1, min(end, n))
	return Span{FromPos: pf, ToPos: pt, Start: start, End: end}
}

// segmentKm returns the length of every segment.
func segmentKm(route []Point) []float64 {
	out := make([]float64, 0, len(route)-1)
	for i := 0; i+1 < len(route); i++ {
		out = append(out, HaversineKm(route[i], route[i+1]))
	}
	return out
}

// SuggestSegmentPrice is the default price per seat for a segment:
// roughly a fair share of fuel and tolls, rounded to Rp1.000.
func SuggestSegmentPrice(km float64) int64 {
	p := km * 1.3 * 650 // road distance ≈ 1.3× straight line, Rp650/km per seat
	return roundUp1000(math.Max(p, 10000))
}

func roundUp1000(v float64) int64 { return int64(math.Ceil(v/1000)) * 1000 }

// distributePrice splits a full-route price over segments by distance.
func distributePrice(total int64, route []Point) []int64 {
	kms := segmentKm(route)
	sum := 0.0
	for _, k := range kms {
		sum += k
	}
	out := make([]int64, len(kms))
	var used int64
	for i, k := range kms {
		if i == len(kms)-1 {
			out[i] = max(0, total-used)
			break
		}
		share := int64(math.Round(float64(total)*k/math.Max(sum, 0.001)/1000)) * 1000
		out[i] = share
		used += share
	}
	return out
}

// pricePerSeat for a span: full price of every segment ridden completely,
// and a proportional share of a segment ridden only partly (pickup or
// drop-off between two stops). Rounded up to Rp1.000.
func pricePerSeat(t *Trip, sp Span) int64 {
	total := 0.0
	for i := sp.Start; i < sp.End && i < len(t.SegmentPrices); i++ {
		lo := math.Max(sp.FromPos, float64(i))
		hi := math.Min(sp.ToPos, float64(i+1))
		cover := math.Max(0, hi-lo)
		if cover > 0.9 {
			cover = 1 // close enough to a stop: charge the whole segment
		}
		total += float64(t.SegmentPrices[i]) * cover
	}
	if total <= 0 && sp.Start < len(t.SegmentPrices) {
		total = float64(t.SegmentPrices[sp.Start]) * 0.3
	}
	return roundUp1000(total)
}

// occupancy returns accepted seats and luggage per segment. Caller holds the lock.
func (s *Store) occupancy(t *Trip) (seats, luggage []int) {
	n := len(t.Route()) - 1
	seats, luggage = make([]int, n), make([]int, n)
	for _, b := range s.Bookings {
		if b.TripID != t.ID || b.Status != BookingAccepted {
			continue
		}
		for i := b.SegStart; i < b.SegEnd && i < n; i++ {
			seats[i] += b.Seats
			luggage[i] += b.Luggage
		}
	}
	return
}

// available seats/luggage on a span: capacity minus the busiest segment.
func (s *Store) available(t *Trip, sp Span) (seats, luggage int) {
	occS, occL := s.occupancy(t)
	maxS, maxL := 0, 0
	for i := sp.Start; i < sp.End && i < len(occS); i++ {
		maxS = max(maxS, occS[i])
		maxL = max(maxL, occL[i])
	}
	return t.Seats - maxS, t.MaxLuggage - maxL
}

// etas estimates the arrival time at each route point.
func etas(t *Trip) []time.Time {
	route := t.Route()
	speed := 60.0 // km/h, intercity
	if t.Kind == KindIntra {
		speed = 28
	}
	out := []time.Time{t.DepartAt}
	acc := 0.0
	for _, k := range segmentKm(route) {
		acc += k * 1.3
		out = append(out, t.DepartAt.Add(time.Duration(acc/speed*float64(time.Hour))).Truncate(5*time.Minute))
	}
	return out
}

// etaAt estimates the time the car passes route position pos.
func etaAt(t *Trip, pos float64) time.Time {
	e := etas(t)
	i := int(math.Floor(pos))
	if i >= len(e)-1 {
		return e[len(e)-1]
	}
	f := pos - float64(i)
	d := e[i+1].Sub(e[i])
	return e[i].Add(time.Duration(f * float64(d))).Truncate(5 * time.Minute)
}

// normalizeTrip fills fields missing in older data files.
func normalizeTrip(t *Trip) {
	if t.Stops == nil {
		t.Stops = []Point{}
	}
	route := t.Route()
	if len(t.SegmentPrices) != len(route)-1 {
		t.SegmentPrices = distributePrice(t.PricePerSeat, route)
	}
	var sum int64
	for _, p := range t.SegmentPrices {
		sum += p
	}
	t.PricePerSeat = sum
}
