import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '../api';
import { Button, Empty, Loading, Screen } from '../ui';
import { SectionTitle } from '../components/TripBits';
import BookingCard from '../components/BookingCard';
import { useApp } from '../state';

/** Perjalanan: the passenger's bookings, active first. */
export default function Bookings({ navigation }) {
  const { onNotification } = useApp();
  const [list, setList] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      setList(await api('/my/bookings'));
    } catch {
      setList((x) => x || []);
    }
  }, []);
  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    const off = onNotification((n) => n.booking_id && load());
    return () => {
      unsub();
      off();
    };
  }, [load, navigation, onNotification]);

  if (!list) return <Loading />;
  const active = list.filter((b) => (b.status === 'accepted' || b.status === 'negotiating') && b.trip.status !== 'completed' && b.trip.status !== 'cancelled');
  const past = list.filter((b) => !active.includes(b));
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {!list.length ? (
        <Empty icon="ticket" title="Belum ada perjalanan" action={<Button block={false} title="Cari tumpangan" onPress={() => navigation.navigate('Cari')} />}>
          Pesanan dan tawaran harga Anda akan muncul di sini.
        </Empty>
      ) : (
        <View style={{ gap: 12 }}>
          {active.length > 0 && <SectionTitle>Aktif</SectionTitle>}
          {active.map((b) => (
            <BookingCard key={b.id} booking={b} role="passenger" onChange={load} navigation={navigation} showTrip />
          ))}
          {past.length > 0 && <SectionTitle>Riwayat</SectionTitle>}
          {past.map((b) => (
            <BookingCard key={b.id} booking={b} role="passenger" onChange={load} navigation={navigation} showTrip />
          ))}
        </View>
      )}
    </Screen>
  );
}
