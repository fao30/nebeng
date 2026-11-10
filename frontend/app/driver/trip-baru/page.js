'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AMENITIES, estimateEtas, fmtDay, fmtRp, fmtTime, haversine, localInputValue, shortPlace, suggestSegmentPrice } from '@/lib/format';
import MapView from '@/components/MapView';
import PointField, { pointFromClick } from '@/components/PointField';
import RequireAuth from '@/components/RequireAuth';
import RouteTimeline from '@/components/RouteTimeline';
import Icon from '@/components/Icon';
import { Stepper, Toggle } from '@/components/ui';
import { useApp } from '../../providers';

const STEPS = ['Rute', 'Waktu', 'Harga', 'Detail', 'Tinjau'];
const MAX_STOPS = 10;

function NewTrip() {
  const { user } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [stops, setStops] = useState([]);
  const [active, setActive] = useState('origin');
  const [departAt, setDepartAt] = useState(localInputValue(3));
  const [prices, setPrices] = useState([]);
  const [negotiable, setNegotiable] = useState(true);
  const [seats, setSeats] = useState(3);
  const [luggage, setLuggage] = useState(true);
  const [maxLuggage, setMaxLuggage] = useState(2);
  const [amen, setAmen] = useState({ max2_back: true, pets: false, smoking: false, baby_seat: false, parcel: false, cargo: false });
  const [instant, setInstant] = useState(true);
  const [vehicle, setVehicle] = useState([user.car_model, user.car_plate].filter(Boolean).join(' '));
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const route = useMemo(() => (origin && dest ? [origin, ...stops, dest] : null), [origin, dest, stops]);
  const segKm = useMemo(() => (route ? route.slice(1).map((p, i) => haversine(route[i], p)) : []), [route]);
  const kind = origin && dest && haversine(origin, dest) <= 25 ? 'dalam_kota' : 'antar_kota';

  // Keep one price per segment; new segments start at the suggested price.
  useEffect(() => {
    setPrices((prev) => segKm.map((km, i) => (prev.length === segKm.length && prev[i] ? prev[i] : suggestSegmentPrice(km))));
  }, [segKm]);

  const etas = route ? estimateEtas(route, new Date(departAt).toISOString(), kind) : [];
  const preview = route && {
    origin,
    destination: dest,
    stops,
    etas: etas.map((d) => d.toISOString()),
    depart_at: new Date(departAt).toISOString(),
  };
  const total = prices.reduce((a, b) => a + b, 0);

  function addStop(p) {
    if (p && stops.length < MAX_STOPS) setStops((s) => [...s, p]);
  }
  function moveStop(i, dir) {
    setStops((s) => {
      const n = [...s];
      const j = i + dir;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }
  async function onMapClick(ll) {
    if (step !== 0) return;
    const p = await pointFromClick(ll);
    if (active === 'origin') {
      setOrigin(p);
      setActive(dest ? 'stop' : 'dest');
    } else if (active === 'dest') {
      setDest(p);
      setActive('stop');
    } else addStop(p);
  }

  const canNext = [
    !!route && haversine(origin, dest) >= 0.3,
    new Date(departAt) > new Date(Date.now() - 5 * 60e3),
    prices.length > 0 && prices.every((p) => p >= 0),
    seats >= 1,
    true,
  ][step];

  async function publish() {
    setBusy(true);
    setErr('');
    try {
      const t = await api('/trips', {
        method: 'POST',
        body: {
          origin,
          destination: dest,
          stops,
          depart_at: new Date(departAt).toISOString(),
          seats,
          luggage,
          max_luggage: luggage ? maxLuggage : 0,
          segment_prices: prices,
          negotiable,
          instant_booking: instant,
          amenities: amen,
          kind,
          vehicle,
          notes,
        },
      });
      router.push(`/trip/${t.id}`);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="wizard">
      <div>
        <div className="progress" aria-hidden>
          {STEPS.map((s, i) => (
            <i key={s} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <div className="wizard-step">
          Langkah {step + 1} dari {STEPS.length}
        </div>

        {step === 0 && (
          <div className="stack" style={{ '--gap': '14px' }}>
            <h1>Ke mana Anda berangkat?</h1>
            <p className="muted">Tambahkan titik stop tempat penumpang bisa naik atau turun. Urutkan sesuai arah perjalanan.</p>
            <PointField label="Berangkat dari" kind="origin" value={origin} onChange={setOrigin} active={active === 'origin'} onActivate={() => setActive('origin')} />
            {stops.map((s, i) => (
              <div className="stop-item" key={`${s.lat}-${i}`}>
                <span className="dot dot-stop" />
                <span>{s.label}</span>
                <button type="button" className="btn btn-ghost icon-btn" onClick={() => moveStop(i, -1)} disabled={i === 0} aria-label="Naikkan">
                  <Icon name="arrowUp" className="icon-sm" />
                </button>
                <button type="button" className="btn btn-ghost icon-btn" onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1} aria-label="Turunkan">
                  <Icon name="arrowDown" className="icon-sm" />
                </button>
                <button type="button" className="btn btn-ghost icon-btn btn-danger" onClick={() => setStops(stops.filter((_, j) => j !== i))} aria-label="Hapus titik stop">
                  <Icon name="trash" className="icon-sm" />
                </button>
              </div>
            ))}
            {stops.length < MAX_STOPS && <StopAdder onAdd={addStop} active={active === 'stop'} onActivate={() => setActive('stop')} />}
            <PointField label="Tujuan akhir" kind="dest" value={dest} onChange={setDest} active={active === 'dest'} onActivate={() => setActive('dest')} />
            {route && (
              <p className="small muted">
                ±{Math.round(segKm.reduce((a, b) => a + b, 0))} km{stops.length ? `, ${stops.length} titik stop` : ''}, {kind === 'antar_kota' ? 'antar kota' : 'dalam kota'}
              </p>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="stack" style={{ '--gap': '14px' }}>
            <h1>Kapan berangkat?</h1>
            <label className="field">
              <span className="field-label">Tanggal dan jam</span>
              <input className="input" type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
            </label>
            <div className="card">
              <div className="section-title">Perkiraan jam di tiap titik</div>
              <RouteTimeline trip={preview} />
              <p className="xs muted" style={{ marginTop: 12 }}>
                Dihitung dari jarak dan kecepatan rata-rata. Penumpang melihat jam ini sebagai perkiraan.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack" style={{ '--gap': '14px' }}>
            <h1>Harga per kursi</h1>
            <p className="muted">Atur harga tiap ruas. Penumpang hanya membayar ruas yang ia lewati, jadi harga turun-naik tengah jalan tetap adil.</p>
            <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {prices.map((p, i) => (
                <div className="seg-price" key={i}>
                  <div className="grow">
                    <b>
                      {shortPlace(route[i])} ke {shortPlace(route[i + 1])}
                    </b>
                    <span className="xs muted">
                      ±{Math.round(segKm[i])} km, saran {fmtRp(suggestSegmentPrice(segKm[i]))}
                    </span>
                  </div>
                  <Stepper
                    label={`harga ruas ${i + 1}`}
                    wide
                    value={p}
                    step={5000}
                    min={0}
                    max={5_000_000}
                    format={fmtRp}
                    onChange={(v) => setPrices((ps) => ps.map((x, j) => (j === i ? v : x)))}
                  />
                </div>
              ))}
            </div>
            <div className="row-between">
              <span className="ink2">Rute penuh per kursi</span>
              <b className="tnum" style={{ fontSize: '1.2rem' }}>
                {fmtRp(total)}
              </b>
            </div>
            <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              <Toggle icon="tag" title="Penumpang boleh menawar" desc="Penumpang bisa mengajukan harga lain, Anda tetap yang memutuskan." checked={negotiable} onChange={setNegotiable} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="stack" style={{ '--gap': '14px' }}>
            <h1>Detail perjalanan</h1>
            <div className="card stack" style={{ '--gap': '14px' }}>
              <div className="qty-row">
                <div>
                  <b>Maksimal penumpang</b>
                  <span className="xs muted">Jumlah kursi yang Anda tawarkan</span>
                </div>
                <Stepper label="penumpang" value={seats} onChange={setSeats} min={1} max={8} />
              </div>
              <Toggle icon="luggage" title="Bisa bawa koper" checked={luggage} onChange={setLuggage} />
              {luggage && (
                <div className="qty-row">
                  <div>
                    <b>Maksimal koper</b>
                    <span className="xs muted">Total untuk semua penumpang sekaligus</span>
                  </div>
                  <Stepper label="koper" value={maxLuggage} onChange={setMaxLuggage} min={1} max={20} />
                </div>
              )}
            </div>
            <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {AMENITIES.filter((a) => !['instant', 'luggage'].includes(a.key)).map((a) => (
                <Toggle key={a.key} icon={a.icon} title={a.label} checked={amen[a.key]} onChange={(v) => setAmen({ ...amen, [a.key]: v })} />
              ))}
            </div>
            <div className="stack" style={{ '--gap': '8px' }}>
              <span className="field-label">Cara penumpang memesan</span>
              <label className="choice">
                <input type="radio" name="mode" checked={instant} onChange={() => setInstant(true)} />
                <span>
                  <b>
                    <Icon name="bolt" className="icon-sm" /> Pesan instan
                  </b>
                  <span className="small muted">Penumpang yang setuju dengan harga Anda langsung terkonfirmasi.</span>
                </span>
              </label>
              <label className="choice">
                <input type="radio" name="mode" checked={!instant} onChange={() => setInstant(false)} />
                <span>
                  <b>
                    <Icon name="shield" className="icon-sm" /> Saya setujui dulu
                  </b>
                  <span className="small muted">Setiap pesanan menunggu persetujuan Anda.</span>
                </span>
              </label>
            </div>
            <label className="field">
              <span className="field-label">Kendaraan</span>
              <input className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Toyota Avanza B 1234 XYZ" />
            </label>
            <label className="field">
              <span className="field-label">Catatan untuk penumpang</span>
              <textarea className="input" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Misal: lewat tol, tunggu maksimal 5 menit di titik jemput" />
            </label>
          </div>
        )}

        {step === 4 && preview && (
          <div className="stack" style={{ '--gap': '14px' }}>
            <h1>Tinjau dan terbitkan</h1>
            <div className="card stack" style={{ '--gap': '16px' }}>
              <div className="row-between">
                <span className="chip">
                  <Icon name="calendar" />
                  {fmtDay(departAt)}, {fmtTime(departAt)}
                </span>
                <b className="tnum">{fmtRp(total)} /kursi</b>
              </div>
              <RouteTimeline trip={preview} />
              <hr className="divider" style={{ margin: 0 }} />
              <div className="row wrap small ink2">
                <span className="chip">
                  <Icon name="users" />
                  {seats} kursi
                </span>
                <span className="chip">
                  <Icon name="luggage" />
                  {luggage ? `${maxLuggage} koper` : 'Tanpa koper'}
                </span>
                <span className="chip chip-primary">
                  <Icon name={instant ? 'bolt' : 'shield'} />
                  {instant ? 'Pesan instan' : 'Perlu persetujuan'}
                </span>
                {negotiable && <span className="chip">Bisa nego</span>}
                {AMENITIES.filter((a) => amen[a.key]).map((a) => (
                  <span className="chip" key={a.key}>
                    <Icon name={a.icon} />
                    {a.label}
                  </span>
                ))}
              </div>
            </div>
            {err && <p className="error">{err}</p>}
          </div>
        )}

        <div className="wizard-nav">
          {step > 0 && (
            <button className="btn btn-lg" onClick={() => setStep(step - 1)}>
              <Icon name="chevronLeft" />
              Kembali
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary btn-lg" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Lanjut: {STEPS[step + 1]}
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={publish}>
              Terbitkan trip
            </button>
          )}
        </div>
      </div>

      <div className="wizard-map">
        <MapView
          markers={[
            ...(origin ? [{ ...origin, kind: 'origin', popup: origin.label }] : []),
            ...stops.map((s, i) => ({ ...s, kind: 'stop', popup: `Stop ${i + 1}: ${s.label}` })),
            ...(dest ? [{ ...dest, kind: 'dest', popup: dest.label }] : []),
          ]}
          lines={route ? [{ points: route, kind: 'route' }] : []}
          onClick={onMapClick}
          fitKey={`${origin?.lat}${dest?.lat}${stops.length}`}
          height={step === 0 ? 560 : 420}
        />
      </div>
    </div>
  );
}

function StopAdder({ onAdd, active, onActivate }) {
  const [k, setK] = useState(0);
  return (
    <PointField
      key={k}
      label="Tambah titik stop"
      placeholder="Tambah titik stop (opsional)"
      kind="stop"
      value={null}
      active={active}
      onActivate={onActivate}
      onChange={(p) => {
        if (p) {
          onAdd(p);
          setK((x) => x + 1);
        }
      }}
    />
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <NewTrip />
    </RequireAuth>
  );
}
