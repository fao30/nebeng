import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Small route thumbnail: the real shape of the route, navy start, teal end. */
export default function MiniRoute({ points = [], size = 80, from, to }) {
  const pts = points.filter(Boolean);
  if (pts.length < 2) return null;
  const pad = 11;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const minLng = Math.min(...lngs);
  const span = Math.max(Math.max(...lats) - minLat, Math.max(...lngs) - minLng) || 1;
  const raw = pts.map((p) => [pad + ((p.lng - minLng) / span) * (size - 2 * pad), size - pad - ((p.lat - minLat) / span) * (size - 2 * pad)]);
  const xs = raw.map((c) => c[0]);
  const ys = raw.map((c) => c[1]);
  const dx = (size - 2 * pad - (Math.max(...xs) - Math.min(...xs))) / 2 - (Math.min(...xs) - pad);
  const dy = (size - 2 * pad - (Math.max(...ys) - Math.min(...ys))) / 2 - (Math.min(...ys) - pad);
  const c = raw.map(([x, y]) => [x + dx, y + dy]);
  const line = (arr) => arr.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const hi = from != null ? c.slice(from, (to ?? c.length - 1) + 1) : null;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect width={size} height={size} rx={13} fill="#EBF1FF" />
      <Path d={`M0 ${size * 0.35} L${size} ${size * 0.3}`} stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" />
      <Path d={`M${size * 0.62} 0 L${size * 0.58} ${size}`} stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" />
      <Path d={line(c)} fill="none" stroke={hi ? '#B8CCFB' : '#155DFC'} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      {hi && hi.length > 1 && <Path d={line(hi)} fill="none" stroke="#155DFC" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
      {c.slice(1, -1).map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={2.6} fill="#FFFFFF" stroke="#155DFC" strokeWidth={1.6} />
      ))}
      <Circle cx={c[0][0]} cy={c[0][1]} r={4.5} fill="#155DFC" />
      <Circle cx={c[c.length - 1][0]} cy={c[c.length - 1][1]} r={4.5} fill="#F9FF52" stroke="#0B1736" strokeWidth={2} />
    </Svg>
  );
}
