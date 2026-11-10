'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import { DEFAULT_SETTINGS } from './format';

let cache = null;

/** Platform settings set by the admin (price per km, minutes per km…). */
export function useSettings() {
  const [s, setS] = useState(cache || DEFAULT_SETTINGS);
  useEffect(() => {
    if (cache) return;
    api('/settings')
      .then((r) => {
        cache = r;
        setS(r);
      })
      .catch(() => {});
  }, []);
  return s;
}

export function clearSettingsCache() {
  cache = null;
}
