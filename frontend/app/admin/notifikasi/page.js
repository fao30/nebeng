'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import AdminShell from '@/components/AdminShell';
import Icon from '@/components/Icon';
import { Avatar } from '@/components/ui';
import { NOTIF_LABEL, metaFor } from '@/lib/notifications';

const GROUPS = [
  { value: '', label: 'Semua jenis' },
  { value: 'booking', label: 'Pesanan (terima, tolak, tawar, batal)' },
  { value: 'chat', label: 'Chat' },
  { value: 'trip_started', label: 'Trip mulai' },
  { value: 'trip_completed', label: 'Trip selesai' },
  { value: 'trip_cancelled', label: 'Trip dibatalkan' },
  { value: 'trip_reminder', label: 'Pengingat berangkat' },
  { value: 'trip_new', label: 'Trip baru di rute penumpang' },
  { value: 'request_new', label: 'Permintaan penumpang baru' },
];

export default function AdminNotifications() {
  const [f, setF] = useState({ q: '', type: '', date_from: '', date_to: '' });
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api(`/admin/notifications${qs(f)}`)
      .then((d) => {
        setData(d);
        setErr('');
      })
      .catch((e) => setErr(e.message));
  }, [f]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    const every = setInterval(load, 15000);
    return () => {
      clearTimeout(t);
      clearInterval(every);
    };
  }, [load]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const counts = data?.counts || {};
  const sum = (prefix) => Object.entries(counts).reduce((n, [k, v]) => (k.startsWith(prefix) ? n + v : n), 0);

  return (
    <AdminShell title="Log notifikasi" desc="Semua notifikasi yang dikirim ke pemilik mobil dan penumpang: pesanan, chat, dan status trip.">
      <div className="stats" style={{ marginBottom: 16 }}>
        {[
          ['Pesanan', sum('booking'), 'ticket'],
          ['Chat', sum('chat'), 'message'],
          ['Status trip', sum('trip_started') + sum('trip_completed') + sum('trip_cancelled') + sum('trip_reminder'), 'car'],
          ['Trip & permintaan baru', sum('trip_new') + sum('request_new'), 'megaphone'],
        ].map(([label, n, icon]) => (
          <div key={label} className="stat">
            <span className="xs muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name={icon} className="icon-sm" />
              {label}
            </span>
            <b className="tnum">{n}</b>
          </div>
        ))}
      </div>
      <div className="filterbar">
        <label className="field">
          <span className="field-label">Cari penerima atau isi</span>
          <input className="input" value={f.q} onChange={set('q')} placeholder="Nama, email, telepon, atau kata" />
        </label>
        <label className="field">
          <span className="field-label">Jenis</span>
          <select className="input" value={f.type} onChange={set('type')}>
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Dari tanggal</span>
          <input className="input" type="date" value={f.date_from} onChange={set('date_from')} />
        </label>
        <label className="field">
          <span className="field-label">Sampai</span>
          <input className="input" type="date" value={f.date_to} onChange={set('date_to')} />
        </label>
      </div>
      {err && <p className="error">{err}</p>}
      {data && (
        <p className="small muted" style={{ margin: '0 0 8px' }}>
          {data.total} notifikasi{data.total > data.items.length ? `, menampilkan ${data.items.length} terbaru` : ''}
        </p>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Penerima</th>
              <th>Jenis</th>
              <th>Notifikasi</th>
              <th>Dibaca</th>
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  Belum ada notifikasi yang cocok.
                </td>
              </tr>
            )}
            {(data?.items || []).map((n) => {
              const m = metaFor(n.type);
              return (
                <tr key={n.id}>
                  <td className="tnum small" style={{ whiteSpace: 'nowrap' }}>
                    {fmtDate(n.at)}
                  </td>
                  <td>
                    <div className="row" style={{ '--gap': '8px' }}>
                      <Avatar name={n.user_name || '?'} />
                      <div>
                        <b>{n.user_name || 'Pengguna dihapus'}</b>
                        <span className="sub">{n.user_email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="log-type">
                    <span className={`chip tone-${m.tone}`}>
                      <Icon name={m.icon} />
                      {NOTIF_LABEL[n.type] || n.type}
                    </span>
                  </td>
                  <td>
                    <b className="small">{n.title}</b>
                    {n.body && <div className="xs ink2">{n.body}</div>}
                  </td>
                  <td className="small">{n.read_at ? <span className="ink2">{fmtDate(n.read_at)}</span> : <span className="muted">Belum</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
