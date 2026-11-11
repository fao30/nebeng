import { StyleSheet } from 'react-native';

// Design E "Biru Peta": navy primary, indigo brand, teal for destinations and live.
export const colors = {
  ink: '#1C2452',
  ink2: '#4A5280',
  muted: '#6A7299',
  line: '#E6E9F4',
  line2: '#F3F4FA',
  canvas: '#F5F6FB',
  surface: '#FFFFFF',
  primary: '#26337A',
  primary600: '#1A2459',
  primary50: '#EEF0FD',
  primary100: '#DDE1F7',
  indigo: '#5157D9',
  teal: '#33B5C9',
  tealInk: '#0E6A78',
  teal50: '#E9F8FA',
  map: '#ECEEF7',
  mint: '#0B7A55',
  mint50: '#E6F7F2',
  amber: '#8A5300',
  amber50: '#FFF4E0',
  red: '#C8333A',
  red50: '#FCEBEC',
  star: '#F2A516',
};

export const radius = { sm: 12, md: 16, lg: 22 };

export const shadow = {
  shadowColor: '#26337A',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const t = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '900', color: colors.primary, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.primary },
  h3: { fontSize: 16, fontWeight: '800', color: colors.primary },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  small: { fontSize: 13.5, color: colors.ink2, lineHeight: 19 },
  xs: { fontSize: 12, color: colors.muted, lineHeight: 16 },
  strong: { fontWeight: '700' },
  muted: { color: colors.muted },
  tnum: { fontVariant: ['tabular-nums'] },
});
