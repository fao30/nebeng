package main

import "math"

const earthRadiusKm = 6371.0

func rad(d float64) float64 { return d * math.Pi / 180 }

// HaversineKm returns the great-circle distance between two points in km.
func HaversineKm(a, b Point) float64 {
	dLat := rad(b.Lat - a.Lat)
	dLng := rad(b.Lng - a.Lng)
	h := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rad(a.Lat))*math.Cos(rad(b.Lat))*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusKm * math.Asin(math.Min(1, math.Sqrt(h)))
}

// projectOnSegment returns the distance (km) from p to segment a->b and the
// fraction t (0..1) along the segment of the closest point. Uses an
// equirectangular projection, accurate enough for a few hundred km.
func projectOnSegment(p, a, b Point) (distKm, t float64) {
	lat0 := rad((a.Lat + b.Lat) / 2)
	toXY := func(q Point) (float64, float64) {
		return rad(q.Lng) * math.Cos(lat0) * earthRadiusKm, rad(q.Lat) * earthRadiusKm
	}
	ax, ay := toXY(a)
	bx, by := toXY(b)
	px, py := toXY(p)
	dx, dy := bx-ax, by-ay
	l2 := dx*dx + dy*dy
	if l2 == 0 {
		return math.Hypot(px-ax, py-ay), 0
	}
	t = ((px-ax)*dx + (py-ay)*dy) / l2
	t = math.Max(0, math.Min(1, t))
	cx, cy := ax+t*dx, ay+t*dy
	return math.Hypot(px-cx, py-cy), t
}

// nearestOnRoute returns the distance (km) from p to the polyline `route` and
// its position along the route, expressed as segmentIndex + fraction.
func nearestOnRoute(p Point, route []Point) (distKm, pos float64) {
	distKm = math.Inf(1)
	for i := 0; i+1 < len(route); i++ {
		d, t := projectOnSegment(p, route[i], route[i+1])
		if d < distKm {
			distKm, pos = d, float64(i)+t
		}
	}
	return distKm, pos
}

// RouteMatch decides whether a passenger going from `from` to `to` can ride a
// trip whose route is origin -> stops... -> destination. The pickup must lie
// within fromRadius km of the route (or any stop), the drop-off within
// toRadius km, and the pickup must come before the drop-off along the route.
// Either point may be nil (not filtered).
// Returns match, pickup distance, dropoff distance.
func RouteMatch(route []Point, from, to *Point, fromRadius, toRadius float64) (bool, float64, float64) {
	var dFrom, dTo float64
	posFrom, posTo := 0.0, float64(len(route)-1)
	if from != nil {
		dFrom, posFrom = nearestOnRoute(*from, route)
		if dFrom > fromRadius {
			return false, dFrom, 0
		}
	}
	if to != nil {
		dTo, posTo = nearestOnRoute(*to, route)
		if dTo > toRadius {
			return false, dFrom, dTo
		}
	}
	if from != nil && to != nil && posFrom > posTo+0.02 {
		return false, dFrom, dTo // opposite direction
	}
	return true, dFrom, dTo
}

// AutoKind classifies a trip: beyond 25 km straight-line is treated as intercity.
func AutoKind(a, b Point) string {
	if HaversineKm(a, b) > 25 {
		return KindInter
	}
	return KindIntra
}
