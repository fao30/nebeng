import React, { useCallback, useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from '../Icon';
import { api } from '../api';
import { colors, t } from '../theme';
import { fmtDate } from '../format';
import { Banner, Button, Card, Chip, ErrorText, Field, Row, Screen, Segmented } from '../ui';
import { useApp } from '../state';

const LABEL = { '': 'Belum dikirim', pending: 'Sedang ditinjau', approved: 'Terverifikasi', rejected: 'Ditolak' };
const TONE = { '': 'muted', pending: 'amber', approved: 'mint', rejected: 'red' };
const due = (iso) => new Date(new Date(iso).getTime() + 24 * 3600e3).toISOString();

/** One photo: selfies only from the live front camera; documents also from the gallery. */
function PhotoSlot({ label, hint, value, onChange, selfie }) {
  const [err, setErr] = useState('');
  const opts = { mediaType: 'photo', maxWidth: 1600, maxHeight: 1600, quality: 0.85, saveToPhotos: false, cameraType: selfie ? 'front' : 'back' };
  const handle = (r) => {
    if (r.didCancel) return;
    if (r.errorCode) return setErr(r.errorCode === 'camera_unavailable' ? 'Kamera tidak tersedia di perangkat ini.' : r.errorCode === 'permission' ? 'Izin kamera ditolak. Aktifkan di Pengaturan.' : 'Foto gagal diambil.');
    const a = r.assets?.[0];
    if (a?.uri) {
      setErr('');
      onChange({ uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || 'photo.jpg' });
    }
  };
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={[t.body, t.strong]}>{label}</Text>
          <Text style={t.xs}>{hint}</Text>
        </View>
        {value && <Icon name="check" color={colors.mint} />}
      </Row>
      {value && <Image source={{ uri: value.uri }} style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: colors.line2 }} resizeMode="contain" />}
      <Row gap={8}>
        <Button small block={false} icon="camera" title={value ? 'Ulangi' : selfie ? 'Buka kamera depan' : 'Ambil foto'} onPress={() => launchCamera(opts, handle)} />
        {!selfie && <Button small block={false} kind="outline" title="Dari galeri" onPress={() => launchImageLibrary(opts, handle)} />}
      </Row>
      <ErrorText>{err}</ErrorText>
    </View>
  );
}

function Status({ v, what }) {
  if (!v) return null;
  if (v.status === 'pending')
    return (
      <Banner tone="amber" icon="clock" title="Sedang ditinjau admin">
        {what} dikirim {fmtDate(v.submitted_at)}. Hasilnya paling lambat {fmtDate(due(v.submitted_at))} (maksimal 1x24 jam). Kami kirim notifikasi begitu selesai.
      </Banner>
    );
  if (v.status === 'approved')
    return (
      <Banner tone="mint" icon="check" title="Terverifikasi">
        {v.kind === 'vehicle' ? `${v.car_model} ${v.car_plate}` : `${v.doc_type === 'sim' ? 'SIM' : 'KTP'} dan wajah cocok`}
      </Banner>
    );
  return (
    <Banner tone="red" icon="x" title="Ditolak">
      Alasan: {v.reason}. Perbaiki fotonya lalu kirim ulang di bawah.
    </Banner>
  );
}

async function upload(kind, fields, files) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  Object.entries(files).forEach(([k, f]) => fd.append(k, { uri: f.uri, type: f.type, name: `${k}.jpg` }));
  return api(`/kyc/${kind}`, { method: 'POST', form: fd });
}

export default function Verify() {
  const { user, refreshUser } = useApp();
  const [kyc, setKyc] = useState(null);
  const [doc, setDoc] = useState('ktp');
  const [id, setId] = useState({});
  const [car, setCar] = useState({ car_model: user?.car_model || '', car_color: '', car_plate: user?.car_plate || '' });
  const [carFiles, setCarFiles] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setKyc(await api('/kyc'));
      await refreshUser();
    } catch (e) {
      setErr(e.message);
    }
  }, [refreshUser]);
  useEffect(() => {
    load();
  }, [load]);

  async function submit(kind) {
    setBusy(kind);
    setErr('');
    try {
      if (kind === 'identity') await upload('identity', { doc_type: doc }, id);
      else await upload('vehicle', car, carFiles);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  }

  const idSt = user?.identity_status || '';
  const carSt = user?.vehicle_status || '';
  const docName = doc === 'sim' ? 'SIM' : 'KTP';
  const canCar = idSt === 'approved' || idSt === 'pending';
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <View style={{ gap: 16 }}>
        <Banner tone="mint" icon="shield">
          Foto hanya dilihat tim verifikasi Nebeng, disimpan terenkripsi, dan tidak pernah ditampilkan ke pengguna lain. Pengguna lain hanya melihat tanda "Terverifikasi".
        </Banner>
        <ErrorText>{err}</ErrorText>

        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={t.h2}>Verifikasi identitas</Text>
              <Text style={t.xs}>Wajib untuk semua akun</Text>
            </View>
            <Chip tone={TONE[idSt]} label={LABEL[idSt]} />
          </Row>
          <Status v={kyc?.identity} what="Data identitas" />
          {kyc && (idSt === '' || idSt === 'rejected') && (
            <>
              <Text style={[t.small, t.strong]}>Dokumen yang dipakai</Text>
              <Segmented
                value={doc}
                onChange={setDoc}
                options={[
                  { value: 'ktp', label: 'KTP' },
                  { value: 'sim', label: 'SIM' },
                ]}
              />
              <PhotoSlot label={`1. Foto ${docName}`} hint={`Seluruh kartu masuk, tulisan terbaca, tidak silau. Nama di ${docName} harus sama dengan nama akun.`} value={id.id_photo} onChange={(f) => setId({ ...id, id_photo: f })} />
              <PhotoSlot label="2. Verifikasi wajah" hint="Wajah menghadap kamera, tanpa masker, kacamata hitam, atau topi. Pencahayaan cukup." value={id.selfie} onChange={(f) => setId({ ...id, selfie: f })} selfie />
              <PhotoSlot label={`3. Selfie sambil memegang ${docName}`} hint={`Pegang ${docName} di bawah dagu. Wajah dan kartu harus sama-sama jelas.`} value={id.id_selfie} onChange={(f) => setId({ ...id, id_selfie: f })} selfie />
              <Button title="Kirim untuk diverifikasi" disabled={!id.id_photo || !id.selfie || !id.id_selfie} busy={busy === 'identity'} onPress={() => submit('identity')} />
            </>
          )}
        </Card>

        <Card style={!canCar ? { opacity: 0.6 } : null}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={t.h2}>Aktifkan fitur pemilik mobil</Text>
              <Text style={t.xs}>Untuk membuat trip dan memberi tumpangan</Text>
            </View>
            <Chip tone={TONE[carSt]} label={LABEL[carSt]} />
          </Row>
          {!canCar ? (
            <Text style={t.small}>Kirim verifikasi identitas dulu, lalu lengkapi data mobil di sini.</Text>
          ) : (
            <>
              <Status v={kyc?.vehicle} what="Data mobil" />
              {kyc && (carSt === '' || carSt === 'rejected') && (
                <>
                  <Field label="Merek dan model" value={car.car_model} onChangeText={(v) => setCar({ ...car, car_model: v })} placeholder="Toyota Avanza" />
                  <Field label="Warna" value={car.car_color} onChangeText={(v) => setCar({ ...car, car_color: v })} placeholder="Hitam" />
                  <Field label="Pelat nomor (sesuai STNK)" value={car.car_plate} onChangeText={(v) => setCar({ ...car, car_plate: v.toUpperCase() })} placeholder="B 1234 XYZ" autoCapitalize="characters" />
                  <PhotoSlot label="1. Foto mobil tampak depan" hint="Seluruh bagian depan mobil masuk, pelat nomor terbaca jelas." value={carFiles.car_front} onChange={(f) => setCarFiles({ ...carFiles, car_front: f })} />
                  <PhotoSlot label="2. Foto STNK" hint="STNK masih berlaku. Nomor polisi, merek, dan masa berlaku terbaca." value={carFiles.stnk} onChange={(f) => setCarFiles({ ...carFiles, stnk: f })} />
                  <Button title="Kirim data mobil" disabled={!carFiles.car_front || !carFiles.stnk || !car.car_model.trim() || !car.car_plate.trim()} busy={busy === 'vehicle'} onPress={() => submit('vehicle')} />
                </>
              )}
            </>
          )}
        </Card>
        <Text style={[t.xs, { textAlign: 'center' }]}>Semua verifikasi diperiksa manual oleh admin Nebeng, maksimal 1x24 jam.</Text>
      </View>
    </Screen>
  );
}
