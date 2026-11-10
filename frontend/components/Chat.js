'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDay, fmtRp, fmtTime } from '@/lib/format';
import Icon from './Icon';
import { Sheet } from './ui';

/**
 * Chat between the passenger and driver of a booking, shown in a sheet.
 * `role` is the viewer's side (driver | passenger), or 'admin' for read-only.
 */
export default function Chat({ bookingId, role, title, open, onClose, readOnly }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  const load = useCallback(() => {
    api(`/bookings/${bookingId}/messages`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [bookingId]);

  useEffect(() => {
    if (!open) return;
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [open, load]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [data?.messages?.length]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const messages = await api(`/bookings/${bookingId}/messages`, { method: 'POST', body: { text } });
      setData((d) => ({ ...d, messages }));
      setText('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const b = data?.booking;
  const closed = b && b.status !== 'negotiating' && b.status !== 'accepted';
  // Offers and chat messages on one timeline.
  const items = [
    ...(b?.offers || []).map((o) => ({ kind: 'offer', by: o.by, at: o.at, price: o.price, text: o.message })),
    ...(data?.messages || []).map((m) => ({ kind: 'msg', by: m.role, at: m.at, text: m.text, name: m.sender_name })),
  ].sort((x, y) => new Date(x.at) - new Date(y.at));

  const mine = (by) => (role === 'admin' ? by === 'passenger' : by === role);
  let lastDay = '';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title || 'Chat'}
      footer={
        !readOnly && role !== 'admin' ? (
          closed ? (
            <p className="small muted">Percakapan ditutup karena pesanan sudah {b.status === 'rejected' ? 'ditolak' : 'dibatalkan'}.</p>
          ) : (
            <form className="row grow" onSubmit={send}>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan…" maxLength={1000} aria-label="Pesan" />
              <button className="btn btn-primary icon-btn" disabled={busy || !text.trim()} aria-label="Kirim">
                <Icon name="navigate" />
              </button>
            </form>
          )
        ) : null
      }
    >
      {role === 'admin' && b && (
        <p className="xs muted" style={{ marginBottom: 12 }}>
          Kiri: driver ({b.driver?.name}). Kanan: penumpang ({b.passenger?.name}). Admin hanya bisa membaca.
        </p>
      )}
      <div className="chat">
        {!data && !err && <p className="muted small">Memuat…</p>}
        {data && items.length === 0 && <p className="muted small">Belum ada pesan. Sapa duluan untuk memastikan titik jemput.</p>}
        {items.map((it, i) => {
          const day = fmtDay(it.at);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={i} style={{ display: 'contents' }}>
              {showDay && <div className="chat-day">{day}</div>}
              {it.kind === 'offer' ? (
                <div className={`chat-offer ${mine(it.by) ? 'mine' : ''}`}>
                  <Icon name="tag" className="icon-sm" />
                  {it.by === 'driver' ? 'Driver' : 'Penumpang'} menawarkan <b className="tnum">{fmtRp(it.price)}</b>
                  {it.text ? `: ${it.text}` : ''}
                </div>
              ) : (
                <div className={`chat-msg ${mine(it.by) ? 'mine' : ''}`}>
                  {role === 'admin' && <span className="xs strong">{it.name}</span>}
                  <span>{it.text}</span>
                  <time className="xs">{fmtTime(it.at)}</time>
                </div>
              )}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {err && <p className="error">{err}</p>}
    </Sheet>
  );
}
