'use client';
import { useState } from 'react';
import { amapEnabled } from '@/lib/amap';
import { maptilerEnabled } from '@/lib/maptiler';
import AmapView from './AmapView';
import LeafletView from './LeafletView';

/**
 * Map used across the app. Provider order:
 *   1. MapTiler tiles (NEXT_PUBLIC_MAPTILER_KEY) on Leaflet
 *   2. AMap (NEXT_PUBLIC_AMAP_KEY), falling back to OpenStreetMap if it fails
 *   3. OpenStreetMap tiles on Leaflet
 *
 * markers: [{ lat, lng, kind, text, popup }]
 * lines:   [{ points: [...] } or { from, to }, kind: route | walk ]
 * circles: [{ lat, lng, radiusKm }]
 * fitKey:  change it to re-fit the view to all markers
 */
export default function MapView(props) {
  const [amapFailed, setAmapFailed] = useState(false);
  if (!maptilerEnabled() && amapEnabled() && !amapFailed) return <AmapView {...props} onFail={() => setAmapFailed(true)} />;
  return <LeafletView {...props} />;
}
