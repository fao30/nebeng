import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import Icon from '../Icon';
import { api } from '../api';
import { colors, t } from '../theme';
import { bookingStatusLabel, bookingStatusTone, fmtDay, fmtRp, fmtTime, shortPlace } from '../format';
import { Button, Card, Chip, ErrorText, Field, LinkText, Person, Row, Sheet, Stars, s } from '../ui';

const wa = (phone) => `https://wa.me/${phone.replace(/^0/, '62').replace(/\D/g, '')}`;

/** A booking: price negotiation, boarding code, drop-off, rating and report. */
export default function BookingCard({ booking: b, role, onChange, navigation, showTrip, openRate }) {
  const last = b.offers[b.offers.length - 1];
  const [price, setPrice] = useState(String(last?.price || ''));
  const [msg, setMsg] = useState('');
  const [countering, setCountering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const otherRole = role === 'driver' ? 'passenger' : 'driver';
  const other = role === 'driver' ? b.passenger : b.driver;
  const myTurn = b.status === 'negotiating' && b.awaiting === role;
  const canCounter = !(role === 'passenger' && b.source === 'passenger_booking' && !b.trip.negotiable);
  const canRate = b.status === 'accepted' && (b.dropped_at || b.trip.status === 'completed');
  const rated = role === 'driver' ? b.rated_by_driver : b.rated_by_passenger;
  const [rating, setRating] = useState(!!openRate && canRate && !rated);
  const [report, setReport] = useState(false);
  const otherName = otherRole === 'driver' ? 'pemilik mobil' : 'penumpang';

  useEffect(() => {
    if (!countering) setPrice(String(last?.price || ''));
  }, [last?.price, b.offers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(action) {
    const run = async () => {
      setBusy(true);
      setErr('');
      try {
        const updated = await api(`/bookings/${b.id}/respond`, { method: 'POST', body: { action, price: Number(price), message: msg } });
        setMsg('');
        setCountering(false);
        onChange?.(updated);
      } catch (e) {
        setErr(e.message);
      } finally {
        setBusy(false);
      }
    };
    if (action === 'cancel') Alert.alert('Batalkan pesanan?', 'Pihak lain akan mendapat notifikasi.', [{ text: 'Tidak' }, { text: 'Batalkan', style: 'destructive', onPress: run }]);
    else run();
  }

  const sub = [role === 'driver' ? 'Penumpang' : 'Pemilik mobil', `${b.seats} orang`, b.luggage ? `${b.luggage} koper` : null].filter(Boolean).join(' · ');
  return (
    <Card style={b.status === 'rejected' || b.status === 'cancelled' ? { opacity: 0.7 } : null}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Person user={other} sub={sub} rating={otherRole} />
        </View>
        <Chip tone={bookingStatusTone[b.status]} label={bookingStatusLabel[b.status]} />
      </Row>

      {showTrip && (
        <Text style={t.small} onPress={() => navigation.navigate('Trip', { id: b.trip_id })}>
          {shortPlace(b.trip.origin)} ke {shortPlace(b.trip.destination)} · {fmtDay(b.trip.depart_at)}
        </Text>
      )}
      <View style={{ gap: 4 }}>
        <Row gap={8}>
          <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: colors.primary }} />
          <Text style={[t.small, { flex: 1 }]} numberOfLines={2}>
            {b.pickup.label}
            {b.pickup.note ? ` · ${b.pickup.note}` : ''}
          </Text>
          {b.pickup_at && <Text style={[t.body, t.strong, t.tnum]}>{fmtTime(b.pickup_at)}</Text>}
        </Row>
        <Row gap={8}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
          <Text style={[t.small, { flex: 1 }]} numberOfLines={2}>
            {b.dropoff.label}
          </Text>
        </Row>
        {role === 'driver' && b.passenger_to && <Text style={t.xs}>Tujuan asli penumpang: {shortPlace(b.passenger_to)}</Text>}
      </View>

      <View style={{ gap: 6 }}>
        {b.offers.map((o, i) => {
          const mine = o.by === role;
          return (
            <View key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: mine ? colors.primary50 : colors.line2, borderRadius: 14, padding: 10 }}>
              <Text style={[t.body, t.strong, t.tnum]}>{fmtRp(o.price)}</Text>
              <Text style={t.xs}>
                {mine ? 'Anda' : o.by === 'driver' ? 'Pemilik mobil' : 'Penumpang'}
                {o.message ? `: ${o.message}` : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {b.status === 'accepted' && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: colors.mint, fontWeight: '800' }}>Disepakati {fmtRp(b.agreed_price)}</Text>
          {other?.phone && <Button small block={false} kind="soft" icon="message" title="WhatsApp" onPress={() => Linking.openURL(wa(other.phone))} />}
        </Row>
      )}
      {b.status === 'negotiating' && !myTurn && <Text style={t.small}>Menunggu jawaban {otherName}.</Text>}

      {myTurn && (
        <View style={{ gap: 8 }}>
          <Row gap={8}>
            <Button small title={`Terima ${fmtRp(last.price)}`} icon="check" busy={busy} onPress={() => act('accept')} style={{ flex: 1 }} />
            {canCounter && <Button small kind="outline" title="Tawar" onPress={() => setCountering(!countering)} block={false} />}
            <Button small kind="dangerGhost" title="Tolak" onPress={() => act('reject')} block={false} />
          </Row>
          {countering && (
            <View style={{ gap: 8 }}>
              <Row gap={8}>
                <TextInput value={price} onChangeText={setPrice} keyboardType="number-pad" style={[s.input, { width: 120 }]} accessibilityLabel="Harga tawaran" />
                <TextInput value={msg} onChangeText={setMsg} placeholder="Pesan (opsional)" placeholderTextColor={colors.muted} style={[s.input, { flex: 1 }]} />
              </Row>
              <Button small title="Kirim tawaran" onPress={() => act('counter')} busy={busy} />
            </View>
          )}
        </View>
      )}

      <BoardingPanel booking={b} role={role} onChange={onChange} />

      {canRate && (rated ? <Text style={{ color: colors.mint, fontWeight: '700' }}>✓ Rating untuk {otherName} terkirim</Text> : <Button small kind="soft" title={`★ Beri rating ${other?.name?.split(' ')[0] || ''}`} onPress={() => setRating(true)} />)}

      <Row style={{ justifyContent: 'space-between' }}>
        {b.status === 'negotiating' || b.status === 'accepted' || b.message_count > 0 ? (
          <Button small block={false} kind="soft" icon="message" title={`Chat${b.message_count ? ` (${b.message_count})` : ''}`} onPress={() => navigation.navigate('Chat', { bookingId: b.id, role, title: other?.name })} />
        ) : (
          <View />
        )}
        <Row gap={16}>
          <LinkText onPress={() => setReport(true)} style={{ color: colors.muted, fontWeight: '600' }}>
            Laporkan
          </LinkText>
          {(b.status === 'accepted' || (b.status === 'negotiating' && !myTurn)) && b.trip.status !== 'completed' && !b.boarded_at && (
            <LinkText danger onPress={() => act('cancel')}>
              Batalkan
            </LinkText>
          )}
        </Row>
      </Row>
      <ErrorText>{err}</ErrorText>
      <RatingSheet booking={b} toRole={otherRole} open={rating} onClose={() => setRating(false)} onDone={onChange} />
      <ReportSheet booking={b} targetRole={otherRole} open={report} onClose={() => setReport(false)} />
    </Card>
  );
}

/* ---------- boarding code ---------- */
function BoardingPanel({ booking: b, role, onChange }) {
  const [code, setCode] = useState('');
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (b.status !== 'accepted') return null;
  const open = b.trip.status === 'scheduled' || b.trip.status === 'ongoing';
  const run = async (fn) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const box = { borderRadius: 14, padding: 14, gap: 8 };

  if (b.dropped_at)
    return (
      <Row style={[box, { backgroundColor: colors.line2 }]}>
        <Icon name="flag" size={16} color={colors.ink2} />
        <Text style={t.small}>
          Naik {fmtTime(b.boarded_at)}, turun {fmtTime(b.dropped_at)} di {shortPlace(b.dropoff)}
        </Text>
      </Row>
    );
  if (b.boarded_at)
    return (
      <View style={[box, { backgroundColor: colors.mint50 }]}>
        <Row>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={16} color="#fff" strokeWidth={3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[t.body, t.strong]}>{role === 'driver' ? `${b.passenger.name} sudah naik` : 'Anda sudah naik'}</Text>
            <Text style={t.xs}>
              Kode cocok pukul {fmtTime(b.boarded_at)} · turun di {shortPlace(b.dropoff)}
            </Text>
          </View>
        </Row>
        {role === 'driver' && b.trip.status === 'ongoing' && (
          <Button
            small
            icon="flag"
            title={`Sudah sampai, turunkan ${b.passenger.name.split(' ')[0]}`}
            busy={busy}
            onPress={() =>
              Alert.alert('Turunkan penumpang?', `${b.passenger.name} turun di ${shortPlace(b.dropoff)}.`, [
                { text: 'Batal' },
                { text: 'Ya, sudah sampai', onPress: () => run(async () => onChange?.(await api(`/bookings/${b.id}/dropoff`, { method: 'POST' }))) },
              ])
            }
          />
        )}
        <ErrorText>{err}</ErrorText>
      </View>
    );
  if (!open) return null;
  if (role === 'passenger')
    return (
      <View style={[box, { backgroundColor: colors.primary50 }]}>
        <Text style={[t.body, t.strong]}>Kode naik</Text>
        <Text style={t.xs}>Tunjukkan ke pemilik mobil saat masuk mobil. Pemilik mobil memasukkan kode ini supaya kalian berdua tahu Anda sudah naik.</Text>
        {code ? (
          <>
            <Row gap={10} style={{ justifyContent: 'center', marginVertical: 6 }}>
              {code.split('').map((c, i) => (
                <View key={i} style={{ width: 54, height: 64, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary100, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 32, fontWeight: '800', color: colors.primary }}>{c}</Text>
                </View>
              ))}
            </Row>
            <LinkText onPress={() => run(async () => setCode((await api(`/bookings/${b.id}/boarding-code`, { method: 'POST', body: { renew: true } })).code))}>Buat kode baru</LinkText>
          </>
        ) : (
          <Button small icon="shield" title="Tampilkan kode naik" busy={busy} onPress={() => run(async () => setCode((await api(`/bookings/${b.id}/boarding-code`, { method: 'POST', body: {} })).code))} />
        )}
        <ErrorText>{err}</ErrorText>
      </View>
    );
  return (
    <View style={[box, { backgroundColor: colors.primary50 }]}>
      <Text style={[t.body, t.strong]}>Konfirmasi {b.passenger.name.split(' ')[0]} naik</Text>
      <Text style={t.xs}>Minta penumpang menunjukkan kode naik 4 angka dari aplikasinya.</Text>
      <Row gap={8}>
        <TextInput
          value={entry}
          onChangeText={(v) => setEntry(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="0000"
          placeholderTextColor={colors.muted}
          style={[s.input, { width: 110, textAlign: 'center', fontSize: 22, fontWeight: '800', letterSpacing: 6, backgroundColor: colors.surface }]}
          accessibilityLabel="Kode naik dari penumpang"
        />
        <Button
          small
          title="Konfirmasi naik"
          busy={busy}
          disabled={entry.length !== 4}
          style={{ flex: 1 }}
          onPress={() =>
            run(async () => {
              const u = await api(`/bookings/${b.id}/board`, { method: 'POST', body: { code: entry } });
              setEntry('');
              onChange?.(u);
            })
          }
        />
      </Row>
      <ErrorText>{err}</ErrorText>
    </View>
  );
}

/* ---------- rating ---------- */
const TAGS = {
  driver: ['Tepat waktu', 'Mengemudi aman', 'Ramah', 'Mobil bersih', 'Sesuai rute'],
  passenger: ['Tepat waktu', 'Ramah', 'Sopan', 'Bayar sesuai', 'Barang rapi'],
};
const WORDS = ['', 'Buruk', 'Kurang', 'Cukup', 'Baik', 'Luar biasa'];

function TagPick({ options, value, onToggle }) {
  return (
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <Pressable key={o} onPress={() => onToggle(o)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.primary50 : colors.surface }}>
            <Text style={{ fontWeight: '600', color: on ? colors.primary : colors.ink2, fontSize: 13.5 }}>{o}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

function RatingSheet({ booking: b, toRole, open, onClose, onDone }) {
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const other = toRole === 'driver' ? b.driver : b.passenger;
  async function submit() {
    setBusy(true);
    setErr('');
    try {
      const u = await api(`/bookings/${b.id}/rating`, { method: 'POST', body: { stars, tags, comment } });
      onDone?.(u);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={`Beri rating ${toRole === 'driver' ? 'pemilik mobil' : 'penumpang'}`} footer={<Button title="Kirim rating" disabled={!stars} busy={busy} onPress={submit} />}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={[t.h3]}>{other?.name}</Text>
        <Text style={t.xs}>
          {shortPlace(b.pickup)} ke {shortPlace(b.dropoff)}
        </Text>
      </View>
      <Stars value={stars} onChange={setStars} />
      <Text style={[t.body, t.strong, { textAlign: 'center', minHeight: 20 }]}>{WORDS[stars]}</Text>
      {stars > 0 && <TagPick options={TAGS[toRole]} value={tags} onToggle={(x) => setTags(tags.includes(x) ? tags.filter((y) => y !== x) : [...tags, x])} />}
      <Field label="Komentar (opsional)" value={comment} onChangeText={setComment} multiline maxLength={500} placeholder="Ceritakan perjalanan Anda" />
      <ErrorText>{err}</ErrorText>
    </Sheet>
  );
}

/* ---------- report ---------- */
const REASONS = {
  driver: [
    ['dangerous_driving', 'Mengemudi berbahaya'],
    ['no_show', 'Tidak datang menjemput'],
    ['different_car', 'Mobil atau pelat berbeda'],
    ['overcharge', 'Minta bayaran lebih'],
    ['wrong_route', 'Tidak sesuai rute / titik'],
  ],
  passenger: [
    ['no_show', 'Tidak datang (no-show)'],
    ['late', 'Terlambat lama'],
    ['payment', 'Tidak membayar / masalah bayar'],
    ['damage', 'Merusak / mengotori mobil'],
  ],
  both: [
    ['rude', 'Perilaku tidak sopan'],
    ['harassment', 'Pelecehan atau ancaman'],
    ['cancel_last', 'Membatalkan mendadak'],
    ['fraud', 'Penipuan / akun palsu'],
    ['other', 'Lainnya'],
  ],
};

function ReportSheet({ booking: b, targetRole, open, onClose }) {
  const [cat, setCat] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const other = targetRole === 'driver' ? b.driver : b.passenger;
  const close = () => {
    onClose();
    setTimeout(() => {
      setSent(false);
      setCat('');
      setText('');
    }, 300);
  };
  async function submit() {
    setBusy(true);
    setErr('');
    try {
      await api(`/bookings/${b.id}/report`, { method: 'POST', body: { category: cat, text } });
      setSent(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open={open}
      onClose={close}
      title={`Laporkan ${targetRole === 'driver' ? 'pemilik mobil' : 'penumpang'}`}
      footer={sent ? <Button kind="outline" title="Tutup" onPress={close} /> : <Button kind="danger" title="Kirim laporan ke admin" busy={busy} disabled={!cat || (cat === 'other' && !text.trim())} onPress={submit} />}
    >
      {sent ? (
        <View style={{ alignItems: 'center', gap: 8, padding: 16 }}>
          <Icon name="shield" size={36} color={colors.primary} />
          <Text style={t.h3}>Laporan terkirim</Text>
          <Text style={[t.small, { textAlign: 'center' }]}>Admin Nebeng akan meninjau laporan Anda. Kabarnya muncul di notifikasi. Jika Anda dalam bahaya, hubungi 112.</Text>
        </View>
      ) : (
        <>
          <Text style={t.small}>
            Tentang <Text style={t.strong}>{other?.name}</Text>. Laporan hanya dibaca admin.
          </Text>
          {[...REASONS[targetRole], ...REASONS.both].map(([k, label]) => (
            <Pressable key={k} onPress={() => setCat(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: cat === k ? colors.red : colors.line, backgroundColor: cat === k ? colors.red50 : colors.surface }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: cat === k ? colors.red : colors.muted, alignItems: 'center', justifyContent: 'center' }}>
                {cat === k && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red }} />}
              </View>
              <Text style={t.body}>{label}</Text>
            </Pressable>
          ))}
          <Field label={`Ceritakan apa yang terjadi${cat === 'other' ? '' : ' (opsional)'}`} value={text} onChangeText={setText} multiline maxLength={2000} />
          <ErrorText>{err}</ErrorText>
        </>
      )}
    </Sheet>
  );
}
