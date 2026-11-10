const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export const fmtRp = (n) => rupiah.format(n || 0).replace(/\s/g, '');

export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDay(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tmr = new Date(Date.now() + 864e5);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Hari ini';
  if (same(d, tmr)) return 'Besok';
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtDate(iso) {
  return `${fmtDay(iso)}, ${fmtTime(iso)}`;
}

export function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} mnt`;
  return r ? `${h} j ${r} mnt` : `${h} jam`;
}

export const kindLabel = (k) => (k === 'antar_kota' ? 'Antar kota' : 'Dalam kota');

export const tripStatusLabel = {
  scheduled: 'Terjadwal',
  ongoing: 'Sedang jalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const bookingStatusLabel = {
  negotiating: 'Menunggu',
  accepted: 'Terkonfirmasi',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};

export const bookingStatusChip = {
  negotiating: 'chip-amber',
  accepted: 'chip-mint',
  rejected: 'chip-red',
  cancelled: '',
};

// value for <input type="datetime-local"> some hours from now
export function localInputValue(hoursFromNow = 2, date) {
  const d = date ? new Date(date) : new Date(Date.now() + hoursFromNow * 3600e3);
  if (!date) d.setMinutes(0, 0, 0);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayISO() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const routeOf = (t) => [t.origin, ...(t.stops || []), t.destination];

export function shortPlace(p) {
  return (p?.label || '').split(',')[0] || 'Titik di peta';
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');
}

export function haversine(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Platform settings (admin-editable). Defaults match the backend's.
export const DEFAULT_SETTINGS = { price_per_km: 650, min_segment_price: 10000, road_factor: 1.3, min_per_km_intra: 2.1, min_per_km_inter: 1.0 };

// Same formula as the backend's SuggestSegmentPrice.
export function suggestSegmentPrice(km, cfg = DEFAULT_SETTINGS) {
  return Math.ceil(Math.max(km * cfg.road_factor * cfg.price_per_km, cfg.min_segment_price) / 1000) * 1000;
}

export function estimateEtas(points, departISO, kind, cfg = DEFAULT_SETTINGS) {
  const mpk = kind === 'dalam_kota' ? cfg.min_per_km_intra : cfg.min_per_km_inter;
  const out = [new Date(departISO)];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    acc += haversine(points[i - 1], points[i]) * cfg.road_factor;
    const t = new Date(departISO).getTime() + acc * mpk * 60e3;
    out.push(new Date(Math.floor(t / 300e3) * 300e3));
  }
  return out;
}

export const timeBuckets = [
  { id: 'subuh', label: 'Sebelum 06.00', icon: 'moon', test: (h) => h < 6 },
  { id: 'pagi', label: '06.00 – 12.00', icon: 'sunrise', test: (h) => h >= 6 && h < 12 },
  { id: 'siang', label: '12.00 – 18.00', icon: 'sun', test: (h) => h >= 12 && h < 18 },
  { id: 'malam', label: 'Setelah 18.00', icon: 'sunset', test: (h) => h >= 18 },
];

export const AMENITIES = [
  { key: 'instant', icon: 'bolt', label: 'Pesan instan', no: 'Perlu persetujuan driver' },
  { key: 'max2_back', icon: 'sofa', label: 'Maks. 2 orang di belakang', no: 'Kursi belakang bisa 3 orang' },
  { key: 'luggage', icon: 'luggage', label: 'Boleh bawa koper', no: 'Tidak menerima koper' },
  { key: 'parcel', icon: 'box', label: 'Terima titipan paket', no: 'Tidak menerima paket' },
  { key: 'cargo', icon: 'cargo', label: 'Boleh barang besar', no: 'Tanpa barang besar' },
  { key: 'pets', icon: 'paw', label: 'Boleh bawa hewan', no: 'Tanpa hewan peliharaan' },
  { key: 'baby_seat', icon: 'baby', label: 'Ada kursi bayi', no: 'Tidak ada kursi bayi' },
  { key: 'smoking', icon: 'smoke', label: 'Boleh merokok', no: 'Dilarang merokok' },
];

export function hasAmenity(trip, key) {
  if (key === 'instant') return !!trip.instant_booking;
  if (key === 'luggage') return !!trip.luggage;
  return !!trip.amenities?.[key];
}
