'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import RequireAuth from '@/components/RequireAuth';
import Icon from '@/components/Icon';
import { Person } from '@/components/ui';
import { useApp } from '../providers';

function ProfileForm() {
  const { user, setUser, signOut, mode, setMode } = useApp();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', car_model: '', car_plate: '' });
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');

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
            Driver
          </button>
        </div>
      </div>
      <form className="card stack" style={{ '--gap': '14px' }} onSubmit={submit}>
        <h3>Data diri</h3>
        <label className="field">
          <span className="field-label">Nama</span>
          <input className="input" value={form.name} onChange={set('name')} autoComplete="name" />
        </label>
        <label className="field">
          <span className="field-label">Nomor WhatsApp</span>
          <input className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="08xxxxxxxxxx" />
          <span className="help">Hanya terlihat oleh driver atau penumpang setelah harga disepakati.</span>
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
