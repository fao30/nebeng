'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { KYC_LABEL, KYC_TONE, kycPhotoURL } from '@/lib/kyc';
import AdminShell from '@/components/AdminShell';
import Icon from '@/components/Icon';
import { Avatar, Sheet } from '@/components/ui';

const SLOTS = {
  identity: [
    ['id_photo', 'KTP/SIM'],
    ['selfie', 'Wajah'],
    ['id_selfie', 'Selfie dengan kartu'],
  ],
  vehicle: [
    ['car_front', 'Mobil tampak depan'],
    ['stnk', 'STNK'],
  ],
};
const REJECT = {
  identity: ['Foto KTP/SIM buram atau terpotong', 'Wajah tidak cocok dengan foto di kartu', 'Nama akun tidak sama dengan nama di kartu', 'Selfie tidak jelas atau memakai masker/kacamata hitam', 'Kartu tidak terlihat di selfie'],
  vehicle: ['Pelat nomor tidak terlihat di foto mobil', 'Pelat di foto mobil tidak sama dengan STNK', 'STNK buram atau terpotong', 'STNK sudah tidak berlaku', 'Data mobil tidak sesuai STNK'],
};

function age(iso) {
  const h = (Date.now() - new Date(iso)) / 3600e3;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} mnt lalu`;
  return `${Math.floor(h)} jam lalu`;
}

function Photo({ id, label, onZoom }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState(false);
  useEffect(() => {
    let u = '';
    kycPhotoURL(id)
      .then((x) => setUrl((u = x)))
      .catch(() => setErr(true));
    return () => u && URL.revokeObjectURL(u);
  }, [id]);
  return (
    <figure className="kyc-photo">
      {url ? (
        <button type="button" onClick={() => onZoom(url, label)} aria-label={`Perbesar ${label}`}>
          <img src={url} alt={label} />
        </button>
      ) : (
        <div className="kyc-photo-empty">{err ? 'Foto tidak tersedia' : 'Memuat…'}</div>
      )}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export default function AdminVerify() {
  const [f, setF] = useState({ status: 'pending', kind: '', q: '' });
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null);

  const load = useCallback(() => {
    api(`/admin/verifications${qs(f)}`)
      .then((d) => {
        setData(d);
        setErr('');
        const want = new URLSearchParams(window.location.search).get('id');
        if (want) setSel((cur) => cur || d.items.find((x) => x.id === want) || null);
      })
      .catch((e) => setErr(e.message));
  }, [f]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    const every = setInterval(load, 30000);
    return () => {
      clearTimeout(t);
      clearInterval(every);
    };
  }, [load]);
  useEffect(() => setReason(''), [sel?.id]);

  async function review(approve) {
    setBusy(true);
    setErr('');
    try {
      await api(`/admin/verifications/${sel.id}`, { method: 'POST', body: { approve, reason } });
      setSel(null);
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const counts = data?.counts || {};
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <AdminShell title="Verifikasi" desc="Periksa wajah, KTP/SIM, foto mobil, dan STNK. Target: setiap pengajuan selesai maksimal 1x24 jam.">
      <div className="stats" style={{ marginBottom: 16 }}>
        {['pending', 'approved', 'rejected'].map((k) => (
          <button key={k} className={`stat stat-btn ${f.status === k ? 'on' : ''}`} onClick={() => setF({ ...f, status: f.status === k ? '' : k })}>
            <span>{KYC_LABEL[k]}</span>
            <b className="tnum">{counts[k] || 0}</b>
          </button>
        ))}
      </div>
      <div className="filterbar">
        <label className="field">
          <span className="field-label">Cari nama, email, atau pelat</span>
          <input className="input" value={f.q} onChange={set('q')} placeholder="Nama, email, telepon, pelat" />
        </label>
        <label className="field">
          <span className="field-label">Jenis</span>
          <select className="input" value={f.kind} onChange={set('kind')}>
            <option value="">Semua</option>
            <option value="identity">Identitas</option>
            <option value="vehicle">Mobil</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <select className="input" value={f.status} onChange={set('status')}>
            <option value="">Semua</option>
            <option value="pending">Sedang ditinjau</option>
            <option value="approved">Terverifikasi</option>
            <option value="rejected">Ditolak</option>
          </select>
        </label>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>Jenis</th>
              <th>Dikirim</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  {f.status === 'pending' ? 'Tidak ada pengajuan yang menunggu. 👍' : 'Tidak ada yang cocok.'}
                </td>
              </tr>
            )}
            {(data?.items || []).map((v) => (
              <tr key={v.id} className={`clickable ${v.overdue ? 'row-overdue' : ''}`} onClick={() => setSel(v)}>
                <td>
                  <div className="row" style={{ '--gap': '8px' }}>
                    <Avatar name={v.user?.name || '?'} />
                    <div>
                      <b>{v.user?.name}</b>
                      <span className="sub">{v.user?.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  {v.kind === 'identity' ? (
                    <span className="small">Identitas · {v.doc_type === 'sim' ? 'SIM' : 'KTP'}</span>
                  ) : (
                    <span className="small">
                      Mobil · {v.car_model} <b>{v.car_plate}</b>
                    </span>
                  )}
                </td>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>
                  {fmtDate(v.submitted_at)}
                  {v.status === 'pending' && <div className={`xs ${v.overdue ? 'strong link-danger' : 'muted'}`}>{v.overdue ? 'Lewat 1x24 jam!' : age(v.submitted_at)}</div>}
                </td>
                <td>
                  <span className={`chip ${KYC_TONE[v.status]}`}>{KYC_LABEL[v.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel ? `${sel.kind === 'identity' ? 'Identitas' : 'Mobil'}: ${sel.user?.name}` : ''}
        footer={
          sel?.status === 'pending' && (
            <div className="row" style={{ '--gap': '8px' }}>
              <button className="btn btn-danger-solid grow" disabled={busy || !reason.trim()} onClick={() => review(false)}>
                Tolak
              </button>
              <button className="btn btn-primary grow" disabled={busy} onClick={() => review(true)}>
                <Icon name="check" className="icon-sm" />
                Setujui
              </button>
            </div>
          )
        }
      >
        {sel && (
          <div className="stack" style={{ '--gap': '14px' }}>
            <div className="card-sub small">
              <b>{sel.user?.name}</b> · {sel.user?.email} · {sel.user?.phone || 'tanpa telepon'}
              {sel.kind === 'vehicle' && (
                <div style={{ marginTop: 4 }}>
                  Data yang diisi: <b>{sel.car_model}</b>
                  {sel.car_color ? `, ${sel.car_color}` : ''}, pelat <b>{sel.car_plate}</b>
                </div>
              )}
              <div className="xs muted" style={{ marginTop: 4 }}>
                Dikirim {fmtDate(sel.submitted_at)}
                {sel.reviewed_at ? ` · ditinjau ${fmtDate(sel.reviewed_at)}` : ''}
              </div>
            </div>
            <div className={`kyc-photos kyc-photos-${sel.kind}`}>
              {SLOTS[sel.kind].map(([slot, label]) => (
                <Photo key={slot} id={sel.files[slot]} label={label} onZoom={(url, l) => setZoom({ url, label: l })} />
              ))}
            </div>
            <ul className="kyc-checklist small">
              {sel.kind === 'identity' ? (
                <>
                  <li>Wajah di selfie sama dengan foto di kartu dan di selfie-dengan-kartu.</li>
                  <li>Nama di kartu sama dengan nama akun ({sel.user?.name}).</li>
                  <li>Kartu asli (bukan foto layar/fotokopi), tidak rusak, tulisan terbaca.</li>
                </>
              ) : (
                <>
                  <li>Pelat di foto mobil sama dengan STNK dan dengan yang diisi ({sel.car_plate}).</li>
                  <li>Merek/model di STNK sesuai ({sel.car_model}).</li>
                  <li>STNK masih berlaku.</li>
                </>
              )}
            </ul>
            {sel.status === 'pending' ? (
              <>
                <div className="tag-pick" style={{ justifyContent: 'flex-start' }}>
                  {REJECT[sel.kind].map((r) => (
                    <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(reason === r ? '' : r)}>
                      {r}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span className="field-label">Alasan penolakan (dikirim ke pengguna)</span>
                  <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wajib diisi jika menolak" />
                </label>
              </>
            ) : (
              <p className="small">
                Status: <span className={`chip ${KYC_TONE[sel.status]}`}>{KYC_LABEL[sel.status]}</span>
                {sel.reason ? ` · Alasan: ${sel.reason}` : ''}
              </p>
            )}
            {err && <p className="error">{err}</p>}
          </div>
        )}
      </Sheet>

      {zoom && (
        <div className="zoom" role="dialog" aria-label={zoom.label} onClick={() => setZoom(null)}>
          <img src={zoom.url} alt={zoom.label} />
          <span>{zoom.label} · klik untuk menutup</span>
        </div>
      )}
    </AdminShell>
  );
}
