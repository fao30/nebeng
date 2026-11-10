'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { API_URL, api, getToken } from './api';

/**
 * One shared notification feed per tab: loaded once, then kept fresh over
 * Server-Sent Events (with a 30 s poll as fallback). Components read it via
 * useNotifications(); new arrivals also go to onArrival listeners (toasts).
 */
let state = { items: [], unread: 0, loaded: false, live: false };
const subs = new Set();
const arrivals = new Set();
let es = null;
let poll = null;
let token = null;

function set(next) {
  state = { ...state, ...next };
  subs.forEach((fn) => fn());
}

const countUnread = (items) => items.filter((n) => !n.read_at).length;

async function refresh() {
  try {
    const r = await api('/notifications');
    set({ items: r.items, unread: r.unread, loaded: true });
  } catch {
    /* offline: keep what we have */
  }
}

function upsert(n) {
  const items = [n, ...state.items.filter((x) => x.id !== n.id)].sort((a, b) => new Date(b.at) - new Date(a.at));
  set({ items, unread: countUnread(items) });
  arrivals.forEach((fn) => fn(n));
}

function connect() {
  stop();
  token = getToken();
  if (!token) return;
  refresh();
  es = new EventSource(`${API_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`);
  es.onopen = () => set({ live: true });
  es.onerror = () => set({ live: false });
  es.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.type === 'notification') upsert(msg.notification);
    else if (msg.type === 'read') refresh(); // read on another tab or device
    else if (msg.type === 'ready') refresh(); // (re)connected: catch up on anything missed
  };
  poll = setInterval(() => !state.live && refresh(), 30000);
}

function stop() {
  es?.close();
  es = null;
  clearInterval(poll);
  poll = null;
  token = null;
}

/** Start or stop the feed when the signed-in user changes. */
export function useNotificationFeed(userId) {
  useEffect(() => {
    if (!userId) {
      stop();
      set({ items: [], unread: 0, loaded: false, live: false });
      return;
    }
    connect();
    return stop;
  }, [userId]);
}

export function useNotifications() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => state,
    () => state,
  );
}

export function onArrival(fn) {
  arrivals.add(fn);
  return () => arrivals.delete(fn);
}

export async function markRead(ids) {
  const now = new Date().toISOString();
  const items = state.items.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: now } : n));
  set({ items, unread: countUnread(items) });
  try {
    await api('/notifications/read', { method: 'POST', body: { ids: ids || [] } });
  } catch {
    refresh();
  }
}

/** Type → icon, tone and filter group for the UI. */
export const NOTIF_META = {
  booking_request: { icon: 'inbox', tone: 'primary', group: 'pesanan' },
  booking_instant: { icon: 'bolt', tone: 'mint', group: 'pesanan' },
  booking_offer: { icon: 'car', tone: 'primary', group: 'pesanan' },
  booking_counter: { icon: 'tag', tone: 'amber', group: 'pesanan' },
  booking_accepted: { icon: 'check', tone: 'mint', group: 'pesanan' },
  booking_rejected: { icon: 'x', tone: 'red', group: 'pesanan' },
  booking_cancelled: { icon: 'x', tone: 'red', group: 'pesanan' },
  chat: { icon: 'message', tone: 'primary', group: 'chat' },
  trip_started: { icon: 'navigate', tone: 'mint', group: 'trip' },
  trip_completed: { icon: 'flag', tone: 'mint', group: 'trip' },
  trip_cancelled: { icon: 'x', tone: 'red', group: 'trip' },
  trip_reminder: { icon: 'clock', tone: 'amber', group: 'trip' },
  trip_new: { icon: 'route', tone: 'primary', group: 'trip' },
  request_new: { icon: 'megaphone', tone: 'primary', group: 'pesanan' },
};

export const NOTIF_LABEL = {
  booking_request: 'Permintaan kursi',
  booking_instant: 'Pesan langsung',
  booking_offer: 'Tawaran driver',
  booking_counter: 'Tawar harga',
  booking_accepted: 'Diterima',
  booking_rejected: 'Ditolak',
  booking_cancelled: 'Dibatalkan',
  chat: 'Chat',
  trip_started: 'Trip mulai',
  trip_completed: 'Trip selesai',
  trip_cancelled: 'Trip batal',
  trip_reminder: 'Pengingat',
  trip_new: 'Trip baru',
  request_new: 'Permintaan penumpang',
};

export const metaFor = (type) => NOTIF_META[type] || { icon: 'info', tone: 'primary', group: 'lain' };

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
