'use client';
import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, qs } from '@/lib/api';
import { bookingStatusChip, bookingStatusLabel, fmtDay, fmtRp, fmtTime, kindLabel, shortPlace, tripStatusLabel } from '@/lib/format';
import AdminShell from '@/components/AdminShell';
import Chat from '@/components/Chat';
import Icon from '@/components/Icon';
import { Landmark } from '@/components/RouteTimeline';

const EMPTY = { date_from: '', date_to: '', price_min: '', price_max: '', q: '', who: '', status: '' };
const statusChip = { scheduled: 'chip-primary', ongoing: 'chip-mint', completed: '', cancelled: 'chip-red' };

export default function AdminTrips() {
  const [f, setF] = useState(EMPTY);
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [chat, setChat] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api(`/admin/trips${qs(f)}`)
      .then(setList)
      .catch((e) => setErr(e.message));
  }, [f]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const total = (list || []).reduce((a, t) => a + t.revenue, 0);

  return (
    <AdminShell title="Semua trip" desc="Filter per tanggal berangkat, harga per kursi (rute penuh), dan nama driver atau penumpang.">
      <div className="filterbar">
        <label className="field">
          <span className="field-label">Dari tanggal</span>
          <input className="input" type="date" value={f.date_from} onChange={set('date_from')} />
        </label>
        <label className="field">
          <span className="field-label">Sampai tanggal</span>
          <input className="input" type="date" value={f.date_to} onChange={set('date_to')} />
        </label>
        <label className="field">
          <span className="field-label">Harga min (Rp)</span>
          <input className="input" type="number" min="0" step="5000" value={f.price_min} onChange={set('price_min')} placeholder="0" />
        </label>
        <label className="field">
          <span className="field-label">Harga maks (Rp)</span>
          <input className="input" type="number" min="0" step="5000" value={f.price_max} onChange={set('price_max')} placeholder="Tanpa batas" />
        </label>
        <label className="field">
          <span className="field-label">Cari nama, email, telepon</span>
          <input className="input" value={f.q} onChange={set('q')} placeholder="Misal: Budi" />
        </label>
        <label className="field">
          <span className="field-label">Cari di</span>
          <select className="input" value={f.who} onChange={set('who')}>
            <option value="">Driver & penumpang</option>
            <option value="driver">Driver saja</option>
            <option value="passenger">Penumpang saja</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <select className="input" value={f.status} onChange={set('status')}>
            <option value="">Semua</option>
            {Object.entries(tripStatusLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-ghost" onClick={() => setF(EMPTY)} disabled={JSON.stringify(f) === JSON.stringify(EMPTY)}>
          Atur ulang
        </button>
      </div>

      {err && <p className="error">{err}</p>}
      {list && (
        <p className="small muted" style={{ marginBottom: 10 }}>
          {list.length} trip · nilai transaksi terkonfirmasi {fmtRp(total)}
        </p>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Berangkat</th>
              <th>Rute</th>
              <th>Driver</th>
              <th className="num">Harga / kursi</th>
              <th className="num">Kursi</th>
              <th>Penumpang</th>
              <th className="num">Transaksi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list && list.length === 0 && (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  Tidak ada trip yang cocok dengan filter.
                </td>
              </tr>
            )}
            {(list || []).map((t) => {
              const isOpen = open === t.id;
              const nego = t.bookings.filter((b) => b.status === 'negotiating').length;
              return (
                <Fragment key={t.id}>
                  <tr className={`clickable ${isOpen ? 'expanded' : ''}`} onClick={() => setOpen(isOpen ? null : t.id)} aria-expanded={isOpen}>
                    <td>
                      <b>{fmtDay(t.depart_at)}</b>
                      <span className="sub tnum">{fmtTime(t.depart_at)}</span>
                    </td>
                    <td>
                      {shortPlace(t.origin)} ke {shortPlace(t.destination)}
                      <span className="sub">
                        {kindLabel(t.kind)} · {Math.round(t.distance_km)} km{t.stops?.length ? ` · ${t.stops.length} stop` : ''}
                      </span>
                    </td>
                    <td>
                      {t.driver.name}
                      <span className="sub tnum">{t.driver.phone || t.driver.email}</span>
                    </td>
                    <td className="num">{fmtRp(t.price_per_seat)}</td>
                    <td className="num">
                      {t.seats_booked}/{t.seats}
                    </td>
                    <td>
                      {t.bookings.length ? `${t.bookings.length} pesanan` : <span className="muted">Belum ada</span>}
                      {nego > 0 && <span className="sub">{nego} masih negosiasi</span>}
                    </td>
                    <td className="num">{fmtRp(t.revenue)}</td>
                    <td>
                      <span className={`chip ${statusChip[t.status]}`}>{tripStatusLabel[t.status]}</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={8} className="detail-cell">
                        <div className="row-between" style={{ marginBottom: 10 }}>
                          <b>Pesanan di trip ini</b>
                          <Link href={`/trip/${t.id}`} className="small">
                            Buka halaman trip
                          </Link>
                        </div>
                        {t.bookings.length === 0 && <p className="small muted">Belum ada pesanan.</p>}
                        <div className="stack" style={{ '--gap': '10px' }}>
                          {t.bookings.map((b) => (
                            <div key={b.id} className="card" style={{ padding: 14 }}>
                              <div className="row-between wrap">
                                <div>
                                  <b>{b.passenger.name}</b>
                                  <span className="small muted tnum">
                                    {' '}
                                    · {b.passenger.phone || b.passenger.email} · {b.seats} orang{b.luggage ? ` · ${b.luggage} koper` : ''}
                                  </span>
                                </div>
                                <div className="row" style={{ '--gap': '8px' }}>
                                  <span className="small tnum">
                                    {b.status === 'accepted' ? `Deal ${fmtRp(b.agreed_price)}` : `Tawaran ${fmtRp(b.last_offer)}`}
                                    <span className="muted"> / harga {fmtRp(b.list_price)}</span>
                                  </span>
                                  <span className={`chip ${bookingStatusChip[b.status]}`}>{bookingStatusLabel[b.status]}</span>
                                  <button className="btn btn-soft btn-sm" onClick={() => setChat({ id: b.id, title: `${b.passenger.name} dan ${t.driver.name}` })}>
                                    <Icon name="message" className="icon-sm" />
                                    Chat ({b.messages})
                                  </button>
                                </div>
                              </div>
                              <div className="small ink2" style={{ marginTop: 8 }}>
                                Jemput {fmtTime(b.pickup_at)} di {b.pickup.label}
                                <Landmark note={b.pickup.note} />
                                <div style={{ marginTop: 2 }}>
                                  Turun di {b.dropoff.label}
                                  <Landmark note={b.dropoff.note} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {chat && <Chat bookingId={chat.id} role="admin" title={`Chat ${chat.title}`} open onClose={() => setChat(null)} />}
    </AdminShell>
  );
}
