'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const Ctx = createContext(null);

function store(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function Providers({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState('passenger');

  useEffect(() => {
    const m = read('nebeng_mode');
    if (m === 'driver' || m === 'passenger') setModeState(m);
    if (!read('nebeng_token')) {
      setReady(true);
      return;
    }
    api('/me')
      .then(setUser)
      .catch(() => store('nebeng_token', null))
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback((session) => {
    store('nebeng_token', session.token);
    setUser(session.user);
  }, []);

  const signOut = useCallback(() => {
    store('nebeng_token', null);
    setUser(null);
  }, []);

  const setMode = useCallback((m) => {
    store('nebeng_mode', m);
    setModeState(m);
  }, []);

  return <Ctx.Provider value={{ user, setUser, ready, signIn, signOut, mode, setMode }}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
