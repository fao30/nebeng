'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Sheet } from './ui';

const REASONS = ['Mengambil atau mengajak transaksi di luar aplikasi', 'Perilaku kasar atau pelecehan', 'Penipuan / akun palsu', 'No-show atau batal mendadak berulang', 'Mengemudi berbahaya'];

/** Block or unblock a user (admin). `user` is an AdminUser row. */
export default function BlockSheet({ user, onClose, onDone, presetReason = '' }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    setReason(presetReason);
    setErr('');
  }, [user, presetReason]);
  if (!user) return null;
  const blocking = !user.blocked;

  async function submit() {
    setBusy(true);
    setErr('');
    try {
      const updated = await api(`/admin/users/${user.id}/block`, { method: 'POST', body: { blocked: blocking, reason } });
      onDone?.(updated);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={blocking ? `Blokir ${user.name}` : `Buka blokir ${user.name}`}
      footer={
        <button className={`btn btn-block ${blocking ? 'btn-danger-solid' : 'btn-primary'}`} disabled={busy || (blocking && !reason.trim())} onClick={submit}>
          {blocking ? 'Blokir akun' : 'Buka blokir'}
        </button>
      }
    >
      {blocking ? (
        <div className="stack" style={{ '--gap': '14px' }}>
          <div className="banner banner-danger small">
            Akun ini langsung keluar dan tidak bisa masuk lagi. Trip terjadwal miliknya dibatalkan, pesanan aktifnya dibatalkan, dan pihak yang terdampak
            mendapat notifikasi.
          </div>
          <div className="small ink2">
            {user.email} · {user.reports_against || 0} laporan · rating pemilik mobil {user.driver_ratings ? `★ ${user.driver_rating}` : '-'}, penumpang{' '}
            {user.passenger_ratings ? `★ ${user.passenger_rating}` : '-'}
          </div>
          <div className="tag-pick" style={{ justifyContent: 'flex-start' }}>
            {REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">Alasan (ditampilkan ke pengguna saat mencoba masuk)</span>
            <textarea className="input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {err && <p className="error">{err}</p>}
        </div>
      ) : (
        <div className="stack" style={{ '--gap': '10px' }}>
          <p className="small">
            Diblokir karena: <b>{user.blocked_reason}</b>
          </p>
          <p className="small muted">Setelah dibuka, pengguna bisa masuk lagi. Trip dan pesanan yang sudah dibatalkan tidak dipulihkan.</p>
          {err && <p className="error">{err}</p>}
        </div>
      )}
    </Sheet>
  );
}
