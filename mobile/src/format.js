const pad = (x) => String(x).padStart(2, '0');
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function fmtRp(n) {
  const s = String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp${s}`;
}

export function fmtTime(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

export function fmtDay(iso) {
  const d = new Date(iso);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, new Date())) return 'Hari ini';
  if (same(d, new Date(Date.now() + 864e5))) return 'Besok';
  if (same(d, new Date(Date.now() - 864e5))) return 'Kemarin';
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;
}

export const fmtDate = (iso) => `${fmtDay(iso)}, ${fmtTime(iso)}`;

export function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} mnt`;
  return r ? `${h} j ${r} mnt` : `${h} jam`;
}

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return fmtDay(iso);
}

export const km = (d) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1).replace('.', ',')} km`);

export const routeOf = (t) => [t.origin, ...(t.stops || []), t.destination];
export const shortPlace = (p) => (p?.label || '').split(',')[0] || 'Titik di peta';

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

export const DEFAULT_SETTINGS = { price_per_km: 650, min_segment_price: 10000, road_factor: 1.3 };
export function suggestPrice(points, cfg = DEFAULT_SETTINGS) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const k = haversine(points[i - 1], points[i]);
    total += Math.ceil(Math.max(k * cfg.road_factor * cfg.price_per_km, cfg.min_segment_price) / 1000) * 1000;
  }
  return total;
}

export const tripStatusLabel = { scheduled: 'Terjadwal', ongoing: 'Berjalan', completed: 'Selesai', cancelled: 'Dibatalkan' };
export const bookingStatusLabel = { negotiating: 'Menunggu', accepted: 'Terkonfirmasi', rejected: 'Ditolak', cancelled: 'Dibatalkan' };
export const bookingStatusTone = { negotiating: 'amber', accepted: 'mint', rejected: 'red', cancelled: 'muted' };
