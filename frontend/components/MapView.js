'use client';
import { useState } from 'react';
import { amapEnabled } from '@/lib/amap';
import AmapView from './AmapView';
import LeafletView from './LeafletView';

/**
 * Map used across the app. Uses AMap when NEXT_PUBLIC_AMAP_KEY is set and
 * falls back to OpenStreetMap (Leaflet) if there is no key or AMap fails.
 *
 * markers: [{ lat, lng, kind, text, popup }]
 * lines:   [{ points: [...] } or { from, to }, kind: route | walk ]
 * circles: [{ lat, lng, radiusKm }]
 * fitKey:  change it to re-fit the view to all markers
 */
export default function MapView(props) {
  const [amapFailed, setAmapFailed] = useState(false);
  if (amapEnabled() && !amapFailed) return <AmapView {...props} onFail={() => setAmapFailed(true)} />;
  return <LeafletView {...props} />;
}
