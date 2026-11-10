'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDay, fmtRp, fmtTime, localInputValue } from '@/lib/format';
import MapView from '@/components/MapView';
import PointField, { pointFromClick } from '@/components/PointField';
import Negotiation from '@/components/Negotiation';
import RequireAuth from '@/components/RequireAuth';
import Icon from '@/components/Icon';
import { Empty, Stepper } from '@/components/ui';

const reqStatus = {
  open: ['Menunggu tawaran', 'chip-amber'],
  matched: ['Dapat tumpangan', 'chip-mint'],
  cancelled: ['Dibatalkan', ''],
};

function Minta() {
  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [active, setActive] = useState('origin');
  const [departAt, setDepartAt] = useState(localInputValue(3));
  const [seats, setSeats] = useState(1);
  const [luggage, setLuggage] = useState(0);
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(null);

  const load = useCallback(() => api('/my/requests').then(setMine).catch(() => setMine([])), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/requests', {
        method: 'POST',
        body: { origin, destination: dest, depart_at: new Date(departAt).toISOString(), seats, luggage, budget: Number(budget) || 0, notes },
      });
      setOrigin(null);
      setDest(null);
      setNotes('');
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id) {
    if (!confirm('Batalkan permintaan ini?')) return;
    await api(`/requests/${id}/cancel`, { method: 'POST' }).catch((e) => alert(e.message));
    load();
  }

  async function onMapClick(ll) {
    const p = await pointFromClick(ll);
    if (active === 'origin') {
      setOrigin(p);
      setActive('dest');
    } else setDest(p);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Minta tumpangan</h1>
          <p>Belum ada trip yang cocok? Pasang permintaan, driver yang searah akan menawarkan harga dan jam jemput.</p>
        </div>
      </div>
      <div className="detail">
        <section className="stack" style={{ '--gap': '16px', minWidth: 0 }}>
          <h2>Permintaan saya</h2>
          {mine && mine.length === 0 && (
            <Empty icon="megaphone" title="Belum ada permintaan">
              Isi formulir untuk memasang permintaan pertama Anda.
            </Empty>
          )}
          {(mine || []).map((r) => (
            <article key={r.id} className="card stack">
              <div className="row-between">
                <div className="row">
                  <Icon name="calendar" />
                  <b>
                    {fmtDay(r.depart_at)}, {fmtTime(r.depart_at)}
                  </b>
                </div>
                <span className={`chip ${reqStatus[r.status][1]}`}>{reqStatus[r.status][0]}</span>
              </div>
              <div className="stack small" style={{ '--gap': '6px' }}>
                <div className="row" style={{ '--gap': '8px' }}>
                  <span className="dot" />
                  {r.origin.label}
                </div>
                <div className="row" style={{ '--gap': '8px' }}>
                  <span className="dot dot-dest" />
                  {r.destination.label}
                </div>
              </div>
              <div className="row wrap">
                <span className="chip">
                  <Icon name="users" />
                  {r.seats} orang
                </span>
                <span className="chip">
                  <Icon name="luggage" />
                  {r.luggage ? `${r.luggage} koper` : 'Tanpa koper'}
                </span>
                {r.budget > 0 && <span className="chip">Budget {fmtRp(r.budget)}</span>}
              </div>
              {(r.offers || []).length > 0 && <div className="section-title" style={{ margin: '4px 0 0' }}>Tawaran dari driver ({r.offers.length})</div>}
              {(r.offers || []).map((b) => (
                <Negotiation key={b.id + b.updated_at} booking={b} role="passenger" onChange={load} showTrip />
              ))}
              {r.status === 'open' && (
                <div className="row-between">
                  <span className="xs muted">{(r.offers || []).length ? '' : 'Belum ada driver yang menawari.'}</span>
                  <button className="link link-danger small" onClick={() => cancel(r.id)}>
                    Batalkan permintaan
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>

        <aside className="detail-aside">
          <form className="card stack" style={{ '--gap': '14px' }} onSubmit={submit}>
            <h3>Permintaan baru</h3>
            <PointField label="Jemput di" kind="origin" value={origin} onChange={setOrigin} active={active === 'origin'} onActivate={() => setActive('origin')} />
            <PointField label="Antar ke" kind="dest" value={dest} onChange={setDest} active={active === 'dest'} onActivate={() => setActive('dest')} />
            <MapView
              markers={[...(origin ? [{ ...origin, kind: 'pickup', text: 'A' }] : []), ...(dest ? [{ ...dest, kind: 'drop', text: 'B' }] : [])]}
              lines={origin && dest ? [{ from: origin, to: dest, kind: 'walk' }] : []}
              onClick={onMapClick}
              fitKey={`${origin?.lat}${dest?.lat}`}
              height={200}
            />
            <label className="field">
              <span className="field-label">Berangkat</span>
              <input className="input" type="datetime-local" required value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
            </label>
            <div className="qty-row">
              <b>Penumpang</b>
              <Stepper label="penumpang" value={seats} onChange={setSeats} min={1} max={8} />
            </div>
            <div className="qty-row">
              <b>Koper</b>
              <Stepper label="koper" value={luggage} onChange={setLuggage} min={0} max={10} />
            </div>
            <label className="field">
              <span className="field-label">Budget total (opsional)</span>
              <input className="input" type="number" min="0" step="1000" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="50000" />
            </label>
            <label className="field">
              <span className="field-label">Catatan</span>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Misal: jemput di lobi kantor" />
            </label>
            {err && <p className="error">{err}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy || !origin || !dest}>
              Pasang permintaan
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <Minta />
    </RequireAuth>
  );
}
