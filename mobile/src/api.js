import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

let token = null;
let onBlocked = null;

export async function loadToken() {
  token = await AsyncStorage.getItem('nebeng_token');
  return token;
}
export async function setToken(t) {
  token = t;
  if (t) await AsyncStorage.setItem('nebeng_token', t);
  else await AsyncStorage.removeItem('nebeng_token');
}
export const getToken = () => token;
export const setBlockedHandler = (fn) => (onBlocked = fn);

export function qs(params) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export async function api(path, { method = 'GET', body, form } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error('Tidak bisa terhubung ke server. Periksa internet Anda (server gratis bisa butuh ~30 detik untuk bangun).');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 403 && data?.code === 'account_blocked' && token) onBlocked?.(data.error);
    const err = new Error(data?.error || `Server membalas ${res.status}`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

export const photoURL = (id) => `${API_URL}/api/kyc/files/${id}`;
