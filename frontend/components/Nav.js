'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/app/providers';
import Icon from './Icon';
import { Avatar } from './ui';
import { NotificationBell, NotificationToasts } from './Notifications';
import { TERMS_VERSION, TermsModal } from './Terms';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { onArrival } from '@/lib/notifications';
import { identityOK } from '@/lib/kyc';

const TABS = {
  passenger: [
    { href: '/cari', label: 'Cari', icon: 'search' },
    { href: '/minta', label: 'Minta', icon: 'megaphone' },
    { href: '/pesanan', label: 'Perjalanan', icon: 'ticket' },
    { href: '/profil', label: 'Profil', icon: 'user' },
  ],
  driver: [
    { href: '/driver', label: 'Trip saya', icon: 'car' },
    { href: '/driver/trip-baru', label: 'Buat trip', icon: 'plus', main: true },
    { href: '/driver/permintaan', label: 'Permintaan', icon: 'inbox' },
    { href: '/profil', label: 'Profil', icon: 'user' },
  ],
};

export function BrandGlyph() {
  return (
    <span className="brand-glyph" aria-hidden>
      {/* Logo "N Rute": the letter N drawn as a route, ending at a teal destination. */}
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6.8 17.4V6.8l10.4 10.4V6.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6.8" cy="17.4" r="1.9" fill="#fff" />
        <circle cx="17.2" cy="6.4" r="2.2" fill="#33b5c9" />
      </svg>
    </span>
  );
}

export default function Nav() {
  const { user, setUser, mode, setMode, signOut } = useApp();
  const [termsBusy, setTermsBusy] = useState(false);
  // Verification decided by an admin: refresh the account so gates open at once.
  useEffect(
    () => onArrival((n) => n.type === 'kyc' && api('/me').then(setUser).catch(() => {})),
    [setUser],
  );
  const path = usePathname();
  const router = useRouter();
  if (path.startsWith('/live/')) return null;

  function switchMode(m) {
    setMode(m);
    router.push(m === 'driver' ? '/driver' : '/cari');
  }

  const tabs = TABS[mode];
  const current = (href) => (href === path || (href !== '/driver' && href !== '/' && path.startsWith(href + '/')) ? 'page' : undefined);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Numpang, beranda">
            <BrandGlyph />
            <span className={user ? 'brand-word' : ''}>Numpang</span>
          </Link>
          {user && (
            <nav className="nav" aria-label="Menu utama">
              {tabs
                .filter((t) => t.href !== '/profil')
                .map((t) => (
                  <Link key={t.href} href={t.href} aria-current={current(t.href)}>
                    {t.label}
                  </Link>
                ))}
              {user.is_admin && (
                <Link href="/admin" aria-current={path.startsWith('/admin') ? 'page' : undefined}>
                  Admin
                </Link>
              )}
            </nav>
          )}
          <div className="header-end">
            {user ? (
              <>
                <div className="seg" role="tablist" aria-label="Mode">
                  <button role="tab" aria-selected={mode === 'passenger'} onClick={() => switchMode('passenger')}>
                    Penumpang
                  </button>
                  <button role="tab" aria-selected={mode === 'driver'} onClick={() => switchMode('driver')}>
                    Pemilik mobil
                  </button>
                </div>
                <NotificationBell userId={user.id} />
                <Link href="/profil" className="who row" aria-label="Profil" style={{ '--gap': '8px', color: 'var(--ink)' }}>
                  <Avatar name={user.name} />
                </Link>
                <button
                  className="btn btn-ghost icon-btn who"
                  title="Keluar"
                  aria-label="Keluar"
                  onClick={() => {
                    signOut();
                    router.push('/');
                  }}
                >
                  <Icon name="logout" />
                </button>
              </>
            ) : (
              <>
                <Link href="/cari" className="btn btn-ghost btn-sm">
                  Cari trip
                </Link>
                <Link href="/masuk" className="btn btn-primary btn-sm">
                  Masuk
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {user && <NotificationToasts />}
      {user && !identityOK(user) && !path.startsWith('/verifikasi') && !path.startsWith('/admin') && !path.startsWith('/syarat') && (
        <Link href="/verifikasi" className={`kyc-bar ${user.identity_status === 'pending' ? 'is-pending' : ''}`}>
          <Icon name={user.identity_status === 'pending' ? 'clock' : 'shield'} className="icon-sm" />
          <span>
            {user.identity_status === 'pending'
              ? 'Verifikasi identitas sedang ditinjau admin, maksimal 1x24 jam.'
              : user.identity_status === 'rejected'
                ? 'Verifikasi identitas ditolak. Ketuk untuk melihat alasan dan kirim ulang.'
                : 'Verifikasi wajah dan KTP/SIM untuk mulai numpang.'}
          </span>
          <Icon name="chevronRight" className="icon-sm" />
        </Link>
      )}
      {/* Existing accounts accept new or updated terms before continuing. */}
      <TermsModal
        open={!!user && user.terms_version !== TERMS_VERSION && !path.startsWith('/syarat')}
        busy={termsBusy}
        acceptLabel="Setuju"
        onAccept={async () => {
          setTermsBusy(true);
          try {
            setUser(await api('/me/terms', { method: 'POST', body: { version: TERMS_VERSION } }));
          } finally {
            setTermsBusy(false);
          }
        }}
        footerExtra={
          <button
            className="link small"
            onClick={() => {
              signOut();
              router.push('/');
            }}
          >
            Tidak setuju, keluar
          </button>
        }
      />
      {user && (
        <nav className="tabbar" aria-label="Menu">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} aria-current={current(t.href)} className={t.main ? 'tab-main' : ''}>
              <Icon name={t.icon} />
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
