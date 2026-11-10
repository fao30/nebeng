'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/app/providers';
import Icon from './Icon';
import { Empty } from './ui';

const TABS = [
  { href: '/admin', label: 'Ringkasan & tarif', icon: 'sliders' },
  { href: '/admin/trip', label: 'Trip', icon: 'route' },
  { href: '/admin/percakapan', label: 'Percakapan', icon: 'message' },
  { href: '/admin/pengguna', label: 'Pengguna', icon: 'users' },
  { href: '/admin/notifikasi', label: 'Log notifikasi', icon: 'bell' },
];

export default function AdminShell({ title, desc, actions, children }) {
  const { user, ready } = useApp();
  const path = usePathname();
  if (!ready) return <p className="muted">Memuat…</p>;
  if (!user?.is_admin)
    return (
      <Empty
        icon="shield"
        title="Khusus admin"
        action={
          !user && (
            <Link className="btn btn-primary" href={`/masuk?next=${encodeURIComponent(path)}`}>
              Masuk sebagai admin
            </Link>
          )
        }
      >
        Halaman ini hanya untuk akun admin Nebeng.
      </Empty>
    );
  return (
    <div>
      <nav className="admin-tabs" aria-label="Menu admin">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={path === t.href ? 'page' : undefined}>
            <Icon name={t.icon} className="icon-sm" />
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {desc && <p>{desc}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
