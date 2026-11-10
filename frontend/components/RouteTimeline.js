import { fmtTime, routeOf, shortPlace } from '@/lib/format';

/**
 * Vertical route with times. With a `quote` (the passenger's part of the
 * route), the passenger's own pickup/drop-off points are inserted and the
 * stretch they ride is highlighted; the rest is muted.
 *
 * Props: trip (with etas), quote?, pickup?, dropoff?, compact (only show the
 * passenger's two points).
 */
export default function RouteTimeline({ trip, quote, pickup, dropoff, compact = false }) {
  const pts = routeOf(trip);
  const etas = trip.etas || [];
  let rows = pts.map((p, i) => ({
    pos: i,
    label: p.label,
    time: etas[i] || (i === 0 ? trip.depart_at : null),
    kind: i === 0 ? 'origin' : i === pts.length - 1 ? 'dest' : 'stop',
    sub: i === 0 ? 'Berangkat' : i === pts.length - 1 ? 'Tujuan akhir' : 'Titik stop',
  }));

  if (quote) {
    const from = quote.from_pos;
    const to = quote.to_pos;
    const near = (a, b) => Math.abs(a - b) < 0.03;
    const pickRow = {
      pos: from,
      label: pickup?.label || rows.find((r) => near(r.pos, from))?.label || 'Titik jemput Anda',
      time: quote.pickup_at,
      kind: 'pickup',
      sub: 'Naik di sini',
    };
    const dropRow = {
      pos: to,
      label: dropoff?.label || rows.find((r) => near(r.pos, to))?.label || 'Titik antar Anda',
      time: quote.dropoff_at,
      kind: 'drop',
      sub: 'Turun di sini',
    };
    rows = rows.filter((r) => !near(r.pos, from) && !near(r.pos, to));
    rows.push(pickRow, dropRow);
    rows.sort((a, b) => a.pos - b.pos || (a.kind === 'pickup' ? -1 : 1));
    rows.forEach((r) => (r.on = r.pos >= from - 1e-6 && r.pos <= to + 1e-6));
    if (compact) rows = [pickRow, dropRow].map((r) => ({ ...r, on: true }));
  } else {
    rows.forEach((r) => (r.on = true));
    if (compact) rows = [rows[0], rows[rows.length - 1]];
  }

  return (
    <div className="tl">
      {rows.map((r, i) => {
        const prev = rows[i - 1];
        const next = rows[i + 1];
        const up = prev && prev.on && r.on;
        const down = next && next.on && r.on;
        const rail = up && down ? 'on' : down ? 'on-down' : up ? 'on-up' : '';
        const dot = r.kind === 'dest' || r.kind === 'drop' ? 'dot-dest' : r.kind === 'stop' ? 'dot-stop' : '';
        const [head, ...rest] = (r.label || '').split(',');
        return (
          <div key={`${r.kind}-${i}`} style={{ display: 'contents' }} className={`${r.on ? '' : 'tl-off'} ${!next ? 'tl-last' : ''}`}>
            <div className={`tl-time ${r.on ? '' : 'muted'}`}>{r.time ? fmtTime(r.time) : ''}</div>
            <div className={`tl-rail ${rail} ${i === 0 ? 'first' : ''} ${!next ? 'last' : ''} ${r.on ? '' : 'off'}`}>
              <span className={`dot ${dot}`} />
            </div>
            <div className={`tl-body ${!next ? 'tl-last-body' : ''}`} style={!next ? { paddingBottom: 0 } : undefined}>
              <b className={r.on ? '' : 'muted'} style={r.on ? undefined : { fontWeight: 500 }}>
                {head || shortPlace(r)}
              </b>
              {!compact && (
                <span className="xs">
                  {r.kind === 'pickup' || r.kind === 'drop' ? r.sub : rest.join(',').trim() || r.sub}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
