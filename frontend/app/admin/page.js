'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate, fmtDuration, fmtRp, suggestSegmentPrice } from '@/lib/format';
import { clearSettingsCache } from '@/lib/settings';
import AdminShell from '@/components/AdminShell';

const FIELDS = [
  { key: 'price_per_km', label: 'Harga saran per km', desc: 'Per kursi, untuk 1 km jarak jalan. Dipakai sebagai harga saran saat pemilik mobil membuat trip.', unit: 'Rp / km', step: 50 },
  { key: 'min_segment_price', label: 'Harga saran minimum per ruas', desc: 'Ruas yang sangat pendek tidak disarankan di bawah angka ini.', unit: 'Rp', step: 1000 },
  { key: 'min_per_km_intra', label: 'Rata-rata menit per km, dalam kota', desc: 'Dipakai untuk menghitung jam tiba dari titik A ke B di trip dalam kota.', unit: 'menit / km', step: 0.1 },
  { key: 'min_per_km_inter', label: 'Rata-rata menit per km, antar kota', desc: 'Untuk trip antar kota (lebih dari 25 km), biasanya lebih cepat karena lewat tol.', unit: 'menit / km', step: 0.1 },
  { key: 'road_factor', label: 'Faktor jarak jalan', desc: 'Jarak di jalan dibanding garis lurus di peta. 1,3 artinya jalan 30% lebih panjang.', unit: '×', step: 0.05 },
];

function Settings() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [km, setKm] = useState(150);

  useEffect(() => {
    api('/settings').then((s) => {
      setForm(s);
      setSaved(s);
    });
  }, []);

  if (!form) return <p className="muted">Memuat pengaturan…</p>;

  const dirty = FIELDS.some((f) => Number(form[f.key]) !== Number(saved[f.key]));
  const num = (k) => Number(form[k]) || 0;
  const cfg = Object.fromEntries(FIELDS.map((f) => [f.key, num(f.key)]));
  const straight = km / cfg.road_factor; // example: user types road km
  const intraKm = 12;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const s = await api('/admin/settings', { method: 'PUT', body: cfg });
      setForm(s);
      setSaved(s);
      clearSettingsCache();
      setMsg('Tersimpan. Harga saran dan perkiraan jam di seluruh aplikasi langsung memakai angka baru.');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail">
      <form className="card" onSubmit={save}>
        <h2>Tarif dan waktu tempuh</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          {saved.updated_by ? `Terakhir diubah oleh ${saved.updated_by}, ${fmtDate(saved.updated_at)}.` : 'Masih memakai nilai bawaan.'}
        </p>
        <div style={{ marginTop: 8 }}>
          {FIELDS.map((f) => (
            <label key={f.key} className="setting-row">
              <span>
                <b>{f.label}</b>
                <span className="help">{f.desc}</span>
              </span>
              <span className="unit-input">
                <input type="number" step={f.step} min="0" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                <span>{f.unit}</span>
              </span>
            </label>
          ))}
        </div>
        {err && <p className="error">{err}</p>}
        {msg && <p className="ok small">{msg}</p>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" disabled={busy || !dirty}>
            Simpan pengaturan
          </button>
          {dirty && (
            <button type="button" className="btn btn-ghost" onClick={() => setForm(saved)}>
              Batalkan perubahan
            </button>
          )}
        </div>
      </form>

      <aside className="detail-aside stack" style={{ '--gap': '12px' }}>
        <div className="preview-box stack" style={{ '--gap': '12px' }}>
          <h3>Pratinjau</h3>
          <label className="field">
            <span className="field-label">Contoh jarak di jalan</span>
            <span className="unit-input">
              <input type="number" min="1" value={km} onChange={(e) => setKm(Number(e.target.value) || 0)} />
              <span>km</span>
            </span>
          </label>
          <div className="breakdown" style={{ listStyle: 'none' }}>
            <div className="row-between small">
              <span>Harga saran per kursi</span>
              <b className="tnum">{fmtRp(suggestSegmentPrice(straight, cfg))}</b>
            </div>
            <div className="row-between small" style={{ marginTop: 6 }}>
              <span>Waktu tempuh antar kota</span>
              <b className="tnum">{fmtDuration(km * cfg.min_per_km_inter * 60e3)}</b>
            </div>
            <div className="row-between small" style={{ marginTop: 6 }}>
              <span>Waktu tempuh {intraKm} km dalam kota</span>
              <b className="tnum">{fmtDuration(intraKm * cfg.min_per_km_intra * 60e3)}</b>
            </div>
          </div>
          <p className="xs muted">
            Contoh: {km} km ≈ Jakarta–Bandung lewat tol. Pemilik mobil tetap bisa mengubah harga tiap ruas; angka ini hanya saran awal.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Stats() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api('/admin/stats').then(setS).catch(() => {});
  }, []);
  if (!s) return null;
  const active = (s.trips.scheduled || 0) + (s.trips.ongoing || 0);
  return (
    <div className="stats">
      <div className="stat">
        <span>Pengguna</span>
        <b>{s.users}</b>
      </div>
      <div className="stat">
        <span>Trip aktif</span>
        <b>{active}</b>
        <small>{s.trips_total} total, {s.trips.completed || 0} selesai</small>
      </div>
      <div className="stat">
        <span>Pesanan terkonfirmasi</span>
        <b>{s.bookings.accepted || 0}</b>
        <small>{s.bookings.negotiating || 0} masih negosiasi</small>
      </div>
      <div className="stat">
        <span>Nilai transaksi</span>
        <b>{fmtRp(s.gmv)}</b>
        <small>{s.seats_booked} kursi terjual</small>
      </div>
      <div className="stat">
        <span>Permintaan terbuka</span>
        <b>{s.open_requests}</b>
      </div>
      <div className="stat">
        <span>Pesan chat</span>
        <b>{s.messages}</b>
      </div>
    </div>
  );
}

export default function AdminHome() {
  return (
    <AdminShell title="Panel admin" desc="Ringkasan platform dan pengaturan tarif.">
      <Stats />
      <Settings />
    </AdminShell>
  );
}
