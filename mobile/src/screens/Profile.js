import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { api } from '../api';
import { colors, t } from '../theme';
import { fmtDay } from '../format';
import { Button, Card, Chip, ErrorText, Field, Person, Row, Screen, Segmented, Stars } from '../ui';
import { ListItem } from '../components/TripBits';
import { useApp } from '../state';

const KYC = { '': ['Belum dikirim', 'muted'], pending: ['Sedang ditinjau', 'amber'], approved: ['Terverifikasi', 'mint'], rejected: ['Ditolak', 'red'] };

export default function Profile({ navigation }) {
  const { user, setUser, signOut, mode, setMode } = useApp();
  const [phone, setPhone] = useState(user.phone || '');
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');
  const [ratings, setRatings] = useState([]);
  useEffect(() => {
    api('/my/ratings').then(setRatings).catch(() => {});
  }, []);

  async function save() {
    setErr('');
    setSaved('');
    try {
      setUser(await api('/me', { method: 'PUT', body: { phone } }));
      setSaved('Tersimpan.');
    } catch (e) {
      setErr(e.message);
    }
  }
  const [idLabel, idTone] = KYC[user.identity_status || ''];
  const [carLabel, carTone] = KYC[user.vehicle_status || ''];
  const avg = (sum, n) => (n ? (sum / n).toFixed(1) : '–');

  return (
    <Screen>
      <View style={{ gap: 14 }}>
        <Card>
          <Person user={user} sub={user.email} size={52} />
          <Text style={t.small}>Mode aplikasi</Text>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'passenger', label: 'Penumpang' },
              { value: 'driver', label: 'Pemilik mobil' },
            ]}
          />
        </Card>

        <Card>
          <ListItem icon="shield" title="Verifikasi akun" onPress={() => navigation.navigate('Verifikasi')} right={<Chip tone={idTone} label={idLabel} />} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={t.small}>Fitur pemilik mobil</Text>
            <Chip tone={carTone} label={carLabel} />
          </Row>
          {user.car_model ? (
            <Text style={t.small}>
              {user.car_model} · <Text style={t.strong}>{user.car_plate}</Text>
            </Text>
          ) : null}
        </Card>

        <Card>
          <Text style={t.h3}>Rating Anda</Text>
          <Row>
            <View style={{ flex: 1, backgroundColor: colors.line2, borderRadius: 12, padding: 12 }}>
              <Text style={t.xs}>Sebagai pemilik mobil</Text>
              <Text style={t.h2}>★ {avg(user.driver_rating_sum, user.driver_rating_count)}</Text>
              <Text style={t.xs}>{user.driver_rating_count || 0} rating</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.line2, borderRadius: 12, padding: 12 }}>
              <Text style={t.xs}>Sebagai penumpang</Text>
              <Text style={t.h2}>★ {avg(user.passenger_rating_sum, user.passenger_rating_count)}</Text>
              <Text style={t.xs}>{user.passenger_rating_count || 0} rating</Text>
            </View>
          </Row>
          {ratings.slice(0, 5).map((r, i) => (
            <View key={i} style={{ borderTopWidth: 1, borderTopColor: colors.line2, paddingTop: 8, gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Stars value={r.stars} size={15} />
                <Text style={t.xs}>
                  {r.from} · {fmtDay(r.at)}
                </Text>
              </Row>
              {r.tags?.length ? <Text style={t.xs}>{r.tags.join(' · ')}</Text> : null}
              {r.comment ? <Text style={t.small}>{r.comment}</Text> : null}
            </View>
          ))}
        </Card>

        <Card>
          <Text style={t.h3}>Data diri</Text>
          <Field label="Nama (sesuai KTP/SIM)" value={user.name} editable={false} help="Nama terkunci setelah verifikasi. Hubungi admin untuk mengubah." />
          <Field label="Nomor WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" help="Hanya terlihat oleh pemilik mobil atau penumpang setelah pesanan disetujui." />
          <ErrorText>{err}</ErrorText>
          {saved ? <Text style={{ color: colors.mint, fontWeight: '700' }}>{saved}</Text> : null}
          <Button kind="soft" title="Simpan" onPress={save} />
        </Card>

        <Card>
          <ListItem icon="shield" title="Syarat & Ketentuan" onPress={() => navigation.navigate('Syarat')} />
        </Card>
        <Button
          kind="dangerGhost"
          icon="logout"
          title="Keluar"
          onPress={() => Alert.alert('Keluar dari akun?', '', [{ text: 'Batal' }, { text: 'Keluar', style: 'destructive', onPress: signOut }])}
        />
      </View>
    </Screen>
  );
}
