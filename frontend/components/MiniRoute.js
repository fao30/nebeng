/**
 * Small route thumbnail like a mini map: the real shape of the route (points
 * normalised into the box), navy start, teal end, white stops.
 */
export default function MiniRoute({ points = [], size = 88, from, to }) {
  const pts = points.filter(Boolean);
  if (pts.length < 2) return null;
  const pad = 12;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = Math.max(maxLat - minLat, maxLng - minLng) || 1;
  const xy = (p) => [pad + ((p.lng - minLng) / span) * (size - 2 * pad), size - pad - ((p.lat - minLat) / span) * (size - 2 * pad)];
  // Center the shape in the box.
  const raw = pts.map(xy);
  const w = Math.max(...raw.map((c) => c[0])) - Math.min(...raw.map((c) => c[0]));
  const h = Math.max(...raw.map((c) => c[1])) - Math.min(...raw.map((c) => c[1]));
  const dx = (size - 2 * pad - w) / 2 - (Math.min(...raw.map((c) => c[0])) - pad);
  const dy = (size - 2 * pad - h) / 2 - (Math.min(...raw.map((c) => c[1])) - pad);
  const c = raw.map(([x, y]) => [x + dx, y + dy]);
  const d = c.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const hi = from != null ? c.slice(from, (to ?? c.length - 1) + 1) : null;
  return (
    <svg className="mini-route" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <rect width={size} height={size} rx="14" fill="#ebf1ff" />
      <g stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.9">
        <path d={`M0 ${size * 0.35} L${size} ${size * 0.3}`} />
        <path d={`M${size * 0.62} 0 L${size * 0.58} ${size}`} />
      </g>
      <path d={d} fill="none" stroke={hi ? '#b8ccfb' : '#155dfc'} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      {hi && hi.length > 1 && (
        <path d={hi.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} fill="none" stroke="#155dfc" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {c.slice(1, -1).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="#fff" stroke="#155dfc" strokeWidth="1.6" />
      ))}
      <circle cx={c[0][0]} cy={c[0][1]} r="4.5" fill="#155dfc" />
      <circle cx={c[c.length - 1][0]} cy={c[c.length - 1][1]} r="4.5" fill="#f9ff52" stroke="#0b1736" strokeWidth="2" />
    </svg>
  );
}
