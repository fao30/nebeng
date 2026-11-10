'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { fmtDate, fmtDay, shortPlace } from '@/lib/format';
import AdminShell from '@/components/AdminShell';
import BlockSheet from '@/components/BlockSheet';
import Chat from '@/components/Chat';
import Icon from '@/components/Icon';
import { Avatar, Sheet } from '@/components/ui';

const STATUS = {
  open: ['Baru', 'tone-red'],
  reviewing: ['Ditinjau', 'tone-amber'],
  resolved: ['Selesai', 'tone-mint'],
  dismissed: ['Ditutup', 'chip-muted'],
};

export default function AdminReports() {
  const [f, setF] = useState({ q: '', status: '' });
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocking, setBlocking] = useState(null);
  const [chat, setChat] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('q')) setF((x) => ({ ...x, q: q.get('q') }));
  }, []);

  const load = useCallback(() => {
    api(`/admin/reports${qs(f)}`)
      .then((d) => {
        setData(d);
        setErr('');
        const want = new URLSearchParams(window.location.search).get('id');
        setSel((cur) => (cur ? d.items.find((x) => x.id === cur.id) || cur : want ? d.items.find((x) => x.id === want) || null : null));
      })
      .catch((e) => setErr(e.message));
  }, [f]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => setNote(sel?.admin_note || ''), [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(status) {
    setBusy(true);
    try {
      const r = await api(`/admin/reports/${sel.id}`, { method: 'POST', body: { status, admin_note: note } });
      setSel(r);
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
    <AdminShell title="Laporan" desc="Laporan dari driver tentang penumpang dan dari penumpang tentang driver.">
      <div className="stats" style={{ marginBottom: 16 }}>
        {Object.entries(STATUS).map(([k, [label]]) => (
          <button key={k} className={`stat stat-btn ${f.status === k ? 'on' : ''}`} onClick={() => setF({ ...f, status: f.status === k ? '' : k })}>
            <span>{label}</span>
            <b className="tnum">{counts[k] || 0}</b>
          </button>
        ))}
      </div>
      <div className="filterbar">
        <label className="field">
          <span className="field-label">Cari pelapor, terlapor, atau isi</span>
          <input className="input" value={f.q} onChange={set('q')} placeholder="Nama, email, telepon, atau kata" />
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <select className="input" value={f.status} onChange={set('status')}>
            <option value="">Semua</option>
            {Object.entries(STATUS).map(([k, [label]]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Terlapor</th>
              <th>Alasan</th>
              <th>Pelapor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  Belum ada laporan yang cocok.
                </td>
              </tr>
            )}
            {(data?.items || []).map((r) => (
              <tr key={r.id} className="clickable" onClick={() => setSel(r)}>
                <td className="small tnum" style={{ whiteSpace: 'nowrap' }}>
                  {fmtDate(r.created_at)}
                </td>
                <td>
                  <div className="row" style={{ '--gap': '8px' }}>
                    <Avatar name={r.target?.name || '?'} />
                    <div>
                      <b>{r.target?.name}</b>
                      <span className="sub">
                        {r.target_role === 'driver' ? 'Driver' : 'Penumpang'}
                        {r.target?.blocked ? ' · diblokir' : ''}
                        {r.prior_reports ? ` · ${r.prior_reports} laporan lain` : ''}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <b className="small">{r.category_label}</b>
                  {r.text && <div className="xs ink2 clamp-2">{r.text}</div>}
                </td>
                <td className="small">{r.reporter?.name}</td>
                <td>
                  <span className={`chip ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!sel} onClose={() => setSel(null)} title="Detail laporan">
        {sel && (
          <div className="stack" style={{ '--gap': '14px' }}>
            <div className="row-between">
              <span className={`chip ${STATUS[sel.status][1]}`}>{STATUS[sel.status][0]}</span>
              <span className="xs muted">{fmtDate(sel.created_at)}</span>
            </div>
            <div>
              <div className="xs muted">Alasan</div>
              <b>{sel.category_label}</b>
              {sel.text && <p className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{sel.text}</p>}
            </div>
            <div className="grid-2">
              <div className="card-sub">
                <div className="xs muted">Terlapor ({sel.target_role === 'driver' ? 'driver' : 'penumpang'})</div>
                <b>{sel.target?.name}</b>
                <div className="xs ink2">
                  {sel.target?.email}
                  <br />
                  {sel.target?.phone}
                </div>
                <div className="xs" style={{ marginTop: 4 }}>
                  {sel.target_role === 'driver'
                    ? sel.target?.driver_ratings
                      ? `★ ${sel.target.driver_rating} (${sel.target.driver_ratings})`
                      : 'Belum ada rating'
                    : sel.target?.passenger_ratings
                      ? `★ ${sel.target.passenger_rating} (${sel.target.passenger_ratings})`
                      : 'Belum ada rating'}
                  {' · '}
                  {sel.target?.reports_against} laporan
                </div>
              </div>
              <div className="card-sub">
                <div className="xs muted">Pelapor</div>
                <b>{sel.reporter?.name}</b>
                <div className="xs ink2">
                  {sel.reporter?.email}
                  <br />
                  {sel.reporter?.phone}
                </div>
              </div>
            </div>
            {sel.trip && (
              <div className="small ink2">
                <Icon name="route" className="icon-sm" /> Trip {shortPlace(sel.trip.origin)} ke {shortPlace(sel.trip.destination)}, {fmtDay(sel.trip.depart_at)} ·{' '}
                <button className="link" onClick={() => setChat(true)}>
                  Lihat chat pesanan
                </button>
              </div>
            )}
            <label className="field">
              <span className="field-label">Catatan admin (dikirim ke pelapor saat status berubah)</span>
              <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: driver sudah kami peringatkan" />
            </label>
            <div className="row wrap" style={{ '--gap': '8px' }}>
              {sel.status !== 'reviewing' && (
                <button className="btn btn-sm" disabled={busy} onClick={() => update('reviewing')}>
                  Tandai ditinjau
                </button>
              )}
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => update('resolved')}>
                <Icon name="check" className="icon-sm" />
                Selesai ditindaklanjuti
              </button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => update('dismissed')}>
                Tutup tanpa tindakan
              </button>
            </div>
            {sel.target && !sel.target.is_admin && (
              <button className={`btn btn-block ${sel.target.blocked ? 'btn-soft' : 'btn-danger-solid'}`} onClick={() => setBlocking(sel.target)}>
                {sel.target.blocked ? `Buka blokir ${sel.target.name}` : `Blokir ${sel.target.name}`}
              </button>
            )}
          </div>
        )}
      </Sheet>
      {sel && <Chat bookingId={sel.booking_id} role="admin" open={chat} onClose={() => setChat(false)} title="Chat pesanan (admin)" />}
      <BlockSheet user={blocking} presetReason={sel ? `${sel.category_label} (laporan)` : ''} onClose={() => setBlocking(null)} onDone={load} />
    </AdminShell>
  );
}
