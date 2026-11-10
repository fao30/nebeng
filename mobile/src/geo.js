import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

// Place search for the app: OpenStreetMap Nominatim (free; fine for testing,
// 1 request/second). Swap for Google Places with an app-restricted key later.
const UA = { 'User-Agent': 'NebengApp/1.0 (nebeng-mocha.vercel.app)', 'Accept-Language': 'id' };
const cache = new Map();

function tidy(name) {
  return name
    .split(',')
    .map((x) => x.trim())
    .filter((x, i, a) => x && a.indexOf(x) === i && !/^\d{5}$/.test(x) && x !== 'Indonesia')
    .slice(0, 4)
    .join(', ');
}

export async function searchPlaces(q, { signal, near } = {}) {
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const params = [`q=${encodeURIComponent(q)}`, 'format=jsonv2', 'countrycodes=id', 'limit=8', 'addressdetails=0'];
  if (near) params.push(`viewbox=${near.lng - 0.6},${near.lat + 0.6},${near.lng + 0.6},${near.lat - 0.6}`);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.join('&')}`, { headers: UA, signal });
  if (!res.ok) throw new Error('Pencarian alamat gagal');
  const out = (await res.json()).map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: tidy(r.display_name) }));
  cache.set(key, out);
  return out;
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=17`, { headers: UA });
    const j = await res.json();
    return tidy(j.display_name || '') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export async function askLocationPermission() {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Izin lokasi',
      message: 'Nebeng memakai lokasi untuk titik jemput dan berbagi posisi saat trip berlangsung.',
      buttonPositive: 'Izinkan',
      buttonNegative: 'Nanti',
    });
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }
  return new Promise((resolve) => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    );
  });
}

export async function currentPosition() {
  if (!(await askLocationPermission())) throw new Error('Izin lokasi ditolak. Ketik alamat saja.');
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading, speed: p.coords.speed }),
      () => reject(new Error('Lokasi tidak didapat. Pastikan GPS aktif.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    ),
  );
}

export function watchPosition(cb, onErr) {
  const id = Geolocation.watchPosition(
    (p) => cb({ lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading || 0, speed: p.coords.speed ? p.coords.speed * 3.6 : 0 }),
    () => onErr?.(new Error('GPS tidak tersedia')),
    { enableHighAccuracy: true, distanceFilter: 15, interval: 5000, fastestInterval: 3000 },
  );
  return () => Geolocation.clearWatch(id);
}
