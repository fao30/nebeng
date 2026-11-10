'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { bookingStatusChip, bookingStatusLabel, fmtDay, fmtRp, fmtTime, shortPlace } from '@/lib/format';
import Icon from './Icon';
import { Person } from './ui';
import { Landmark } from './RouteTimeline';
import Chat from './Chat';

/** A booking and its price negotiation. `role` is the viewer's side: driver | passenger. */
export default function Negotiation({ booking: b, role, onChange, showTrip = false }) {
  const last = b.offers[b.offers.length - 1];
  const [price, setPrice] = useState(last?.price || 0);
  const [msg, setMsg] = useState('');
  const [countering, setCountering] = useState(false);
  const [chat, setChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const myTurn = b.status === 'negotiating' && b.awaiting === role;
  const other = role === 'driver' ? b.passenger : b.driver;
  const canCounter = !(role === 'passenger' && b.source === 'passenger_booking' && !b.trip.negotiable);
  const closed = b.status === 'rejected' || b.status === 'cancelled';

  async function act(action) {
    if (action === 'cancel' && !confirm('Batalkan pesanan ini?')) return;
    setBusy(true);
    setErr('');
    try {
      const updated = await api(`/bookings/${b.id}/respond`, {
        method: 'POST',
        body: { action, price: Number(price), message: msg },
      });
      setMsg('');
      setCountering(false);
      onChange?.(updated);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const sub = [
    role === 'driver' ? 'Penumpang' : 'Driver',
    `${b.seats} orang`,
    b.luggage ? `${b.luggage} koper` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className={`nego nego-${b.status} ${closed ? 'nego-closed' : ''}`}>
      <div className="row-between">
        <Person user={other} sub={sub} />
        <span className={`chip ${bookingStatusChip[b.status]}`}>{bookingStatusLabel[b.status]}</span>
      </div>
      <Chat bookingId={b.id} role={role} open={chat} onClose={() => setChat(false)} title={`Chat dengan ${other?.name || ''}`} />

      <div className="stack small" style={{ '--gap': '4px', marginTop: 12 }}>
        {showTrip && (
          <div className="ink2">
            <Link href={`/trip/${b.trip_id}`}>
              {shortPlace(b.trip.origin)} ke {shortPlace(b.trip.destination)}
            </Link>
            , {fmtDay(b.trip.depart_at)}
          </div>
        )}
        <div className="row" style={{ '--gap': '8px', alignItems: 'flex-start' }}>
          <span className="dot" />
          <span className="grow ink2">
            {b.pickup.label}
            <Landmark note={b.pickup.note} />
          </span>
          {b.pickup_at && <span className="tnum strong">{fmtTime(b.pickup_at)}</span>}
        </div>
        <div className="row" style={{ '--gap': '8px', alignItems: 'flex-start' }}>
          <span className="dot dot-dest" />
          <span className="grow ink2">
            {b.dropoff.label}
            <Landmark note={b.dropoff.note} />
          </span>
        </div>
        {b.offered_time && (
          <div className="chip chip-primary" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <Icon name="clock" />
            Driver mengusulkan jemput {fmtDay(b.offered_time)}, {fmtTime(b.offered_time)}
          </div>
        )}
      </div>

      <div className="bubbles">
        {b.offers.map((o, i) => (
          <div key={i} className={`bubble ${o.by === role ? 'mine' : ''}`}>
            <b>{fmtRp(o.price)}</b>
            <span>
              {o.by === role ? 'Anda' : o.by === 'driver' ? 'Driver' : 'Penumpang'}
              {o.message ? `: ${o.message}` : ''}
            </span>
          </div>
        ))}
      </div>
      {b.list_price > 0 && b.status === 'negotiating' && (
        <p className="xs muted" style={{ marginBottom: 10 }}>
          Harga driver untuk rute ini: {fmtRp(b.list_price)}
        </p>
      )}

      {b.status === 'accepted' && (
        <div className="row wrap" style={{ marginBottom: 4 }}>
          <span className="ok grow">Disepakati {fmtRp(b.agreed_price)}</span>
          {other?.phone && (
            <a className="btn btn-soft btn-sm" href={`https://wa.me/${other.phone.replace(/^0/, '62').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
              <Icon name="message" className="icon-sm" />
              WhatsApp
            </a>
          )}
        </div>
      )}

      {b.status === 'negotiating' && !myTurn && (
        <p className="small muted">Menunggu jawaban {role === 'driver' ? 'penumpang' : 'driver'}.</p>
      )}

      {myTurn && (
        <>
          <div className="nego-actions">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act('accept')}>
              <Icon name="check" className="icon-sm" />
              Terima {fmtRp(last.price)}
            </button>
            {canCounter && (
              <button className="btn btn-sm" disabled={busy} onClick={() => setCountering(!countering)}>
                Tawar
              </button>
            )}
            <button className="btn btn-sm btn-ghost btn-danger" disabled={busy} onClick={() => act('reject')}>
              Tolak
            </button>
          </div>
          {countering && (
            <div className="counter-row">
              <input className="input tnum" type="number" min="0" step="1000" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Harga tawaran" style={{ maxWidth: 130 }} />
              <input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Pesan (opsional)" />
              <button className="btn btn-primary btn-sm" style={{ height: 40 }} disabled={busy} onClick={() => act('counter')}>
                Kirim
              </button>
            </div>
          )}
        </>
      )}
      <div className="row-between wrap" style={{ marginTop: 12 }}>
        {(!closed || b.message_count > 0) ? (
          <button className="btn btn-soft btn-sm" onClick={() => setChat(true)} aria-label="Buka chat">
            <Icon name="message" className="icon-sm" />
            Chat{b.message_count > 0 ? ` (${b.message_count})` : ''}
          </button>
        ) : (
          <span />
        )}
        {(b.status === 'accepted' || (b.status === 'negotiating' && !myTurn)) && b.trip.status !== 'completed' && (
          <button className="link link-danger small" disabled={busy} onClick={() => act('cancel')}>
            Batalkan pesanan
          </button>
        )}
      </div>
      {err && (
        <p className="error" style={{ marginTop: 8 }}>
          {err}
        </p>
      )}
    </article>
  );
}
