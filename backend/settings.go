package main

import (
	"math"
	"sync/atomic"
	"time"
)

// Settings are platform-wide values the admin can change from the CRM.
type Settings struct {
	// PricePerKm is the suggested price per seat for 1 km of road.
	PricePerKm float64 `json:"price_per_km"`
	// MinSegmentPrice is the lowest suggested price for one segment.
	MinSegmentPrice int64 `json:"min_segment_price"`
	// RoadFactor converts straight-line distance to road distance.
	RoadFactor float64 `json:"road_factor"`
	// Average minutes needed to drive 1 km of road.
	MinPerKmIntra float64   `json:"min_per_km_intra"` // dalam kota
	MinPerKmInter float64   `json:"min_per_km_inter"` // antar kota
	UpdatedAt     time.Time `json:"updated_at"`
	UpdatedBy     string    `json:"updated_by,omitempty"`
}

func defaultSettings() *Settings {
	return &Settings{PricePerKm: 650, MinSegmentPrice: 10000, RoadFactor: 1.3, MinPerKmIntra: 2.1, MinPerKmInter: 1.0}
}

func (c *Settings) valid() error {
	switch {
	case c.PricePerKm < 0 || c.PricePerKm > 100000:
		return errf(400, "harga per km harus 0–100.000")
	case c.MinSegmentPrice < 0 || c.MinSegmentPrice > 10_000_000:
		return errf(400, "harga minimum per ruas tidak valid")
	case c.RoadFactor < 1 || c.RoadFactor > 3:
		return errf(400, "faktor jalan harus 1–3")
	case c.MinPerKmIntra <= 0 || c.MinPerKmIntra > 30 || c.MinPerKmInter <= 0 || c.MinPerKmInter > 30:
		return errf(400, "menit per km harus lebih dari 0 dan maksimal 30")
	}
	return nil
}

// cfg is read on every price/ETA calculation; swapped atomically on update.
var cfg atomic.Pointer[Settings]

func init() { cfg.Store(defaultSettings()) }

func settings() *Settings { return cfg.Load() }

// SuggestSegmentPrice is the default price per seat for a segment of the
// given straight-line length, rounded up to Rp1.000.
func SuggestSegmentPrice(km float64) int64 {
	c := settings()
	return roundUp1000(math.Max(km*c.RoadFactor*c.PricePerKm, float64(c.MinSegmentPrice)))
}

// travelDuration estimates driving time for a straight-line distance.
func travelDuration(km float64, kind string) time.Duration {
	c := settings()
	mpk := c.MinPerKmInter
	if kind == KindIntra {
		mpk = c.MinPerKmIntra
	}
	return time.Duration(km * c.RoadFactor * mpk * float64(time.Minute))
}
