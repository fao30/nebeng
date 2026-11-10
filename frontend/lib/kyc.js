'use client';
import { API_URL, getToken } from './api';

export const KYC_LABEL = {
  '': 'Belum dikirim',
  pending: 'Sedang ditinjau',
  approved: 'Terverifikasi',
  rejected: 'Ditolak',
};
export const KYC_TONE = { '': 'chip-muted', pending: 'tone-amber', approved: 'tone-mint', rejected: 'tone-red' };

export const identityOK = (u) => u?.identity_status === 'approved';
export const vehicleOK = (u) => identityOK(u) && u?.vehicle_status === 'approved';

/**
 * Shrink a photo before upload: max 1600 px on the long side, JPEG 85 %.
 * Keeps ID text readable while sending ~200–400 KB instead of 5 MB.
 */
export async function compressImage(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Foto tidak bisa dibaca. Coba foto ulang.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** POST a multipart verification (identity | vehicle). */
export async function submitKyc(kind, fields, files) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  Object.entries(files).forEach(([k, blob]) => fd.append(k, blob, `${k}.jpg`));
  const res = await fetch(`${API_URL}/api/kyc/${kind}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Server membalas ${res.status}`);
  return data;
}

/** Fetch a protected KYC photo with the auth header and return an object URL. */
export async function kycPhotoURL(fileId) {
  const res = await fetch(`${API_URL}/api/kyc/files/${fileId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('Foto tidak bisa dimuat');
  return URL.createObjectURL(await res.blob());
}
