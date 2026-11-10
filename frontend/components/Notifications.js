'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Icon from './Icon';
import { markRead, metaFor, onArrival, timeAgo, useNotificationFeed, useNotifications } from '@/lib/notifications';

/** Bell with unread badge, for the header. */
export function NotificationBell({ userId }) {
  useNotificationFeed(userId);
  const { unread } = useNotifications();
  const path = usePathname();
  return (
    <Link
      href="/notifikasi"
      className="btn btn-ghost icon-btn bell"
      aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
      aria-current={path === '/notifikasi' ? 'page' : undefined}
      title="Notifikasi"
    >
      <Icon name="bell" />
      {unread > 0 && <span className="bell-badge">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}

/** One notification row; used by the page and the toast. */
export function NotificationItem({ n, onOpen, compact }) {
  const m = metaFor(n.type);
  return (
    <button type="button" className={`notif ${n.read_at ? '' : 'is-unread'} ${compact ? 'notif-compact' : ''}`} onClick={() => onOpen(n)}>
      <span className={`notif-icon tone-${m.tone}`} aria-hidden>
        <Icon name={m.icon} className="icon-sm" />
      </span>
      <span className="notif-text">
        <span className="notif-title">{n.title}</span>
        {n.body && <span className="notif-body">{n.body}</span>}
        <span className="notif-time">{timeAgo(n.at)}</span>
      </span>
      {!n.read_at && !compact && <span className="notif-dot" aria-label="Belum dibaca" />}
    </button>
  );
}

/** Pops up new notifications while the user is elsewhere in the app. */
export function NotificationToasts() {
  const [list, setList] = useState([]);
  const router = useRouter();
  const path = usePathname();

  useEffect(
    () =>
      onArrival((n) => {
        if (path === '/notifikasi') return;
        setList((l) => [n, ...l.filter((x) => x.id !== n.id)].slice(0, 3));
        setTimeout(() => setList((l) => l.filter((x) => x.id !== n.id || x.at !== n.at)), 6000);
        // Also show a system notification when the tab is in the background.
        try {
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            const sys = new Notification(n.title, { body: n.body || '', tag: n.id });
            sys.onclick = () => {
              window.focus();
              open(n);
            };
          }
        } catch {
          /* not supported */
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path],
  );

  function open(n) {
    setList((l) => l.filter((x) => x.id !== n.id));
    markRead([n.id]);
    if (n.link) router.push(n.link);
  }

  if (!list.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((n) => (
        <div key={n.id + n.at} className="toast">
          <NotificationItem n={n} onOpen={open} compact />
          <button className="btn btn-ghost icon-btn" aria-label="Tutup" onClick={() => setList((l) => l.filter((x) => x.id !== n.id))}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>
      ))}
    </div>
  );
}
