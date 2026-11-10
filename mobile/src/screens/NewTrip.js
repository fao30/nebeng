import React, { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { colors, t } from '../theme';
import { fmtRp, haversine, suggestPrice } from '../format';
import { Banner, Button, Card, ErrorText, Field, Row, Screen, s } from '../ui';
import PlaceField from '../components/PlaceField';
import DateTimeField from '../components/DateTimeField';
import RouteLegs from '../components/RouteLegs';
import { autoKind, encodePath, thinPath, useRoute } from '../routing';

function Toggle({ label, sub, value, onChange }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <Text style={t.body}>{label}</Text>
        {sub ? <Text style={t.xs}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </Row>
  );
}

/** Buat trip: route with optional stops, time, seats, price and rules. */
export default function NewTrip({ navigation }) {
  const [origin, setOrigin] = useState(null);
  const [stops, setStops] = useState([]);
  const [dest, setDest] = useState(null);
  const [depart, setDepart] = useState(() => {
    const d = new Date(Date.now() + 2 * 3600e3);
    d.setMinutes(0, 0, 0);
    return d;
  });
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState('');
  const [touched, setTouched] = useState(false);
  const [luggage, setLuggage] = useState(true);
  const [maxLuggage, setMaxLuggage] = useState(2);
  const [negotiable, setNegotiable] = useState(true);
  const [instant, setInstant] = useState(false);
  const [notes, setNotes] = useState('');
  const [cfg, setCfg] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/settings').then(setCfg).catch(() => {});
  }, []);
  const pts = [origin, ...stops, dest].filter(Boolean);
  const suggestion = origin && dest ? suggestPrice(pts, cfg) : 0;
  const kind = autoKind(origin, dest);
  const road = useRoute(origin && dest ? pts : [], kind);
  const roadOK = road && road.legs.length === pts.length - 1;
  useEffect(() => {
    if (!touched && suggestion) setPrice(String(suggestion));
  }, [suggestion, touched]);

  async function submit() {
    setBusy(true);
    setErr('');
    try {
      const trip = await api('/trips', {
        method: 'POST',
        body: {
          origin,
          stops: stops.filter(Boolean),
          destination: dest,
          depart_at: depart.toISOString(),
          seats,
          luggage,
          max_luggage: luggage ? maxLuggage : 0,
          price_per_seat: Number(price) || 0,
          negotiable,
          instant_booking: instant,
          notes,
          ...(roadOK
            ? {
                leg_km: road.legs.map((l) => Math.round(l.km * 10) / 10),
                leg_minutes: road.legs.map((l) => Math.round(l.min * 10) / 10),
                route_source: road.source,
                path: encodePath(thinPath(road.path)),
              }
            : {}),
        },
      });
      setOrigin(null);
      setStops([]);
      setDest(null);
      setTouched(false);
      navigation.navigate('Trip', { id: trip.id });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const km = origin && dest ? pts.slice(1).reduce((a, p, i) => a + haversine(pts[i], p), 0) * 1.3 : 0;
  return (
    <Screen>
      <View style={{ gap: 14 }}>
        <Card>
          <Text style={t.h3}>Rute</Text>
          <Text style={t.xs}>Penumpang hanya bisa naik dan turun di titik-titik ini. Tambahkan patokan supaya mudah ditemukan.</Text>
          <PlaceField label="Berangkat dari" value={origin} onChange={setOrigin} withNote />
          {stops.map((st, i) => (
            <View key={i} style={{ gap: 6 }}>
              <PlaceField label={`Titik stop ${i + 1}`} value={st} kind="stop" near={origin} withNote onChange={(v) => setStops(v ? stops.map((x, j) => (j === i ? v : x)) : stops.filter((_, j) => j !== i))} />
            </View>
          ))}
          {stops.length < 5 && <Button small kind="soft" icon="plus" title="Tambah titik stop" onPress={() => setStops([...stops, null])} />}
          <PlaceField label="Tujuan akhir" value={dest} onChange={setDest} kind="dest" near={origin} withNote />
          {km > 0 && !roadOK && <Text style={t.xs}>Perkiraan jarak jalan {Math.round(km)} km</Text>}
        </Card>
        {roadOK && <RouteLegs points={pts} road={road} title="Rute lewat jalan" />}

        <Card>
          <DateTimeField label="Waktu berangkat" value={depart} onChange={(d) => d && setDepart(d)} mode="datetime" />
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={t.body}>Kursi untuk penumpang</Text>
            <Row>
              <Button small block={false} kind="outline" title="−" onPress={() => setSeats(Math.max(1, seats - 1))} />
              <Text style={[t.h3, { minWidth: 24, textAlign: 'center' }]}>{seats}</Text>
              <Button small block={false} kind="outline" title="+" onPress={() => setSeats(Math.min(8, seats + 1))} />
            </Row>
          </Row>
          <Toggle label="Boleh bawa koper" value={luggage} onChange={setLuggage} />
          {luggage && (
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={t.small}>Maksimal koper</Text>
              <Row>
                <Button small block={false} kind="outline" title="−" onPress={() => setMaxLuggage(Math.max(1, maxLuggage - 1))} />
                <Text style={[t.h3, { minWidth: 24, textAlign: 'center' }]}>{maxLuggage}</Text>
                <Button small block={false} kind="outline" title="+" onPress={() => setMaxLuggage(Math.min(20, maxLuggage + 1))} />
              </Row>
            </Row>
          )}
        </Card>

        <Card>
          <Text style={t.h3}>Harga per kursi (rute penuh)</Text>
          <TextInput
            value={price}
            onChangeText={(v) => {
              setTouched(true);
              setPrice(v.replace(/\D/g, ''));
            }}
            keyboardType="number-pad"
            style={[s.input, { fontSize: 20, fontWeight: '800' }]}
            accessibilityLabel="Harga per kursi"
          />
          {suggestion > 0 && <Text style={t.xs}>Saran Numpang: {fmtRp(suggestion)}. Harga untuk sebagian rute dihitung otomatis per ruas.</Text>}
          <Toggle label="Boleh ditawar" value={negotiable} onChange={setNegotiable} />
          <Toggle label="Pesan instan" sub="Penumpang yang membayar harga Anda langsung terkonfirmasi" value={instant} onChange={setInstant} />
        </Card>

        <Field label="Catatan untuk penumpang (opsional)" value={notes} onChangeText={setNotes} multiline maxLength={300} placeholder="Misal: tidak merokok, AC dingin" />
        <Banner icon="shield">Trip memakai mobil yang sudah diverifikasi. Jangan mengambil penumpang di luar aplikasi.</Banner>
        <ErrorText>{err}</ErrorText>
        <Button title="Terbitkan trip" busy={busy} disabled={!origin || !dest || stops.some((x) => !x) || !Number(price)} onPress={submit} />
      </View>
    </Screen>
  );
}
