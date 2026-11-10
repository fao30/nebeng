'use client';
import { useState } from 'react';
import Icon from './Icon';
import { fmtTime } from '@/lib/format';

export default function LivePanel({ sharing, onToggle, broadcast, shareToken, live, passenger }) {
  const [copied, setCopied] = useState(false);
  const link = shareToken && typeof window !== 'undefined' ? `${window.location.origin}/live/${shareToken}` : '';
  const driverPos = live.positions.find((p) => p.role === 'driver');

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Salin link ini:', link);
    }
  }

  const status = broadcast.error
    ? broadcast.error
    : sharing
      ? broadcast.last
        ? `Terkirim ${fmtTime(broadcast.last)}`
        : 'Menunggu sinyal GPS…'
      : passenger
        ? 'Bagikan lokasi supaya pemilik mobil mudah menemukan Anda.'
        : 'Penumpang bisa melihat posisi mobil Anda di peta.';

  return (
    <div className="card">
      <div className={`live ${sharing ? 'on' : ''}`}>
        <span className={`live-dot ${sharing && broadcast.sending ? 'on' : ''}`} aria-hidden />
        <div className="grow" style={{ lineHeight: 1.35 }}>
          <b>{sharing ? 'Lokasi Anda dibagikan' : 'Live location'}</b>
          <div className={`xs ${broadcast.error ? 'error' : 'muted'}`}>{status}</div>
        </div>
        <button className={`btn btn-sm ${sharing ? '' : 'btn-primary'}`} onClick={onToggle}>
          {sharing ? 'Hentikan' : 'Bagikan'}
        </button>
      </div>
      {passenger && driverPos && (
        <p className="small" style={{ marginTop: 10 }}>
          <Icon name="car" className="icon-sm" /> Posisi pemilik mobil diperbarui {fmtTime(driverPos.at)}
          {driverPos.speed ? `, ${Math.round(driverPos.speed)} km/jam` : ''}
        </p>
      )}
      {link && (
        <>
          <div className="live-link">
            <code>{link.replace(/^https?:\/\//, '')}</code>
            <button className="btn btn-sm" onClick={copy}>
              <Icon name="copy" className="icon-sm" />
              {copied ? 'Tersalin' : 'Salin'}
            </button>
          </div>
          <p className="xs muted" style={{ marginTop: 6 }}>
            Kirim link ini ke keluarga supaya mereka bisa memantau perjalanan tanpa login.
          </p>
        </>
      )}
    </div>
  );
}
