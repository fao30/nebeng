import { StyleSheet } from 'react-native';

// Numpang palette "Electric Blue + Neon Yellow". `teal*` names are kept and now mean the yellow accent;
// yellow never carries white text and gets an ink outline on light surfaces.
export const colors = {
  ink: '#0B1736',
  ink2: '#3A4566',
  muted: '#646E8F',
  line: '#E2E7F5',
  line2: '#EFF3FD',
  canvas: '#F5F7FF',
  surface: '#FFFFFF',
  primary: '#155DFC',
  primary600: '#0F47CF',
  primary50: '#EBF1FF',
  primary100: '#D5E2FF',
  indigo: '#0B1736',
  teal: '#F9FF52',
  tealInk: '#155DFC',
  teal50: '#FBFFC2',
  map: '#E8EEFC',
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
  shadowColor: '#155DFC',
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
