'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/app/providers';
import { Empty } from './ui';
import KycGate from './KycGate';

export default function RequireAuth({ children, kyc }) {
  const { user, ready } = useApp();
  const path = usePathname();
  if (!ready) return <p className="muted">Memuat…</p>;
  if (!user)
    return (
      <div className="page-narrow">
        <Empty
          icon="user"
          title="Masuk dulu, ya"
          action={
            <Link className="btn btn-primary" href={`/masuk?next=${encodeURIComponent(path)}`}>
              Masuk atau daftar
            </Link>
          }
        >
          Halaman ini butuh akun supaya pesanan dan trip Anda tersimpan.
        </Empty>
      </div>
    );
  return kyc ? <KycGate need={kyc}>{children}</KycGate> : children;
}
