import { amapEnabled, amapReverse, amapSearch } from './amap';
import { maptilerEnabled, maptilerReverse, maptilerSearch } from './maptiler';
import { googleEnabled, googleReverse, googleSearch } from './gmaps';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('nebeng_token');
  } catch {
    return null;
  }
}

/** The admin blocked this account: sign out and explain on the sign-in page. */
export function accountBlocked(message) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('nebeng_token');
    sessionStorage.setItem('nebeng_blocked', message || 'Akun Anda diblokir oleh admin Numpang.');
  } catch {
    /* storage unavailable */
  }
  if (!window.location.pathname.startsWith('/masuk')) window.location.href = '/masuk?blocked=1';
}

export async function api(path, { method = 'GET', body, token } = {}) {
  const t = token ?? getToken();
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 403 && data?.code === 'account_blocked' && t) accountBlocked(data.error);
    const err = new Error(data?.error || `Server membalas ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Free geocoding via OpenStreetMap Nominatim (fine for testing; use a paid
// provider for production traffic).
const geoCache = new Map();

/**
 * Address search. Provider order: Google Places (if key set) → MapTiler →
 * AMap → OpenStreetMap Nominatim. Google results carry a `resolve()` that
 * fetches coordinates when picked. Results are cached per query; pass an
 * AbortSignal so a newer keystroke cancels the older request.
 */
export async function geocode(query, { signal, near } = {}) {
  const key = query.trim().toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key);
  let rows = null;
  if (googleEnabled()) {
    try {
      rows = await googleSearch(query, { near });
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    } catch (e) {
      if (e.name === 'AbortError') throw e;
    }
  }
  if (!rows?.length && maptilerEnabled()) {
    try {
      rows = await maptilerSearch(query, { signal, near });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
    }
  }
  if (!rows?.length && amapEnabled()) {
    try {
      rows = await amapSearch(query);
    } catch {
      /* next provider */
    }
  }
  if (!rows?.length) rows = await nominatimSearch(query, signal);
  if (!rows.some((r) => r.resolve)) geoCache.set(key, rows);
  return rows;
}

async function nominatimSearch(query, signal) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error('Pencarian alamat gagal');
  const rows = await res.json();
  return rows.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: shortLabel(r.display_name) }));
}

export async function reverseGeocode(lat, lng) {
  if (googleEnabled()) {
    try {
      return await googleReverse(lat, lng);
    } catch {
      /* next provider */
    }
  }
  if (maptilerEnabled()) {
    try {
      return await maptilerReverse(lat, lng);
    } catch {
      /* next provider */
    }
  }
  if (amapEnabled()) {
    try {
      return await amapReverse(lat, lng);
    } catch {
      /* fall back to OpenStreetMap */
    }
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&accept-language=id&lat=${lat}&lon=${lng}`;
    const res = await fetch(url);
    const r = await res.json();
    return shortLabel(r.display_name || '') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function shortLabel(name) {
  return name.split(',').slice(0, 3).map((s) => s.trim()).join(', ');
}
