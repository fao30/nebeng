import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Switch, Text, TextInput, View } from 'react-native';
import EventSource from 'react-native-sse';
import Icon from '../Icon';
import { api, qs } from '../api';
import { API_URL, WEB_URL } from '../config';
import { colors, t } from '../theme';
import { fmtDate, fmtRp, fmtTime, haversine, km, routeOf, shortPlace, tripStatusLabel } from '../format';
import { Banner, Button, Card, Chip, ErrorText, Loading, Person, Row, Screen, s } from '../ui';
import { RouteTimeline, SectionTitle } from '../components/TripBits';
import BookingCard from '../components/BookingCard';
import TripMap from '../components/TripMap';
import KycNotice from '../components/KycNotice';
import { watchPosition } from '../geo';
import { identityOK, useApp, useLiveRefresh } from '../state';

const wa = (phone) => `https://wa.me/${phone.replace(/^0/, '62').replace(/\D/g, '')}`;

/** Live positions on a trip (Server-Sent Events), shared by driver and confirmed passengers. */
function useLive(shareToken) {
  const [positions, setPositions] = useState({});
  useEffect(() => {
    if (!shareToken) return;
    const es = new EventSource(`${API_URL}/api/live/${shareToken}/stream`, { pollingInterval: 4000 });
    es.addEventListener('message', (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === 'snapshot') setPositions(Object.fromEntries((m.positions || []).map((p) => [p.user_id, p])));
        if (m.type === 'position') setPositions((cur) => ({ ...cur, [m.position.user_id]: m.position }));
      } catch {
        /* ignore */
      }
    });
    return () => {
      es.removeAllEventListeners();
      es.close();
    };
  }, [shareToken]);
  return Object.values(positions);
}

/** Send this phone's GPS to the trip while `on`. */
function useBroadcast(tripId, on) {
  const [state, setState] = useState({ last: null, error: '' });
  useEffect(() => {
    if (!on || !tripId) return;
    let lastSent = 0;
    const stop = watchPosition(
      async (p) => {
        if (Date.now() - lastSent < 4000) return;
        lastSent = Date.now();
        try {
          await api(`/trips/${tripId}/location`, { method: 'POST', body: p });
          setState({ last: new Date(), error: '' });
        } catch (e) {
          setState((x) => ({ ...x, error: e.message }));
        }
      },
      (e) => setState((x) => ({ ...x, error: e.message })),
    );
    return stop;
  }, [tripId, on]);
  return state;
}

function LivePanel({ trip, live, passenger }) {
  const [on, setOn] = useState(false);
  const b = useBroadcast(trip.id, on);
  const driver = live.find((p) => p.role === 'driver');
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={[t.body, t.strong]}>Bagikan lokasi live</Text>
          <Text style={t.xs}>{passenger ? 'Supaya pemilik mobil mudah menemukan Anda.' : 'Penumpang bisa melihat posisi mobil Anda.'}</Text>
        </View>
        <Switch value={on} onValueChange={setOn} trackColor={{ true: colors.primary }} />
      </Row>
      {on && <Text style={t.xs}>{b.error ? b.error : b.last ? `Terkirim ${fmtTime(b.last)}` : 'Mencari GPS…'}</Text>}
      {passenger && driver && (
        <Row gap={6}>
          <Icon name="car" size={15} color={colors.mint} />
          <Text style={t.small}>Posisi pemilik mobil diperbarui {fmtTime(driver.at)}</Text>
        </Row>
      )}
      {trip.share_token && (
        <Button
          small
          kind="outline"
          icon="copy"
          title="Kirim link pantau ke keluarga"
          onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`Pantau perjalanan Numpang saya: ${WEB_URL}/live/${trip.share_token}`)}`)}
        />
      )}
    </Card>
  );
}

function Participants({ list, meId }) {
  if (!list?.length) return null;
  return (
    <Card>
      <Text style={t.h3}>Peserta trip</Text>
      <Text style={t.xs}>Nomor telepon hanya terlihat antara pemilik mobil dan penumpang.</Text>
      {list.map((p) => (
        <View key={p.user.id + p.role} style={{ gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line2 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <Person
                user={{ ...p.user, name: p.user.id === meId ? `${p.user.name} (Anda)` : p.user.name }}
                rating={p.role}
                sub={p.role === 'driver' ? `Pemilik mobil${p.user.car_model ? ` · ${p.user.car_model} ${p.user.car_plate || ''}` : ''}` : `Penumpang · ${p.seats} orang`}
              />
            </View>
            {p.user.id !== meId && p.user.phone && (
              <>
                <Pressable onPress={() => Linking.openURL(`tel:${p.user.phone}`)} hitSlop={8} style={{ padding: 8 }} accessibilityLabel={`Telepon ${p.user.name}`}>
                  <Icon name="phone" size={19} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => Linking.openURL(wa(p.user.phone))} hitSlop={8} style={{ padding: 8 }} accessibilityLabel={`WhatsApp ${p.user.name}`}>
                  <Icon name="message" size={19} color={colors.primary} />
                </Pressable>
              </>
            )}
          </Row>
          {p.role === 'passenger' && p.pickup && (
            <Text style={[t.xs, { marginLeft: 50 }]}>
              Jemput {p.pickup_at ? fmtTime(p.pickup_at) : ''} di {shortPlace(p.pickup)} · turun di {shortPlace(p.dropoff)}
            </Text>
          )}
        </View>
      ))}
    </Card>
  );
}

/* ---------- passenger: book a seat ---------- */
function BookingPanel({ trip, from, to, sel, setSel, initSeats, onDone }) {
  const q = trip.quote;
  const route = routeOf(trip);
  const etas = trip.etas || [];
  const pi = sel?.pi ?? q.pickup_index;
  const di = sel?.di ?? q.dropoff_index;
  const [seats, setSeats] = useState(Math.min(initSeats || 1, q.seats_available || 1));
  const [luggage, setLuggage] = useState(0);
  const [price, setPrice] = useState(String(q.price_per_seat * seats));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  useEffect(() => setPrice(String(q.price_per_seat * seats)), [q.price_per_seat, seats]);

  async function book() {
    setBusy(true);
    setErr('');
    try {
      const b = await api(`/trips/${trip.id}/bookings`, {
        method: 'POST',
        body: { pickup_index: pi, dropoff_index: di, pickup: from || undefined, dropoff: to || undefined, seats, luggage, price: Number(price), message },
      });
      setDone(b.status === 'accepted' ? 'Kursi Anda terkonfirmasi.' : 'Permintaan terkirim ke pemilik mobil.');
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const PointPick = ({ label, value, onPick, min, max }) => (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      {route.map((p, i) =>
        i < min || i > max ? null : (
          <Pressable
            key={i}
            onPress={() => onPick(i)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: value === i ? colors.primary : colors.line, backgroundColor: value === i ? colors.primary50 : colors.surface }}
          >
            <Text style={[t.body, t.strong, t.tnum, { width: 44 }]}>{etas[i] ? fmtTime(etas[i]) : ''}</Text>
            <View style={{ flex: 1 }}>
              <Text style={t.body} numberOfLines={1}>
                {shortPlace(p)}
              </Text>
              {p.note ? <Text style={t.xs}>Patokan: {p.note}</Text> : null}
              {(label.startsWith('Naik') ? from : to) && <Text style={t.xs}>{km(haversine(label.startsWith('Naik') ? from : to, p))} dari titik Anda</Text>}
            </View>
            {value === i && <Icon name="check" size={18} color={colors.primary} />}
          </Pressable>
        ),
      )}
    </View>
  );

  if (done)
    return (
      <Banner tone="mint" icon="check" title={done}>
        Kabar selanjutnya muncul di notifikasi dan di tab Perjalanan.
      </Banner>
    );
  return (
    <Card>
      <Text style={t.h3}>Pesan kursi</Text>
      <Text style={t.xs}>Penumpang naik dan turun di titik yang ditentukan pemilik mobil.</Text>
      <PointPick label="Naik di" value={pi} min={0} max={route.length - 2} onPick={(i) => setSel({ pi: i, di: Math.max(di, i + 1) })} />
      <PointPick label="Turun di" value={di} min={pi + 1} max={route.length - 1} onPick={(i) => setSel({ pi, di: i })} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={t.body}>Jumlah orang</Text>
        <Row>
          <Button small block={false} kind="outline" title="−" onPress={() => setSeats(Math.max(1, seats - 1))} />
          <Text style={[t.h3, { minWidth: 24, textAlign: 'center' }]}>{seats}</Text>
          <Button small block={false} kind="outline" title="+" onPress={() => setSeats(Math.min(q.seats_available, seats + 1))} />
        </Row>
      </Row>
      {trip.luggage && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={t.body}>Koper</Text>
          <Row>
            <Button small block={false} kind="outline" title="−" onPress={() => setLuggage(Math.max(0, luggage - 1))} />
            <Text style={[t.h3, { minWidth: 24, textAlign: 'center' }]}>{luggage}</Text>
            <Button small block={false} kind="outline" title="+" onPress={() => setLuggage(Math.min(q.luggage_available ?? trip.max_luggage, luggage + 1))} />
          </Row>
        </Row>
      )}
      <View style={{ gap: 6 }}>
        <Text style={s.label}>{trip.negotiable ? `Tawaran harga (harga pemilik mobil ${fmtRp(q.price_per_seat * seats)})` : 'Harga'}</Text>
        {trip.negotiable ? (
          <TextInput value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, ''))} keyboardType="number-pad" style={s.input} accessibilityLabel="Tawaran harga" />
        ) : (
          <Text style={[t.h2, t.tnum]}>{fmtRp(q.price_per_seat * seats)}</Text>
        )}
      </View>
      <TextInput value={message} onChangeText={setMessage} placeholder="Pesan untuk pemilik mobil (opsional)" placeholderTextColor={colors.muted} style={s.input} />
      <ErrorText>{err}</ErrorText>
      <Button title={trip.instant_booking && Number(price) >= q.price_per_seat * seats ? 'Pesan sekarang' : 'Kirim permintaan ke pemilik mobil'} busy={busy} onPress={book} />
      <Text style={[t.xs, { textAlign: 'center' }]}>
        {trip.instant_booking ? 'Kursi langsung terkonfirmasi. Bayar langsung ke pemilik mobil.' : 'Pemilik mobil akan mengonfirmasi atau menawar balik. Bayar langsung ke pemilik mobil.'}
      </Text>
    </Card>
  );
}

/* ---------- screen ---------- */
export default function Trip({ route, navigation }) {
  const { id, from, to, seats: initSeats, rate } = route.params || {};
  const { user } = useApp();
  const [trip, setTrip] = useState(null);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setTrip(await api(`/trips/${id}${qs({ from_lat: from?.lat, from_lng: from?.lng, to_lat: to?.lat, to_lng: to?.lng, pickup_index: sel?.pi, dropoff_index: sel?.di })}`));
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, [id, from, to, sel]);
  useEffect(() => {
    load();
  }, [load]);
  useLiveRefresh(load, { tripId: id });
  const live = useLive(trip?.share_token);

  useEffect(() => {
    if (trip) navigation.setOptions({ title: `${shortPlace(trip.origin)} → ${shortPlace(trip.destination)}` });
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip) return <Screen>{err ? <ErrorText>{err}</ErrorText> : <Loading />}</Screen>;
  const isDriver = user && trip.driver_id === user.id;
  const mine = trip.my_bookings || [];
  const active = mine.find((b) => b.status === 'accepted' || b.status === 'negotiating');
  const accepted = mine.find((b) => b.status === 'accepted');
  const q = trip.quote;

  async function status(action) {
    const go = async () => {
      setBusy(true);
      try {
        setTrip(await api(`/trips/${trip.id}/status`, { method: 'POST', body: { action } }));
      } catch (e) {
        Alert.alert('Gagal', e.message);
      } finally {
        setBusy(false);
      }
    };
    if (action === 'cancel') Alert.alert('Batalkan trip?', 'Semua penumpang akan mendapat notifikasi.', [{ text: 'Tidak' }, { text: 'Batalkan trip', style: 'destructive', onPress: go }]);
    else go();
  }

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={t.h2}>
            {shortPlace(trip.origin)} ke {shortPlace(trip.destination)}
          </Text>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip icon="calendar" label={fmtDate(trip.depart_at)} />
            <Chip label={trip.kind === 'antar_kota' ? 'Antar kota' : 'Dalam kota'} />
            {trip.status !== 'scheduled' && <Chip tone={trip.status === 'ongoing' ? 'mint' : 'muted'} label={tripStatusLabel[trip.status]} />}
            {trip.instant_booking && <Chip tone="primary" icon="bolt" label="Pesan instan" />}
          </Row>
        </View>

        <TripMap trip={trip} live={live} highlight={q ? [q.pickup_index, q.dropoff_index] : null} />

        <Card>
          <Person user={trip.driver} rating="driver" sub={`${trip.vehicle || 'Kendaraan'}${trip.plate ? ` · ${trip.plate}` : ''}`} size={46} />
          {!trip.plate && !isDriver && <Text style={t.xs}>Pelat nomor dan nama lengkap pemilik mobil terlihat setelah pesanan Anda terkonfirmasi.</Text>}
          <RouteTimeline trip={trip} from={isDriver ? null : q?.pickup_index} to={isDriver ? null : q?.dropoff_index} />
          {trip.notes ? <Text style={t.small}>Catatan: {trip.notes}</Text> : null}
        </Card>

        {isDriver ? (
          <>
            {trip.status === 'scheduled' && (
              <Row gap={8}>
                <Button icon="navigate" title="Mulai trip" busy={busy} onPress={() => status('start')} style={{ flex: 1 }} />
                <Button kind="dangerGhost" block={false} title="Batalkan" onPress={() => status('cancel')} />
              </Row>
            )}
            {trip.status === 'ongoing' && <Button kind="mint" icon="flag" title="Selesaikan trip" busy={busy} onPress={() => status('complete')} />}
            {(trip.status === 'scheduled' || trip.status === 'ongoing') && <LivePanel trip={trip} live={live} />}
            <SectionTitle>Penumpang ({(trip.bookings || []).length})</SectionTitle>
            {(trip.bookings || []).length === 0 && <Text style={t.small}>Belum ada pesanan. Penumpang yang searah akan muncul di sini.</Text>}
            {(trip.bookings || []).map((b) => (
              <BookingCard key={b.id} booking={b} role="driver" onChange={load} navigation={navigation} openRate={b.id === rate} />
            ))}
            <Participants list={trip.participants} meId={user?.id} />
          </>
        ) : (
          <>
            {active ? (
              <>
                <BookingCard booking={active} role="passenger" onChange={load} navigation={navigation} openRate={active.id === rate} />
                {accepted && trip.status !== 'completed' && trip.status !== 'cancelled' && <LivePanel trip={trip} live={live} passenger />}
                <Participants list={trip.participants} meId={user?.id} />
              </>
            ) : trip.status !== 'scheduled' ? (
              <Banner icon="info">Trip ini sudah {tripStatusLabel[trip.status].toLowerCase()} dan tidak menerima pesanan.</Banner>
            ) : !identityOK(user) ? (
              <KycNotice need="identity" navigation={navigation} />
            ) : q ? (
              <BookingPanel trip={trip} from={from} to={to} sel={sel} setSel={setSel} initSeats={initSeats} onDone={load} />
            ) : null}
            {mine
              .filter((b) => b !== active)
              .map((b) => (
                <BookingCard key={b.id} booking={b} role="passenger" onChange={load} navigation={navigation} openRate={b.id === rate} />
              ))}
          </>
        )}
      </View>
    </Screen>
  );
}
