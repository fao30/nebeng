import { StyleSheet } from 'react-native';

export const colors = {
  ink: '#17142E',
  ink2: '#4B4864',
  muted: '#8D8AA3',
  line: '#E9E7F0',
  line2: '#F2F1F7',
  canvas: '#F6F5FA',
  surface: '#FFFFFF',
  primary: '#4A2BB0',
  primary600: '#3B2093',
  primary50: '#F2EFFD',
  primary100: '#E5DFFB',
  mint: '#0F9F6B',
  mint50: '#E6F6EF',
  amber: '#B97409',
  amber50: '#FDF3E1',
  red: '#D63C43',
  red50: '#FCEBEC',
  star: '#F2A516',
};

export const radius = { sm: 10, md: 14, lg: 20 };

export const shadow = {
  shadowColor: '#17142E',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const t = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  h2: { fontSize: 19, fontWeight: '800', color: colors.ink },
  h3: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  small: { fontSize: 13.5, color: colors.ink2, lineHeight: 19 },
  xs: { fontSize: 12, color: colors.muted, lineHeight: 16 },
  strong: { fontWeight: '700' },
  muted: { color: colors.muted },
  tnum: { fontVariant: ['tabular-nums'] },
});
