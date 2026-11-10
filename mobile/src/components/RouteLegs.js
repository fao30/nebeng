import React from 'react';
import { Text, View } from 'react-native';
import { colors, t } from '../theme';
import { shortPlace } from '../format';
import { fmtKm, fmtMin } from '../routing';
import { Card, Row } from '../ui';

const SOURCE = {
  google: 'Google Maps, memperhitungkan lalu lintas',
  osm: 'OpenStreetMap, ditambah perkiraan macet',
};

/** Total and per-leg (A→B, B→C, …) road distance and driving time. */
export default function RouteLegs({ points, road, title = 'Jarak dan waktu tempuh' }) {
  if (!road || !points || points.length < 2) return null;
  const totalKm = road.legs.reduce((a, l) => a + l.km, 0);
  const totalMin = road.legs.reduce((a, l) => a + l.min, 0);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={t.h3}>{title}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>{fmtMin(totalMin)}</Text>
          <Text style={t.xs}>{fmtKm(totalKm)}</Text>
        </View>
      </Row>
      {road.legs.length > 1 &&
        road.legs.map((l, i) => (
          <Row key={i} gap={8} style={{ backgroundColor: colors.line2, borderRadius: 12, padding: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary }}>
              {String.fromCharCode(65 + i)}→{String.fromCharCode(66 + i)}
            </Text>
            <Text style={[t.small, { flex: 1, fontWeight: '600', color: colors.ink }]} numberOfLines={1}>
              {shortPlace(points[i])} → {shortPlace(points[i + 1])}
            </Text>
            <Text style={t.xs}>{fmtKm(l.km)}</Text>
            <Text style={{ fontWeight: '800', color: colors.ink }}>± {fmtMin(l.min)}</Text>
          </Row>
        ))}
      <Text style={t.xs}>Waktu tempuh dari {SOURCE[road.source] || 'perkiraan'}. Bisa berubah karena macet atau cuaca.</Text>
    </Card>
  );
}
