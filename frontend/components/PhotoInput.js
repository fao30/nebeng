'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { compressImage } from '@/lib/kyc';

/**
 * One photo slot. `camera="user"` opens a live front-camera view with a face
 * guide (verifikasi muka); `camera="environment"` is for documents and the car.
 * Falls back to the phone's own camera / file picker when live camera isn't available.
 */
export default function PhotoInput({ label, hint, value, onChange, camera = 'environment', guide = 'doc', disabled }) {
  const [live, setLive] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const video = useRef(null);
  const stream = useRef(null);
  const file = useRef(null); // phone camera app (capture)
  const gallery = useRef(null); // photo library
  const preview = useRef('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = value ? URL.createObjectURL(value) : '';
    setUrl(preview.current);
  }, [value]);
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Attach the camera once the <video> element is on screen.
  useEffect(() => {
    if (live && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => {});
    }
  }, [live]);

  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setLive(false);
  }

  async function openCamera() {
    setErr('');
    if (!navigator.mediaDevices?.getUserMedia) return file.current?.click();
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camera, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      setLive(true);
    } catch {
      // Permission denied or no camera: use the phone's camera app / file picker instead.
      setErr(camera === 'user' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau pakai kamera HP yang terbuka sekarang.' : '');
      file.current?.click();
    }
  }

  async function snap() {
    const v = video.current;
    if (!v?.videoWidth) return setErr('Kamera belum siap, tunggu sebentar lalu coba lagi.');
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (camera === 'user') {
      // un-mirror: the preview is mirrored like a mirror, the photo shouldn't be
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    stop();
    setBusy(true);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    onChange(await compressImage(blob));
    setBusy(false);
  }

  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErr('Pilih file gambar (JPG atau PNG).');
    setBusy(true);
    setErr('');
    try {
      onChange(await compressImage(f));
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`photo-in ${disabled ? 'is-disabled' : ''}`}>
      <div className="photo-head">
        <div>
          <b>{label}</b>
          {hint && <div className="xs muted">{hint}</div>}
        </div>
        {value && <Icon name="check" className="icon-sm ok-icon" />}
      </div>

      {live ? (
        <div className={`cam cam-${guide}`}>
          <video ref={video} playsInline muted className={camera === 'user' ? 'mirror' : ''} />
          <div className="cam-guide" aria-hidden />
          <div className="cam-actions">
            <button type="button" className="btn btn-sm" onClick={stop}>
              Batal
            </button>
            <button type="button" className="cam-shutter" onClick={snap} aria-label="Ambil foto" />
            <span style={{ width: 64 }} />
          </div>
        </div>
      ) : url ? (
        <div className="photo-preview">
          <img src={url} alt={label} />
          <button type="button" className="btn btn-sm" onClick={camera === 'user' ? openCamera : () => file.current?.click()} disabled={disabled}>
            <Icon name="edit" className="icon-sm" />
            Ulangi
          </button>
        </div>
      ) : (
        <div className="photo-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={openCamera} disabled={disabled || busy}>
            <Icon name="camera" className="icon-sm" />
            {camera === 'user' ? 'Buka kamera depan' : 'Ambil foto'}
          </button>
          {camera !== 'user' && (
            <button type="button" className="btn btn-sm" onClick={() => gallery.current?.click()} disabled={disabled || busy}>
              Pilih dari galeri
            </button>
          )}
        </div>
      )}
      <input ref={file} type="file" accept="image/*" capture={camera} hidden onChange={pick} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={pick} />
      {busy && <p className="xs muted">Memproses foto…</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
