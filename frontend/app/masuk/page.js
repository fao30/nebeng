'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApp } from '../providers';
import { Segmented } from '@/components/ui';
import { BrandGlyph } from '@/components/Nav';
import { TERMS_VERSION, TermsLink, TermsModal } from '@/components/Terms';

export default function Masuk() {
  const { signIn, mode } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [blocked, setBlocked] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    try {
      const m = sessionStorage.getItem('nebeng_blocked');
      if (m) {
        setBlocked(m);
        sessionStorage.removeItem('nebeng_blocked');
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  function submit(e) {
    e.preventDefault();
    setErr('');
    // Sign-up goes through the Terms & Conditions popup first.
    if (tab === 'register') setTerms(true);
    else send();
  }

  async function send() {
    setBusy(true);
    setErr('');
    try {
      const body = tab === 'register' ? { ...form, accept_terms: TERMS_VERSION } : form;
      const session = await api(tab === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body });
      setTerms(false);
      signIn(session);
      const next = new URLSearchParams(window.location.search).get('next');
      if (tab === 'register') router.push('/verifikasi?welcome=1');
      else router.push(next && next.startsWith('/') ? next : mode === 'driver' ? '/driver' : '/cari');
    } catch (e) {
      setErr(e.message);
      setTerms(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="stack" style={{ '--gap': '6px', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
        <BrandGlyph />
        <h1>{tab === 'login' ? 'Selamat datang kembali' : 'Buat akun Numpang'}</h1>
        <p className="muted">Satu akun untuk numpang dan memberi tumpangan.</p>
      </div>
      {blocked && (
        <div className="banner banner-danger" role="alert" style={{ marginBottom: 14 }}>
          <b>Akun diblokir</b>
          <span className="small">{blocked}</span>
        </div>
      )}
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
          {tab === 'login' ? 'Masuk' : 'Lanjut'}
        </button>
        {tab === 'register' && (
          <p className="xs muted" style={{ textAlign: 'center' }}>
            Sebelum akun dibuat, Anda akan diminta menyetujui <TermsLink />.
          </p>
        )}
      </form>
      <TermsModal open={terms} busy={busy} onClose={() => setTerms(false)} onAccept={send} acceptLabel="Setuju dan buat akun" />
      <p className="small muted" style={{ textAlign: 'center', marginTop: 14 }}>
        Akun demo: <b>budi@demo.id</b> (pemilik mobil) atau <b>andi@demo.id</b> (penumpang), password <b>demo123</b>
      </p>
    </div>
  );
}
