'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { geocode, reverseGeocode } from '@/lib/api';
import { useDebounce } from '@/lib/useDebounce';

/**
 * Place picker: type to get suggestions, use current location, or (when the
 * parent passes `active`/`onActivate`) click the map to fill it.
 */
export default function PointField({ label, value, onChange, active, onActivate, kind = 'origin', placeholder, compact, withNote, notePlaceholder }) {
  const [editing, setEditing] = useState(!value);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const wrap = useRef(null);
  const input = useRef(null);
  const debounced = useDebounce(q.trim(), 350);

  useEffect(() => setEditing(!value), [value]);

  useEffect(() => {
    const close = (e) => wrap.current && !wrap.current.contains(e.target) && setResults([]);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Search only after typing pauses (useDebounce); a newer query aborts the
  // request still in flight so stale results never overwrite fresh ones.
  useEffect(() => {
    if (debounced.length < 3) {
      setResults([]);
      setBusy(false);
      return;
    }
    const ctrl = new AbortController();
    setBusy(true);
    setErr('');
    geocode(debounced, { signal: ctrl.signal, near: value || undefined })
      .then((r) => {
        if (ctrl.signal.aborted) return;
        setResults(r);
        if (!r.length) setErr('Tidak ditemukan. Coba nama jalan atau tempat lain, atau pilih di peta.');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setErr('Pencarian alamat gagal. Coba lagi atau pilih di peta.');
      })
      .finally(() => !ctrl.signal.aborted && setBusy(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  function onType(v) {
    setQ(v);
    setErr('');
    if (v.trim().length < 3) setResults([]);
  }

  async function pick(p) {
    if (p.resolve) {
      // Google suggestions get their coordinates only when picked.
      setBusy(true);
      try {
        p = await p.resolve();
      } catch {
        setBusy(false);
        return setErr('Lokasi ini tidak bisa dipakai. Pilih saran lain atau klik di peta.');
      }
      setBusy(false);
    }
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
      {busy && q.trim().length >= 3 && !results.length && (
        <div className="place-menu">
          <p className="small muted" style={{ padding: 10 }}>
            Mencari…
          </p>
        </div>
      )}
      {results.length > 0 && (
        <div className="place-menu" role="listbox">
          {results.map((r, i) => (
            <button type="button" key={i} onClick={() => pick(r)} role="option" aria-selected="false">
              <Icon name="pin" />
              {r.label}
            </button>
          ))}
          {results.some((r) => r.source === 'google') && <div className="powered">Powered by Google</div>}
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
      {withNote && value && !editing && (
        <div className="note-field">
          <Icon name="flag" className="icon-sm" />
          <input
            value={value.note || ''}
            maxLength={200}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            placeholder={notePlaceholder || 'Patokan, misal: depan Indomaret, pagar hijau'}
            aria-label={`Patokan ${label}`}
          />
        </div>
      )}
    </div>
  );
}

export async function pointFromClick(latlng) {
  return { ...latlng, label: await reverseGeocode(latlng.lat, latlng.lng) };
}
