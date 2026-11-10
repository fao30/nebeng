'use client';
import { useEffect, useRef, useState } from 'react';
import { loadAMap } from '@/lib/amap';
import { DEFAULT_CENTER } from '@/lib/leaflet';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** AMap implementation of MapView. Same props as LeafletView, plus onFail. */
export default function AmapView({ markers = [], lines = [], circles = [], onClick, fitKey, height = 320, className = '', onFail }) {
  const el = useRef(null);
  const map = useRef(null);
  const overlays = useRef([]);
  const pins = useRef([]);
  const info = useRef(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAMap()
      .then((AMap) => {
        if (cancelled || !el.current || map.current) return;
        const m = new AMap.Map(el.current, {
          zoom: 9,
          center: [DEFAULT_CENTER[1], DEFAULT_CENTER[0]], // AMap uses [lng, lat]
          showOversea: true,
          viewMode: '2D',
        });
        m.on('click', (e) => clickRef.current && clickRef.current({ lat: e.lnglat.getLat(), lng: e.lnglat.getLng() }));
        info.current = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -16) });
        map.current = m;
        setReady(true);
      })
      .catch(() => !cancelled && onFail && onFail());
    return () => {
      cancelled = true;
      if (map.current) {
        map.current.destroy();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw overlays on every render (cheap at this app's scale).
  useEffect(() => {
    const AMap = typeof window !== 'undefined' && window.AMap;
    const m = map.current;
    if (!ready || !AMap || !m) return;
    if (overlays.current.length) m.remove(overlays.current);
    const next = [];
    const nextPins = [];
    circles.forEach((c) => {
      next.push(
        new AMap.Circle({
          center: [c.lng, c.lat],
          radius: c.radiusKm * 1000,
          strokeColor: '#155DFC',
          strokeWeight: 1,
          strokeOpacity: 0.6,
          fillColor: '#155DFC',
          fillOpacity: 0.07,
          bubble: true,
        }),
      );
    });
    lines.forEach((ln) => {
      const pts = (ln.points || [ln.from, ln.to]).filter(Boolean);
      if (pts.length < 2) return;
      const walk = ln.kind === 'walk';
      next.push(
        new AMap.Polyline({
          path: pts.map((p) => [p.lng, p.lat]),
          strokeColor: walk ? '#0B1736' : '#155DFC',
          strokeWeight: walk ? 2 : 5,
          strokeOpacity: walk ? 0.8 : 0.85,
          strokeStyle: walk ? 'dashed' : 'solid',
          strokeDasharray: walk ? [4, 6] : undefined,
          lineJoin: 'round',
          lineCap: 'round',
          bubble: true,
        }),
      );
    });
    markers.forEach((mk) => {
      const marker = new AMap.Marker({
        position: [mk.lng, mk.lat],
        content: `<div class="pin pin-${esc(mk.kind)}">${esc(mk.text || '')}</div>`,
        anchor: 'center',
        offset: new AMap.Pixel(0, 0),
        title: mk.popup || '',
        zIndex: mk.kind === 'driver' ? 200 : 110,
      });
      if (mk.popup) {
        marker.on('click', () => {
          info.current.setContent(`<div class="amap-pop">${esc(mk.popup)}</div>`);
          info.current.open(m, [mk.lng, mk.lat]);
        });
      }
      next.push(marker);
      nextPins.push(marker);
    });
    m.add(next);
    overlays.current = next;
    pins.current = nextPins;
  });

  // Fit to markers only when fitKey changes, so live updates don't jump the view.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    if (markers.length === 1) m.setZoomAndCenter(13, [markers[0].lng, markers[0].lat]);
    else if (pins.current.length > 1) m.setFitView(pins.current, false, [48, 48, 48, 48], 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  return (
    <div className={`map ${className}`} style={{ height }}>
      <div ref={el} style={{ height: '100%', width: '100%' }} />
      {!ready && <div className="map-loading">Memuat peta…</div>}
    </div>
  );
}
