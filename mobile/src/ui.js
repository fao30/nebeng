import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors, radius, shadow, t } from './theme';
import { initials } from './format';

export function Screen({ children, refreshing, onRefresh, scroll = true, padded = true, style }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && { padding: 16, paddingBottom: 40 }, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && { padding: 16 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={({ pressed } = {}) => [s.card, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Comp>
  );
}

export function Button({ title, onPress, kind = 'primary', icon, disabled, busy, small, block = true, style }) {
  const k = btn[kind] || btn.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy) }}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        !block && { alignSelf: 'flex-start' },
        { backgroundColor: k.bg, borderColor: k.border || k.bg },
        (disabled || busy) && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={k.fg} size="small" />
      ) : (
        <>
          {icon && <Icon name={icon} size={small ? 16 : 18} color={k.fg} />}
          <Text style={[s.btnText, small && { fontSize: 14 }, { color: k.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
const btn = {
  primary: { bg: colors.primary, fg: '#fff' },
  soft: { bg: colors.primary50, fg: colors.primary },
  ghost: { bg: 'transparent', fg: colors.ink2 },
  outline: { bg: colors.surface, fg: colors.ink, border: colors.line },
  danger: { bg: colors.red, fg: '#fff' },
  dangerGhost: { bg: 'transparent', fg: colors.red },
  mint: { bg: colors.mint, fg: '#fff' },
  teal: { bg: colors.teal, fg: '#0B1736' },
};

export function LinkText({ children, onPress, danger, style }) {
  return (
    <Text onPress={onPress} style={[{ color: danger ? colors.red : colors.primary, fontWeight: '700' }, style]} suppressHighlighting>
      {children}
    </Text>
  );
}

const TONES = {
  primary: [colors.primary50, colors.primary],
  mint: [colors.mint50, colors.mint],
  amber: [colors.amber50, colors.amber],
  red: [colors.red50, colors.red],
  muted: [colors.line2, colors.ink2],
};
export function Chip({ label, tone = 'muted', icon }) {
  const [bg, fg] = TONES[tone] || TONES.muted;
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={13} color={fg} />}
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Field({ label, help, error, style, inputStyle, ...props }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.muted} style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, inputStyle]} {...props} />
      {help && <Text style={t.xs}>{help}</Text>}
      {error && <ErrorText>{error}</ErrorText>}
    </View>
  );
}

export const ErrorText = ({ children }) => (children ? <Text style={{ color: colors.red, fontSize: 13.5, fontWeight: '600' }}>{children}</Text> : null);

export function Avatar({ name, size = 40 }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

export function Person({ user, sub, rating, size = 40 }) {
  if (!user) return null;
  const n = rating === 'driver' ? user.driver_ratings : user.passenger_ratings;
  const avg = rating === 'driver' ? user.driver_rating : user.passenger_rating;
  return (
    <View style={s.row}>
      <Avatar name={user.name} size={size} />
      <View style={{ flex: 1 }}>
        <View style={[s.row, { gap: 5 }]}>
          <Text style={[t.body, t.strong]} numberOfLines={1}>
            {user.name}
          </Text>
          {user.verified && (
            <View style={s.verified}>
              <Icon name="check" size={10} color="#fff" strokeWidth={3.5} />
            </View>
          )}
          {rating && (
            <Text style={{ color: n ? colors.amber : colors.muted, fontWeight: '700', fontSize: 12.5 }}>{n ? `★ ${avg.toFixed(1)} (${n})` : 'Baru'}</Text>
          )}
        </View>
        {sub ? <Text style={t.xs}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function Stars({ value, onChange, size = 38 }) {
  return (
    <View style={[s.row, { gap: 6, justifyContent: 'center' }]}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text
          key={n}
          onPress={onChange ? () => onChange(n) : undefined}
          accessibilityRole={onChange ? 'button' : 'text'}
          accessibilityLabel={`${n} bintang`}
          style={{ fontSize: size, color: n <= value ? colors.star : colors.line }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

/** Bottom sheet built on Modal. */
export function Sheet({ open, onClose, title, children, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!open} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.sheetHead}>
            <Text style={t.h3}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Tutup">
              <Icon name="x" color={colors.ink2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && <View style={s.sheetFoot}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Segmented({ value, onChange, options, full }) {
  return (
    <View style={[s.seg, full && s.segFull]}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segBtn, full && s.segBtnFull, value === o.value && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: value === o.value }}>
          <Text style={[s.segText, value === o.value && { color: colors.ink }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Empty({ icon = 'route', title, children, action }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
      <View style={[s.avatar, { width: 56, height: 56, borderRadius: 28 }]}>
        <Icon name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={[t.h3, { textAlign: 'center' }]}>{title}</Text>
      {children ? <Text style={[t.small, { textAlign: 'center' }]}>{children}</Text> : null}
      {action}
    </View>
  );
}

export function Banner({ tone = 'primary', icon = 'info', title, children, action }) {
  const [bg, fg] = TONES[tone] || TONES.primary;
  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      <Icon name={icon} size={20} color={fg} />
      <View style={{ flex: 1, gap: 4 }}>
        {title && <Text style={[t.body, t.strong]}>{title}</Text>}
        {children ? <Text style={t.small}>{children}</Text> : null}
        {action}
      </View>
    </View>
  );
}

export const Row = ({ children, style, gap = 10 }) => <View style={[s.row, { gap }, style]}>{children}</View>;
export const Spacer = ({ h = 12 }) => <View style={{ height: h }} />;
export const Loading = () => (
  <View style={{ padding: 40, alignItems: 'center' }}>
    <ActivityIndicator color={colors.primary} />
  </View>
);

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line, gap: 12, ...shadow, shadowOpacity: 0.06, elevation: 2 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1 },
  btnSmall: { height: 38, paddingHorizontal: 14, borderRadius: 11 },
  btnText: { fontSize: 16, fontWeight: '800' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700' },
  label: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  input: { backgroundColor: colors.line2, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 16, color: colors.ink, borderWidth: 1, borderColor: colors.line },
  avatar: { backgroundColor: colors.primary100, alignItems: 'center', justifyContent: 'center' },
  verified: { width: 15, height: 15, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(23,20,46,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '90%', ...shadow },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.line2 },
  sheetFoot: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line2 },
  seg: { flexDirection: 'row', backgroundColor: colors.line2, borderRadius: 999, padding: 3, borderWidth: 1, borderColor: colors.line, alignSelf: 'flex-start' },
  segBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  segFull: { alignSelf: 'stretch' },
  segBtnFull: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  segOn: { backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.06, elevation: 1 },
  segText: { fontSize: 14, fontWeight: '700', color: colors.ink2 },
  banner: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, alignItems: 'flex-start' },
});
