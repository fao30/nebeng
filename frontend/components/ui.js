'use client';
import { useEffect } from 'react';
import Icon from './Icon';
import { initials } from '@/lib/format';

export function Avatar({ name, large }) {
  return (
    <span className={`avatar ${large ? 'avatar-lg' : ''}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** Star average for a user as driver or passenger, e.g. ★ 4.8 (12). */
export function RatingBadge({ user, as }) {
  const n = as === 'driver' ? user?.driver_ratings : user?.passenger_ratings;
  const avg = as === 'driver' ? user?.driver_rating : user?.passenger_rating;
  if (!n) return <span className="rating rating-new">Baru</span>;
  return (
    <span className="rating" title={`${avg} dari 5, ${n} rating sebagai ${as === 'driver' ? 'pemilik mobil' : 'penumpang'}`}>
      ★ {avg.toFixed(1)} <span className="muted">({n})</span>
    </span>
  );
}

export function Person({ user, sub, large, rating }) {
  if (!user) return null;
  return (
    <div className="person">
      <Avatar name={user.name} large={large} />
      <div className="person-text">
        <b>
          {user.name}
          {user.verified && (
            <span className="verified" title={rating === 'driver' && user.car_verified ? 'Identitas dan mobil terverifikasi' : 'Identitas terverifikasi'} aria-label="Terverifikasi">
              <Icon name="check" />
            </span>
          )}
          {rating && <RatingBadge user={user} as={rating} />}
        </b>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, format = (v) => v, wide, label }) {
  return (
    <div className={`stepper ${wide ? 'stepper-wide' : ''}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`Kurangi ${label || ''}`}>
        <Icon name="minus" className="icon-sm" />
      </button>
      <output aria-live="polite">{format(value)}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label={`Tambah ${label || ''}`}>
        <Icon name="plus" className="icon-sm" />
      </button>
    </div>
  );
}

export function Toggle({ icon, title, desc, checked, onChange }) {
  return (
    <label className="toggle">
      {icon && <Icon name={icon} />}
      <span className="toggle-text">
        <b>{title}</b>
        {desc && <span className="help">{desc}</span>}
      </span>
      <input type="checkbox" className="switch" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Tutup">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon = 'route', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} type="button">
          {o.icon && <Icon name={o.icon} className="icon-sm" />}
          {o.label}
          {o.count ? <span className="count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
