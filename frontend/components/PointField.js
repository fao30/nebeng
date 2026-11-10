'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { geocode, reverseGeocode } from '@/lib/api';

/**
 * Place picker: type to get suggestions, use current location, or (when the
 * parent passes `active`/`onActivate`) click the map to fill it.
 */
export default function PointField({ label, value, onChange, active, onActivate, kind = 'origin', placeholder, compact }) {
  const [editing, setEditing] = useState(!value);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const wrap = useRef(null);
  const input = useRef(null);
  const timer = useRef(null);

  useEffect(() => setEditing(!value), [value]);

  useEffect(() => {
    const close = (e) => wrap.current && !wrap.current.contains(e.target) && setResults([]);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function onType(v) {
    setQ(v);
    setErr('');
    clearTimeout(timer.current);
    if (v.trim().length < 3) return setResults([]);
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await geocode(v.trim());
        setResults(r);
        if (!r.length) setErr('Tidak ditemukan. Coba nama jalan atau tempat lain, atau pilih di peta.');
      } catch (e) {
        setErr(e.message);
      } finally {
        setBusy(false);
      }
    }, 450);
  }

  function pick(p) {
    onChange(p);
    setResults([]);
    setQ('');
  }

  function useMine() {
    if (!navigator.geolocation) return setErr('Browser tidak mendukung lokasi.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        pick({ lat, lng, label: await reverseGeocode(lat, lng) });
        setBusy(false);
      },
      () => {
        setErr('Izin lokasi ditolak. Ketik alamat atau pilih di peta.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const dot = kind === 'dest' || kind === 'drop' ? 'dot-dest' : kind === 'stop' ? 'dot-stop' : '';
  return (
    <div className={`place ${active ? 'is-active' : ''}`} ref={wrap}>
      <div className="place-box" onClick={onActivate}>
        <span className={`dot ${dot}`} aria-hidden />
        {!editing && value ? (
          <button
            type="button"
            className="place-value"
            onClick={() => {
              setEditing(true);
              setTimeout(() => input.current?.focus(), 0);
            }}
          >
            {!compact && <span className="xs">{label}</span>}
            <span>{value.label}</span>
          </button>
        ) : (
          <input
            ref={input}
            value={q}
            onChange={(e) => onType(e.target.value)}
            onFocus={onActivate}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setResults([]);
                if (value) setEditing(false);
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                if (results[0]) pick(results[0]);
              }
            }}
            placeholder={placeholder || label}
            aria-label={label}
            autoComplete="off"
          />
        )}
        {value && !editing ? (
          <button type="button" className="btn btn-ghost icon-btn" onClick={() => onChange(null)} aria-label={`Hapus ${label}`}>
            <Icon name="x" className="icon-sm" />
          </button>
        ) : (
          <button type="button" className="btn btn-ghost icon-btn" onClick={useMine} disabled={busy} title="Gunakan lokasi saya" aria-label="Gunakan lokasi saya">
            <Icon name="locate" />
          </button>
        )}
      </div>
      {results.length > 0 && (
        <div className="place-menu" role="listbox">
          {results.map((r, i) => (
            <button type="button" key={i} onClick={() => pick(r)} role="option" aria-selected="false">
              <Icon name="pin" />
              {r.label}
            </button>
          ))}
        </div>
      )}
      {active && editing && !results.length && !err && onActivate && (
        <p className="help" style={{ marginTop: 6 }}>
          Ketik alamat, atau klik langsung di peta.
        </p>
      )}
      {err && (
        <p className="error" style={{ marginTop: 6 }}>
          {err}
        </p>
      )}
    </div>
  );
}

export async function pointFromClick(latlng) {
  return { ...latlng, label: await reverseGeocode(latlng.lat, latlng.lng) };
}
