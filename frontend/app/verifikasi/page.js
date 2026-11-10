'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { KYC_LABEL, KYC_TONE, submitKyc } from '@/lib/kyc';
import { useApp } from '../providers';
import RequireAuth from '@/components/RequireAuth';
import PhotoInput from '@/components/PhotoInput';
import Icon from '@/components/Icon';
import { Segmented } from '@/components/ui';

const due = (iso) => new Date(new Date(iso).getTime() + 24 * 3600e3).toISOString();

function Status({ v, what }) {
  if (!v) return null;
  if (v.status === 'pending')
    return (
      <div className="kyc-state is-pending">
        <Icon name="clock" />
        <div>
          <b>Sedang ditinjau admin</b>
          <div className="small ink2">
            {what} dikirim {fmtDate(v.submitted_at)}. Hasilnya paling lambat <b>{fmtDate(due(v.submitted_at))}</b> (maksimal 1x24 jam). Kami kirim notifikasi
            begitu selesai.
          </div>
        </div>
      </div>
    );
  if (v.status === 'approved')
    return (
      <div className="kyc-state is-ok">
        <Icon name="check" />
        <div>
          <b>Terverifikasi</b>
          <div className="small ink2">
            {v.kind === 'vehicle' ? `${v.car_model} ${v.car_color ? `(${v.car_color}) ` : ''}${v.car_plate}` : `${v.doc_type === 'sim' ? 'SIM' : 'KTP'} dan wajah cocok`} · disetujui{' '}
            {v.reviewed_at ? fmtDate(v.reviewed_at) : ''}
          </div>
        </div>
      </div>
    );
  return (
    <div className="kyc-state is-bad">
      <Icon name="x" />
      <div>
        <b>Ditolak</b>
        <div className="small ink2">
          Alasan: <b>{v.reason}</b>. Perbaiki fotonya lalu kirim ulang di bawah.
        </div>
      </div>
    </div>
  );
}

function IdentityForm({ onDone }) {
  const [doc, setDoc] = useState('ktp');
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (b) => setFiles((f) => ({ ...f, [k]: b }));
  const docName = doc === 'sim' ? 'SIM' : 'KTP';
  const ready = files.id_photo && files.selfie && files.id_selfie;

  async function submit() {
    setBusy(true);
    setErr('');
    try {
      await submitKyc('identity', { doc_type: doc }, files);
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ '--gap': '14px' }}>
      <div>
        <div className="field-label" style={{ marginBottom: 6 }}>
          Dokumen yang dipakai
        </div>
        <Segmented
          label="Jenis dokumen"
          value={doc}
          onChange={setDoc}
          options={[
            { value: 'ktp', label: 'KTP' },
            { value: 'sim', label: 'SIM' },
          ]}
        />
      </div>
      <ol className="kyc-steps">
        <li>
          <PhotoInput
            label={`1. Foto ${docName}`}
            hint={`Seluruh kartu masuk bingkai, tulisan terbaca jelas, tidak silau. Nama di ${docName} harus sama dengan nama akun.`}
            value={files.id_photo}
            onChange={set('id_photo')}
            camera="environment"
            guide="doc"
          />
        </li>
        <li>
          <PhotoInput
            label="2. Verifikasi wajah"
            hint="Wajah menghadap kamera di dalam oval, tanpa masker, kacamata hitam, atau topi. Pencahayaan cukup."
            value={files.selfie}
            onChange={set('selfie')}
            camera="user"
            guide="face"
          />
        </li>
        <li>
          <PhotoInput
            label={`3. Selfie sambil memegang ${docName}`}
            hint={`Pegang ${docName} di bawah dagu. Wajah dan kartu harus sama-sama terlihat jelas.`}
            value={files.id_selfie}
            onChange={set('id_selfie')}
            camera="user"
            guide="face-doc"
          />
        </li>
      </ol>
      {err && <p className="error">{err}</p>}
      <button className="btn btn-primary btn-lg" disabled={!ready || busy} onClick={submit}>
        {busy ? 'Mengirim…' : 'Kirim untuk diverifikasi'}
      </button>
    </div>
  );
}

function VehicleForm({ user, onDone }) {
  const [form, setForm] = useState({ car_model: user.car_model || '', car_color: '', car_plate: user.car_plate || '' });
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const ready = files.car_front && files.stnk && form.car_model.trim() && form.car_plate.trim();

  async function submit() {
    setBusy(true);
    setErr('');
    try {
      await submitKyc('vehicle', form, files);
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ '--gap': '14px' }}>
      <div className="grid-2">
        <label className="field">
          <span className="field-label">Merek dan model</span>
          <input className="input" value={form.car_model} onChange={set('car_model')} placeholder="Toyota Avanza" />
        </label>
        <label className="field">
          <span className="field-label">Warna</span>
          <input className="input" value={form.car_color} onChange={set('car_color')} placeholder="Hitam" />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Pelat nomor (sesuai STNK)</span>
        <input className="input" value={form.car_plate} onChange={set('car_plate')} placeholder="B 1234 XYZ" style={{ textTransform: 'uppercase' }} />
      </label>
      <ol className="kyc-steps">
        <li>
          <PhotoInput
            label="1. Foto mobil tampak depan"
            hint="Seluruh bagian depan mobil masuk, pelat nomor terbaca jelas."
            value={files.car_front}
            onChange={(b) => setFiles((f) => ({ ...f, car_front: b }))}
            camera="environment"
            guide="car"
          />
        </li>
        <li>
          <PhotoInput
            label="2. Foto STNK"
            hint="STNK masih berlaku. Nomor polisi, merek, dan masa berlaku terbaca jelas."
            value={files.stnk}
            onChange={(b) => setFiles((f) => ({ ...f, stnk: b }))}
            camera="environment"
            guide="doc"
          />
        </li>
      </ol>
      {err && <p className="error">{err}</p>}
      <button className="btn btn-primary btn-lg" disabled={!ready || busy} onClick={submit}>
        {busy ? 'Mengirim…' : 'Kirim data mobil'}
      </button>
    </div>
  );
}

function Verify() {
  const { user, setUser } = useApp();
  const [kyc, setKyc] = useState(null);
  const [welcome, setWelcome] = useState(false);

  const load = useCallback(() => {
    api('/kyc').then(setKyc).catch(() => {});
    api('/me').then(setUser).catch(() => {});
  }, [setUser]);
  useEffect(() => {
    load();
    setWelcome(new URLSearchParams(window.location.search).has('welcome'));
  }, [load]);

  const id = kyc?.identity;
  const car = kyc?.vehicle;
  const idSt = user.identity_status || '';
  const carSt = user.vehicle_status || '';
  const canCar = idSt === 'approved' || idSt === 'pending';

  return (
    <div className="narrow">
      <div className="page-head">
        <div>
          <h1>Verifikasi akun</h1>
          <p>Untuk keamanan bersama, semua yang nebeng dan pemilik mobil dikenal identitasnya.</p>
        </div>
      </div>

      {welcome && idSt === '' && (
        <div className="banner" style={{ marginBottom: 16 }}>
          <b>Akun Anda sudah dibuat 🎉</b>
          <span className="small">Satu langkah lagi: verifikasi wajah dan KTP/SIM supaya bisa mulai nebeng.</span>
        </div>
      )}

      <div className="kyc-privacy small">
        <Icon name="shield" />
        <span>
          Foto hanya dilihat tim verifikasi Nebeng, disimpan terenkripsi, dan <b>tidak pernah ditampilkan ke pengguna lain</b>. Pengguna lain hanya melihat
          tanda &ldquo;Terverifikasi&rdquo;. <Link href="/syarat">Baca S&K bagian verifikasi</Link>.
        </span>
      </div>

      <section className="card kyc-card">
        <div className="row-between">
          <div>
            <h2>Verifikasi identitas</h2>
            <p className="small muted">Wajib untuk semua akun · wajah, KTP atau SIM, dan selfie dengan kartu</p>
          </div>
          <span className={`chip ${KYC_TONE[idSt]}`}>{KYC_LABEL[idSt]}</span>
        </div>
        <Status v={id} what="Data identitas" />
        {(idSt === '' || idSt === 'rejected') && kyc && <IdentityForm onDone={load} />}
      </section>

      <section className={`card kyc-card ${canCar ? '' : 'is-locked'}`}>
        <div className="row-between">
          <div>
            <h2>Aktifkan fitur pemilik mobil</h2>
            <p className="small muted">Untuk membuat trip dan memberi tumpangan · foto mobil tampak depan dan STNK</p>
          </div>
          <span className={`chip ${KYC_TONE[carSt]}`}>{KYC_LABEL[carSt]}</span>
        </div>
        {!canCar ? (
          <p className="small ink2">Kirim verifikasi identitas dulu, lalu lengkapi data mobil di sini.</p>
        ) : (
          <>
            <Status v={car} what="Data mobil" />
            {(carSt === '' || carSt === 'rejected') && kyc && <VehicleForm user={user} onDone={load} />}
          </>
        )}
      </section>
      <p className="xs muted" style={{ textAlign: 'center', margin: '8px 0 24px' }}>
        Semua verifikasi diperiksa manual oleh admin Nebeng, maksimal 1x24 jam.
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <Verify />
    </RequireAuth>
  );
}
