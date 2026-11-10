import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventSource from 'react-native-sse';
import Icon from '../Icon';
import { api, getToken } from '../api';
import { API_URL } from '../config';
import { colors, t } from '../theme';
import { fmtRp, fmtTime } from '../format';
import { ErrorText, Loading } from '../ui';

/** Real-time chat for one booking (SSE + send). */
export default function Chat({ route, navigation }) {
  const { bookingId, role, title } = route.params;
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await api(`/bookings/${bookingId}/messages`));
    } catch (e) {
      setErr(e.message);
    }
  }, [bookingId]);

  useEffect(() => {
    navigation.setOptions({ title: title ? `Chat dengan ${title}` : 'Chat' });
    load();
    const es = new EventSource(`${API_URL}/api/bookings/${bookingId}/stream`, { headers: { Authorization: `Bearer ${getToken()}` }, pollingInterval: 4000 });
    es.addEventListener('message', (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === 'message')
          setData((cur) => (cur && !cur.messages.some((x) => x.id === m.message.id) ? { ...cur, messages: [...cur.messages, m.message] } : cur));
        if (m.type === 'booking' || m.type === 'ready') load();
      } catch {
        /* ignore */
      }
    });
    return () => {
      es.removeAllEventListeners();
      es.close();
    };
  }, [bookingId, load, navigation, title]);

  async function send() {
    const v = text.trim();
    if (!v) return;
    setSending(true);
    setErr('');
    try {
      const messages = await api(`/bookings/${bookingId}/messages`, { method: 'POST', body: { text: v } });
      setText('');
      setData((cur) => ({ ...cur, messages }));
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  }

  if (!data) return err ? <ErrorText>{err}</ErrorText> : <Loading />;
  const b = data.booking;
  const items = [
    ...b.offers.map((o) => ({ kind: 'offer', by: o.by, at: o.at, price: o.price, text: o.message, id: `o${o.at}` })),
    ...data.messages.map((m) => ({ kind: 'msg', by: m.role, at: m.at, text: m.text, id: m.id })),
  ].sort((a, c) => new Date(a.at) - new Date(c.at));
  const closed = b.status !== 'negotiating' && b.status !== 'accepted';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.by === role;
            if (item.kind === 'offer')
              return (
                <Text style={[t.xs, { textAlign: 'center', marginVertical: 4 }]}>
                  {mine ? 'Anda' : item.by === 'driver' ? 'Pemilik mobil' : 'Penumpang'} menawarkan {fmtRp(item.price)} · {fmtTime(item.at)}
                </Text>
              );
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: mine ? colors.primary : colors.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: mine ? 0 : 1, borderColor: colors.line }}>
                <Text style={{ color: mine ? '#fff' : colors.ink, fontSize: 15 }}>{item.text}</Text>
                <Text style={{ color: mine ? 'rgba(255,255,255,0.75)' : colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' }}>{fmtTime(item.at)}</Text>
              </View>
            );
          }}
        />
        <ErrorText>{err}</ErrorText>
        {closed ? (
          <Text style={[t.small, { textAlign: 'center', padding: 14 }]}>Percakapan ditutup karena pesanan sudah selesai.</Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, padding: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Tulis pesan…"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, backgroundColor: colors.line2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.ink, maxHeight: 120 }}
              multiline
              maxLength={1000}
              accessibilityLabel="Pesan"
            />
            <Pressable onPress={send} disabled={sending || !text.trim()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: sending || !text.trim() ? 0.5 : 1 }} accessibilityLabel="Kirim">
              <Icon name="arrowRight" color="#fff" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
