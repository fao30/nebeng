'use client';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import Icon from './Icon';
import { identityOK, vehicleOK } from '@/lib/kyc';

/** Explains what's missing and links to /verifikasi. */
export function KycNotice({ need = 'identity', compact }) {
  const { user } = useApp();
  const idSt = user?.identity_status || '';
  const vSt = user?.vehicle_status || '';
  const st = need === 'vehicle' && identityOK(user) ? vSt : idSt;
  const pending = st === 'pending';
  const rejected = st === 'rejected';
  const title =
    need === 'vehicle'
      ? identityOK(user)
        ? pending
          ? 'Data mobil Anda sedang ditinjau'
          : rejected
            ? 'Verifikasi mobil ditolak'
            : 'Aktifkan fitur pemilik mobil'
        : pending
          ? 'Identitas Anda sedang ditinjau'
          : 'Verifikasi identitas dan mobil dulu'
      : pending
        ? 'Identitas Anda sedang ditinjau'
        : rejected
          ? 'Verifikasi identitas ditolak'
          : 'Verifikasi identitas dulu';
  const body = pending
    ? 'Tim Numpang memeriksa data Anda, maksimal 1x24 jam. Kami kirim notifikasi begitu selesai.'
    : rejected
      ? 'Lihat alasannya dan kirim ulang foto di halaman verifikasi.'
      : need === 'vehicle'
        ? 'Untuk keamanan penumpang, pemilik mobil wajib verifikasi wajah, KTP/SIM, foto mobil tampak depan, dan STNK. Diperiksa admin maksimal 1x24 jam.'
        : 'Untuk keamanan bersama, setiap akun wajib verifikasi wajah dan KTP/SIM sebelum numpang. Diperiksa admin maksimal 1x24 jam.';
  return (
    <div className={`kyc-notice ${compact ? 'kyc-notice-compact' : 'card'} ${pending ? 'is-pending' : ''}`}>
      <span className="kyc-notice-icon">
        <Icon name={pending ? 'clock' : 'shield'} />
      </span>
      <div className="grow">
        <b>{title}</b>
        <p className="small ink2">{body}</p>
        <Link className={`btn btn-sm ${pending ? 'btn-soft' : 'btn-primary'}`} href="/verifikasi">
          {pending ? 'Lihat status' : rejected ? 'Kirim ulang' : 'Mulai verifikasi'}
        </Link>
      </div>
    </div>
  );
}

/** Renders children only when the user has passed the needed verification. */
export default function KycGate({ need = 'identity', children }) {
  const { user } = useApp();
  const ok = need === 'vehicle' ? vehicleOK(user) : identityOK(user);
  if (ok) return children;
  return (
    <div className="page-narrow" style={{ maxWidth: 560, margin: '24px auto' }}>
      <KycNotice need={need} />
    </div>
  );
}
