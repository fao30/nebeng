'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { fmtDay } from '@/lib/format';
import AdminShell from '@/components/AdminShell';
import BlockSheet from '@/components/BlockSheet';
import { Avatar } from '@/components/ui';

const stars = (avg, n) =>
  n ? (
    <span className="rating">
      ★ {avg.toFixed(1)} <span className="muted">({n})</span>
    </span>
  ) : (
    <span className="muted">-</span>
  );

export default function AdminUsers() {
  const [f, setF] = useState({ q: '', role: '' });
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [blocking, setBlocking] = useState(null);

  const load = useCallback(() => {
    api(`/admin/users${qs(f)}`)
      .then(setList)
      .catch((e) => setErr(e.message));
  }, [f]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <AdminShell title="Pengguna" desc="Semua akun. Satu akun bisa menjadi pemilik mobil dan penumpang sekaligus. Blokir akun yang melanggar ketentuan.">
      <div className="filterbar">
        <label className="field">
          <span className="field-label">Cari</span>
          <input className="input" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Nama, email, atau telepon" />
        </label>
        <label className="field">
          <span className="field-label">Tampilkan</span>
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="">Semua</option>
            <option value="driver">Pernah jadi pemilik mobil</option>
            <option value="passenger">Pernah jadi penumpang</option>
            <option value="reported">Pernah dilaporkan</option>
            <option value="blocked">Diblokir</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Kontak</th>
              <th>Kendaraan</th>
              <th>Rating pemilik mobil</th>
              <th>Rating penumpang</th>
              <th className="num">Trip</th>
              <th className="num">Pesanan</th>
              <th className="num">Laporan</th>
              <th>Bergabung</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list && list.length === 0 && (
              <tr>
                <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  Tidak ada pengguna yang cocok.
                </td>
              </tr>
            )}
            {(list || []).map((u) => (
              <tr key={u.id} className={u.blocked ? 'row-blocked' : ''}>
                <td>
                  <div className="row" style={{ '--gap': '8px' }}>
                    <Avatar name={u.name} />
                    <div>
                      <b>{u.name}</b>
                      <div className="row" style={{ '--gap': '4px' }}>
                        {u.is_admin && <span className="chip chip-primary">Admin</span>}
                        {u.blocked && (
                          <span className="chip tone-red" title={u.blocked_reason}>
                            Diblokir
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="tnum">{u.phone || '-'}</span>
                  <span className="sub">{u.email}</span>
                </td>
                <td>{u.car_model ? `${u.car_model} ${u.car_plate}` : <span className="muted">-</span>}</td>
                <td>{stars(u.driver_rating, u.driver_ratings)}</td>
                <td>{stars(u.passenger_rating, u.passenger_ratings)}</td>
                <td className="num">{u.trips_as_driver}</td>
                <td className="num">{u.bookings_as_passenger}</td>
                <td className="num">
                  {u.reports_against ? (
                    <a href={`/admin/laporan?q=${encodeURIComponent(u.email)}`} className={u.open_reports ? 'strong link-danger' : ''}>
                      {u.reports_against}
                      {u.open_reports ? ` (${u.open_reports} baru)` : ''}
                    </a>
                  ) : (
                    0
                  )}
                </td>
                <td className="small">{fmtDay(u.created_at)}</td>
                <td>
                  {!u.is_admin && (
                    <button className={`btn btn-sm ${u.blocked ? 'btn-soft' : 'btn-ghost btn-danger'}`} onClick={() => setBlocking(u)}>
                      {u.blocked ? 'Buka blokir' : 'Blokir'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BlockSheet user={blocking} onClose={() => setBlocking(null)} onDone={load} />
    </AdminShell>
  );
}
