'use client';
import { useEffect, useRef, useState } from 'react';
import { API_URL, api } from './api';

/** Subscribe to a trip's live positions through Server-Sent Events. */
export function useLiveStream(shareToken) {
  const [positions, setPositions] = useState({});
  const [status, setStatus] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    const es = new EventSource(`${API_URL}/api/live/${shareToken}/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'snapshot') {
        const next = {};
        (msg.positions || []).forEach((p) => (next[p.user_id] = p));
        setPositions(next);
      } else if (msg.type === 'position') {
        setPositions((prev) => ({ ...prev, [msg.position.user_id]: msg.position }));
      } else if (msg.type === 'status') {
        setStatus(msg.status);
      }
    };
    return () => es.close();
  }, [shareToken]);

  return { positions: Object.values(positions), status, connected };
}

/** Send this device's GPS position for a trip while `enabled` is true. */
export function useBroadcastLocation(tripId, enabled) {
  const [state, setState] = useState({ sending: false, error: '', last: null });
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled || !tripId) {
      setState((s) => ({ ...s, sending: false }));
      return;
    }
    if (!navigator.geolocation) {
      setState({ sending: false, error: 'Browser tidak mendukung GPS.', last: null });
      return;
    }
    setState((s) => ({ ...s, sending: true, error: '' }));
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 3000) return; // throttle
        lastSent.current = now;
        const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
        try {
          await api(`/trips/${tripId}/location`, {
            method: 'POST',
            body: { lat, lng, heading: heading || 0, speed: speed ? speed * 3.6 : 0 },
          });
          setState({ sending: true, error: '', last: new Date() });
        } catch (e) {
          setState((s) => ({ ...s, error: e.message }));
        }
      },
      (e) => setState({ sending: false, error: e.code === 1 ? 'Izin lokasi ditolak di browser.' : 'GPS tidak tersedia.', last: null }),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [tripId, enabled]);

  return state;
}
