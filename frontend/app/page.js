'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './providers';
import { api } from '@/lib/api';
import { fmtRp, routeOf, shortPlace, todayISO } from '@/lib/format';
import PointField from '@/components/PointField';
import Icon from '@/components/Icon';
import MiniRoute from '@/components/MiniRoute';

/** Decorative map for the hero: a route, a car on its way and the boarding code. */
function HeroMap() {
  return (
    <div className="hero-map" aria-hidden>
      <svg viewBox="0 0 560 560" preserveAspectRatio="xMidYMid slice">
        <rect width="560" height="560" fill="#eceef7" />
        <g fill="#e1e4f1">
          <rect x="40" y="40" width="120" height="90" rx="6" />
          <rect x="250" y="170" width="140" height="100" rx="6" />
          <rect x="420" y="40" width="100" height="120" rx="6" />
          <rect x="60" y="330" width="130" height="110" rx="6" />
          <rect x="330" y="380" width="160" height="100" rx="6" />
        </g>
        <g stroke="#fff" fill="none" strokeLinecap="round">
          <path d="M-20 160 L580 140" strokeWidth="16" />
          <path d="M-20 300 L580 320" strokeWidth="11" />
          <path d="M-20 470 L580 450" strokeWidth="16" />
          <path d="M210 -20 L200 580" strokeWidth="16" />
          <path d="M400 -20 L410 580" strokeWidth="11" />
          <path d="M-20 600 L600 -20" strokeWidth="24" stroke="#f7f8fc" />
        </g>
        <g fontFamily="Mulish, sans-serif" fontSize="13" fill="#8a91b3" fontWeight="700">
          <text x="20" y="152">Jl. Ahmad Yani</text>
          <text x="420" y="314">Jl. Raya Bekasi</text>
          <text x="250" y="420" transform="rotate(-45 250 420)">
            Tol Jakarta–Cikampek
          </text>
        </g>
        <path d="M80 500 L200 470 L205 300 L330 305 L405 300 L410 145 L500 120" stroke="#26337a" strokeWidth="7" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M410 145 L500 120" stroke="#33b5c9" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M140 540 L170 520 L195 480" stroke="#26337a" strokeWidth="4" strokeDasharray="1 9" strokeLinecap="round" fill="none" />
        <circle cx="140" cy="540" r="28" fill="rgba(51,181,201,0.18)" />
        <circle cx="140" cy="540" r="10" fill="#33b5c9" stroke="#fff" strokeWidth="4" />
        <circle cx="80" cy="500" r="11" fill="#26337a" stroke="#fff" strokeWidth="4" />
        <circle cx="205" cy="300" r="8" fill="#fff" stroke="#26337a" strokeWidth="4" />
        <circle cx="500" cy="120" r="11" fill="#33b5c9" stroke="#fff" strokeWidth="4" />
      </svg>
      <span className="hero-car">
        <Icon name="car" />
      </span>
      <span className="map-callout hero-callout">
        <b>4 mnt</b>
        <span>800 m lagi</span>
      </span>
      <div className="hero-card">
        <div>
          <b>Mobil terverifikasi</b>
          <span className="plate">B 1234 •••</span>
        </div>
        <div className="code-mini">
          {'4827'.split('').map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { title: 'Cari yang searah', body: 'Masukkan titik jemput dan tujuan. Kami tunjukkan mobil yang lewat dekatmu, lengkap dengan jarak ke titik naiknya.' },
  { title: 'Pesan atau tawar', body: 'Pesan langsung di harga pemilik mobil, atau tawar dan ngobrol lewat chat sampai deal.' },
  { title: 'Naik dengan kode', body: 'Tunjukkan kode naik 4 angka. Keluarga bisa pantau perjalanan lewat link lokasi live.' },
];
const SAFETY = [
  { title: 'Wajah, KTP & STNK dicek', body: 'Admin memeriksa setiap akun dan mobil, maksimal 1x24 jam.' },
  { title: 'Kode naik', body: 'Pemilik mobil memasukkan kodemu, jadi kalian sama-sama tahu kamu sudah naik.' },
  { title: 'Lokasi live untuk keluarga', body: 'Satu link untuk memantau perjalanan, tanpa perlu akun.' },
  { title: 'Rating & laporan', body: 'Saling beri rating setelah trip, laporkan pelanggaran ke admin.' },
];

export default function Home() {
  const { user, setMode } = useApp();
  const router = useRouter();
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [date, setDate] = useState('');
  const [seats, setSeats] = useState(1);
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    api('/trips')
      .then(setTrips)
      .catch(() => {});
  }, []);

  // Popular routes from the trips that are actually open now.
  const routes = useMemo(() => {
    const byRoute = new Map();
    trips.forEach((t) => {
      const key = `${shortPlace(t.origin)}→${shortPlace(t.destination)}`;
      const cur = byRoute.get(key);
      if (!cur) byRoute.set(key, { trip: t, count: 1, min: t.price_per_seat });
      else {
        cur.count++;
        cur.min = Math.min(cur.min, t.price_per_seat);
      }
    });
    return [...byRoute.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [trips]);

  function go(q) {
    const p = new URLSearchParams();
    if (q.from) p.set('from', JSON.stringify(q.from));
    if (q.to) p.set('to', JSON.stringify(q.to));
    if (q.date) p.set('date', q.date);
    p.set('seats', q.seats || 1);
    setMode('passenger');
    router.push(`/cari?${p}`);
  }

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-text">
          <span className="eyebrow-pill">
            <span className="live-dot on" />
            Dalam kota dan antar kota
          </span>
          <h1>
            Searah?
            <br />
            Nebeng aja.
          </h1>
          <p className="hero-lead">
            Cari pemilik mobil yang lewat dekatmu, naik di titik jemputnya, dan bagi ongkos bensin dan tol. Semua akun terverifikasi wajah dan KTP.
          </p>
          <form
            className="route-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              go({ from, to, date, seats });
            }}
          >
            <div className="route-search-fields">
              <div className="route-rail" aria-hidden>
                <span className="dot" />
                <span className="route-rail-line" />
                <span className="dot dot-dest" />
              </div>
              <div className="stack" style={{ '--gap': '8px', flex: 1, minWidth: 0 }}>
                <PointField label="Dari" placeholder="Titik jemput kamu" kind="origin" value={from} onChange={setFrom} />
                <PointField label="Ke" placeholder="Tujuan kamu" kind="dest" value={to} onChange={setTo} />
              </div>
            </div>
            <div className="route-search-row">
              <input className="input" type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} aria-label="Tanggal berangkat" />
              <select className="input" value={seats} onChange={(e) => setSeats(Number(e.target.value))} aria-label="Jumlah penumpang">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} orang
                  </option>
                ))}
              </select>
              <button className="btn btn-primary btn-lg">
                <Icon name="search" />
                Cari tumpangan
              </button>
            </div>
          </form>
          {routes.length > 0 && (
            <div className="row wrap small" style={{ '--gap': '8px' }}>
              <span className="muted strong">Populer:</span>
              {routes.slice(0, 3).map((r) => (
                <button key={r.trip.id} type="button" className="chip recent-chip" onClick={() => go({ from: r.trip.origin, to: r.trip.destination })}>
                  {shortPlace(r.trip.origin)} → {shortPlace(r.trip.destination)}
                </button>
              ))}
            </div>
          )}
        </div>
        <HeroMap />
      </section>

      <section className="home-band" id="cara">
        <span className="eyebrow light">Cara kerja</span>
        <h2>Tiga langkah, semua di aplikasi</h2>
        <div className="home-grid-3">
          {STEPS.map((s, i) => (
            <article key={s.title} className="step-card">
              <span className="step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      {routes.length > 0 && (
        <section className="home-section">
          <div className="row-between wrap" style={{ alignItems: 'flex-end' }}>
            <h2>Rute yang sedang tersedia</h2>
            <Link href="/cari" className="strong">
              Lihat semua trip
            </Link>
          </div>
          <div className="journey-grid">
            {routes.map((r) => (
              <button key={r.trip.id} type="button" className="journey" onClick={() => go({ from: r.trip.origin, to: r.trip.destination })}>
                <div className="journey-body">
                  <div className="journey-route">
                    <div className="route-rail sm" aria-hidden>
                      <span className="dot" />
                      <span className="route-rail-line" />
                      <span className="dot dot-dest" />
                    </div>
                    <div className="stack" style={{ '--gap': '10px' }}>
                      <b>{shortPlace(r.trip.origin)}</b>
                      <b>{shortPlace(r.trip.destination)}</b>
                    </div>
                  </div>
                  <div className="journey-meta">
                    <span>{r.count} trip</span>
                    <span>{r.trip.kind === 'antar_kota' ? 'Antar kota' : 'Dalam kota'}</span>
                    <span className="strong" style={{ color: 'var(--primary)' }}>
                      mulai {fmtRp(r.min)}
                    </span>
                  </div>
                </div>
                <MiniRoute points={routeOf(r.trip)} />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="home-safety" id="aman">
        <div className="home-safety-text">
          <span className="eyebrow">Keamanan</span>
          <h2>Tahu siapa yang semobil denganmu</h2>
          <p>Setiap akun dicek admin. Nomor telepon dan pelat baru terlihat setelah pesanan disetujui, dan semua perjalanan tercatat di aplikasi.</p>
        </div>
        <div className="home-grid-2">
          {SAFETY.map((x) => (
            <div key={x.title} className="safety-card">
              <span className="safety-icon">
                <Icon name="shield" />
              </span>
              <b>{x.title}</b>
              <span>{x.body}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-cta">
        <div>
          <h2>
            Punya kursi kosong?
            <br />
            Isi, dan ongkos jadi ringan.
          </h2>
          <p>Pasang rute dan titik jemputmu, tentukan harga per kursi, terima penumpang yang searah. Verifikasi mobil dan STNK sekali saja.</p>
        </div>
        <div className="stack" style={{ '--gap': '10px', alignItems: 'stretch' }}>
          <Link href={user ? '/driver/trip-baru' : '/masuk'} className="btn btn-teal btn-lg" onClick={() => setMode('driver')}>
            Mulai beri tumpangan
          </Link>
          <span className="small" style={{ color: '#d3d8f2', textAlign: 'center' }}>
            Verifikasi maksimal 1x24 jam
          </span>
        </div>
      </section>

      <footer className="home-footer">
        <span>© 2026 Nebeng</span>
        <span className="row" style={{ '--gap': '18px' }}>
          <Link href="/syarat">Syarat &amp; Ketentuan</Link>
          {!user && <Link href="/masuk">Masuk</Link>}
        </span>
      </footer>
    </div>
  );
}
