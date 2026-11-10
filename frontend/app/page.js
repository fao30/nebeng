'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from './providers';
import SearchBar from '@/components/SearchBar';
import Icon from '@/components/Icon';

function HeroRoute() {
  // A route drawn like the app's timelines: departure, a stop, arrival.
  return (
    <div className="hero-route" aria-hidden>
      <svg viewBox="0 0 470 330" fontFamily="Plus Jakarta Sans, sans-serif">
        <path d="M40 290 C 140 290, 120 170, 230 165 S 360 60, 430 40" fill="none" stroke="#e5dffb" strokeWidth="14" strokeLinecap="round" />
        <path d="M40 290 C 140 290, 120 170, 230 165 S 360 60, 430 40" fill="none" stroke="#4a2bb0" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" />
        <circle cx="40" cy="290" r="9" fill="#fff" stroke="#4a2bb0" strokeWidth="4" />
        <circle cx="230" cy="165" r="7" fill="#fff" stroke="#8d8aa3" strokeWidth="3" />
        <circle cx="430" cy="40" r="9" fill="#4a2bb0" stroke="#fff" strokeWidth="3" />
        <g fontSize="13" fill="#17142e">
          <text x="62" y="282" fontWeight="700">07.00</text>
          <text x="62" y="300" fill="#8d8aa3">Jakarta</text>
          <text x="250" y="172" fontWeight="700">08.45</text>
          <text x="250" y="190" fill="#8d8aa3">Purwakarta</text>
          <text x="352" y="22" fontWeight="700">09.40</text>
          <text x="352" y="76" fill="#8d8aa3">Bandung</text>
        </g>
        <g transform="translate(300 220)">
          <rect width="150" height="58" rx="14" fill="#fff" stroke="#e9e7f0" />
          <text x="16" y="25" fontSize="12" fill="#8d8aa3">Cawang → Bandung</text>
          <text x="16" y="45" fontSize="16" fontWeight="800" fill="#17142e">Rp105.000</text>
        </g>
      </svg>
    </div>
  );
}

export default function Home() {
  const { user, setMode } = useApp();
  const router = useRouter();

  function search({ from, to, date, seats }) {
    const q = new URLSearchParams();
    if (from) q.set('from', JSON.stringify(from));
    if (to) q.set('to', JSON.stringify(to));
    if (date) q.set('date', date);
    q.set('seats', seats);
    setMode('passenger');
    router.push(`/cari?${q}`);
  }

  return (
    <div>
      <section className="hero">
        <HeroRoute />
        <h1>Searah? Nebeng aja.</h1>
        <p className="hero-lead">
          Cari mobil yang lewat dekat titik jemput Anda, bayar sesuai ruas yang Anda tempuh, dan pantau posisinya secara langsung.
          Atau isi kursi kosong mobil Anda di perjalanan yang memang akan Anda tempuh.
        </p>
      </section>
      <SearchBar onSearch={search} />

      <section className="home-cols">
        <div className="card">
          <div className="row">
            <Icon name="users" />
            <h2>Untuk penumpang</h2>
          </div>
          <ol>
            <li>Tentukan titik jemput, titik antar, dan seberapa jauh Anda mau berjalan dari rute.</li>
            <li>Bayar hanya ruas yang Anda lewati. Pesan instan, atau ajukan harga sendiri.</li>
            <li>Belum ada trip? Pasang permintaan, biar pemilik mobil searah yang menawari.</li>
          </ol>
          <Link href={user ? '/cari' : '/masuk'} className="btn btn-soft" style={{ marginTop: 16 }} onClick={() => setMode('passenger')}>
            Cari tumpangan
          </Link>
        </div>
        <div className="card">
          <div className="row">
            <Icon name="car" />
            <h2>Untuk pemilik mobil</h2>
          </div>
          <ol>
            <li>Buat trip dengan titik stop di mana saja, harga tiap ruas, kursi, dan koper.</li>
            <li>Kursi yang kosong setelah penumpang turun bisa langsung dipesan lagi.</li>
            <li>Lihat permintaan penumpang searah, tawarkan harga dan jam jemput.</li>
          </ol>
          <Link
            href={user ? '/driver/trip-baru' : '/masuk'}
            className="btn btn-soft"
            style={{ marginTop: 16 }}
            onClick={() => setMode('driver')}
          >
            Tawarkan kursi
          </Link>
        </div>
      </section>

      {!user && (
        <p className="demo">
          Coba dengan akun demo: pemilik mobil <code>budi@demo.id</code>, penumpang <code>andi@demo.id</code> atau <code>sari@demo.id</code>,
          password <code>demo123</code>.
        </p>
      )}
    </div>
  );
}
