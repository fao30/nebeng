'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtTime, shortPlace } from '@/lib/format';
import Icon from './Icon';
import { Sheet } from './ui';

/* ---------- boarding code ---------- */

/**
 * Accepted booking, before and during the ride. The passenger shows a 4-digit
 * code; the driver types it in, so both sides know the passenger is in the car.
 * Then the driver marks the passenger as dropped off.
 */
export function BoardingPanel({ booking: b, role, onChange }) {
  const [code, setCode] = useState('');
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const tripOpen = b.trip.status === 'scheduled' || b.trip.status === 'ongoing';
  if (b.status !== 'accepted') return null;

  async function run(fn) {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const showCode = (renew) => run(async () => setCode((await api(`/bookings/${b.id}/boarding-code`, { method: 'POST', body: { renew } })).code));
  const board = () =>
    run(async () => {
      const updated = await api(`/bookings/${b.id}/board`, { method: 'POST', body: { code: entry } });
      setEntry('');
      onChange?.(updated);
    });
  const drop = () =>
    run(async () => {
      if (!confirm(`Tandai ${b.passenger.name} sudah turun di ${shortPlace(b.dropoff)}?`)) return;
      onChange?.(await api(`/bookings/${b.id}/dropoff`, { method: 'POST' }));
    });

  if (b.dropped_at)
    return (
      <div className="board board-done">
        <Icon name="flag" className="icon-sm" />
        <span>
          Naik {fmtTime(b.boarded_at)}, turun {fmtTime(b.dropped_at)} di {shortPlace(b.dropoff)}
        </span>
      </div>
    );

  if (b.boarded_at)
    return (
      <div className="board board-in">
        <div className="row" style={{ '--gap': '8px' }}>
          <span className="board-check">
            <Icon name="check" className="icon-sm" />
          </span>
          <div className="grow">
            <b>{role === 'driver' ? `${b.passenger.name} sudah naik` : 'Anda sudah naik'}</b>
            <div className="xs muted">
              Kode cocok pukul {fmtTime(b.boarded_at)} · turun di {shortPlace(b.dropoff)}
            </div>
          </div>
        </div>
        {role === 'driver' && b.trip.status === 'ongoing' && (
          <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={drop}>
            <Icon name="flag" className="icon-sm" />
            Sudah sampai, turunkan {b.passenger.name.split(' ')[0]}
          </button>
        )}
        {err && <p className="error">{err}</p>}
      </div>
    );

  if (!tripOpen) return null;

  return role === 'passenger' ? (
    <div className="board">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <b>Kode naik</b>
          <div className="xs muted">Tunjukkan ke pemilik mobil saat masuk mobil. Pemilik mobil memasukkan kode ini supaya kalian berdua tahu Anda sudah naik.</div>
        </div>
      </div>
      {code ? (
        <>
          <div className="board-code tnum" aria-label={`Kode naik ${code.split('').join(' ')}`}>
            {code.split('').map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          <button className="link small" disabled={busy} onClick={() => showCode(true)}>
            Buat kode baru
          </button>
        </>
      ) : (
        <button className="btn btn-primary btn-sm btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={() => showCode(false)}>
          <Icon name="shield" className="icon-sm" />
          Tampilkan kode naik
        </button>
      )}
      {err && <p className="error">{err}</p>}
    </div>
  ) : (
    <div className="board">
      <b>Konfirmasi {b.passenger.name.split(' ')[0]} naik</b>
      <div className="xs muted">Minta penumpang menunjukkan kode naik 4 angka dari aplikasinya, lalu masukkan di sini.</div>
      <form
        className="board-entry"
        onSubmit={(e) => {
          e.preventDefault();
          if (entry.length === 4) board();
        }}
      >
        <input
          className="input tnum"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={entry}
          onChange={(e) => setEntry(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="0000"
          aria-label={`Kode naik dari ${b.passenger.name}`}
        />
        <button className="btn btn-primary btn-sm" disabled={busy || entry.length !== 4}>
          Konfirmasi naik
        </button>
      </form>
      {err && <p className="error">{err}</p>}
    </div>
  );
}

/* ---------- ratings ---------- */

const TAGS = {
  driver: ['Tepat waktu', 'Mengemudi aman', 'Ramah', 'Mobil bersih', 'Sesuai rute'],
  passenger: ['Tepat waktu', 'Ramah', 'Sopan', 'Bayar sesuai', 'Barang rapi'],
};
const STAR_WORDS = ['', 'Buruk', 'Kurang', 'Cukup', 'Baik', 'Luar biasa'];

export function Stars({ value, onChange, size = 'lg' }) {
  return (
    <div className={`stars stars-${size}`} role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? 'Rating' : `${value} dari 5 bintang`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} bintang`} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>
            ★
          </button>
        ) : (
          <span key={n} className={n <= value ? 'on' : ''}>
            ★
          </span>
        ),
      )}
    </div>
  );
}

/** Rate the other side of a booking. `toRole` is who is being rated. */
export function RatingSheet({ booking: b, toRole, open, onClose, onDone }) {
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
      const updated = await api(`/bookings/${b.id}/rating`, { method: 'POST', body: { stars, tags, comment } });
      onDone?.(updated);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const toggle = (t) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Beri rating ${toRole === 'driver' ? 'pemilik mobil' : 'penumpang'}`}
      footer={
        <button className="btn btn-primary btn-block" disabled={!stars || busy} onClick={submit}>
          Kirim rating
        </button>
      }
    >
      <div className="stack" style={{ '--gap': '16px', textAlign: 'center' }}>
        <div>
          <b>{other?.name}</b>
          <div className="xs muted">
            {shortPlace(b.pickup)} ke {shortPlace(b.dropoff)}
          </div>
        </div>
        <Stars value={stars} onChange={setStars} />
        <div className="small strong" style={{ minHeight: 20 }}>
          {STAR_WORDS[stars]}
        </div>
        {stars > 0 && (
          <div className="tag-pick">
            {TAGS[toRole].map((t) => (
              <button key={t} type="button" aria-pressed={tags.includes(t)} onClick={() => toggle(t)}>
                {t}
              </button>
            ))}
          </div>
        )}
        <label className="field" style={{ textAlign: 'left' }}>
          <span className="field-label">Komentar (opsional)</span>
          <textarea className="input" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ceritakan perjalanan Anda" />
        </label>
        <p className="xs muted" style={{ textAlign: 'left' }}>
          Rating tampil di profil {toRole === 'driver' ? 'pemilik mobil' : 'penumpang'} tanpa nama lengkap Anda.
        </p>
        {err && <p className="error">{err}</p>}
      </div>
    </Sheet>
  );
}

/* ---------- reports ---------- */

const REPORT_REASONS = {
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

/** Report the other side of a booking to the admins. */
export function ReportSheet({ booking: b, targetRole, open, onClose }) {
  const [cat, setCat] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const other = targetRole === 'driver' ? b.driver : b.passenger;
  const reasons = [...REPORT_REASONS[targetRole], ...REPORT_REASONS.both];

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
  function close() {
    onClose();
    setTimeout(() => {
      setSent(false);
      setCat('');
      setText('');
    }, 200);
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={`Laporkan ${targetRole === 'driver' ? 'pemilik mobil' : 'penumpang'}`}
      footer={
        sent ? (
          <button className="btn btn-block" onClick={close}>
            Tutup
          </button>
        ) : (
          <button className="btn btn-danger-solid btn-block" disabled={!cat || busy || (cat === 'other' && !text.trim())} onClick={submit}>
            Kirim laporan ke admin
          </button>
        )
      }
    >
      {sent ? (
        <div className="empty" style={{ padding: '24px 8px' }}>
          <Icon name="shield" />
          <h3>Laporan terkirim</h3>
          <p>Admin Numpang akan meninjau laporan Anda. Kabar tindak lanjutnya muncul di notifikasi. Jika Anda dalam bahaya, hubungi 112.</p>
        </div>
      ) : (
        <div className="stack" style={{ '--gap': '14px' }}>
          <p className="small ink2">
            Tentang <b>{other?.name}</b>. Laporan hanya dibaca admin, tidak dikirim ke {targetRole === 'driver' ? 'pemilik mobil' : 'penumpang'}.
          </p>
          <div className="reason-list" role="radiogroup" aria-label="Alasan laporan">
            {reasons.map(([k, label]) => (
              <label key={k} className={`reason ${cat === k ? 'on' : ''}`}>
                <input type="radio" name="reason" value={k} checked={cat === k} onChange={() => setCat(k)} />
                {label}
              </label>
            ))}
          </div>
          <label className="field">
            <span className="field-label">Ceritakan apa yang terjadi {cat === 'other' ? '' : '(opsional)'}</span>
            <textarea className="input" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Kapan, di mana, dan apa yang terjadi" />
          </label>
          {err && <p className="error">{err}</p>}
        </div>
      )}
    </Sheet>
  );
}
