'use client';
import { useEffect, useRef } from 'react';
import { useLeaflet, DEFAULT_CENTER, pinIcon } from '@/lib/leaflet';

/**
 * markers: [{ lat, lng, kind, text, popup }]
 *   kind: origin | dest | pickup | drop | driver | passenger | request
 * lines:   [{ points: [p1, p2, ...] } or { from, to }, kind ]   kind: route | walk
 * circles: [{ lat, lng, radiusKm }]
 * fitKey:  change it to re-fit the view to all markers
 */
export default function MapView({ markers = [], lines = [], circles = [], onClick, fitKey, height = 320, className = '' }) {
  const L = useLeaflet();
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!L || !el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e) => clickRef.current && clickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, [L]);

  useEffect(() => {
    if (!L || !map.current) return;
    const g = layer.current;
    g.clearLayers();
    circles.forEach((c) => {
      L.circle([c.lat, c.lng], {
        radius: c.radiusKm * 1000,
        color: '#0B5D45',
        weight: 1,
        fillColor: '#0B5D45',
        fillOpacity: 0.07,
      }).addTo(g);
    });
    lines.forEach((ln) => {
      const pts = ln.points || [ln.from, ln.to];
      L.polyline(
        pts.map((p) => [p.lat, p.lng]),
        ln.kind === 'walk'
          ? { color: '#2A2E33', weight: 2, dashArray: '4 6' }
          : { color: '#0B5D45', weight: 5, opacity: 0.85 },
      ).addTo(g);
    });
    markers.forEach((mk) => {
      const m = L.marker([mk.lat, mk.lng], { icon: pinIcon(L, mk.kind, mk.text || '') }).addTo(g);
      if (mk.popup) m.bindPopup(mk.popup);
    });
  });

  useEffect(() => {
    if (!L || !map.current) return;
    const pts = [...markers.map((m) => [m.lat, m.lng])];
    if (pts.length === 1) map.current.setView(pts[0], 13);
    else if (pts.length > 1) map.current.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, fitKey]);

  return (
    <div className={`map ${className}`} style={{ height }}>
      <div ref={el} style={{ height: '100%', width: '100%' }} />
      {!L && <div className="map-loading">Memuat peta…</div>}
    </div>
  );
}
