'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import Negotiation from '@/components/Negotiation';
import RequireAuth from '@/components/RequireAuth';
import Icon from '@/components/Icon';
import { Empty, Segmented } from '@/components/ui';

function Pesanan() {
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('active');
  const load = useCallback(() => api('/my/bookings').then(setList).catch(() => setList([])), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  if (!list) return <p className="muted">Memuat…</p>;
  const isActive = (b) => (b.status === 'negotiating' || b.status === 'accepted') && b.trip.status !== 'completed' && b.trip.status !== 'cancelled';
  const active = list.filter(isActive);
  const past = list.filter((b) => !isActive(b));
  const shown = tab === 'active' ? active : past;

  return (
    <div className="page-narrow">
      <div className="page-head">
        <div>
          <h1>Perjalanan saya</h1>
          <p>Pesanan Anda sebagai penumpang.</p>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          label="Daftar pesanan"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: 'Mendatang', count: active.length },
            { value: 'past', label: 'Riwayat' },
          ]}
        />
      </div>
      {shown.length === 0 && (
        <Empty
          icon="ticket"
          title={tab === 'active' ? 'Belum ada perjalanan' : 'Belum ada riwayat'}
          action={
            tab === 'active' && (
              <Link className="btn btn-primary" href="/cari">
                Cari trip
              </Link>
            )
          }
        >
          {tab === 'active' ? 'Cari trip yang searah dengan tujuan Anda.' : 'Perjalanan yang selesai atau dibatalkan akan muncul di sini.'}
        </Empty>
      )}
      <div className="list">
        {shown.map((b) => (
          <div key={b.id} className="stack" style={{ '--gap': '8px' }}>
            <Negotiation booking={b} role="passenger" onChange={load} showTrip />
            {isActive(b) && (
              <Link className="small row" style={{ '--gap': '6px', marginLeft: 4 }} href={`/trip/${b.trip_id}`}>
                <Icon name={b.status === 'accepted' ? 'live' : 'route'} className="icon-sm" />
                {b.status === 'accepted' ? 'Buka trip dan live location' : 'Lihat detail trip'}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <Pesanan />
    </RequireAuth>
  );
}
