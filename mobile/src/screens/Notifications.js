import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import Icon from '../Icon';
import { colors, t } from '../theme';
import { fmtDay, timeAgo } from '../format';
import { Button, Empty, Segmented } from '../ui';
import { useApp } from '../state';

const TONE = {
  primary: [colors.primary100, colors.primary],
  mint: [colors.mint50, colors.mint],
  amber: [colors.amber50, colors.amber],
  red: [colors.red50, colors.red],
};
const META = {
  booking_request: ['inbox', 'primary', 'pesanan'],
  booking_instant: ['bolt', 'mint', 'pesanan'],
  booking_offer: ['car', 'primary', 'pesanan'],
  booking_counter: ['tag', 'amber', 'pesanan'],
  booking_accepted: ['check', 'mint', 'pesanan'],
  booking_rejected: ['x', 'red', 'pesanan'],
  booking_cancelled: ['x', 'red', 'pesanan'],
  request_new: ['megaphone', 'primary', 'pesanan'],
  chat: ['message', 'primary', 'chat'],
  trip_started: ['navigate', 'mint', 'trip'],
  trip_completed: ['flag', 'mint', 'trip'],
  trip_cancelled: ['x', 'red', 'trip'],
  trip_reminder: ['clock', 'amber', 'trip'],
  trip_new: ['route', 'primary', 'trip'],
  boarded: ['shield', 'mint', 'trip'],
  dropped_off: ['flag', 'mint', 'trip'],
  rated: ['star', 'amber', 'trip'],
  kyc: ['shield', 'primary', 'lain'],
  report_updated: ['shield', 'primary', 'lain'],
  report_new: ['flag', 'red', 'lain'],
};
export function notifIcon(type) {
  const [icon, tone, group] = META[type] || ['info', 'primary', 'lain'];
  const [bg, fg] = TONE[tone];
  return { icon, bg, fg, group };
}

/** Where a notification's web link goes in the app. */
export function openNotification(n, navigation) {
  const link = n.link || '';
  const q = Object.fromEntries((link.split('?')[1] || '').split('&').filter(Boolean).map((kv) => kv.split('=').map(decodeURIComponent)));
  if (link.startsWith('/trip/') && n.trip_id) return navigation.navigate('Trip', { id: n.trip_id, chat: q.chat, rate: q.rate });
  if (link.startsWith('/live/') && n.trip_id) return navigation.navigate('Trip', { id: n.trip_id });
  if (link.startsWith('/verifikasi')) return navigation.navigate('Verifikasi');
  const tab = (screen) => navigation.navigate('Home', { screen });
  if (link.startsWith('/driver/trip-baru')) return tab('Buat trip');
  if (link.startsWith('/profil')) return tab('Profil');
  if (n.trip_id) return navigation.navigate('Trip', { id: n.trip_id });
  if (link.startsWith('/cari')) return tab('Cari');
}

export default function Notifications({ navigation }) {
  const { notifs, loadNotifs, markRead } = useApp();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const items = useMemo(
    () => notifs.items.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read_at : notifIcon(n.type).group === filter)),
    [notifs.items, filter],
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={t.small}>{notifs.unread ? `${notifs.unread} belum dibaca` : 'Semua sudah dibaca'}</Text>
          {notifs.unread > 0 && <Button small block={false} kind="soft" icon="check" title="Tandai dibaca" onPress={() => markRead()} />}
        </View>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Semua' },
            { value: 'unread', label: 'Baru' },
            { value: 'pesanan', label: 'Pesanan' },
            { value: 'chat', label: 'Chat' },
            { value: 'trip', label: 'Trip' },
          ]}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadNotifs();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <Empty icon="bell" title="Belum ada notifikasi">
            Kabar saat pemilik mobil menerima, menolak, atau menawar, chat baru, trip mulai dan selesai muncul di sini.
          </Empty>
        }
        renderItem={({ item: n, index }) => {
          const m = notifIcon(n.type);
          const day = fmtDay(n.at);
          const showDay = index === 0 || fmtDay(items[index - 1].at) !== day;
          return (
            <>
              {showDay && <Text style={[t.xs, { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }]}>{day}</Text>}
              <Pressable
                onPress={() => {
                  if (!n.read_at) markRead([n.id]);
                  openNotification(n, navigation);
                }}
                style={({ pressed }) => [
                  { flexDirection: 'row', gap: 12, padding: 14, marginHorizontal: 12, marginBottom: 6, borderRadius: 14, backgroundColor: n.read_at ? colors.surface : colors.primary50 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: m.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={m.icon} size={17} color={m.fg} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[t.body, { fontWeight: n.read_at ? '600' : '800' }]}>{n.title}</Text>
                  {n.body ? <Text style={t.small}>{n.body}</Text> : null}
                  <Text style={t.xs}>{timeAgo(n.at)}</Text>
                </View>
                {!n.read_at && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 }} />}
              </Pressable>
            </>
          );
        }}
      />
    </View>
  );
}
