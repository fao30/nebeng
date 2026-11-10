'use client';
import { useEffect, useState } from 'react';
import { amapEnabled } from '@/lib/amap';
import { maptilerEnabled } from '@/lib/maptiler';
import { googleEnabled, onGoogleFail } from '@/lib/gmaps';
import AmapView from './AmapView';
import GoogleMapView from './GoogleMapView';
import LeafletView from './LeafletView';

/**
 * Map used across the app. Provider order:
 *   1. Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_KEY)
 *   2. MapTiler tiles on Leaflet (NEXT_PUBLIC_MAPTILER_KEY)
 *   3. AMap (NEXT_PUBLIC_AMAP_KEY)
 *   4. OpenStreetMap tiles on Leaflet
 * A provider that fails to load falls through to the next one.
 *
 * markers: [{ lat, lng, kind, text, popup }]
 * lines:   [{ points: [...] } or { from, to }, kind: route | walk ]
 * circles: [{ lat, lng, radiusKm }]
 * fitKey:  change it to re-fit the view to all markers
 */
export default function MapView(props) {
  const [googleFailed, setGoogleFailed] = useState(false);
  const [amapFailed, setAmapFailed] = useState(false);
  useEffect(() => onGoogleFail(() => setGoogleFailed(true)), []);

  if (googleEnabled() && !googleFailed) return <GoogleMapView {...props} onFail={() => setGoogleFailed(true)} />;
  if (!maptilerEnabled() && amapEnabled() && !amapFailed) return <AmapView {...props} onFail={() => setAmapFailed(true)} />;
  return <LeafletView {...props} />;
}
