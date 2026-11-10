import Link from 'next/link';
import Icon from './Icon';
import { Person } from './ui';
import RouteTimeline from './RouteTimeline';
import { AMENITIES, fmtDuration, fmtRp, hasAmenity, tripStatusLabel } from '@/lib/format';

const km = (d) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1).replace('.', ',')} km`);

export default function TripCard({ trip, href, showStatus, children }) {
  const q = trip.quote;
  const price = q ? q.price_per_seat : trip.price_per_seat;
  const seats = q ? q.seats_available : trip.seats_available;
  const dur = q ? new Date(q.dropoff_at) - new Date(q.pickup_at) : null;
  const icons = AMENITIES.filter((a) => hasAmenity(trip, a.key)).slice(0, 5);

  const body = (
    <article className="card trip-card">
      <div>
        <RouteTimeline trip={trip} quote={q} pickup={q?.pickup} dropoff={q?.dropoff} compact />
        {dur != null && <div className="xs muted" style={{ marginTop: 6, marginLeft: 72 }}>{fmtDuration(dur)} perjalanan</div>}
        {(q?.pickup_walk_km != null || q?.dropoff_walk_km != null) && (
          <div className="row wrap xs" style={{ '--gap': '6px', marginTop: 8, marginLeft: 72 }}>
            {q.pickup_walk_km != null && <span className="chip">Naik {km(q.pickup_walk_km)} dari titik Anda</span>}
            {q.dropoff_walk_km != null && <span className="chip">Turun {km(q.dropoff_walk_km)} dari tujuan Anda</span>}
          </div>
        )}
      </div>
      <div className="trip-price">
        <b>{fmtRp(price)}</b>
        <span className="xs">per kursi</span>
        {showStatus && trip.status !== 'scheduled' && (
          <span className="chip" style={{ marginTop: 6 }}>
            {tripStatusLabel[trip.status]}
          </span>
        )}
      </div>
      <div className="trip-foot">
        <Person user={trip.driver} sub={trip.vehicle || 'Kendaraan belum diisi'} rating="driver" />
        <div className="amen" aria-label="Fasilitas">
          {icons.map((a) => (
            <Icon key={a.key} name={a.icon} title={a.label} />
          ))}
        </div>
        <span className={`chip ${seats > 0 ? 'chip-primary' : 'chip-red'}`}>
          <Icon name="users" />
          {seats > 0 ? `${seats} kursi` : 'Penuh'}
        </span>
      </div>
      {children}
    </article>
  );
  return href ? (
    <Link href={href} className="card-link" style={{ borderRadius: 'var(--r-lg)' }}>
      {body}
    </Link>
  ) : (
    body
  );
}
