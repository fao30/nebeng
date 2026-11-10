'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/app/providers';
import Icon from '@/components/Icon';
import { Empty, Segmented } from '@/components/ui';
import { NotificationItem } from '@/components/Notifications';
import { markRead, metaFor, useNotifications } from '@/lib/notifications';
import { onSoundChange, setSoundEnabled, soundEnabled } from '@/lib/sound';

const FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'unread', label: 'Belum dibaca' },
  { value: 'pesanan', label: 'Pesanan' },
  { value: 'chat', label: 'Chat' },
  { value: 'trip', label: 'Trip' },
];

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hari ini';
  if (d.toDateString() === y.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function NotificationsPage() {
  const { user, ready } = useApp();
  const { items, unread, loaded, live } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [perm, setPerm] = useState('unsupported');
  const router = useRouter();

  useEffect(() => {
    try {
      if ('Notification' in window) setPerm(Notification.permission);
    } catch {
      /* not supported */
    }
  }, []);

  const shown = useMemo(
    () => items.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read_at : metaFor(n.type).group === filter)),
    [items, filter],
  );
  const groups = useMemo(() => {
    const out = [];
    shown.forEach((n) => {
      const label = dayLabel(n.at);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(n);
    });
    return out;
  }, [shown]);

  if (!ready) return <p className="muted">Memuat…</p>;
  if (!user)
    return (
      <Empty
        icon="bell"
        title="Masuk untuk melihat notifikasi"
        action={
          <Link className="btn btn-primary" href="/masuk?next=/notifikasi">
            Masuk
          </Link>
        }
      >
        Kabar pesanan, chat, dan trip Anda muncul di sini.
      </Empty>
    );

  function open(n) {
    if (!n.read_at) markRead([n.id]);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="narrow">
      <div className="page-head">
        <div>
          <h1>Notifikasi</h1>
          <p>
            {unread ? `${unread} belum dibaca` : 'Semua sudah dibaca'}
            <span className={`live-dot ${live ? 'on' : ''}`} title={live ? 'Tersambung langsung' : 'Menyambung ulang…'} />
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <SoundToggle />
          {unread > 0 && (
            <button className="btn btn-soft btn-sm" onClick={() => markRead()}>
              <Icon name="check" className="icon-sm" />
              Tandai semua dibaca
            </button>
          )}
        </div>
      </div>

      {perm === 'default' && (
        <div className="card row-between notif-perm">
          <div className="small">
            <b>Dapat kabar walau tab ini tidak dibuka</b>
            <div className="muted xs">Izinkan notifikasi browser untuk pesanan, chat, dan trip.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => Notification.requestPermission().then(setPerm)}>
            Izinkan
          </button>
        </div>
      )}

      <Segmented value={filter} onChange={setFilter} options={FILTERS} label="Filter notifikasi" />

      {loaded && !shown.length && (
        <Empty icon="bell" title={filter === 'all' ? 'Belum ada notifikasi' : 'Tidak ada yang cocok'}>
          {filter === 'all'
            ? 'Kabar saat pemilik mobil menerima, menolak, atau menawar, chat baru, trip mulai dan selesai, serta trip baru di rute Anda akan muncul di sini.'
            : 'Coba filter lain.'}
        </Empty>
      )}
      {!loaded && <p className="muted">Memuat…</p>}

      {groups.map((g) => (
        <section key={g.label} className="notif-group">
          <h2 className="notif-day">{g.label}</h2>
          <div className="card notif-list">
            {g.items.map((n) => (
              <NotificationItem key={n.id} n={n} onOpen={open} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(soundEnabled());
    return onSoundChange(setOn);
  }, []);
  return (
    <button
      type="button"
      className={`btn btn-sm ${on ? 'btn-soft' : 'btn-ghost'}`}
      onClick={() => setSoundEnabled(!on)}
      aria-pressed={on}
      title={on ? 'Matikan suara notifikasi' : 'Nyalakan suara notifikasi'}
    >
      <Icon name={on ? 'volume' : 'mute'} className="icon-sm" />
      {on ? 'Suara nyala' : 'Suara mati'}
    </button>
  );
}
