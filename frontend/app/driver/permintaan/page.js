'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, qs } from '@/lib/api';
import { fmtDay, fmtRp, fmtTime, localInputValue, routeOf, shortPlace } from '@/lib/format';
import MapView from '@/components/MapView';
import PointField from '@/components/PointField';
import Negotiation from '@/components/Negotiation';
import RequireAuth from '@/components/RequireAuth';
import Icon from '@/components/Icon';
import { Empty, Person, Segmented, Sheet, Stepper } from '@/components/ui';
import { Landmark } from '@/components/RouteTimeline';

function Permintaan() {
  const [trips, setTrips] = useState(null);
  const [filter, setFilter] = useState('trip');
  const [tripId, setTripId] = useState('');
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [rFrom, setRFrom] = useState(10);
  const [rTo, setRTo] = useState(15);
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [offerFor, setOfferFor] = useState(null);

  useEffect(() => {
    api('/my/trips').then((all) => {
      const open = all.filter((t) => t.status === 'scheduled');
      setTrips(open);
      const pre = new URLSearchParams(window.location.search).get('trip');
      if (pre && open.some((t) => t.id === pre)) setTripId(pre);
      else if (open.length) setTripId(open[open.length - 1].id);
      else setFilter('area');
    });
  }, []);

  const load = useCallback(async () => {
    setErr('');
    try {
      const q =
        filter === 'trip' && tripId
          ? qs({ trip_id: tripId, from_radius_km: rFrom, to_radius_km: rTo })
          : qs({ from_lat: from?.lat, from_lng: from?.lng, to_lat: to?.lat, to_lng: to?.lng, from_radius_km: rFrom, to_radius_km: rTo });
      setList(await api(`/requests${q}`));
    } catch (e) {
      setErr(e.message);
    }
  }, [filter, tripId, from, to, rFrom, rTo]);

  useEffect(() => {
    if (trips) load();
  }, [trips, load]);

  if (!trips) return <p className="muted">Memuat…</p>;
  const trip = trips.find((t) => t.id === tripId);

  const markers = [];
  const lines = [];
  if (filter === 'trip' && trip) {
    markers.push(
      { ...trip.origin, kind: 'origin' },
      ...(trip.stops || []).map((s) => ({ ...s, kind: 'stop', popup: s.label })),
      { ...trip.destination, kind: 'dest' },
    );
    lines.push({ points: routeOf(trip), kind: 'route' });
  }
  (list || []).forEach((r, i) => {
    markers.push({ ...r.origin, kind: 'request', text: String(i + 1), popup: `${r.passenger.name}: ${r.origin.label}` });
    lines.push({ from: r.origin, to: r.destination, kind: 'walk' });
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Permintaan penumpang</h1>
          <p>Penumpang yang butuh tumpangan. Tawarkan trip Anda beserta harga dan jam jemput.</p>
        </div>
      </div>

      {trips.length === 0 && (
        <div className="card row wrap" style={{ marginBottom: 16, background: 'var(--primary-50)', borderColor: 'transparent' }}>
          <Icon name="info" />
          <span className="grow">Untuk menawarkan tumpangan, buat trip Anda dulu. Anda tetap bisa melihat permintaan di sekitar.</span>
          <Link className="btn btn-primary btn-sm" href="/driver/trip-baru">
            Buat trip
          </Link>
        </div>
      )}

      <div className="results-layout" style={{ marginTop: 0 }}>
        <aside className="filters card stack" style={{ '--gap': '14px' }}>
          <Segmented
            label="Filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'trip', label: 'Searah trip saya' },
              { value: 'area', label: 'Per area' },
            ]}
          />
          {filter === 'trip' ? (
            trips.length ? (
              <label className="field">
                <span className="field-label">Trip</span>
                <select className="input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {shortPlace(t.origin)} ke {shortPlace(t.destination)}, {fmtDay(t.depart_at)} {fmtTime(t.depart_at)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="small muted">Belum ada trip terjadwal.</p>
            )
          ) : (
            <>
              <PointField label="Jemput sekitar" kind="origin" value={from} onChange={setFrom} />
              <PointField label="Tujuan sekitar" kind="dest" value={to} onChange={setTo} />
            </>
          )}
          <label className="field">
            <span className="row-between small">
              <span>Radius jemput</span>
              <b className="tnum">{rFrom} km</b>
            </span>
            <input type="range" min="1" max="60" value={rFrom} onChange={(e) => setRFrom(Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="row-between small">
              <span>Radius antar</span>
              <b className="tnum">{rTo} km</b>
            </span>
            <input type="range" min="1" max="60" value={rTo} onChange={(e) => setRTo(Number(e.target.value))} />
          </label>
          <p className="help">
            {filter === 'trip'
              ? 'Jarak titik jemput/antar penumpang dari rute dan titik stop trip Anda.'
              : 'Kosongkan titik untuk melihat semua permintaan.'}
          </p>
        </aside>

        <section className="stack" style={{ '--gap': '14px', minWidth: 0 }}>
          <MapView markers={markers} lines={lines} fitKey={`${filter}${tripId}${list?.length}`} height={300} />
          {err && <p className="error">{err}</p>}
          <h2>{list == null ? 'Memuat…' : list.length ? `${list.length} permintaan` : 'Belum ada permintaan yang cocok'}</h2>
          {list && list.length === 0 && (
            <Empty icon="inbox" title="Belum ada yang searah">
              Perbesar radius atau lihat per area. Permintaan baru muncul di sini begitu penumpang memasangnya.
            </Empty>
          )}
          {(list || []).map((r, i) => (
            <RequestCard key={r.id} n={i + 1} req={r} canOffer={trips.length > 0} onOffer={() => setOfferFor(r)} onChange={load} />
          ))}
        </section>
      </div>

      <OfferSheet req={offerFor} trips={trips} defaultTrip={filter === 'trip' ? tripId : ''} onClose={() => setOfferFor(null)} onDone={load} />
    </div>
  );
}

function RequestCard({ n, req, canOffer, onOffer, onChange }) {
  const activeOffer = (req.offers || []).find((o) => o.status === 'negotiating');
  return (
    <article className="card stack">
      <div className="row-between">
        <Person user={req.passenger} sub={`${req.seats} orang · ${req.luggage ? `${req.luggage} koper` : 'tanpa koper'}`} />
        <span className="chip chip-amber">{n}</span>
      </div>
      <div className="stack" style={{ '--gap': '6px' }}>
        <div className="row small" style={{ '--gap': '8px' }}>
          <span className="dot" />
          <span className="grow">
            {req.origin.label}
            <Landmark note={req.origin.note} />
          </span>
          <b className="tnum">{fmtTime(req.depart_at)}</b>
        </div>
        <div className="row small" style={{ '--gap': '8px' }}>
          <span className="dot dot-dest" />
          <span className="grow">
            {req.destination.label}
            <Landmark note={req.destination.note} />
          </span>
        </div>
      </div>
      <div className="row wrap">
        <span className="chip">
          <Icon name="calendar" />
          {fmtDay(req.depart_at)}
        </span>
        {req.budget > 0 && (
          <span className="chip chip-primary">
            <Icon name="tag" />
            Budget {fmtRp(req.budget)}
          </span>
        )}
        {req.pickup_dist_km != null && <span className="chip">Jemput {req.pickup_dist_km} km dari rute</span>}
        {req.dropoff_dist_km != null && <span className="chip">Antar {req.dropoff_dist_km} km dari rute</span>}
      </div>
      {req.notes && <p className="small ink2">“{req.notes}”</p>}
      {(req.offers || []).map((b) => (
        <Negotiation key={b.id} booking={b} role="driver" onChange={onChange} />
      ))}
      {canOffer && !activeOffer && (
        <button className="btn btn-primary" onClick={onOffer}>
          Tawarkan tumpangan
          {req.quote && <span style={{ opacity: 0.8, fontWeight: 500 }}>· saran {fmtRp(req.quote.price_per_seat * req.seats)}</span>}
        </button>
      )}
    </article>
  );
}

function OfferSheet({ req, trips, defaultTrip, onClose, onDone }) {
  const [tripId, setTripId] = useState('');
  const [price, setPrice] = useState(0);
  const [time, setTime] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    if (!req) return;
    setTripId(defaultTrip || trips[0]?.id || '');
    setMsg('');
    setErr('');
  }, [req, defaultTrip, trips]);

  // Fetch the price and pickup time for this request on the chosen trip.
  useEffect(() => {
    if (!req || !tripId) return;
    api(`/trips/${tripId}${qs({ from_lat: req.origin.lat, from_lng: req.origin.lng, to_lat: req.destination.lat, to_lng: req.destination.lng })}`)
      .then((t) => {
        setQuote(t.quote);
        setPrice(t.quote.price_per_seat * req.seats);
        setTime(localInputValue(0, t.quote.pickup_at));
      })
      .catch(() => setQuote(null));
  }, [req, tripId]);

  async function send() {
    setBusy(true);
    setErr('');
    try {
      await api(`/requests/${req.id}/offer`, {
        method: 'POST',
        body: { trip_id: tripId, price: Number(price), message: msg, offered_time: time ? new Date(time).toISOString() : null },
      });
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={!!req}
      onClose={onClose}
      title="Tawarkan tumpangan"
      footer={
        <button className="btn btn-primary btn-lg grow" disabled={busy || !tripId} onClick={send}>
          Kirim tawaran {fmtRp(price)}
        </button>
      }
    >
      {req && (
        <div className="stack" style={{ '--gap': '16px' }}>
          <Person user={req.passenger} sub={`${shortPlace(req.origin)} ke ${shortPlace(req.destination)}, ${req.seats} orang`} />
          <div className="stack" style={{ '--gap': '8px' }}>
            <span className="field-label">Pakai trip</span>
            {trips.map((t) => (
              <label key={t.id} className="choice">
                <input type="radio" name="trip" checked={tripId === t.id} onChange={() => setTripId(t.id)} />
                <span>
                  <b>
                    {shortPlace(t.origin)} ke {shortPlace(t.destination)}
                  </b>
                  <span className="small muted">
                    {fmtDay(t.depart_at)}, {fmtTime(t.depart_at)} · {t.seats_available} kursi
                  </span>
                </span>
              </label>
            ))}
          </div>
          {quote && (
            <p className="small muted">
              Penumpang naik di <b>{shortPlace(quote.pickup)}</b> ({quote.pickup_walk_km} km dari lokasinya) dan turun di{' '}
              <b>{shortPlace(quote.dropoff)}</b> ({quote.dropoff_walk_km} km dari tujuannya). Harga ruas ini {fmtRp(quote.price_per_seat)} per kursi,
              perkiraan lewat titik naik {fmtTime(quote.pickup_at)}.
              {quote.seats_available < req.seats && <span className="error"> Kursi di ruas ini tidak cukup.</span>}
            </p>
          )}
          <div className="qty-row">
            <b>Harga total</b>
            <Stepper label="harga" wide value={Number(price)} onChange={setPrice} min={0} max={10_000_000} step={5000} format={fmtRp} />
          </div>
          <label className="field">
            <span className="field-label">Jam jemput yang Anda usulkan</span>
            <input className="input" type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Pesan</span>
            <input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Misal: saya jemput di depan gerbang" />
          </label>
          {err && <p className="error">{err}</p>}
        </div>
      )}
    </Sheet>
  );
}

export default function Page() {
  return (
    <RequireAuth kyc="vehicle">
      <Permintaan />
    </RequireAuth>
  );
}
