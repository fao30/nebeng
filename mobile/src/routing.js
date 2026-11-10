// Road routing for the app (OpenStreetMap / OSRM). Same data format as the web,
// so a trip made on either shows the same route and leg times.
import { useEffect, useState } from 'react';
import { haversine } from './format';

const TRAFFIC = { dalam_kota: 1.45, antar_kota: 1.15 };
const cache = new Map();

export function autoKind(a, b) {
  return a && b && haversine(a, b) <= 25 ? 'dalam_kota' : 'antar_kota';
}

export async function fetchRoute(points, kind = 'antar_kota') {
  const pts = (points || []).filter(Boolean);
  if (pts.length < 2) return null;
  const coords = pts.map((p) => `${Number(p.lng).toFixed(6)},${Number(p.lat).toFixed(6)}`).join(';');
  const key = `${kind}|${coords}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: ctl.signal });
    clearTimeout(timer);
    const data = await res.json();
    const r = data.routes?.[0];
    if (data.code !== 'Ok' || !r) throw new Error('no route');
    const f = TRAFFIC[kind] || 1.25;
    const out = {
      source: 'osm',
      path: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      legs: r.legs.map((l) => ({ km: l.distance / 1000, min: (l.duration / 60) * f })),
    };
    cache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

export function useRoute(points, kind) {
  const pts = (points || []).filter(Boolean);
  const key = pts.map((p) => `${p.lat},${p.lng}`).join(';') + kind;
  const [state, setState] = useState({ key: '', route: null });
  useEffect(() => {
    if (pts.length < 2) return;
    let live = true;
    fetchRoute(pts, kind).then((route) => live && setState({ key, route }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state.route : null;
}

/** Saved road data of a trip, or a fresh route for older trips. */
export function useTripRoad(trip) {
  const pts = trip ? [trip.origin, ...(trip.stops || []), trip.destination] : [];
  const saved = trip && trip.leg_minutes?.length === pts.length - 1;
  const fresh = useRoute(saved ? [] : pts, trip?.kind);
  if (!trip) return null;
  if (saved) {
    return {
      source: trip.route_source || 'google',
      path: trip.path ? decodePath(trip.path) : pts,
      legs: trip.leg_minutes.map((min, i) => ({ min, km: trip.leg_km?.[i] || 0 })),
    };
  }
  return fresh;
}

export function fmtMin(min) {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} j ${r} mnt` : `${h} jam`;
}

export const fmtKm = (km) => (km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`);

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
    } while (b >= 0x20 && i <= str.length);
    return res & 1 ? ~(res >> 1) : res >> 1;
  };
  while (i < (str || '').length) {
    lat += dec();
    lng += dec();
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

export function thinPath(path, max = 600) {
  if (path.length <= max) return path;
  const step = (path.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => path[Math.round(i * step)]);
}
