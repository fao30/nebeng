'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/app/providers';
import Icon from './Icon';
import { Avatar } from './ui';
import { NotificationBell, NotificationToasts } from './Notifications';
import { TERMS_VERSION, TermsModal } from './Terms';
import { api } from '@/lib/api';
import { useState } from 'react';

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
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="6" cy="18" r="2.2" fill="#fff" stroke="none" />
        <circle cx="18" cy="6" r="2.2" fill="#fff" stroke="none" />
        <path d="M6 18c0-6 12-6 12-12" />
      </svg>
    </span>
  );
}

export default function Nav() {
  const { user, setUser, mode, setMode, signOut } = useApp();
  const [termsBusy, setTermsBusy] = useState(false);
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
          <Link href="/" className="brand" aria-label="Nebeng, beranda">
            <BrandGlyph />
            nebeng
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
                    Driver
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
