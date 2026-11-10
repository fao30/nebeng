import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { TERMS_VERSION } from '../config';
import { colors, t } from '../theme';
import { Banner, Button, Card, ErrorText, Field, Screen, Segmented } from '../ui';
import { TermsModal } from '../components/Terms';
import { useApp } from '../state';
import Logo from '../components/Logo';

export default function Auth() {
  const { signIn, blocked } = useApp();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const set = (k) => (v) => setForm({ ...form, [k]: v });

  async function send() {
    setBusy(true);
    setErr('');
    try {
      const body = tab === 'register' ? { ...form, email: form.email.trim(), accept_terms: TERMS_VERSION } : { email: form.email.trim(), password: form.password };
      const session = await api(tab === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body });
      setTerms(false);
      await signIn(session);
    } catch (e) {
      setErr(e.message);
      setTerms(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 20 }}>
        <Logo size={56} />
        <Text style={t.h1}>{tab === 'login' ? 'Selamat datang' : 'Buat akun Numpang'}</Text>
        <Text style={[t.small, { textAlign: 'center' }]}>Satu akun untuk numpang dan memberi tumpangan.</Text>
      </View>
      {blocked ? (
        <View style={{ marginBottom: 14 }}>
          <Banner tone="red" icon="shield" title="Akun diblokir">
            {blocked}
          </Banner>
        </View>
      ) : null}
      <Card style={{ gap: 14 }}>
        <Segmented
          value={tab}
          onChange={(v) => {
            setTab(v);
            setErr('');
          }}
          options={[
            { value: 'login', label: 'Masuk' },
            { value: 'register', label: 'Daftar' },
          ]}
        />
        {tab === 'register' && (
          <>
            <Field label="Nama lengkap (sesuai KTP/SIM)" value={form.name} onChangeText={set('name')} autoComplete="name" textContentType="name" />
            <Field label="Nomor WhatsApp" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="08xxxxxxxxxx" textContentType="telephoneNumber" />
          </>
        )}
        <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry autoCapitalize="none" textContentType={tab === 'login' ? 'password' : 'newPassword'} />
        <ErrorText>{err}</ErrorText>
        <Button
          title={tab === 'login' ? 'Masuk' : 'Lanjut'}
          busy={busy && !terms}
          disabled={!form.email || form.password.length < 6 || (tab === 'register' && !form.name.trim())}
          onPress={() => (tab === 'register' ? setTerms(true) : send())}
        />
        {tab === 'register' && <Text style={[t.xs, { textAlign: 'center' }]}>Sebelum akun dibuat, Anda akan diminta menyetujui Syarat & Ketentuan.</Text>}
      </Card>
      <Text style={[t.xs, { textAlign: 'center', marginTop: 16, color: colors.ink2 }]}>Akun demo: budi@demo.id (pemilik mobil) atau andi@demo.id (penumpang), password demo123</Text>
      <TermsModal open={terms} busy={busy} onClose={() => setTerms(false)} onAccept={send} acceptLabel="Setuju dan buat akun" />
    </Screen>
  );
}
