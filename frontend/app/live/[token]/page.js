'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtDay, fmtTime, routeOf, shortPlace, tripStatusLabel } from '@/lib/format';
import { useLiveStream } from '@/lib/live';
import MapView from '@/components/MapView';
import { Person } from '@/components/ui';

export default function LivePage() {
  const { token } = useParams();
  const [snap, setSnap] = useState(null);
  const [err, setErr] = useState('');
  const live = useLiveStream(token);
  const [, tick] = useState(0);

  useEffect(() => {
    api(`/live/${token}`)
      .then(setSnap)
      .catch((e) => setErr(e.message));
    const t = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, [token]);

  if (err) return <p className="error">{err}</p>;
  if (!snap) return <p className="muted">Menghubungkan…</p>;

  const status = live.status || snap.trip.status;
  const positions = live.positions.length ? live.positions : snap.positions;
  const driver = positions.find((p) => p.role === 'driver');
  const ago = driver ? Math.round((Date.now() - new Date(driver.at).getTime()) / 60000) : null;

  const markers = [
    { ...snap.trip.origin, kind: 'origin', popup: snap.trip.origin.label },
    ...(snap.trip.stops || []).map((s) => ({ ...s, kind: 'stop', popup: s.label })),
    { ...snap.trip.destination, kind: 'dest', popup: snap.trip.destination.label },
    ...snap.stops.map((s) => ({ ...s.pickup, kind: 'pickup', text: s.name[0], popup: `Jemput ${s.name}` })),
    ...positions.map((p) => ({ lat: p.lat, lng: p.lng, kind: p.role, text: p.role === 'driver' ? '' : p.name[0], popup: `${p.name}, ${fmtTime(p.at)}` })),
  ];

  return (
    <div className="live-page">
      <MapView
        markers={markers}
        lines={[{ points: routeOf(snap.trip), kind: 'route' }]}
        fitKey={driver ? 'driver' : 'none'}
        height="100%"
        className="map-full"
      />
      <div className="live-card stack">
        <div className="row-between">
          <div className="row" style={{ '--gap': '8px' }}>
            <span className={`live-dot ${live.connected && status === 'ongoing' ? 'on' : ''}`} aria-hidden />
            <b>{tripStatusLabel[status]}</b>
          </div>
          <span className="xs muted">
            {driver ? (ago < 1 ? 'Posisi baru saja diperbarui' : `Posisi ${ago} menit lalu`) : 'Menunggu posisi driver'}
          </span>
        </div>
        <h2>
          {shortPlace(snap.trip.origin)} ke {shortPlace(snap.trip.destination)}
        </h2>
        <p className="small muted">
          Jadwal {fmtDay(snap.trip.depart_at)}, {fmtTime(snap.trip.depart_at)}
        </p>
        <div className="row-between">
          <Person user={snap.driver} sub={snap.trip.vehicle} />
          {snap.trip.plate && <span className="plate">{snap.trip.plate}</span>}
        </div>
        {status === 'completed' && <p className="small ok">Trip sudah selesai. Live location berhenti.</p>}
      </div>
    </div>
  );
}
