'use client';
import { shortPlace } from '@/lib/format';
import { ROUTE_SOURCE_LABEL, fmtKm, fmtMin } from '@/lib/routing';
import Icon from './Icon';

/**
 * Distance and driving time for the whole route and for every leg
 * (A → B, B → C, …), from road routing.
 */
export default function RouteSummary({ points, road, title = 'Jarak dan waktu tempuh' }) {
  if (!points || points.length < 2) return null;
  if (!road) {
    return (
      <div className="route-sum card">
        <div className="section-title">{title}</div>
        <p className="xs muted">Menghitung rute lewat jalan…</p>
      </div>
    );
  }
  const totalKm = road.legs.reduce((a, l) => a + l.km, 0);
  const totalMin = road.legs.reduce((a, l) => a + l.min, 0);
  return (
    <div className="route-sum card">
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          {title}
        </div>
        <div className="route-sum-total">
          <b>{fmtMin(totalMin)}</b>
          <span>{fmtKm(totalKm)}</span>
        </div>
      </div>
      {road.legs.length > 1 && (
        <ol className="route-legs">
          {road.legs.map((l, i) => (
            <li key={i}>
              <span className="route-leg-idx">
                {String.fromCharCode(65 + i)}→{String.fromCharCode(66 + i)}
              </span>
              <span className="route-leg-name">
                {shortPlace(points[i])} <Icon name="chevronRight" className="icon-xs" /> {shortPlace(points[i + 1])}
              </span>
              <span className="route-leg-km">{fmtKm(l.km)}</span>
              <b className="route-leg-min">± {fmtMin(l.min)}</b>
            </li>
          ))}
        </ol>
      )}
      <p className="xs muted" style={{ marginTop: 10 }}>
        Waktu tempuh dari {ROUTE_SOURCE_LABEL[road.source] || ROUTE_SOURCE_LABEL.estimate}. Bisa berubah karena macet atau cuaca.
      </p>
    </div>
  );
}
