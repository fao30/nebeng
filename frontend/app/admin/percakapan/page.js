'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { bookingStatusChip, bookingStatusLabel, fmtDate, fmtRp, shortPlace } from '@/lib/format';
import AdminShell from '@/components/AdminShell';
import Chat from '@/components/Chat';
import Icon from '@/components/Icon';
import { Avatar } from '@/components/ui';
import { DateField } from '@/components/DatePicker';

export default function AdminChats() {
  const [f, setF] = useState({ q: '', date_from: '', date_to: '', with_messages: '1' });
  const [list, setList] = useState(null);
  const [chat, setChat] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api(`/admin/conversations${qs(f)}`)
      .then(setList)
      .catch((e) => setErr(e.message));
  }, [f]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <AdminShell title="Percakapan" desc="Chat dan tawar-menawar harga antara pemilik mobil dan penumpang, per pesanan.">
      <div className="filterbar">
        <label className="field">
          <span className="field-label">Cari pemilik mobil atau penumpang</span>
          <input className="input" value={f.q} onChange={set('q')} placeholder="Nama, email, atau telepon" />
        </label>
        <label className="field">
          <span className="field-label">Aktivitas dari</span>
          <DateField quick={false} value={f.date_from} onChange={(v) => set('date_from')({ target: { value: v } })} placeholder="Semua" label="Dari tanggal" />
        </label>
        <label className="field">
          <span className="field-label">Sampai</span>
          <DateField quick={false} value={f.date_to} onChange={(v) => set('date_to')({ target: { value: v } })} placeholder="Semua" label="Sampai tanggal" />
        </label>
        <label className="field">
          <span className="field-label">Tampilkan</span>
          <select className="input" value={f.with_messages} onChange={set('with_messages')}>
            <option value="1">Yang ada chat</option>
            <option value="">Semua pesanan</option>
          </select>
        </label>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Penumpang dan pemilik mobil</th>
              <th>Trip</th>
              <th>Pesan terakhir</th>
              <th className="num">Pesan</th>
              <th className="num">Harga</th>
              <th>Status</th>
              <th>Aktivitas</th>
            </tr>
          </thead>
          <tbody>
            {list && list.length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  Belum ada percakapan yang cocok.
                </td>
              </tr>
            )}
            {(list || []).map((c) => (
              <tr key={c.id} className="clickable" onClick={() => setChat({ id: c.id, title: `${c.passenger.name} dan ${c.driver.name}` })}>
                <td>
                  <div className="row" style={{ '--gap': '8px' }}>
                    <Avatar name={c.passenger.name} />
                    <div>
                      <b>{c.passenger.name}</b>
                      <span className="sub">dengan {c.driver.name} (pemilik mobil)</span>
                    </div>
                  </div>
                </td>
                <td>
                  {shortPlace(c.trip.origin)} ke {shortPlace(c.trip.destination)}
                  <span className="sub">{fmtDate(c.trip.depart_at)}</span>
                </td>
                <td style={{ maxWidth: 280 }}>
                  <span className="ink2">{c.last_text || <span className="muted">Tanpa pesan</span>}</span>
                </td>
                <td className="num">
                  <span className="row" style={{ '--gap': '4px', justifyContent: 'flex-end' }}>
                    <Icon name="message" className="icon-sm" />
                    {c.messages}
                  </span>
                </td>
                <td className="num">
                  {fmtRp(c.status === 'accepted' ? c.agreed_price : c.last_offer)}
                  <span className="sub">harga {fmtRp(c.list_price)}</span>
                </td>
                <td>
                  <span className={`chip ${bookingStatusChip[c.status]}`}>{bookingStatusLabel[c.status]}</span>
                </td>
                <td className="tnum small">{fmtDate(c.last_activity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chat && <Chat bookingId={chat.id} role="admin" title={`Chat ${chat.title}`} open onClose={() => setChat(null)} />}
    </AdminShell>
  );
}
