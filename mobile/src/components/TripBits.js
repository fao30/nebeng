import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from '../Icon';
import { colors, t } from '../theme';
import { fmtDuration, fmtRp, fmtTime, km, routeOf, shortPlace, tripStatusLabel } from '../format';
import { Card, Chip, Person, Row } from '../ui';

/** Vertical route with times; `from`/`to` mark where this passenger boards and leaves. */
export function RouteTimeline({ trip, from, to, compact }) {
  const pts = routeOf(trip);
  const etas = trip.etas || [];
  const show = compact && from != null ? [from, to] : pts.map((_, i) => i);
  return (
    <View>
      {show.map((i, k) => {
        const p = pts[i];
        const active = from == null || (i >= from && i <= to);
        const edge = i === from || i === to;
        const last = k === show.length - 1;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
            <Text style={[t.body, t.strong, t.tnum, { width: 46, color: active ? colors.ink : colors.muted }]}>{etas[i] ? fmtTime(etas[i]) : ''}</Text>
            <View style={{ alignItems: 'center', width: 14 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  marginTop: 4,
                  backgroundColor: i === pts.length - 1 || i === to ? colors.primary : colors.surface,
                  borderWidth: 3,
                  borderColor: active ? colors.primary : colors.line,
                }}
              />
              {!last && <View style={{ width: 2, flex: 1, minHeight: compact ? 18 : 24, backgroundColor: active && i < (to ?? pts.length) ? colors.primary : colors.line }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : 12 }}>
              <Text style={[t.body, edge && t.strong, !active && { color: colors.muted }]} numberOfLines={compact ? 1 : 2}>
                {compact ? shortPlace(p) : p.label}
              </Text>
              {!compact && p.note ? (
                <Row gap={4}>
                  <Icon name="flag" size={12} color={colors.muted} />
                  <Text style={t.xs}>{p.note}</Text>
                </Row>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function TripCard({ trip, onPress, radius, showStatus }) {
  const q = trip.quote;
  const price = q ? q.price_per_seat : trip.price_per_seat;
  const seats = q ? q.seats_available : trip.seats_available;
  const dur = q ? new Date(q.dropoff_at) - new Date(q.pickup_at) : null;
  return (
    <Card onPress={onPress}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <RouteTimeline trip={trip} from={q?.pickup_index} to={q?.dropoff_index} compact />
          {dur != null && <Text style={[t.xs, { marginLeft: 72, marginTop: 4 }]}>{fmtDuration(dur)} perjalanan</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[t.h3, t.tnum, { fontSize: 18 }]}>{fmtRp(price)}</Text>
          <Text style={t.xs}>per kursi</Text>
          {showStatus && trip.status !== 'scheduled' && <Chip label={tripStatusLabel[trip.status]} />}
        </View>
      </Row>
      {q && (q.pickup_walk_km != null || q.dropoff_walk_km != null) && (
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {q.pickup_walk_km != null && <Chip tone={radius?.from != null && q.pickup_walk_km > radius.from ? 'amber' : 'muted'} label={`Naik ${km(q.pickup_walk_km)} dari titik Anda`} />}
          {q.dropoff_walk_km != null && <Chip tone={radius?.to != null && q.dropoff_walk_km > radius.to ? 'amber' : 'muted'} label={`Turun ${km(q.dropoff_walk_km)} dari tujuan`} />}
        </Row>
      )}
      <View style={{ height: 1, backgroundColor: colors.line2 }} />
      <Row>
        <View style={{ flex: 1 }}>
          <Person user={trip.driver} sub={trip.vehicle || 'Kendaraan belum diisi'} rating="driver" size={34} />
        </View>
        {trip.instant_booking && <Icon name="bolt" size={16} color={colors.primary} />}
        <Chip tone="primary" icon="users" label={`${seats} kursi`} />
      </Row>
    </Card>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 8, marginBottom: 4 }}>
      <Text style={[t.xs, { fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }]}>{children}</Text>
      {action}
    </Row>
  );
}

export function ListItem({ icon, title, sub, onPress, right }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, pressed && { opacity: 0.7 }]}>
      {icon && <Icon name={icon} color={colors.ink2} />}
      <View style={{ flex: 1 }}>
        <Text style={[t.body, t.strong]}>{title}</Text>
        {sub ? <Text style={t.xs}>{sub}</Text> : null}
      </View>
      {right || (onPress && <Icon name="chevronRight" size={18} color={colors.muted} />)}
    </Pressable>
  );
}
