'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApp } from '../providers';
import { Segmented } from '@/components/ui';
import { BrandGlyph } from '@/components/Nav';

export default function Masuk() {
  const { signIn, mode } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const session = await api(tab === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: form });
      signIn(session);
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/') ? next : mode === 'driver' ? '/driver' : '/cari');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="stack" style={{ '--gap': '6px', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
        <BrandGlyph />
        <h1>{tab === 'login' ? 'Selamat datang kembali' : 'Buat akun Nebeng'}</h1>
        <p className="muted">Satu akun untuk nebeng dan memberi tumpangan.</p>
      </div>
      <form onSubmit={submit} className="card stack" style={{ '--gap': '14px' }}>
        <Segmented
          label="Masuk atau daftar"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'login', label: 'Masuk' },
            { value: 'register', label: 'Daftar' },
          ]}
        />
        {tab === 'register' && (
          <>
            <label className="field">
              <span className="field-label">Nama lengkap</span>
              <input className="input" required value={form.name} onChange={set('name')} autoComplete="name" />
            </label>
            <label className="field">
              <span className="field-label">Nomor WhatsApp</span>
              <input className="input" value={form.phone} onChange={set('phone')} placeholder="08xxxxxxxxxx" autoComplete="tel" />
            </label>
          </>
        )}
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" required type="email" value={form.email} onChange={set('email')} autoComplete="email" />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            required
            type="password"
            minLength={6}
            value={form.password}
            onChange={set('password')}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {tab === 'login' ? 'Masuk' : 'Buat akun'}
        </button>
      </form>
      <p className="small muted" style={{ textAlign: 'center', marginTop: 14 }}>
        Akun demo: <b>budi@demo.id</b> (driver), <b>andi@demo.id</b> (penumpang), <b>admin@demo.id</b> (admin). Password <b>demo123</b>
      </p>
    </div>
  );
}
