import Icon from './Icon';
import { Person } from './ui';
import { Landmark } from './RouteTimeline';
import { fmtTime, shortPlace } from '@/lib/format';

const wa = (phone) => `https://wa.me/${phone.replace(/^0/, '62').replace(/\D/g, '')}`;

/**
 * Everyone confirmed on a trip. Phone numbers only go between driver and
 * passenger: the API never sends one passenger another passenger's number.
 */
export default function Participants({ list, meId }) {
  if (!list?.length) return null;
  return (
    <div className="card stack" style={{ '--gap': '14px' }}>
      <div>
        <h3>Peserta trip</h3>
        <p className="xs muted">Nomor telepon hanya bisa dilihat antara driver dan penumpang. Sesama penumpang tidak bisa melihat nomor satu sama lain.</p>
      </div>
      {list.map((p) => {
        const me = p.user.id === meId;
        const sub = p.role === 'driver' ? `Driver${p.user.car_model ? ` · ${p.user.car_model} ${p.user.car_plate || ''}` : ''}` : `Penumpang · ${p.seats} orang${p.luggage ? ` · ${p.luggage} koper` : ''}`;
        return (
          <div key={p.user.id + p.role} className="participant">
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <Person user={{ ...p.user, name: me ? `${p.user.name} (Anda)` : p.user.name }} sub={sub} />
              {!me && p.user.phone && (
                <div className="row" style={{ '--gap': '6px' }}>
                  <a className="btn btn-sm icon-btn" href={`tel:${p.user.phone}`} aria-label={`Telepon ${p.user.name}`} title={p.user.phone}>
                    <Icon name="phone" className="icon-sm" />
                  </a>
                  <a className="btn btn-soft btn-sm" href={wa(p.user.phone)} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </div>
              )}
            </div>
            {p.user.phone ? (
              <div className="small tnum ink2" style={{ marginLeft: 46 }}>{p.user.phone}</div>
            ) : (
              !me && <div className="xs muted" style={{ marginLeft: 46 }}>Nomor disembunyikan</div>
            )}
            {p.role === 'passenger' && p.pickup && (
              <div className="small ink2" style={{ marginLeft: 46, marginTop: 4 }}>
                <div>
                  Jemput {p.pickup_at ? <b className="tnum">{fmtTime(p.pickup_at)}</b> : null} di {shortPlace(p.pickup)}
                  <Landmark note={p.pickup.note} />
                </div>
                <div style={{ marginTop: 2 }}>
                  Turun di {shortPlace(p.dropoff)}
                  <Landmark note={p.dropoff?.note} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
