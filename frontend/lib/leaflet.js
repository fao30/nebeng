'use client';
import { useEffect, useState } from 'react';

// Leaflet is loaded from a CDN so the app has no map dependency to install.
let loading = null;

function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => resolve(window.L);
    s.onerror = () => {
      loading = null;
      reject(new Error('Peta gagal dimuat'));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export function useLeaflet() {
  const [L, setL] = useState(typeof window !== 'undefined' ? window.L || null : null);
  useEffect(() => {
    if (!L) loadLeaflet().then(setL).catch(() => {});
  }, [L]);
  return L;
}

export const DEFAULT_CENTER = [-6.6, 107.0]; // Jawa Barat

export function pinIcon(L, kind, text = '') {
  return L.divIcon({
    className: '',
    html: `<div class="pin pin-${kind}">${text}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
