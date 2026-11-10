'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { fmtDay } from '@/lib/format';
import TripCard from '@/components/TripCard';
import RequireAuth from '@/components/RequireAuth';
import Icon from '@/components/Icon';
import { Empty, Segmented } from '@/components/ui';

function DriverHome() {
  const [trips, setTrips] = useState(null);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    const load = () => api('/my/trips').then(setTrips).catch(() => setTrips([]));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!trips) return <p className="muted">Memuat…</p>;
  const upcoming = trips.filter((t) => t.status === 'scheduled' || t.status === 'ongoing').reverse();
  const past = trips.filter((t) => t.status === 'completed' || t.status === 'cancelled');
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="page-narrow">
      <div className="page-head">
        <div>
          <h1>Trip saya</h1>
          <p>Trip yang Anda tawarkan sebagai pemilik mobil.</p>
        </div>
        <Link className="btn btn-primary" href="/driver/trip-baru">
          <Icon name="plus" />
          Buat trip
        </Link>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          label="Daftar trip"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: 'Mendatang', count: upcoming.length },
            { value: 'past', label: 'Riwayat' },
          ]}
        />
      </div>
      {list.length === 0 &&
        (tab === 'upcoming' ? (
          <Empty
            icon="car"
            title="Belum ada trip"
            action={
              <Link className="btn btn-primary" href="/driver/trip-baru">
                Buat trip pertama
              </Link>
            }
          >
            Buat trip dulu supaya bisa menawarkan tumpangan ke penumpang yang searah.
          </Empty>
        ) : (
          <Empty icon="clock" title="Belum ada riwayat">
            Trip yang selesai atau dibatalkan akan muncul di sini.
          </Empty>
        ))}
      <div className="list">
        {list.map((t) => {
          const waiting = (t.bookings || []).filter((b) => b.status === 'negotiating' && b.awaiting === 'driver').length;
          const booked = (t.bookings || []).filter((b) => b.status === 'accepted').length;
          return (
            <div key={t.id}>
              <div className="day-head">{fmtDay(t.depart_at)}</div>
              <TripCard trip={t} href={`/trip/${t.id}`} showStatus>
                {(waiting > 0 || booked > 0) && (
                  <div className="row wrap" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                    {waiting > 0 && (
                      <span className="chip chip-amber">
                        <Icon name="message" />
                        {waiting} menunggu jawaban Anda
                      </span>
                    )}
                    {booked > 0 && (
                      <span className="chip chip-mint">
                        <Icon name="check" />
                        {booked} pesanan terkonfirmasi
                      </span>
                    )}
                  </div>
                )}
              </TripCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth kyc="vehicle">
      <DriverHome />
    </RequireAuth>
  );
}
