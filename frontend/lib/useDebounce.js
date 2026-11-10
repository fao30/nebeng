'use client';
import { useEffect, useState } from 'react';

/** Returns `value` only after it has stopped changing for `delay` ms. */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
