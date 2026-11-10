'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, qs } from '@/lib/api';
import { AMENITIES, fmtDay, routeOf, shortPlace, timeBuckets } from '@/lib/format';
import SearchBar from '@/components/SearchBar';
import TripCard from '@/components/TripCard';
import MapView from '@/components/MapView';
import Icon from '@/components/Icon';
import { Empty, Segmented, Sheet } from '@/components/ui';

const SORTS = [
  { id: 'earliest', label: 'Berangkat paling awal' },
  { id: 'cheapest', label: 'Harga termurah' },
  { id: 'nearest_pickup', label: 'Terdekat dari titik jemput' },
  { id: 'nearest_dropoff', label: 'Terdekat ke tujuan' },
];

const DEFAULT_FILTERS = { order: 'earliest', times: [], rFrom: 10, rTo: 10, amen: [], luggage: 0 };

const LAST_KEY = 'nebeng_last_search';

// The passenger's last searched route, kept in this browser.
function readLast() {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY));
    return v && (v.from || v.to) ? v : null;
  } catch {
    return null;
  }
}
const RECENT_KEY = 'nebeng_recent_routes';
const sameRoute = (a, b) =>
  ['from', 'to'].every((k) => (!a[k] && !b[k]) || (a[k] && b[k] && Math.abs(a[k].lat - b[k].lat) < 1e-4 && Math.abs(a[k].lng - b[k].lng) < 1e-4));

function readRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Remember the last route (searched first next time) and the 3 most recent
// distinct routes (shown as shortcuts) — e.g. a daily Tambun → MT Haryono commute.
function saveLast(q) {
  if (!q.from && !q.to) return;
  const r = { from: q.from || null, to: q.to || null, seats: q.seats || 1 };
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(r));
    const recent = [r, ...readRecent().filter((x) => !sameRoute(x, r))].slice(0, 3);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    /* storage unavailable */
  }
}

function parse(q, key) {
  try {
    const v = JSON.parse(q.get(key));
    return v && typeof v.lat === 'number' ? v : null;
  } catch {
    return null;
  }
}

export default function Cari() {
  const [query, setQuery] = useState(null); // {from,to,date,seats}
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [trips, setTrips] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sheet, setSheet] = useState(false);
  const [view, setView] = useState('list');
  const [others, setOthers] = useState(null); // other trips when the route has none
  const [remembered, setRemembered] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    setRecent(readRecent());
    const q = new URLSearchParams(window.location.search);
    const fromUrl = { from: parse(q, 'from'), to: parse(q, 'to'), date: q.get('date') || '', seats: Number(q.get('seats')) || 1 };
    if (fromUrl.from || fromUrl.to) {
      saveLast(fromUrl);
      setQuery(fromUrl);
      return;
    }
    // No route in the link: start with the route this passenger searched last.
    const last = readLast();
    if (last) {
      setRemembered(true);
      setQuery({ from: last.from || null, to: last.to || null, date: '', seats: last.seats || 1 });
    } else {
      setQuery(fromUrl);
    }
  }, []);

  const load = useCallback(async () => {
    if (!query) return;
    setBusy(true);
    setErr('');
    try {
      const amen = Object.fromEntries(filters.amen.map((k) => [k, 1]));
      const data = await api(
        `/trips${qs({
          from_lat: query.from?.lat,
          from_lng: query.from?.lng,
          to_lat: query.to?.lat,
          to_lng: query.to?.lng,
          from_radius_km: filters.rFrom,
          to_radius_km: filters.rTo,
          date: query.date,
          seats: query.seats,
          luggage: filters.luggage || '',
          order_by: filters.order,
          ...amen,
        })}`,
      );
      setTrips(data);
      // Nothing on this route: offer whatever else is available.
      if (!data.length && (query.from || query.to)) {
        setOthers(await api(`/trips${qs({ seats: query.seats, date: query.date })}`));
      } else {
        setOthers(null);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [query, filters.amen, filters.rFrom, filters.rTo, filters.luggage, filters.order]);

  useEffect(() => {
    load();
  }, [load]);

  function onSearch(v) {
    setRemembered(false);
    saveLast(v);
    setRecent(readRecent());
    setQuery(v);
    const q = new URLSearchParams();
    if (v.from) q.set('from', JSON.stringify(v.from));
    if (v.to) q.set('to', JSON.stringify(v.to));
    if (v.date) q.set('date', v.date);
    q.set('seats', v.seats);
    window.history.replaceState(null, '', `/cari?${q}`);
  }

  const bucketOf = (t) => {
    const h = new Date(t.quote?.pickup_at || t.depart_at).getHours();
    return timeBuckets.find((b) => b.test(h))?.id;
  };
  const counts = useMemo(() => {
    const c = {};
    (trips || []).forEach((t) => {
      const b = bucketOf(t);
      c[b] = (c[b] || 0) + 1;
    });
    return c;
  }, [trips]);
  const shown = (trips || []).filter((t) => !filters.times.length || filters.times.includes(bucketOf(t)));
  const activeCount =
    filters.times.length +
    filters.amen.length +
    (filters.luggage ? 1 : 0) +
    (filters.order !== 'earliest' ? 1 : 0) +
    (filters.rFrom !== 10 || filters.rTo !== 10 ? 1 : 0);

  const groups = [];
  shown.forEach((t) => {
    const day = fmtDay(t.quote?.pickup_at || t.depart_at);
    const g = groups.find((x) => x.day === day);
    g ? g.items.push(t) : groups.push({ day, items: [t] });
  });

  const href = (t) =>
    `/trip/${t.id}${qs({
      p: query?.from ? JSON.stringify(query.from) : '',
      d: query?.to ? JSON.stringify(query.to) : '',
      s: query?.seats,
      k: filters.luggage || '',
    })}`;

  const filterPanel = <FilterPanel filters={filters} setFilters={setFilters} counts={counts} hasFrom={!!query?.from} hasTo={!!query?.to} />;

  const markers = [];
  const circles = [];
  if (query?.from) {
    markers.push({ ...query.from, kind: 'pickup', text: 'A' });
    circles.push({ ...query.from, radiusKm: filters.rFrom });
  }
  if (query?.to) {
    markers.push({ ...query.to, kind: 'drop', text: 'B' });
    circles.push({ ...query.to, radiusKm: filters.rTo });
  }
  shown.slice(0, 20).forEach((t) =>
    markers.push({ ...t.origin, kind: 'origin', popup: `${t.driver?.name}: ${shortPlace(t.origin)} ke ${shortPlace(t.destination)}` }),
  );

  return (
    <div>
      {query && <SearchBar key={`${query.from?.lat}|${query.to?.lat}`} initial={query} onSearch={onSearch} busy={busy} />}
      {recent.length > 0 && (
        <div className="recent-routes" aria-label="Rute terakhir">
          <span className="xs muted">Rute terakhir</span>
          {recent.map((r, i) => {
            const on = query && sameRoute(r, query);
            return (
              <button
                key={i}
                className={`chip recent-chip ${on ? 'chip-primary' : ''}`}
                onClick={() => onSearch({ from: r.from, to: r.to, date: '', seats: r.seats || 1 })}
              >
                <Icon name="clock" />
                {r.from ? shortPlace(r.from) : 'Mana saja'} → {r.to ? shortPlace(r.to) : 'mana saja'}
              </button>
            );
          })}
        </div>
      )}

      <div className="results-layout">
        <aside className="filters card desktop-only" aria-label="Filter">
          <div className="row-between" style={{ marginBottom: 6 }}>
            <h3>Filter</h3>
            {activeCount > 0 && (
              <button className="link small" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Atur ulang
              </button>
            )}
          </div>
          {filterPanel}
        </aside>

        <section className="stack" style={{ '--gap': '14px', minWidth: 0 }}>
          <div className="row-between wrap">
            <div>
              <h2>{trips == null ? 'Mencari…' : shown.length ? `${shown.length} trip tersedia` : 'Belum ada trip yang cocok'}</h2>
              <p className="small muted">
                {query?.from || query?.to
                  ? `${query.from ? shortPlace(query.from) : 'Mana saja'} ke ${query.to ? shortPlace(query.to) : 'mana saja'}`
                  : 'Semua trip yang akan berangkat'}
              </p>
            </div>
            <div className="row">
              <button className="btn btn-sm mobile-only" onClick={() => setSheet(true)}>
                <Icon name="sliders" className="icon-sm" />
                Filter
                {activeCount > 0 && <span className="count">{activeCount}</span>}
              </button>
              <Segmented
                label="Tampilan"
                value={view}
                onChange={setView}
                options={[
                  { value: 'list', label: 'Daftar', icon: 'list' },
                  { value: 'map', label: 'Peta', icon: 'map' },
                ]}
              />
            </div>
          </div>

          {remembered && (query?.from || query?.to) && (
            <div className="row wrap small" style={{ background: 'var(--primary-50)', padding: '10px 14px', borderRadius: 12 }}>
              <Icon name="clock" className="icon-sm" />
              <span className="grow">
                Menampilkan rute terakhir yang Anda cari: <b>{query.from ? shortPlace(query.from) : 'mana saja'}</b> ke{' '}
                <b>{query.to ? shortPlace(query.to) : 'mana saja'}</b>
              </span>
              <button
                className="link small"
                onClick={() => {
                  setRemembered(false);
                  setQuery({ from: null, to: null, date: '', seats: query.seats });
                }}
              >
                Lihat semua trip
              </button>
            </div>
          )}

          {err && <p className="error">{err}</p>}

          {view === 'map' && (
            <MapView
              markers={markers}
              circles={circles}
              lines={shown.slice(0, 20).map((t) => ({ points: routeOf(t), kind: 'route' }))}
              fitKey={`${shown.length}-${query?.from?.lat}`}
              height={460}
            />
          )}

          {trips && shown.length === 0 && others?.length > 0 && (
            <>
              <div className="card row wrap" style={{ '--gap': '12px' }}>
                <Icon name="info" />
                <span className="grow small">
                  Belum ada trip untuk rute ini. Ini trip lain yang tersedia, atau{' '}
                  <Link href="/minta">pasang permintaan</Link> supaya driver searah menawari Anda.
                </span>
              </div>
              <div className="list">
                {others.map((t) => (
                  <TripCard key={t.id} trip={t} href={`/trip/${t.id}`} />
                ))}
              </div>
            </>
          )}

          {trips && shown.length === 0 && !others?.length && (
            <Empty
              icon="megaphone"
              title="Belum ada yang searah"
              action={
                <Link className="btn btn-primary" href="/minta">
                  Pasang permintaan tumpangan
                </Link>
              }
            >
              Coba perbesar radius jemput atau antar, ganti tanggal, atau pasang permintaan supaya driver yang lewat bisa menawari Anda.
            </Empty>
          )}

          {view === 'list' &&
            groups.map((g) => (
              <div key={g.day}>
                <div className="day-head">{g.day}</div>
                <div className="list">
                  {g.items.map((t) => (
                    <TripCard key={t.id} trip={t} href={href(t)} />
                  ))}
                </div>
              </div>
            ))}
        </section>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter"
        footer={
          <>
            <button className="btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Atur ulang
            </button>
            <button className="btn btn-primary grow" onClick={() => setSheet(false)}>
              Lihat {shown.length} trip
            </button>
          </>
        }
      >
        {filterPanel}
      </Sheet>
    </div>
  );
}

function FilterPanel({ filters, setFilters, counts, hasFrom, hasTo }) {
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleIn = (k, id) => setFilters((f) => ({ ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] }));
  return (
    <div>
      <div className="filter-group">
        <h4>Urutkan</h4>
        {SORTS.map((s) => (
          <label key={s.id} className="radio-row">
            <input type="radio" name="order" checked={filters.order === s.id} onChange={() => set('order', s.id)} />
            {s.label}
          </label>
        ))}
      </div>
      <div className="filter-group">
        <h4>Jam berangkat</h4>
        {timeBuckets.map((b) => (
          <label key={b.id} className={`radio-row ${counts[b.id] ? '' : 'disabled'}`}>
            <input type="checkbox" checked={filters.times.includes(b.id)} onChange={() => toggleIn('times', b.id)} />
            <Icon name={b.icon} />
            {b.label}
            <span className="count-muted">{counts[b.id] || 0}</span>
          </label>
        ))}
      </div>
      <div className="filter-group stack" style={{ '--gap': '14px' }}>
        <h4 style={{ margin: 0 }}>Radius</h4>
        <label className="field">
          <span className="row-between small">
            <span>Dari titik jemput</span>
            <b className="tnum">{filters.rFrom} km</b>
          </span>
          <input type="range" min="1" max="50" value={filters.rFrom} onChange={(e) => set('rFrom', Number(e.target.value))} disabled={!hasFrom} />
        </label>
        <label className="field">
          <span className="row-between small">
            <span>Dari titik antar</span>
            <b className="tnum">{filters.rTo} km</b>
          </span>
          <input type="range" min="1" max="50" value={filters.rTo} onChange={(e) => set('rTo', Number(e.target.value))} disabled={!hasTo} />
        </label>
        <p className="help">
          {hasFrom || hasTo
            ? 'Contoh: antar ke Tambun dengan radius 15 km, trip yang berakhir di Cikarang ikut muncul.'
            : 'Isi titik jemput atau antar di kolom pencarian untuk memakai radius.'}
        </p>
      </div>
      <div className="filter-group">
        <h4>Koper</h4>
        <label className="radio-row">
          <Icon name="luggage" />
          Jumlah koper
          <select
            className="input"
            style={{ width: 112, height: 36, marginLeft: 'auto' }}
            value={filters.luggage}
            onChange={(e) => set('luggage', Number(e.target.value))}
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Tanpa' : `${n} koper`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="filter-group">
        <h4>Kenyamanan</h4>
        {AMENITIES.filter((a) => a.key !== 'luggage').map((a) => (
          <label key={a.key} className="radio-row">
            <input type="checkbox" checked={filters.amen.includes(a.key)} onChange={() => toggleIn('amen', a.key)} />
            <Icon name={a.icon} />
            {a.label}
          </label>
        ))}
      </div>
    </div>
  );
}
