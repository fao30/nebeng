'use client';
// AMap (Gaode) international Maps Platform — https://mapsplatform.opnavi.com
// Configure with NEXT_PUBLIC_AMAP_KEY, NEXT_PUBLIC_AMAP_SECURITY_CODE and
// optionally NEXT_PUBLIC_AMAP_REGION ("sg" default, or "de").
// Without a key the app falls back to OpenStreetMap (Leaflet).

export const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || '';
const SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || '';
const REGION = process.env.NEXT_PUBLIC_AMAP_REGION === 'de' ? 'de' : 'sg';

export const amapEnabled = () => !!AMAP_KEY;

let loading = null;
let failed = false;

export function loadAMap() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (!AMAP_KEY || failed) return Promise.reject(new Error('AMap tidak tersedia'));
  if (window.AMap?.Map) return Promise.resolve(window.AMap);
  if (loading) return loading;
  // Both must be set before the entry script loads.
  window._AMapSecurityConfig = { securityJsCode: SECURITY_CODE };
  window._AMapServiceConfig = { type: `oversea_${REGION}` };
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://${REGION}-webapi.opnavi.com/maps?v=2.0&key=${encodeURIComponent(AMAP_KEY)}`;
    s.async = true;
    const timer = setTimeout(() => fail(new Error('AMap terlalu lama dimuat')), 15000);
    function fail(err) {
      clearTimeout(timer);
      failed = true;
      loading = null;
      reject(err);
    }
    s.onload = () => {
      clearTimeout(timer);
      if (window.AMap?.Map) resolve(window.AMap);
      else fail(new Error('AMap gagal dimuat'));
    };
    s.onerror = () => fail(new Error('AMap gagal dimuat'));
    document.head.appendChild(s);
  });
  return loading;
}

function withPlugin(AMap, name) {
  return new Promise((resolve, reject) => {
    try {
      AMap.plugin([name], () => resolve(AMap));
    } catch (e) {
      reject(e);
    }
    setTimeout(() => reject(new Error(`${name} timeout`)), 8000);
  });
}

const toPoint = (loc) => {
  if (!loc) return null;
  const lng = typeof loc.getLng === 'function' ? loc.getLng() : loc.lng;
  const lat = typeof loc.getLat === 'function' ? loc.getLat() : loc.lat;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

/** Address suggestions through AMap AutoComplete. Throws on failure so callers can fall back. */
export async function amapSearch(query) {
  const AMap = await withPlugin(await loadAMap(), 'AMap.AutoComplete');
  const ac = new AMap.AutoComplete({ city: '', citylimit: false });
  const tips = await new Promise((resolve, reject) => {
    ac.search(query, (status, result) => (status === 'complete' ? resolve(result?.tips || []) : status === 'no_data' ? resolve([]) : reject(new Error(status))));
  });
  return tips
    .map((t) => {
      const p = toPoint(t.location);
      if (!p) return null;
      const extra = [t.address, t.district].filter((x) => x && typeof x === 'string').join(', ');
      return { ...p, label: extra ? `${t.name}, ${extra}` : t.name };
    })
    .filter(Boolean)
    .slice(0, 6);
}

/** Reverse geocoding through AMap Geocoder. Throws on failure. */
export async function amapReverse(lat, lng) {
  const AMap = await withPlugin(await loadAMap(), 'AMap.Geocoder');
  const geocoder = new AMap.Geocoder({});
  return new Promise((resolve, reject) => {
    geocoder.getAddress([lng, lat], (status, result) => {
      const addr = result?.regeocode?.formattedAddress;
      status === 'complete' && addr ? resolve(addr) : reject(new Error(status));
    });
  });
}
