import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventSource from 'react-native-sse';
import { api, getToken, loadToken, setBlockedHandler, setToken } from './api';
import { API_URL } from './config';

const Ctx = createContext(null);

/** Account, mode (penumpang / pemilik mobil) and the live notification feed. */
export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState('passenger');
  const [blocked, setBlocked] = useState('');
  const [notifs, setNotifs] = useState({ items: [], unread: 0 });
  const [toast, setToast] = useState(null);
  const listeners = useRef(new Set());

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setBlockedHandler((msg) => {
      setBlocked(msg || 'Akun Anda diblokir oleh admin Nebeng.');
      signOut();
    });
    (async () => {
      const m = await AsyncStorage.getItem('nebeng_mode');
      if (m === 'driver' || m === 'passenger') setModeState(m);
      if (await loadToken()) {
        try {
          setUser(await api('/me'));
        } catch (e) {
          if (e.status === 401) await setToken(null);
        }
      }
      setReady(true);
    })();
  }, [signOut]);

  const signIn = useCallback(async (session) => {
    await setToken(session.token);
    setBlocked('');
    setUser(session.user);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api('/me'));
    } catch {
      /* keep */
    }
  }, []);

  const setMode = useCallback((m) => {
    AsyncStorage.setItem('nebeng_mode', m);
    setModeState(m);
  }, []);

  // ---- notifications: load once, then live over SSE ----
  const loadNotifs = useCallback(async () => {
    try {
      const r = await api('/notifications');
      setNotifs({ items: r.items, unread: r.unread });
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setNotifs({ items: [], unread: 0 });
      return;
    }
    loadNotifs();
    const es = new EventSource(`${API_URL}/api/notifications/stream`, { headers: { Authorization: `Bearer ${getToken()}` }, pollingInterval: 4000 });
    es.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'notification') {
        const n = msg.notification;
        setNotifs((cur) => {
          const items = [n, ...cur.items.filter((x) => x.id !== n.id)].sort((a, b) => new Date(b.at) - new Date(a.at));
          return { items, unread: items.filter((x) => !x.read_at).length };
        });
        setToast(n);
        listeners.current.forEach((fn) => fn(n));
        if (n.type === 'kyc') refreshUser();
      } else if (msg.type === 'read' || msg.type === 'ready') {
        loadNotifs();
      } else if (msg.type === 'account' && msg.blocked) {
        setBlocked(msg.message || 'Akun Anda diblokir oleh admin Nebeng.');
        signOut();
      }
    });
    return () => {
      es.removeAllEventListeners();
      es.close();
    };
  }, [user?.id, loadNotifs, refreshUser, signOut]);

  const markRead = useCallback(async (ids) => {
    const now = new Date().toISOString();
    setNotifs((cur) => {
      const items = cur.items.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: now } : n));
      return { items, unread: items.filter((x) => !x.read_at).length };
    });
    try {
      await api('/notifications/read', { method: 'POST', body: { ids: ids || [] } });
    } catch {
      loadNotifs();
    }
  }, [loadNotifs]);

  /** Run fn for every incoming notification (e.g. refresh a booking). Returns unsubscribe. */
  const onNotification = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  return (
    <Ctx.Provider
      value={{ user, setUser, ready, signIn, signOut, refreshUser, mode, setMode, blocked, setBlocked, notifs, loadNotifs, markRead, onNotification, toast, setToast }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);

export const identityOK = (u) => u?.identity_status === 'approved';
export const vehicleOK = (u) => identityOK(u) && u?.vehicle_status === 'approved';

/** Re-run `fn` whenever a notification about this trip or booking arrives. */
export function useLiveRefresh(fn, { tripId, bookingId } = {}) {
  const { onNotification } = useApp();
  useEffect(
    () =>
      onNotification((n) => {
        if ((tripId && n.trip_id === tripId) || (bookingId && n.booking_id === bookingId)) fn();
      }),
    [onNotification, fn, tripId, bookingId],
  );
}
