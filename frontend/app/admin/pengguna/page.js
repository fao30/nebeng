'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { fmtDay } from '@/lib/format';
import AdminShell from '@/components/AdminShell';
import { Avatar } from '@/components/ui';

export default function AdminUsers() {
  const [f, setF] = useState({ q: '', role: '' });
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');

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
    <AdminShell title="Pengguna" desc="Semua akun. Satu akun bisa menjadi driver dan penumpang sekaligus.">
      <div className="filterbar">
        <label className="field">
          <span className="field-label">Cari</span>
          <input className="input" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Nama, email, atau telepon" />
        </label>
        <label className="field">
          <span className="field-label">Peran</span>
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="">Semua</option>
            <option value="driver">Pernah jadi driver</option>
            <option value="passenger">Pernah jadi penumpang</option>
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
              <th className="num">Trip (driver)</th>
              <th className="num">Pesanan</th>
              <th className="num">Permintaan</th>
              <th>Bergabung</th>
            </tr>
          </thead>
          <tbody>
            {(list || []).map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="row" style={{ '--gap': '8px' }}>
                    <Avatar name={u.name} />
                    <b>{u.name}</b>
                    {u.is_admin && <span className="chip chip-primary">Admin</span>}
                  </div>
                </td>
                <td>
                  <span className="tnum">{u.phone || '—'}</span>
                  <span className="sub">{u.email}</span>
                </td>
                <td>{u.car_model ? `${u.car_model} ${u.car_plate}` : <span className="muted">—</span>}</td>
                <td className="num">{u.trips_as_driver}</td>
                <td className="num">{u.bookings_as_passenger}</td>
                <td className="num">{u.requests}</td>
                <td className="small">{fmtDay(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
