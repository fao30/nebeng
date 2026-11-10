import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { t } from '../theme';
import { Button, Empty, Loading, Screen } from '../ui';
import { SectionTitle, TripCard } from '../components/TripBits';
import { useApp } from '../state';

/** Trip saya: the owner's trips, upcoming first. */
export default function DriverTrips({ navigation }) {
  const { onNotification } = useApp();
  const [list, setList] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      setList(await api('/my/trips'));
    } catch {
      setList((x) => x || []);
    }
  }, []);
  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    const off = onNotification((n) => n.trip_id && load());
    return () => {
      unsub();
      off();
    };
  }, [load, navigation, onNotification]);
  if (!list) return <Loading />;
  const upcoming = list.filter((x) => x.status === 'scheduled' || x.status === 'ongoing').sort((a, b) => new Date(a.depart_at) - new Date(b.depart_at));
  const past = list.filter((x) => !upcoming.includes(x));
  const waiting = (x) => (x.bookings || []).filter((b) => b.status === 'negotiating' && b.awaiting === 'driver').length;
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <View style={{ gap: 12 }}>
        <Button icon="plus" title="Buat trip baru" onPress={() => navigation.navigate('Buat trip')} />
        {!list.length && <Empty icon="car" title="Belum ada trip">Buat trip, tentukan titik jemput dan harga, lalu tunggu penumpang searah.</Empty>}
        {upcoming.length > 0 && <SectionTitle>Akan datang</SectionTitle>}
        {upcoming.map((x) => (
          <View key={x.id} style={{ gap: 4 }}>
            {waiting(x) > 0 && <Text style={[t.small, { fontWeight: '800', color: '#B97409' }]}>{waiting(x)} permintaan menunggu jawaban Anda</Text>}
            <TripCard trip={x} showStatus onPress={() => navigation.navigate('Trip', { id: x.id })} />
          </View>
        ))}
        {past.length > 0 && <SectionTitle>Riwayat</SectionTitle>}
        {past.map((x) => (
          <TripCard key={x.id} trip={x} showStatus onPress={() => navigation.navigate('Trip', { id: x.id })} />
        ))}
      </View>
    </Screen>
  );
}
