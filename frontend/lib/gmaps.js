'use client';
// Google Maps Platform: Maps JavaScript API, Places API (New) and Geocoding API.
// Set NEXT_PUBLIC_GOOGLE_MAPS_KEY (restricted to your domain) and optionally
// NEXT_PUBLIC_GOOGLE_MAP_ID (needed for custom markers; DEMO_MAP_ID works for testing).

export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

export const googleEnabled = () => !!GOOGLE_KEY && !failed;

let loading = null;
let failed = false;
const failListeners = new Set();

export function onGoogleFail(fn) {
  failListeners.add(fn);
  return () => failListeners.delete(fn);
}

function markFailed() {
  failed = true;
  loading = null;
  failListeners.forEach((fn) => fn());
}

export function loadGoogle() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (!GOOGLE_KEY || failed) return Promise.reject(new Error('Google Maps tidak tersedia'));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  // Google calls this global when the key is invalid or the domain isn't allowed.
  window.gm_authFailure = markFailed;
  loading = new Promise((resolve, reject) => {
    const cb = '__nebengGoogleReady';
    const timer = setTimeout(() => {
      markFailed();
      reject(new Error('Google Maps terlalu lama dimuat'));
    }, 15000);
    window[cb] = () => {
      clearTimeout(timer);
      resolve(window.google.maps);
    };
    const s = document.createElement('script');
    const params = new URLSearchParams({ key: GOOGLE_KEY, v: 'weekly', loading: 'async', language: 'id', region: 'ID', callback: cb });
    s.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    s.async = true;
    s.onerror = () => {
      clearTimeout(timer);
      markFailed();
      reject(new Error('Google Maps gagal dimuat'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

// One session token per "type → pick" cycle keeps Places billing per session.
let sessionToken = null;

/**
 * Place suggestions from Places API (New). Each result has a `resolve()`
 * that fetches the coordinates when the user picks it.
 */
export async function googleSearch(query, { near } = {}) {
  const maps = await loadGoogle();
  const { AutocompleteSessionToken, AutocompleteSuggestion } = await maps.importLibrary('places');
  if (!sessionToken) sessionToken = new AutocompleteSessionToken();
  const req = { input: query, sessionToken, includedRegionCodes: ['id'], language: 'id', region: 'id' };
  if (near) req.locationBias = { center: { lat: near.lat, lng: near.lng }, radius: 30000 };
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
  return (suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .slice(0, 6)
    .map((p) => {
      const main = p.mainText?.toString() || p.text?.toString() || '';
      const secondary = p.secondaryText?.toString() || '';
      return {
        label: secondary ? `${main}, ${secondary}` : main,
        source: 'google',
        async resolve() {
          const place = p.toPlace();
          await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
          sessionToken = null; // session ends when a place is picked
          const name = place.displayName || main;
          const addr = (place.formattedAddress || secondary).replace(/,\s*Indonesia$/, '');
          return {
            lat: place.location.lat(),
            lng: place.location.lng(),
            label: addr && !addr.startsWith(name) ? `${name}, ${addr}` : addr || name,
          };
        },
      };
    });
}

export async function googleReverse(lat, lng) {
  const maps = await loadGoogle();
  const { Geocoder } = await maps.importLibrary('geocoding');
  const { results } = await new Geocoder().geocode({ location: { lat, lng }, language: 'id' });
  const addr = results?.[0]?.formatted_address;
  if (!addr) throw new Error('alamat tidak ditemukan');
  return addr.replace(/,\s*Indonesia$/, '');
}
