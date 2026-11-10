'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, qs } from '@/lib/api';
import { AMENITIES, fmtDay, fmtDuration, fmtRp, fmtTime, hasAmenity, kindLabel, routeOf, shortPlace, tripStatusLabel } from '@/lib/format';
import { useApp } from '../../providers';
import MapView from '@/components/MapView';
import PointField, { pointFromClick } from '@/components/PointField';
import RouteTimeline from '@/components/RouteTimeline';
import Negotiation from '@/components/Negotiation';
import LivePanel from '@/components/LivePanel';
import Participants from '@/components/Participants';
import Icon from '@/components/Icon';
import { Person, Stepper, Empty } from '@/components/ui';
import { useBroadcastLocation, useLiveStream } from '@/lib/live';

function parsePoint(s) {
  try {
    const p = JSON.parse(s);
    return p && typeof p.lat === 'number' ? p : null;
  } catch {
    return null;
  }
}

export default function TripPage() {
  const { id } = useParams();
  const { user, ready } = useApp();
  const [trip, setTrip] = useState(null);
  const [err, setErr] = useState('');
  const [pickup, setPickup] = useState(undefined);
  const [dropoff, setDropoff] = useState(undefined);
  const [init, setInit] = useState({ seats: 1, luggage: 0 });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setPickup(parsePoint(q.get('p')));
    setDropoff(parsePoint(q.get('d')));
    setInit({ seats: Number(q.get('s')) || 1, luggage: Number(q.get('k')) || 0 });
  }, []);

  // Refetch the quote only when the points move, not while typing a landmark.
  const pk = pickup === undefined ? undefined : pickup ? `${pickup.lat},${pickup.lng}` : '';
  const dk = dropoff ? `${dropoff.lat},${dropoff.lng}` : '';
  const load = useCallback(() => {
    if (pk === undefined) return;
    const [fl, fg] = pk ? pk.split(',') : [];
    const [tl, tg] = dk ? dk.split(',') : [];
    api(`/trips/${id}${qs({ from_lat: fl, from_lng: fg, to_lat: tl, to_lng: tg })}`)
      .then(setTrip)
      .catch((e) => setErr(e.message));
  }, [id, pk, dk]);

  useEffect(() => {
    if (!ready) return;
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [ready, load, user]);

  if (err) return <Empty icon="info" title="Trip tidak bisa dibuka">{err}</Empty>;
  if (!trip) return <p className="muted">Memuat trip…</p>;

  const isDriver = user && trip.driver_id === user.id;
  return isDriver ? (
    <DriverView trip={trip} reload={load} />
  ) : (
    <PassengerView
      trip={trip}
      user={user}
      reload={load}
      pickup={pickup || trip.origin}
      dropoff={dropoff || trip.destination}
      setPickup={setPickup}
      setDropoff={setDropoff}
      init={init}
    />
  );
}

/* ---------- shared blocks ---------- */

function TripHeader({ trip, back }) {
  return (
    <div className="page-head">
      <div>
        {back}
        <h1>
          {shortPlace(trip.origin)} ke {shortPlace(trip.destination)}
        </h1>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <span className="chip">
            <Icon name="calendar" />
            {fmtDay(trip.depart_at)}
          </span>
          <span className="chip">{kindLabel(trip.kind)}</span>
          <span className="chip">{Math.round(trip.distance_km)} km</span>
          {trip.instant_booking && (
            <span className="chip chip-primary">
              <Icon name="bolt" />
              Pesan instan
            </span>
          )}
          {trip.status !== 'scheduled' && <span className={`chip ${trip.status === 'ongoing' ? 'chip-mint' : ''}`}>{tripStatusLabel[trip.status]}</span>}
        </div>
      </div>
    </div>
  );
}

function DriverCard({ trip }) {
  return (
    <div className="card stack">
      <Person user={trip.driver} sub={trip.vehicle || 'Kendaraan belum diisi'} large />
      {trip.notes && <p className="ink2">“{trip.notes}”</p>}
      <hr className="divider" style={{ margin: '4px 0' }} />
      <div className="amen-list">
        {AMENITIES.map((a) => {
          const yes = hasAmenity(trip, a.key);
          return (
            <div key={a.key} className={`amen-item ${yes ? '' : 'no'}`}>
              <Icon name={a.icon} />
              <span>
                {yes ? a.label : a.no}
                {a.key === 'luggage' && yes ? ` (maks. ${trip.max_luggage})` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- passenger ---------- */

function PassengerView({ trip, user, reload, pickup, dropoff, setPickup, setDropoff, init }) {
  const mine = trip.my_bookings || [];
  const active = mine.find((b) => b.status === 'negotiating' || b.status === 'accepted');
  const accepted = active?.status === 'accepted';
  const [activeField, setActiveField] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareToken, setShareToken] = useState('');
  const live = useLiveStream(accepted ? shareToken : '');
  const broadcast = useBroadcastLocation(trip.id, sharing && accepted && trip.status !== 'completed');
  const q = trip.quote;

  useEffect(() => {
    if (accepted && trip.status !== 'completed' && trip.status !== 'cancelled') {
      api(`/trips/${trip.id}/share`)
        .then((r) => setShareToken(r.share_token))
        .catch(() => {});
    }
  }, [accepted, trip.id, trip.status]);

  async function onMapClick(ll) {
    if (!activeField || active) return;
    const p = await pointFromClick(ll);
    activeField === 'pickup' ? setPickup(p) : setDropoff(p);
  }

  const shownPickup = active ? active.pickup : pickup;
  const shownDrop = active ? active.dropoff : dropoff;
  const markers = [
    { ...trip.origin, kind: 'origin', popup: trip.origin.label },
    ...(trip.stops || []).map((s) => ({ ...s, kind: 'stop', popup: s.label })),
    { ...trip.destination, kind: 'dest', popup: trip.destination.label },
    { ...shownPickup, kind: 'pickup', text: 'A', popup: `Jemput: ${shownPickup.label}` },
    { ...shownDrop, kind: 'drop', text: 'B', popup: `Antar: ${shownDrop.label}` },
    ...live.positions.map((p) => ({ lat: p.lat, lng: p.lng, kind: p.role, popup: `${p.name}, ${fmtTime(p.at)}` })),
  ];

  return (
    <div className="has-cta">
      <TripHeader
        trip={trip}
        back={
          <Link href="/cari" className="small row" style={{ '--gap': '4px', marginBottom: 8 }}>
            <Icon name="chevronLeft" className="icon-sm" />
            Kembali ke hasil
          </Link>
        }
      />
      <div className={`detail ${active ? 'aside-first' : ''}`}>
        <div className="stack" style={{ '--gap': '16px' }}>
          <div className="card">
            <div className="section-title">Rute</div>
            <RouteTimeline
              trip={trip}
              quote={active ? { from_pos: active.from_pos, to_pos: active.to_pos, pickup_at: active.pickup_at } : q}
              pickup={active ? active.pickup : pickup}
              dropoff={active ? active.dropoff : dropoff}
            />
            {q && !active && (
              <p className="xs muted" style={{ marginTop: 12 }}>
                Bagian ungu adalah ruas yang Anda tempuh, sekitar {fmtDuration(new Date(q.dropoff_at) - new Date(q.pickup_at))}. Jam tiba
                adalah perkiraan.
              </p>
            )}
          </div>
          <MapView
            markers={markers}
            lines={[
              { points: routeOf(trip), kind: 'route' },
              { from: shownPickup, to: shownDrop, kind: 'walk' },
            ]}
            onClick={onMapClick}
            fitKey={`${trip.id}-${shownPickup.lat}-${shownDrop.lat}`}
            height={320}
          />
          <DriverCard trip={trip} />
        </div>

        <aside className="detail-aside stack" style={{ '--gap': '16px' }} id="pesan">
          {active ? (
            <>
              <Negotiation booking={active} role="passenger" onChange={reload} />
              <Participants list={trip.participants} meId={user?.id} />
              {accepted && trip.status !== 'completed' && trip.status !== 'cancelled' && (
                <LivePanel sharing={sharing} onToggle={() => setSharing(!sharing)} broadcast={broadcast} shareToken={shareToken} live={live} passenger />
              )}
            </>
          ) : trip.status !== 'scheduled' ? (
            <div className="card">
              <p className="muted">Trip ini sudah {tripStatusLabel[trip.status].toLowerCase()} dan tidak menerima pesanan.</p>
            </div>
          ) : user ? (
            <BookingPanel
              trip={trip}
              pickup={pickup}
              dropoff={dropoff}
              setPickup={setPickup}
              setDropoff={setDropoff}
              activeField={activeField}
              setActiveField={setActiveField}
              init={init}
              onDone={reload}
            />
          ) : (
            <div className="card stack">
              <div className="price-big">{fmtRp(q?.price_per_seat)}</div>
              <p className="muted small">per kursi untuk ruas Anda</p>
              <Link className="btn btn-primary btn-block" href={`/masuk?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')}`}>
                Masuk untuk memesan
              </Link>
            </div>
          )}
          {mine.filter((b) => b !== active).length > 0 && (
            <div className="stack">
              <div className="section-title" style={{ margin: 0 }}>
                Riwayat pesanan di trip ini
              </div>
              {mine
                .filter((b) => b !== active)
                .map((b) => (
                  <Negotiation key={b.id + b.updated_at} booking={b} role="passenger" />
                ))}
            </div>
          )}
        </aside>
      </div>

      {!active && trip.status === 'scheduled' && q && (
        <div className="mobile-cta">
          <div className="grow">
            <b className="tnum">{fmtRp(q.price_per_seat)}</b>
            <div className="xs muted">per kursi</div>
          </div>
          <a href="#pesan" className="btn btn-primary">
            Pesan kursi
          </a>
        </div>
      )}
    </div>
  );
}

function BookingPanel({ trip, pickup, dropoff, setPickup, setDropoff, activeField, setActiveField, init, onDone }) {
  const q = trip.quote;
  const [seats, setSeats] = useState(Math.min(init.seats, Math.max(1, q.seats_available)));
  const [luggage, setLuggage] = useState(trip.luggage ? Math.min(init.luggage, q.luggage_available) : 0);
  const [offer, setOffer] = useState(false);
  const [price, setPrice] = useState(0);
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const total = q.price_per_seat * seats;

  useEffect(() => {
    if (!offer) setPrice(total);
  }, [total, offer]);

  const segs = routeOf(trip)
    .slice(0, -1)
    .map((p, i) => ({ i, from: p, to: routeOf(trip)[i + 1], price: trip.segment_prices?.[i] || 0 }));
  const onSum = segs.filter((s) => s.i >= q.seg_start && s.i < q.seg_end).reduce((a, s) => a + s.price, 0);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const b = await api(`/trips/${trip.id}/bookings`, {
        method: 'POST',
        body: { pickup, dropoff, seats, luggage, price: offer ? Number(price) : total, message },
      });
      setDone(b.status === 'accepted' ? 'Kursi Anda terkonfirmasi.' : 'Permintaan terkirim ke driver.');
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const full = q.seats_available < 1;
  return (
    <form className="card stack" style={{ '--gap': '16px' }} onSubmit={submit}>
      <div>
        <div className="price-big">{fmtRp(q.price_per_seat)}</div>
        <span className="small muted">per kursi, {shortPlace(pickup)} ke {shortPlace(dropoff)}</span>
      </div>

      <div className="stack" style={{ '--gap': '8px' }}>
        <PointField label="Titik jemput" kind="origin" value={pickup} onChange={(p) => setPickup(p || trip.origin)} active={activeField === 'pickup'} onActivate={() => setActiveField('pickup')} withNote notePlaceholder="Patokan jemput, misal: depan Indomaret, baju biru" />
        <PointField label="Titik antar" kind="dest" value={dropoff} onChange={(p) => setDropoff(p || trip.destination)} active={activeField === 'drop'} onActivate={() => setActiveField('drop')} withNote notePlaceholder="Patokan turun (opsional)" />
        <p className="help">Pilih titik di sepanjang rute. Bisa juga klik di peta setelah memilih kolom.</p>
      </div>

      {segs.length > 1 && (
        <ul className="breakdown">
          {segs.map((s) => (
            <li key={s.i} className={s.i >= q.seg_start && s.i < q.seg_end ? '' : 'off'}>
              <span>
                {shortPlace(s.from)} ke {shortPlace(s.to)}
              </span>
              <span>{fmtRp(s.price)}</span>
            </li>
          ))}
          {onSum !== q.price_per_seat && (
            <li className="xs muted">
              <span>Disesuaikan dengan titik naik/turun Anda</span>
              <span>{fmtRp(q.price_per_seat)}</span>
            </li>
          )}
        </ul>
      )}

      <div className="qty-row">
        <div>
          <b>Penumpang</b>
          <span className="xs muted">{q.seats_available} kursi tersisa di ruas ini</span>
        </div>
        <Stepper label="penumpang" value={seats} onChange={setSeats} min={1} max={Math.max(1, q.seats_available)} />
      </div>
      <div className="qty-row">
        <div>
          <b>Koper</b>
          <span className="xs muted">{trip.luggage ? `${q.luggage_available} tempat tersisa` : 'Trip ini tanpa koper'}</span>
        </div>
        <Stepper label="koper" value={luggage} onChange={setLuggage} min={0} max={trip.luggage ? q.luggage_available : 0} />
      </div>

      {trip.negotiable && (
        <label className="toggle" style={{ padding: 0 }}>
          <span className="toggle-text">
            <b>Ajukan harga sendiri</b>
            <span className="help">Driver bisa menerima, menolak, atau menawar balik.</span>
          </span>
          <input type="checkbox" className="switch" checked={offer} onChange={(e) => setOffer(e.target.checked)} />
        </label>
      )}
      {offer && (
        <div className="row-between">
          <span className="small">Total tawaran</span>
          <Stepper label="harga" wide value={Number(price)} onChange={setPrice} min={1000} max={total * 2} step={5000} format={fmtRp} />
        </div>
      )}
      <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Pesan untuk driver (opsional)" />

      <ul className="breakdown">
        <li className="total">
          <span>Total</span>
          <span>{fmtRp(offer ? price : total)}</span>
        </li>
      </ul>
      {err && <p className="error">{err}</p>}
      {done && <p className="ok">{done}</p>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || full}>
        {full ? 'Kursi penuh di ruas ini' : trip.instant_booking && !offer ? (
          <>
            <Icon name="bolt" />
            Pesan sekarang
          </>
        ) : (
          'Kirim permintaan ke driver'
        )}
      </button>
      <p className="xs muted" style={{ textAlign: 'center' }}>
        {trip.instant_booking && !offer
          ? 'Kursi langsung terkonfirmasi. Bayar langsung ke driver.'
          : 'Driver akan mengonfirmasi atau menawar balik. Bayar langsung ke driver.'}
      </p>
    </form>
  );
}

/* ---------- driver ---------- */

function DriverView({ trip, reload }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareToken, setShareToken] = useState(trip.share_token || '');
  const broadcast = useBroadcastLocation(trip.id, sharing && (trip.status === 'scheduled' || trip.status === 'ongoing'));
  const live = useLiveStream(shareToken);

  useEffect(() => {
    if (trip.share_token) setShareToken(trip.share_token);
  }, [trip.share_token]);

  async function status(action) {
    if (action === 'cancel' && !confirm('Batalkan trip ini? Semua pesanan ikut dibatalkan.')) return;
    setBusy(true);
    setErr('');
    try {
      const t = await api(`/trips/${trip.id}/status`, { method: 'POST', body: { action } });
      if (action === 'start') {
        setShareToken(t.share_token);
        setSharing(true);
      }
      if (action === 'complete') setSharing(false);
      reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSharing() {
    if (sharing) return setSharing(false);
    try {
      const r = await api(`/trips/${trip.id}/share`);
      setShareToken(r.share_token);
      setSharing(true);
    } catch (e) {
      setErr(e.message);
    }
  }

  const route = routeOf(trip);
  const bookings = trip.bookings || [];
  const accepted = bookings.filter((b) => b.status === 'accepted');
  const pending = bookings.filter((b) => b.status === 'negotiating');
  const closed = bookings.filter((b) => b.status !== 'accepted' && b.status !== 'negotiating');
  const waiting = pending.filter((b) => b.awaiting === 'driver').length;

  const occ = route.slice(0, -1).map((p, i) => ({
    label: `${shortPlace(p)} ke ${shortPlace(route[i + 1])}`,
    seats: accepted.filter((b) => i >= b.seg_start && i < b.seg_end).reduce((a, b) => a + b.seats, 0),
  }));

  const markers = [
    { ...trip.origin, kind: 'origin', popup: trip.origin.label },
    ...(trip.stops || []).map((s, i) => ({ ...s, kind: 'stop', popup: `Stop ${i + 1}: ${s.label}` })),
    { ...trip.destination, kind: 'dest', popup: trip.destination.label },
    ...accepted.flatMap((b) => [
      { ...b.pickup, kind: 'pickup', text: b.passenger.name[0], popup: `Jemput ${b.passenger.name}, ${fmtTime(b.pickup_at)}` },
      { ...b.dropoff, kind: 'drop', text: b.passenger.name[0], popup: `Antar ${b.passenger.name}` },
    ]),
    ...live.positions.map((p) => ({ lat: p.lat, lng: p.lng, kind: p.role, text: p.role === 'driver' ? '' : p.name[0], popup: `${p.name}, ${fmtTime(p.at)}` })),
  ];

  return (
    <div>
      <TripHeader
        trip={trip}
        back={
          <Link href="/driver" className="small row" style={{ '--gap': '4px', marginBottom: 8 }}>
            <Icon name="chevronLeft" className="icon-sm" />
            Trip saya
          </Link>
        }
      />
      <div className="detail">
        <div className="stack" style={{ '--gap': '16px' }}>
          <div className="card">
            <div className="section-title">Rute dan harga per ruas</div>
            <RouteTimeline trip={trip} />
            <hr className="divider" />
            <ul className="breakdown">
              {route.slice(0, -1).map((p, i) => (
                <li key={i}>
                  <span>
                    {shortPlace(p)} ke {shortPlace(route[i + 1])}
                  </span>
                  <span>{fmtRp(trip.segment_prices?.[i])}</span>
                </li>
              ))}
              <li className="total">
                <span>Rute penuh</span>
                <span>{fmtRp(trip.price_per_seat)}</span>
              </li>
            </ul>
          </div>
          <MapView markers={markers} lines={[{ points: route, kind: 'route' }]} fitKey={`${trip.id}-${accepted.length}`} height={340} />

          <section className="stack">
            <div className="row-between">
              <h2>Penumpang</h2>
              {waiting > 0 && <span className="chip chip-amber">{waiting} menunggu jawaban Anda</span>}
            </div>
            {bookings.length === 0 && (
              <Empty
                icon="users"
                title="Belum ada pesanan"
                action={
                  <Link className="btn btn-soft" href={`/driver/permintaan?trip=${trip.id}`}>
                    Lihat permintaan searah
                  </Link>
                }
              >
                Tawarkan trip ini ke penumpang yang sudah memasang permintaan di sepanjang rute Anda.
              </Empty>
            )}
            {[...pending, ...accepted, ...closed].map((b) => (
              <Negotiation key={b.id + b.updated_at} booking={b} role="driver" onChange={reload} />
            ))}
          </section>
        </div>

        <aside className="detail-aside stack" style={{ '--gap': '16px' }}>
          {accepted.length > 0 && <Participants list={trip.participants} meId={trip.driver_id} />}
          <div className="card stack">
            <div className="row-between">
              <h3>Kursi per ruas</h3>
              <span className="xs muted">
                {trip.seats} kursi{trip.luggage ? `, ${trip.max_luggage} koper` : ''}
              </span>
            </div>
            <div className="occupancy">
              {occ.map((o, i) => (
                <div className="occ-row" key={i}>
                  <span>{o.label}</span>
                  <span className="occ-seats" aria-label={`${o.seats} dari ${trip.seats} kursi terisi`}>
                    {Array.from({ length: trip.seats }).map((_, k) => (
                      <i key={k} className={k < o.seats ? 'on' : ''} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <p className="xs muted">Kursi yang kosong setelah penumpang turun bisa dipesan lagi untuk ruas berikutnya.</p>
          </div>

          {(trip.status === 'scheduled' || trip.status === 'ongoing') && (
            <LivePanel sharing={sharing} onToggle={toggleSharing} broadcast={broadcast} shareToken={shareToken} live={live} />
          )}

          <div className="card stack" style={{ '--gap': '10px' }}>
            {trip.status === 'scheduled' && (
              <>
                <button className="btn btn-primary btn-block" disabled={busy} onClick={() => status('start')}>
                  <Icon name="navigate" />
                  Mulai trip
                </button>
                <Link className="btn btn-block" href={`/driver/permintaan?trip=${trip.id}`}>
                  <Icon name="inbox" />
                  Cari penumpang searah
                </Link>
                <button className="btn btn-ghost btn-danger btn-block" disabled={busy} onClick={() => status('cancel')}>
                  Batalkan trip
                </button>
              </>
            )}
            {trip.status === 'ongoing' && (
              <button className="btn btn-primary btn-block" disabled={busy} onClick={() => status('complete')}>
                <Icon name="check" />
                Selesaikan trip
              </button>
            )}
            {(trip.status === 'completed' || trip.status === 'cancelled') && <p className="muted small">Trip ini sudah {tripStatusLabel[trip.status].toLowerCase()}.</p>}
            {err && <p className="error">{err}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
