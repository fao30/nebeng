export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('nebeng_token');
  } catch {
    return null;
  }
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
export async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Pencarian alamat gagal');
  const rows = await res.json();
  return rows.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: shortLabel(r.display_name) }));
}

export async function reverseGeocode(lat, lng) {
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
