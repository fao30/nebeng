'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

// Custom date / date-time picker that replaces the browser's native one.
// Values keep the native formats so callers don't change:
//   DateField      -> "YYYY-MM-DD" ('' = kapan saja)
//   DateTimeField  -> "YYYY-MM-DDTHH:mm"

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const WEEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const pad = (x) => String(x).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function relLabel(d) {
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400e3);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff === 2) return 'Lusa';
  return null;
}

export function fmtPickedDate(iso, short = false) {
  const d = parseISO(iso);
  if (!d) return '';
  const rel = relLabel(d);
  const base = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  const yr = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  if (short) return rel || `${base}${yr}`;
  return rel ? `${rel} · ${base}${yr}` : `${base}${yr}`;
}

function nextSaturday() {
  const t = startOfDay(new Date());
  const add = (6 - t.getDay() + 7) % 7 || 7;
  return addDays(t, t.getDay() === 6 ? 0 : add);
}

function Chevron({ dir }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

// Popover anchored to the trigger with position:fixed, so it never gets clipped by
// cards with overflow:hidden. On phones it becomes a bottom sheet.
function usePopover(open, setOpen, triggerRef, popRef) {
  const [pos, setPos] = useState(null);
  const [sheet, setSheet] = useState(false);

  const place = useCallback(() => {
    const t = triggerRef.current;
    const p = popRef.current;
    if (!t || !p) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < 640) {
      setSheet(true);
      setPos(null);
      return;
    }
    setSheet(false);
    const r = t.getBoundingClientRect();
    const w = p.offsetWidth;
    p.style.maxHeight = '';
    const h = p.scrollHeight;
    const left = Math.min(Math.max(12, r.left), vw - w - 12);
    const below = vh - r.bottom - 20;
    const above = r.top - 20;
    // Prefer below; flip above if it fits there; otherwise use the roomier side and scroll inside.
    const useBelow = h <= below || (h > above && below >= above);
    const room = useBelow ? below : above;
    const height = Math.min(h, room);
    setPos({ left, top: useBelow ? r.bottom + 8 : r.top - 8 - height, maxHeight: room });
  }, [triggerRef, popRef]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place, setOpen, popRef, triggerRef]);

  useEffect(() => {
    if (!open || !sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, sheet]);

  return { pos, sheet };
}

function Calendar({ value, onPick, min, max }) {
  const sel = parseISO(value);
  const minD = parseISO(min);
  const maxD = parseISO(max);
  const today = startOfDay(new Date());
  const [view, setView] = useState(() => {
    const b = sel || minD || today;
    return new Date(b.getFullYear(), b.getMonth(), 1);
  });
  const [focus, setFocus] = useState(() => sel || (minD && minD > today ? minD : today));
  const gridRef = useRef(null);

  const y = view.getFullYear();
  const m = view.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7) cells.push(null);

  const disabled = (d) => (minD && d < minD) || (maxD && d > maxD);
  const canPrev = !minD || new Date(y, m, 0) >= minD;
  const canNext = !maxD || new Date(y, m + 1, 1) <= maxD;

  function move(n) {
    const f = addDays(focus, n);
    if (disabled(f)) return;
    setFocus(f);
    if (f.getMonth() !== m || f.getFullYear() !== y) setView(new Date(f.getFullYear(), f.getMonth(), 1));
  }

  useEffect(() => {
    const el = gridRef.current?.querySelector('[data-focus="1"]');
    if (el && gridRef.current.contains(document.activeElement)) el.focus();
  }, [focus]);

  function onKey(e) {
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (map[e.key]) {
      e.preventDefault();
      move(map[e.key]);
    }
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => setView(new Date(y, m - 1, 1))} disabled={!canPrev} aria-label="Bulan sebelumnya">
          <Chevron dir="left" />
        </button>
        <div className="cal-title" aria-live="polite">
          {MONTHS[m]} <span>{y}</span>
        </div>
        <button type="button" className="cal-nav" onClick={() => setView(new Date(y, m + 1, 1))} disabled={!canNext} aria-label="Bulan berikutnya">
          <Chevron dir="right" />
        </button>
      </div>
      <div className="cal-week" aria-hidden="true">
        {WEEK.map((w, i) => (
          <span key={w} className={i >= 5 ? 'wkend' : ''}>
            {w}
          </span>
        ))}
      </div>
      <div className="cal-grid" role="grid" ref={gridRef} onKeyDown={onKey}>
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = toISO(d);
          const isSel = sel && iso === toISO(sel);
          const isToday = iso === toISO(today);
          const isFocus = iso === toISO(focus);
          const off = disabled(d);
          return (
            <button
              type="button"
              key={i}
              className={`cal-day${isSel ? ' sel' : ''}${isToday ? ' today' : ''}${d.getDay() === 0 || d.getDay() === 6 ? ' wkend' : ''}`}
              disabled={off}
              tabIndex={isFocus ? 0 : -1}
              data-focus={isFocus ? '1' : undefined}
              aria-pressed={isSel}
              aria-label={`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`}
              onClick={() => {
                setFocus(d);
                onPick(iso);
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Shell({ open, setOpen, triggerRef, title, children, footer }) {
  const popRef = useRef(null);
  const { pos, sheet } = usePopover(open, setOpen, triggerRef, popRef);
  if (!open) return null;
  const pop = (
    <div
      ref={popRef}
      className={`dp-pop${sheet ? ' dp-sheet' : ''}`}
      role="dialog"
      aria-label={title}
      style={sheet ? undefined : pos ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight } : { visibility: 'hidden', left: 0, top: 0 }}
    >
      {sheet && (
        <div className="dp-sheet-head">
          <span className="dp-grip" />
          <b>{title}</b>
          <button type="button" className="btn btn-ghost icon-btn" onClick={() => setOpen(false)} aria-label="Tutup">
            <Icon name="x" />
          </button>
        </div>
      )}
      {children}
      {footer}
    </div>
  );
  const node = sheet ? (
    <div className="dp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      {pop}
    </div>
  ) : (
    pop
  );
  // Portal to <body> so no transformed / stacking ancestor can trap or clip it.
  return typeof document === 'undefined' ? null : createPortal(node, document.body);
}

export function DateField({ value, onChange, min, max, placeholder = 'Kapan saja', clearable = true, quick = true, label = 'Tanggal berangkat', className = '', compact = false }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const today = startOfDay(new Date());
  const minD = parseISO(min);
  const pick = (iso) => {
    onChange(iso);
    setOpen(false);
  };
  const chips = [
    { label: 'Hari ini', d: today },
    { label: 'Besok', d: addDays(today, 1) },
    { label: 'Sabtu ini', d: nextSaturday() },
  ].filter((c) => !minD || c.d >= minD);

  return (
    <div className={`dp ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        className={`input dp-trigger${open ? ' open' : ''}${value ? '' : ' empty'}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value ? fmtPickedDate(value) : placeholder}`}
      >
        <Icon name="calendar" />
        <span className="dp-value">{value ? fmtPickedDate(value, compact) : placeholder}</span>
      </button>
      <Shell
        open={open}
        setOpen={setOpen}
        triggerRef={triggerRef}
        title={label}
        footer={
          clearable && value ? (
            <div className="dp-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick('')}>
                Hapus tanggal
              </button>
            </div>
          ) : null
        }
      >
        {quick && (
          <div className="dp-chips">
            {clearable && (
              <button type="button" className={`dp-chip${!value ? ' on' : ''}`} onClick={() => pick('')}>
                Kapan saja
              </button>
            )}
            {chips.map((c) => (
              <button type="button" key={c.label} className={`dp-chip${value === toISO(c.d) ? ' on' : ''}`} onClick={() => pick(toISO(c.d))}>
                {c.label}
              </button>
            ))}
          </div>
        )}
        <Calendar value={value} onPick={pick} min={min} max={max} />
      </Shell>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
const PRESETS = [
  { label: 'Pagi', icon: 'sunrise', h: 6, m: 0 },
  { label: 'Siang', icon: 'sun', h: 12, m: 0 },
  { label: 'Sore', icon: 'sunset', h: 16, m: 0 },
  { label: 'Malam', icon: 'moon', h: 19, m: 0 },
];

export function DateTimeField({ value, onChange, min, label = 'Tanggal dan jam', required }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const hourRef = useRef(null);
  const [date, time] = (value || '').split('T');
  const [hh, mm] = (time || '08:00').split(':').map(Number);
  const minDate = min ? min.slice(0, 10) : undefined;

  const set = (d, h, m) => onChange(`${d || date || toISO(new Date())}T${pad(h)}:${pad(m)}`);

  useEffect(() => {
    if (!open) return;
    // Wait a frame: the popover may re-mount once it decides between popover and sheet.
    const id = setTimeout(() => {
      const box = hourRef.current;
      const el = box?.querySelector('.on');
      if (box && el) box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2;
    }, 40);
    return () => clearTimeout(id);
  }, [open, hh]);

  const shown = value ? `${fmtPickedDate(date)} · ${pad(hh)}:${pad(mm)}` : 'Pilih tanggal dan jam';

  return (
    <div className="dp">
      <button
        type="button"
        ref={triggerRef}
        className={`input dp-trigger${open ? ' open' : ''}${value ? '' : ' empty'}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${shown}`}
      >
        <Icon name="calendar" />
        <span className="dp-value">{shown}</span>
        {value && (
          <span className="dp-time">
            <Icon name="clock" />
          </span>
        )}
      </button>
      {required && <input tabIndex={-1} aria-hidden="true" className="dp-required" required value={value || ''} onChange={() => {}} />}
      <Shell
        open={open}
        setOpen={setOpen}
        triggerRef={triggerRef}
        title={label}
        footer={
          <div className="dp-foot">
            <span className="dp-summary">{shown}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
              Selesai
            </button>
          </div>
        }
      >
        <Calendar value={date} min={minDate} onPick={(d) => set(d, hh, mm)} />
        <div className="dp-timebox">
          <div className="dp-label">
            <Icon name="clock" /> Jam
          </div>
          <div className="dp-chips">
            {PRESETS.map((p) => (
              <button type="button" key={p.label} className={`dp-chip${hh === p.h && mm === p.m ? ' on' : ''}`} onClick={() => set(null, p.h, p.m)}>
                <Icon name={p.icon} />
                {p.label} {pad(p.h)}.00
              </button>
            ))}
          </div>
          <div className="dp-hours" ref={hourRef} role="listbox" aria-label="Jam">
            {HOURS.map((h) => (
              <button type="button" key={h} role="option" aria-selected={h === hh} className={`dp-h${h === hh ? ' on' : ''}`} onClick={() => set(null, h, mm)}>
                {pad(h)}
              </button>
            ))}
          </div>
          <div className="dp-mins" role="listbox" aria-label="Menit">
            {MINUTES.map((m) => (
              <button type="button" key={m} role="option" aria-selected={m === mm} className={`dp-m${m === mm ? ' on' : ''}`} onClick={() => set(null, hh, m)}>
                :{pad(m)}
              </button>
            ))}
            {!MINUTES.includes(mm) && <span className="dp-m on">:{pad(mm)}</span>}
          </div>
        </div>
      </Shell>
    </div>
  );
}
