import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from '../Icon';
import { colors, t } from '../theme';
import { fmtDay, fmtTime, shortPlace } from '../format';
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
  // The next confirmed ride gets the big navy card on top.
  const next = active
    .filter((b) => b.status === 'accepted')
    .sort((a, b) => new Date(a.pickup_at) - new Date(b.pickup_at))[0];
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
          {next && <NextTrip b={next} onPress={() => navigation.navigate('Trip', { id: next.trip_id })} />}
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

function NextTrip({ b, onPress }) {
  const ongoing = b.trip.status === 'ongoing';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 22, padding: 16, gap: 12, opacity: pressed ? 0.9 : 1 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal }} />
          <Text style={{ color: '#9EE6F0', fontWeight: '800', fontSize: 13 }}>
            {b.boarded_at ? 'Kamu sudah naik' : ongoing ? 'Pemilik mobil sedang menuju' : `${fmtDay(b.pickup_at)}, jemput ${fmtTime(b.pickup_at)}`}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color="#FFFFFF" />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ alignItems: 'center', paddingTop: 5 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFFFFF' }} />
          <View style={{ width: 1.5, flex: 1, backgroundColor: 'rgba(255,255,255,0.35)', minHeight: 20 }} />
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.teal }} />
        </View>
        <View style={{ gap: 10, flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{shortPlace(b.pickup)}</Text>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{shortPlace(b.dropoff)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', paddingTop: 10 }}>
        <Text style={{ color: '#C9CEEB', fontWeight: '700', fontSize: 13 }}>
          {b.trip.vehicle || 'Mobil'}
          {b.trip.plate ? ` · ${b.trip.plate}` : ''}
        </Text>
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{b.boarded_at ? 'Selamat jalan' : 'Buka kode naik'}</Text>
      </View>
    </Pressable>
  );
}
