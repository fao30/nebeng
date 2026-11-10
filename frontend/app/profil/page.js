'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import RequireAuth from '@/components/RequireAuth';
import Icon from '@/components/Icon';
import { Person } from '@/components/ui';
import { Stars } from '@/components/Safety';
import { fmtDay } from '@/lib/format';
import { useApp } from '../providers';

function ProfileForm() {
  const { user, setUser, signOut, mode, setMode } = useApp();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', car_model: '', car_plate: '' });
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');
  const [ratings, setRatings] = useState(null);
  const [reports, setReports] = useState(null);

  useEffect(() => {
    api('/my/ratings').then(setRatings).catch(() => setRatings([]));
    api('/my/reports').then(setReports).catch(() => setReports([]));
  }, []);

  useEffect(() => {
    setForm({ name: user.name, phone: user.phone || '', car_model: user.car_model || '', car_plate: user.car_plate || '' });
  }, [user]);

  const set = (k) => (e) => {
    setSaved('');
    setForm({ ...form, [k]: e.target.value });
  };

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      setUser(await api('/me', { method: 'PUT', body: form }));
      setSaved('Profil tersimpan.');
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="page-narrow" style={{ maxWidth: 560 }}>
      <div className="card row-between" style={{ marginBottom: 16 }}>
        <Person user={user} sub={user.email} large />
        <div className="seg" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === 'passenger'} onClick={() => setMode('passenger')}>
            Penumpang
          </button>
          <button role="tab" aria-selected={mode === 'driver'} onClick={() => setMode('driver')}>
            Pemilik mobil
          </button>
        </div>
      </div>
      {user.is_admin && (
        <a href="/admin" className="card row-between" style={{ marginBottom: 16, color: 'inherit' }}>
          <span className="row">
            <Icon name="shield" />
            <b>Panel admin</b>
          </span>
          <Icon name="chevronRight" />
        </a>
      )}
      <form className="card stack" style={{ '--gap': '14px' }} onSubmit={submit}>
        <h3>Data diri</h3>
        <label className="field">
          <span className="field-label">Nama</span>
          <input className="input" value={form.name} onChange={set('name')} autoComplete="name" />
        </label>
        <label className="field">
          <span className="field-label">Nomor WhatsApp</span>
          <input className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="08xxxxxxxxxx" />
          <span className="help">Hanya terlihat oleh pemilik mobil atau penumpang setelah harga disepakati.</span>
        </label>
        <h3 style={{ marginTop: 6 }}>Kendaraan</h3>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Mobil</span>
            <input className="input" value={form.car_model} onChange={set('car_model')} placeholder="Toyota Avanza" />
          </label>
          <label className="field">
            <span className="field-label">Pelat nomor</span>
            <input className="input" value={form.car_plate} onChange={set('car_plate')} placeholder="B 1234 XYZ" />
          </label>
        </div>
        {err && <p className="error">{err}</p>}
        {saved && <p className="ok">{saved}</p>}
        <button className="btn btn-primary">Simpan profil</button>
      </form>
      <section className="card stack" style={{ '--gap': '12px', marginTop: 16 }}>
        <h3>Rating Anda</h3>
        <div className="grid-2">
          {[
            ['Sebagai pemilik mobil', user.driver_rating_sum, user.driver_rating_count],
            ['Sebagai penumpang', user.passenger_rating_sum, user.passenger_rating_count],
          ].map(([label, sum, n]) => (
            <div key={label} className="card-sub">
              <div className="xs muted">{label}</div>
              {n ? (
                <div className="row" style={{ '--gap': '8px' }}>
                  <b style={{ fontSize: '1.4rem' }}>{(sum / n).toFixed(1)}</b>
                  <div>
                    <Stars value={Math.round(sum / n)} size="sm" />
                    <div className="xs muted">{n} rating</div>
                  </div>
                </div>
              ) : (
                <div className="small muted">Belum ada rating</div>
              )}
            </div>
          ))}
        </div>
        {ratings?.length > 0 && (
          <div className="review-list">
            {ratings.slice(0, 10).map((r, i) => (
              <div key={i} className="review">
                <div className="row-between">
                  <Stars value={r.stars} size="sm" />
                  <span className="xs muted">
                    {r.from} · {r.to_role === 'driver' ? 'saat Anda pemilik mobil' : 'saat Anda penumpang'} · {fmtDay(r.at)}
                  </span>
                </div>
                {r.tags?.length > 0 && <div className="xs ink2">{r.tags.join(' · ')}</div>}
                {r.comment && <p className="small">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {reports?.length > 0 && (
        <section className="card stack" style={{ '--gap': '10px', marginTop: 16 }}>
          <h3>Laporan yang Anda kirim</h3>
          {reports.map((r) => (
            <div key={r.id} className="row-between small" style={{ alignItems: 'flex-start' }}>
              <div>
                <b>{r.category_label}</b> tentang {r.target_name}
                <div className="xs muted">{fmtDay(r.created_at)}</div>
                {r.admin_note && <div className="xs ink2">Admin: {r.admin_note}</div>}
              </div>
              <span className={`chip ${{ open: 'tone-red', reviewing: 'tone-amber', resolved: 'tone-mint', dismissed: 'chip-muted' }[r.status]}`}>
                {{ open: 'Terkirim', reviewing: 'Ditinjau', resolved: 'Ditindaklanjuti', dismissed: 'Ditutup' }[r.status]}
              </span>
            </div>
          ))}
        </section>
      )}

      <a href="/syarat" className="card row-between" style={{ marginTop: 16, color: 'inherit' }}>
        <span className="row">
          <Icon name="shield" />
          <b>Syarat & Ketentuan</b>
        </span>
        <Icon name="chevronRight" />
      </a>

      <button
        className="btn btn-ghost btn-danger btn-block"
        style={{ marginTop: 12 }}
        onClick={() => {
          signOut();
          router.push('/');
        }}
      >
        <Icon name="logout" />
        Keluar
      </button>
    </div>
  );
}

export default function Profil() {
  return (
    <RequireAuth>
      <ProfileForm />
    </RequireAuth>
  );
}
