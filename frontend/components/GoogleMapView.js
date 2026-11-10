'use client';
import { useEffect, useRef, useState } from 'react';
import { GOOGLE_MAP_ID, loadGoogle } from '@/lib/gmaps';
import { DEFAULT_CENTER } from '@/lib/leaflet';

function pinElement(kind, text) {
  const el = document.createElement('div');
  el.className = `pin pin-${kind}`;
  el.textContent = text || '';
  return el;
}

/** Google Maps implementation of MapView. Same props as LeafletView, plus onFail. */
export default function GoogleMapView({ markers = [], lines = [], circles = [], onClick, fitKey, height = 320, className = '', onFail }) {
  const el = useRef(null);
  const map = useRef(null);
  const libs = useRef(null);
  const overlays = useRef([]);
  const info = useRef(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogle()
      .then(async (maps) => {
        const [{ Map, Polyline, Circle, InfoWindow }, { AdvancedMarkerElement }, core] = await Promise.all([
          maps.importLibrary('maps'),
          maps.importLibrary('marker'),
          maps.importLibrary('core'),
        ]);
        if (cancelled || !el.current) return;
        const m = new Map(el.current, {
          center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
          zoom: 9,
          mapId: GOOGLE_MAP_ID,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: 'cooperative',
        });
        m.addListener('click', (e) => clickRef.current && e.latLng && clickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
        libs.current = { Polyline, Circle, AdvancedMarkerElement, LatLngBounds: core.LatLngBounds };
        info.current = new InfoWindow();
        map.current = m;
        setReady(true);
      })
      .catch(() => !cancelled && onFail && onFail());
    return () => {
      cancelled = true;
      overlays.current.forEach((o) => (o.setMap ? o.setMap(null) : (o.map = null)));
      overlays.current = [];
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw overlays on every render (cheap at this app's scale).
  useEffect(() => {
    const m = map.current;
    const L = libs.current;
    if (!ready || !m || !L) return;
    overlays.current.forEach((o) => (o.setMap ? o.setMap(null) : (o.map = null)));
    const next = [];
    circles.forEach((c) => {
      next.push(
        new L.Circle({
          map: m,
          center: { lat: c.lat, lng: c.lng },
          radius: c.radiusKm * 1000,
          strokeColor: '#4A2BB0',
          strokeOpacity: 0.6,
          strokeWeight: 1,
          fillColor: '#4A2BB0',
          fillOpacity: 0.07,
          clickable: false,
        }),
      );
    });
    lines.forEach((ln) => {
      const pts = (ln.points || [ln.from, ln.to]).filter(Boolean);
      if (pts.length < 2) return;
      const walk = ln.kind === 'walk';
      next.push(
        new L.Polyline({
          map: m,
          path: pts.map((p) => ({ lat: p.lat, lng: p.lng })),
          clickable: false,
          strokeColor: walk ? '#17142E' : '#4A2BB0',
          strokeOpacity: walk ? 0 : 0.85,
          strokeWeight: walk ? 2 : 5,
          // dashed line for walking/connector segments
          icons: walk ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeWeight: 2, scale: 2 }, offset: '0', repeat: '10px' }] : undefined,
        }),
      );
    });
    markers.forEach((mk) => {
      const marker = new L.AdvancedMarkerElement({
        map: m,
        position: { lat: mk.lat, lng: mk.lng },
        content: pinElement(mk.kind, mk.text),
        title: mk.popup || '',
        zIndex: mk.kind === 'driver' ? 200 : 110,
      });
      if (mk.popup) {
        marker.addListener('click', () => {
          info.current.setContent(Object.assign(document.createElement('div'), { className: 'amap-pop', textContent: mk.popup }));
          info.current.open({ map: m, anchor: marker });
        });
      }
      next.push(marker);
    });
    overlays.current = next;
  });

  // Fit to markers only when fitKey changes, so live updates don't jump the view.
  useEffect(() => {
    const m = map.current;
    const L = libs.current;
    if (!ready || !m || !L) return;
    if (markers.length === 1) {
      m.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      m.setZoom(13);
    } else if (markers.length > 1) {
      const b = new L.LatLngBounds();
      markers.forEach((mk) => b.extend({ lat: mk.lat, lng: mk.lng }));
      m.fitBounds(b, 48);
      // don't zoom in closer than street level
      const once = m.addListener('idle', () => {
        if (m.getZoom() > 15) m.setZoom(15);
        once.remove();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  return (
    <div className={`map ${className}`} style={{ height }}>
      <div ref={el} style={{ height: '100%', width: '100%' }} />
      {!ready && <div className="map-loading">Memuat peta…</div>}
    </div>
  );
}
