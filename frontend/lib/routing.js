'use client';
// Road routing for a multi-stop trip: the path along real roads plus the
// distance and driving time of every leg (A→B, B→C, …).
//
// Providers, in order:
//   1. Google Routes (Maps JS `google.maps.routes.Route`, needs "Routes API"
//      enabled on the key), traffic-aware.
//   2. Google DirectionsService (legacy Directions API), for older keys.
//   3. OSRM public demo server (OpenStreetMap roads, no traffic; times are
//      padded for city traffic).
//   4. Straight-line estimate (same formula as before).
import { useEffect, useState } from 'react';
import { googleEnabled, loadGoogle } from './gmaps';
import { DEFAULT_SETTINGS, haversine } from './format';
import { api } from './api';

const cache = new Map();
const OSRM_TRAFFIC = { dalam_kota: 1.45, antar_kota: 1.15 };

const ll = (p) => ({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng });
const keyOf = (pts, kind) => `${kind}|` + pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');

async function viaGoogleRoutes(pts, departAt) {
  const { Route } = await google.maps.importLibrary('routes');
  const future = departAt && new Date(departAt) > new Date(Date.now() + 60e3);
  const { routes } = await Route.computeRoutes({
    origin: pts[0],
    destination: pts[pts.length - 1],
    intermediates: pts.slice(1, -1).map((p) => ({ location: p })),
    travelMode: 'DRIVING',
    routingPreference: 'TRAFFIC_AWARE',
    ...(future ? { departureTime: new Date(departAt) } : {}),
    language: 'id',
    region: 'ID',
    fields: ['path', 'legs', 'durationMillis', 'distanceMeters'],
  });
  const r = routes?.[0];
  if (!r?.legs?.length) throw new Error('no route');
  return {
    source: 'google',
    path: (r.path || []).map(ll),
    legs: r.legs.map((l) => ({ km: (l.distanceMeters || 0) / 1000, min: (l.durationMillis || 0) / 60000 })),
  };
}

async function viaGoogleDirections(pts, departAt) {
  const svc = new google.maps.DirectionsService();
  const future = departAt && new Date(departAt) > new Date(Date.now() + 60e3);
  const res = await svc.route({
    origin: pts[0],
    destination: pts[pts.length - 1],
    waypoints: pts.slice(1, -1).map((p) => ({ location: p, stopover: true })),
    travelMode: 'DRIVING',
    ...(future ? { drivingOptions: { departureTime: new Date(departAt) } } : {}),
  });
  const r = res.routes?.[0];
  if (!r?.legs?.length) throw new Error('no route');
  return {
    source: 'google',
    path: (r.overview_path || []).map(ll),
    legs: r.legs.map((l) => ({ km: l.distance.value / 1000, min: (l.duration_in_traffic || l.duration).value / 60 })),
  };
}

async function viaOsrm(pts, kind) {
  const coords = pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: ctl.signal });
    const data = await res.json();
    const r = data.routes?.[0];
    if (data.code !== 'Ok' || !r) throw new Error('no route');
    const f = OSRM_TRAFFIC[kind] || 1.25;
    return {
      source: 'osm',
      path: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      legs: r.legs.map((l) => ({ km: l.distance / 1000, min: (l.duration / 60) * f })),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function estimateRoute(pts, kind, cfg = DEFAULT_SETTINGS) {
  const mpk = kind === 'dalam_kota' ? cfg.min_per_km_intra : cfg.min_per_km_inter;
  return {
    source: 'estimate',
    path: pts,
    legs: pts.slice(1).map((p, i) => {
      const km = haversine(pts[i], p) * cfg.road_factor;
      return { km, min: km * mpk };
    }),
  };
}

/** Road route through all points. Never rejects: falls back to an estimate. */
export async function fetchRoute(points, { kind = 'antar_kota', departAt } = {}) {
  const pts = (points || []).filter(Boolean).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  if (pts.length < 2) return null;
  const key = keyOf(pts, kind);
  if (cache.has(key)) return cache.get(key);
  const job = (async () => {
    if (googleEnabled()) {
      try {
        await loadGoogle();
        try {
          return await viaGoogleRoutes(pts, departAt);
        } catch {
          return await viaGoogleDirections(pts, departAt);
        }
      } catch {
        /* fall through */
      }
    }
    try {
      return await viaOsrm(pts, kind);
    } catch {
      return estimateRoute(pts, kind);
    }
  })();
  cache.set(key, job);
  const out = await job;
  if (out.source === 'estimate') cache.delete(key); // try again next time
  return out;
}

/** React hook: { route, loading }. */
export function useRoute(points, opts = {}) {
  const pts = (points || []).filter(Boolean);
  const key = pts.length >= 2 ? keyOf(pts.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })), opts.kind || 'antar_kota') : '';
  const [state, setState] = useState({ key: '', route: null });
  useEffect(() => {
    if (!key) return;
    let live = true;
    fetchRoute(pts, opts).then((route) => live && setState({ key, route }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { route: state.key === key ? state.route : null, loading: !!key && state.key !== key };
}

/** Arrival time at every point, from leg minutes; rounded down to 5 minutes like the server. */
export function etasFromLegs(departAt, legs) {
  const t0 = new Date(departAt).getTime();
  const out = [new Date(t0)];
  let acc = 0;
  for (const l of legs) {
    acc += l.min;
    out.push(new Date(Math.floor((t0 + acc * 60e3) / 300e3) * 300e3));
  }
  return out;
}

export function fmtKm(km) {
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}

export function fmtMin(min) {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} j ${r} mnt` : `${h} jam`;
}

// Google encoded polyline, used to store the road path compactly with the trip.
export function encodePath(path) {
  let out = '';
  let plat = 0;
  let plng = 0;
  const enc = (v) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return s + String.fromCharCode(v + 63);
  };
  for (const p of path) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += enc(lat - plat) + enc(lng - plng);
    plat = lat;
    plng = lng;
  }
  return out;
}

export function decodePath(str) {
  const out = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const dec = () => {
    let shift = 0;
    let res = 0;
    let b;
    do {
      b = str.charCodeAt(i++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && i < str.length + 1);
    return res & 1 ? ~(res >> 1) : res >> 1;
  };
  while (i < (str || '').length) {
    lat += dec();
    lng += dec();
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

/** Keep at most `max` points (evenly), always keeping the ends. */
export function thinPath(path, max = 600) {
  if (path.length <= max) return path;
  const step = (path.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => path[Math.round(i * step)]);
}

/**
 * Road path and legs for a published trip: uses what was saved with the trip,
 * otherwise asks the router (older trips).
 */
const savedTrips = new Set();

export function useTripRoad(trip, { onSaved } = {}) {
  const pts = trip ? [trip.origin, ...(trip.stops || []), trip.destination] : [];
  const saved = trip && trip.leg_minutes?.length === pts.length - 1;
  const { route } = useRoute(saved ? [] : pts, { kind: trip?.kind, departAt: trip?.depart_at });

  // Trips made before road routing: store the measured legs on the server once,
  // so jam tiba, search results and quotes use them for everyone.
  useEffect(() => {
    if (!trip || saved || !route || route.source === 'estimate' || savedTrips.has(trip.id)) return;
    if (route.legs.length !== pts.length - 1) return;
    let token = '';
    try {
      token = localStorage.getItem('nebeng_token') || '';
    } catch {
      /* ignore */
    }
    if (!token) return;
    savedTrips.add(trip.id);
    api(`/trips/${trip.id}/route`, {
      method: 'POST',
      body: {
        leg_km: route.legs.map((l) => Math.round(l.km * 10) / 10),
        leg_minutes: route.legs.map((l) => Math.round(l.min * 10) / 10),
        route_source: route.source,
        path: encodePath(thinPath(route.path)),
      },
    })
      .then((r) => r?.saved && onSaved?.())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, saved, route]);

  if (!trip) return null;
  if (saved) {
    return {
      source: trip.route_source || 'google',
      path: trip.path ? decodePath(trip.path) : pts,
      legs: trip.leg_minutes.map((min, i) => ({ min, km: trip.leg_km?.[i] || 0 })),
      saved: true,
    };
  }
  return route ? { ...route, saved: false } : null;
}

export const ROUTE_SOURCE_LABEL = {
  google: 'Google Maps, memperhitungkan lalu lintas',
  osm: 'OpenStreetMap, ditambah perkiraan macet',
  estimate: 'perkiraan jarak lurus',
};

/** Trip with jam tiba taken from road legs when the server still has the straight-line estimate. */
export function withRoadEtas(trip, road) {
  if (!trip || !road || road.saved || road.source === 'estimate') return trip;
  const n = (trip.stops || []).length + 1;
  if (road.legs.length !== n) return trip;
  return { ...trip, etas: etasFromLegs(trip.depart_at, road.legs).map((d) => d.toISOString()) };
}
