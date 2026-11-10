import React, { useEffect, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { ANDROID_MAPS } from '../config';
import { colors, t } from '../theme';
import { routeOf } from '../format';

/**
 * Route of a trip with its points and, while the trip runs, live positions.
 * iOS uses Apple Maps (no key). Android needs a Google Maps key first.
 */
export default function TripMap({ trip, live = [], highlight, height = 220, path }) {
  const ref = useRef(null);
  const pts = routeOf(trip);
  const coords = pts.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  useEffect(() => {
    const id = setTimeout(() => ref.current?.fitToCoordinates(coords, { edgePadding: { top: 40, bottom: 40, left: 40, right: 40 }, animated: false }), 400);
    return () => clearTimeout(id);
  }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS === 'android' && !ANDROID_MAPS)
    return (
      <View style={{ height: 64, borderRadius: 16, backgroundColor: colors.line2, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <Text style={[t.xs, { textAlign: 'center' }]}>Peta di Android aktif setelah Google Maps API key Android dipasang.</Text>
      </View>
    );

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={{ latitude: coords[0].latitude, longitude: coords[0].longitude, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
        showsUserLocation
        toolbarEnabled={false}
      >
        <Polyline coordinates={path?.length > 1 ? path.map((p) => ({ latitude: p.lat, longitude: p.lng })) : coords} strokeColor={colors.primary} strokeWidth={4} />
        {pts.map((p, i) => (
          <Marker
            key={i}
            coordinate={coords[i]}
            title={p.label}
            description={p.note || undefined}
            pinColor={highlight && (i === highlight[0] || i === highlight[1]) ? colors.primary : i === 0 || i === pts.length - 1 ? colors.ink : colors.amber}
          />
        ))}
        {live.map((p) => (
          <Marker key={p.user_id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.name} pinColor={p.role === 'driver' ? colors.mint : '#2a7de1'} />
        ))}
      </MapView>
    </View>
  );
}
