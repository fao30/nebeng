import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../Icon';
import { colors, t } from '../theme';
import { currentPosition, reverseGeocode, searchPlaces } from '../geo';
import { ErrorText, s } from '../ui';

/** A place picker: tap to open a search screen (debounced), or use current location. */
export default function PlaceField({ label, value, onChange, kind = 'origin', placeholder, withNote, near, hideDot }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 450);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (debounced.length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setBusy(true);
    setErr('');
    searchPlaces(debounced, { signal: ctrl.signal, near })
      .then((r) => {
        setResults(r);
        if (!r.length) setErr('Tidak ditemukan. Coba nama jalan, tempat, atau kecamatan.');
      })
      .catch((e) => e.name !== 'AbortError' && setErr('Pencarian gagal. Coba lagi.'))
      .finally(() => !ctrl.signal.aborted && setBusy(false));
    return () => ctrl.abort();
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(p) {
    onChange({ ...p, note: value?.note || '' });
    setOpen(false);
    setQ('');
  }

  async function mine() {
    setBusy(true);
    setErr('');
    try {
      const p = await currentPosition();
      pick({ lat: p.lat, lng: p.lng, label: await reverseGeocode(p.lat, p.lng) });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const dot = kind === 'dest' ? { backgroundColor: colors.teal } : kind === 'stop' ? { backgroundColor: colors.surface, borderWidth: 2.5, borderColor: colors.indigo } : { backgroundColor: colors.primary };
  return (
    <View style={{ gap: 6 }}>
      <Pressable onPress={() => setOpen(true)} style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54 }]} accessibilityLabel={label}>
        {!hideDot && <View style={[{ width: 12, height: 12, borderRadius: 6 }, dot]} />}
        <View style={{ flex: 1 }}>
          <Text style={t.xs}>{label}</Text>
          <Text style={[t.body, !value && { color: colors.muted }]} numberOfLines={1}>
            {value?.label || placeholder || 'Pilih lokasi'}
          </Text>
        </View>
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityLabel={`Hapus ${label}`}>
            <Icon name="x" size={18} color={colors.muted} />
          </Pressable>
        )}
      </Pressable>
      {withNote && value && (
        <View style={[s.input, { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, backgroundColor: colors.surface }]}>
          <Icon name="flag" size={16} color={colors.muted} />
          <TextInput
            value={value.note || ''}
            onChangeText={(v) => onChange({ ...value, note: v })}
            placeholder="Patokan, misal: depan Indomaret"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, fontSize: 14.5, color: colors.ink }}
            maxLength={200}
          />
        </View>
      )}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Kembali">
              <Icon name="chevronLeft" size={24} />
            </Pressable>
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder={placeholder || `Cari ${label.toLowerCase()}`}
              placeholderTextColor={colors.muted}
              style={[s.input, { flex: 1 }]}
              returnKeyType="search"
            />
          </View>
          <Pressable onPress={mine} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 }}>
            <Icon name="locate" color={colors.primary} />
            <Text style={[t.body, { color: colors.primary, fontWeight: '700' }]}>Gunakan lokasi saya</Text>
            {busy && <ActivityIndicator color={colors.primary} />}
          </Pressable>
          <View style={{ paddingHorizontal: 16 }}>
            <ErrorText>{err}</ErrorText>
          </View>
          <FlatList
            data={results}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(r, i) => `${r.lat},${r.lng},${i}`}
            renderItem={({ item }) => (
              <Pressable onPress={() => pick(item)} style={({ pressed }) => [{ flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.line2 }, pressed && { backgroundColor: colors.line2 }]}>
                <Icon name="pin" size={18} color={colors.muted} />
                <Text style={[t.body, { flex: 1 }]}>{item.label}</Text>
              </Pressable>
            )}
            ListFooterComponent={results.length ? <Text style={[t.xs, { padding: 16 }]}>Data peta © OpenStreetMap</Text> : null}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
