import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../Icon';
import { api, qs } from '../api';
import { colors, t } from '../theme';
import { fmtDay, km, shortPlace } from '../format';
import { Banner, Button, Card, Empty, ErrorText, Loading, Row, Screen, Segmented } from '../ui';
import PlaceField from '../components/PlaceField';
import DateTimeField from '../components/DateTimeField';
import { SectionTitle, TripCard } from '../components/TripBits';
import { useApp } from '../state';

const LAST = 'nebeng_last_search';
const RECENT = 'nebeng_recent_routes';
const RADII = [
  { value: 3, label: '3 km' },
  { value: 10, label: '10 km' },
  { value: 20, label: '20 km' },
];
const same = (a, b) => a?.from?.label === b?.from?.label && a?.to?.label === b?.to?.label;
const ymd = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');

export default function Search({ navigation }) {
  const { user } = useApp();
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [date, setDate] = useState(null);
  const [seats, setSeats] = useState(1);
  const [radius, setRadius] = useState(10);
  const [query, setQuery] = useState(null);
  const [trips, setTrips] = useState(null);
  const [near, setNear] = useState(null);
  const [others, setOthers] = useState(null);
  const [showOthers, setShowOthers] = useState(false);
  const [recent, setRecent] = useState([]);
  const [remembered, setRemembered] = useState(false);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Start with the last searched route (works for city routes like Tambun → MT Haryono too).
  useEffect(() => {
    (async () => {
      try {
        setRecent(JSON.parse((await AsyncStorage.getItem(RECENT)) || '[]'));
        const last = JSON.parse((await AsyncStorage.getItem(LAST)) || 'null');
        if (last && (last.from || last.to)) {
          setFrom(last.from);
          setTo(last.to);
          setSeats(last.seats || 1);
          setRemembered(true);
          setQuery({ from: last.from, to: last.to, seats: last.seats || 1, date: '', radius: 10 });
          return;
        }
      } catch {
        /* first run */
      }
      setQuery({ from: null, to: null, seats: 1, date: '', radius: 10 });
    })();
  }, []);

  async function remember(q) {
    if (!q.from && !q.to) return;
    const r = { from: q.from, to: q.to, seats: q.seats };
    const list = [r, ...recent.filter((x) => !same(x, r))].slice(0, 3);
    setRecent(list);
    await AsyncStorage.setItem(LAST, JSON.stringify(r));
    await AsyncStorage.setItem(RECENT, JSON.stringify(list));
    // Saved on the server too, so a new trip on this route sends a notification.
    const routes = list.filter((x) => x.from && x.to).map((x) => ({ from: x.from, to: x.to }));
    if (user && routes.length) api('/me/routes', { method: 'PUT', body: { routes } }).catch(() => {});
  }

  const load = useCallback(async () => {
    if (!query) return;
    setErr('');
    setTrips(null);
    setShowOthers(false);
    const base = { from_lat: query.from?.lat, from_lng: query.from?.lng, to_lat: query.to?.lat, to_lng: query.to?.lng, date: query.date, seats: query.seats };
    try {
      const data = await api(`/trips${qs({ ...base, from_radius_km: query.radius, to_radius_km: query.radius })}`);
      setTrips(data);
      if (!data.length && (query.from || query.to)) {
        const [n, all] = await Promise.all([
          api(`/trips${qs({ ...base, from_radius_km: Math.max(25, query.radius), to_radius_km: Math.max(25, query.radius), order_by: query.from ? 'nearest_pickup' : 'nearest_dropoff' })}`),
          api(`/trips${qs({ seats: query.seats, date: query.date })}`),
        ]);
        setNear(n);
        const ids = new Set(n.map((x) => x.id));
        setOthers(all.filter((x) => !ids.has(x.id)));
      } else {
        setNear(null);
        setOthers(null);
      }
    } catch (e) {
      setErr(e.message);
      setTrips([]);
    }
  }, [query]);
  useEffect(() => {
    load();
  }, [load]);

  function search(over = {}) {
    const q = { from, to, seats, date: ymd(date), radius, ...over };
    setRemembered(false);
    setQuery(q);
    remember(q);
  }

  const nearest = near?.[0]?.quote;
  const needed = nearest ? Math.min(50, Math.ceil(Math.max(nearest.pickup_walk_km || 0, nearest.dropoff_walk_km || 0))) : null;
  const open = (trip) => navigation.navigate('Trip', { id: trip.id, from: query?.from, to: query?.to, seats: query?.seats });

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <Card style={{ gap: 12, borderRadius: 26 }}>
        <Text style={t.h1}>Mau ke mana?</Text>
        <Row gap={12} style={{ alignItems: 'stretch' }}>
          <View style={{ alignItems: 'center', paddingVertical: 22 }}>
            <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary }} />
            <View style={{ width: 2, flex: 1, backgroundColor: '#CBD5EF', marginVertical: 2 }} />
            <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.teal, borderWidth: 2, borderColor: colors.ink }} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <PlaceField label="Dari" value={from} onChange={setFrom} placeholder="Titik jemput kamu" hideDot />
            <PlaceField label="Ke" value={to} onChange={setTo} kind="dest" placeholder="Tujuan kamu" near={from} hideDot />
          </View>
        </Row>
        <Row gap={8}>
          <View style={{ flex: 1 }}>
            <DateTimeField value={date} onChange={setDate} clearable />
          </View>
          <Row gap={0} style={{ backgroundColor: colors.line2, borderRadius: 12, borderWidth: 1, borderColor: colors.line, height: 48 }}>
            <Pressable onPress={() => setSeats(Math.max(1, seats - 1))} style={{ padding: 12 }} accessibilityLabel="Kurangi orang">
              <Icon name="minus" size={18} />
            </Pressable>
            <Text style={[t.body, t.strong]}>{seats} org</Text>
            <Pressable onPress={() => setSeats(Math.min(8, seats + 1))} style={{ padding: 12 }} accessibilityLabel="Tambah orang">
              <Icon name="plus" size={18} />
            </Pressable>
          </Row>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={t.small}>Radius jemput & antar</Text>
          <Segmented value={radius} onChange={setRadius} options={RADII} />
        </Row>
        <Button icon="search" title="Cari tumpangan" onPress={() => search()} />
      </Card>

      {recent.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {recent.map((r, i) => (
            <Pressable
              key={i}
              onPress={() => {
                setFrom(r.from);
                setTo(r.to);
                search({ from: r.from, to: r.to, seats: r.seats || seats });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: same(r, query) ? colors.primary50 : colors.surface, borderWidth: 1, borderColor: colors.line }}
            >
              <Icon name="clock" size={13} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                {r.from ? shortPlace(r.from) : 'Mana saja'} → {r.to ? shortPlace(r.to) : 'mana saja'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ marginTop: 16, gap: 12 }}>
        {remembered && (
          <Banner icon="clock">
            Menampilkan rute terakhir yang Anda cari: {query?.from ? shortPlace(query.from) : 'mana saja'} ke {query?.to ? shortPlace(query.to) : 'mana saja'}.
          </Banner>
        )}
        <ErrorText>{err}</ErrorText>
        {trips == null ? (
          <Loading />
        ) : trips.length ? (
          <>
            <SectionTitle>{trips.length} trip tersedia</SectionTitle>
            {trips.map((x, i) => (
              <View key={x.id} style={{ gap: 6 }}>
                {(i === 0 || fmtDay(trips[i - 1].depart_at) !== fmtDay(x.depart_at)) && <Text style={[t.h3, { marginTop: 6 }]}>{fmtDay(x.depart_at)}</Text>}
                <TripCard trip={x} onPress={() => open(x)} />
              </View>
            ))}
          </>
        ) : near?.length || others?.length ? (
          <>
            <Banner tone="amber" icon="info" title={`Tidak ada trip yang lewat dalam ${query.radius} km dari ${[query.from && shortPlace(query.from), query.to && shortPlace(query.to)].filter(Boolean).join(' dan ')}.`}>
              {nearest ? `Trip terdekat lewat ${km(Math.max(nearest.pickup_walk_km || 0, nearest.dropoff_walk_km || 0))} dari titik Anda.` : 'Coba ganti tanggal atau pasang permintaan di web.'}
            </Banner>
            {needed != null && needed > query.radius && <Button kind="soft" title={`Perbesar radius jadi ${needed} km`} onPress={() => {
                  setRadius(needed);
                  search({ radius: needed });
                }} />}
            {near?.length > 0 && (
              <>
                <SectionTitle>Hampir searah, di luar radius ({near.length})</SectionTitle>
                {near.map((x) => (
                  <TripCard key={x.id} trip={x} onPress={() => open(x)} radius={{ from: query.from ? query.radius : null, to: query.to ? query.radius : null }} />
                ))}
              </>
            )}
            {others?.length > 0 && (
              <>
                <Button kind="outline" icon={showOthers ? 'arrowUp' : 'arrowDown'} title={`${showOthers ? 'Sembunyikan' : 'Lihat'} trip lain dengan rute berbeda (${others.length})`} onPress={() => setShowOthers(!showOthers)} />
                {showOthers && others.map((x) => <TripCard key={x.id} trip={x} onPress={() => navigation.navigate('Trip', { id: x.id })} />)}
              </>
            )}
          </>
        ) : (
          <Empty icon="megaphone" title="Belum ada yang searah">
            Coba perbesar radius, ganti tanggal, atau cari rute lain.
          </Empty>
        )}
      </View>
    </Screen>
  );
}
