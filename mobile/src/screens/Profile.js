import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { api } from '../api';
import { colors, t } from '../theme';
import { fmtDay, initials } from '../format';
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
        <View style={{ backgroundColor: colors.indigo, borderRadius: 26, padding: 20, gap: 16 }}>
          <Row gap={14}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.indigo, fontWeight: '900', fontSize: 20 }}>{initials(user.name)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 20 }} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={{ color: '#E1E3FF', fontWeight: '700', fontSize: 13 }}>{user.identity_status === 'approved' ? '✓ Terverifikasi' : user.email}</Text>
            </View>
          </Row>
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: 4 }}>
            {[
              ['passenger', 'Penumpang'],
              ['driver', 'Pemilik mobil'],
            ].map(([v, label]) => (
              <Pressable key={v} onPress={() => setMode(v)} accessibilityRole="tab" accessibilityState={{ selected: mode === v }} style={{ flex: 1, paddingVertical: 10, borderRadius: 11, backgroundColor: mode === v ? '#FFFFFF' : 'transparent', alignItems: 'center' }}>
                <Text style={{ fontWeight: '800', color: mode === v ? colors.primary : '#FFFFFF' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

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
