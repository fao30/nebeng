package main

import (
	"math"
	"net/http"
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

// Passengers board and leave only at the driver's own points (origin, stops,
// destination). Their own locations are used to find trips and to pick the
// nearest driver points; they then walk/ride to those points.

// bestStops picks the boarding point index pi and alighting index di (pi < di)
// that minimise the passenger's distance from `from` to route[pi] plus from
// `to` to route[di], keeping each within its radius. Nil from/to means the
// passenger takes the route from its start / to its end.
func bestStops(route []Point, from, to *Point, rFrom, rTo float64) (pi, di int, dFrom, dTo float64, ok bool) {
	n := len(route)
	best := math.Inf(1)
	for i := 0; i < n-1; i++ {
		df := 0.0
		if from != nil {
			if df = HaversineKm(*from, route[i]); df > rFrom {
				continue
			}
		} else if i != 0 {
			continue
		}
		for j := i + 1; j < n; j++ {
			dt := 0.0
			if to != nil {
				if dt = HaversineKm(*to, route[j]); dt > rTo {
					continue
				}
			} else if j != n-1 {
				continue
			}
			if df+dt < best {
				best, pi, di, dFrom, dTo, ok = df+dt, i, j, df, dt, true
			}
		}
	}
	return
}

func spanIdx(pi, di int) Span {
	return Span{FromPos: float64(pi), ToPos: float64(di), Start: pi, End: di}
}

// spanFor snaps a passenger's own pickup/drop-off places to the driver's points.
func spanFor(t *Trip, pickup, dropoff Point) Span {
	pi, di, _, _, ok := bestStops(t.Route(), &pickup, &dropoff, math.Inf(1), math.Inf(1))
	if !ok {
		return fullSpan(t)
	}
	return spanIdx(pi, di)
}

// segmentKm returns the length of every segment.
func segmentKm(route []Point) []float64 {
	out := make([]float64, 0, len(route)-1)
	for i := 0; i+1 < len(route); i++ {
		out = append(out, HaversineKm(route[i], route[i+1]))
	}
	return out
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
	out := []time.Time{t.DepartAt}
	if n := len(t.Route()) - 1; len(t.LegMinutes) == n {
		acc := 0.0
		for _, m := range t.LegMinutes {
			acc += m
			out = append(out, t.DepartAt.Add(time.Duration(acc*float64(time.Minute))).Truncate(5*time.Minute))
		}
		return out
	}
	acc := 0.0
	for _, k := range segmentKm(t.Route()) {
		acc += k
		out = append(out, t.DepartAt.Add(travelDuration(acc, t.Kind)).Truncate(5*time.Minute))
	}
	return out
}

// tripKm is the road distance when measured, else the straight-line route length.
func tripKm(t *Trip) float64 {
	if len(t.LegKm) == len(t.Route())-1 && len(t.LegKm) > 0 {
		sum := 0.0
		for _, k := range t.LegKm {
			sum += k
		}
		return sum
	}
	return routeKm(t.Route())
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

// saveTripRoute lets the app attach measured road legs to a trip that has none
// yet (trips created before road routing). The first viewer who can route the
// trip fills it in for everyone. Values must be plausible for the trip's points.
func (a *API) saveTripRoute(w http.ResponseWriter, r *http.Request, uid string) error {
	var in tripInput
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
	route := t.Route()
	nseg := len(route) - 1
	if len(t.LegMinutes) == nseg && t.DriverID != uid {
		writeJSON(w, 200, map[string]any{"saved": false})
		return nil
	}
	cleanRouting(&in, nseg)
	if in.LegKm == nil {
		return errf(400, "data rute tidak lengkap")
	}
	for i := 0; i < nseg; i++ {
		straight := HaversineKm(route[i], route[i+1])
		minPerKm := in.LegMinutes[i] / in.LegKm[i]
		if in.LegKm[i] < straight*0.9 || in.LegKm[i] > straight*4+3 || minPerKm < 0.35 || minPerKm > 8 {
			return errf(400, "data rute tidak masuk akal")
		}
	}
	t.LegKm, t.LegMinutes, t.RouteSrc, t.Path = in.LegKm, in.LegMinutes, in.RouteSrc, in.Path
	s.Changed()
	writeJSON(w, 200, map[string]any{"saved": true, "etas": etas(t)})
	return nil
}
