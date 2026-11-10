'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';

// Bump together with TermsVersion in the backend (trust.go).
export const TERMS_VERSION = '2026-11-10.2';

/** The Terms & Conditions text. Shown in the sign-up popup and on /syarat. */
export function TermsContent() {
  return (
    <div className="terms">
      <p className="xs muted">Berlaku sejak 10 November 2026</p>
      <p>
        Numpang menghubungkan orang yang ingin <b>numpang</b> (<b>penumpang</b>) dengan <b>pemilik mobil</b> yang searah dan punya kursi kosong. Dengan membuat akun,
        Anda setuju dengan ketentuan di bawah ini.
      </p>

      <div className="terms-key">
        <div className="terms-key-head">
          <Icon name="shield" />
          <b>Aturan utama: semua perjalanan dan pembayaran lewat aplikasi Numpang</b>
        </div>
        <div className="terms-key-cols">
          <div>
            <h4>
              <Icon name="car" className="icon-sm" />
              Untuk pemilik mobil
            </h4>
            <ul>
              <li>
                <b>Jangan pernah mengambil penumpang di luar aplikasi</b>, termasuk kesepakatan lewat WhatsApp, telepon, atau langsung di jalan tanpa pesanan
                di Numpang.
              </li>
              <li>
                Perjalanan di luar aplikasi <b>tidak bisa dilacak</b>: tidak ada lokasi live, tidak ada kode naik, dan tidak ada data siapa yang ada di mobil
                Anda. Demi keamanan Anda sendiri, semua penumpang harus punya pesanan yang sudah disetujui.
              </li>
              <li>Jangan meminta bayaran tambahan di luar harga yang disepakati di aplikasi.</li>
            </ul>
          </div>
          <div>
            <h4>
              <Icon name="user" className="icon-sm" />
              Untuk penumpang
            </h4>
            <ul>
              <li>
                <b>Jangan mau diajak naik atau membayar di luar aplikasi</b>, walaupun ditawari harga lebih murah.
              </li>
              <li>
                Perjalanan di luar aplikasi <b>tidak punya riwayat</b>: tidak tercatat siapa pemilik mobilnya, mobil dan pelatnya, rutenya, dan harganya. Jika terjadi
                masalah, kehilangan barang, atau sengketa, kami tidak bisa membantu.
              </li>
              <li>Naik hanya ke mobil yang pelatnya sama dengan yang tertera di aplikasi.</li>
            </ul>
          </div>
        </div>
        <p className="small">
          Nomor telepon yang terlihat setelah pesanan disetujui hanya untuk koordinasi penjemputan trip tersebut, bukan untuk membuat perjalanan baru di luar
          Numpang. Pelanggaran aturan ini dapat membuat akun <b>diblokir</b>.
        </p>
      </div>

      <h3>1. Akun</h3>
      <ul>
        <li>Anda berusia minimal 17 tahun, memakai nama asli, dan nomor WhatsApp yang aktif.</li>
        <li>Satu orang satu akun. Jangan meminjamkan akun atau password kepada orang lain.</li>
        <li>Anda bertanggung jawab atas semua aktivitas di akun Anda.</li>
      </ul>

      <h3>2. Verifikasi identitas dan kendaraan</h3>
      <p>
        Numpang berarti naik mobil orang lain atau membawa orang lain di mobil Anda. Supaya setiap orang di dalam mobil jelas identitasnya, semua akun wajib
        diverifikasi sebelum bisa numpang atau memberi tumpangan.
      </p>
      <ul>
        <li>
          <b>Semua akun</b> mengirim: (1) foto KTP atau SIM yang masih berlaku, (2) <b>verifikasi wajah</b> berupa foto selfie langsung dari kamera, dan
          (3) selfie sambil memegang KTP/SIM yang sama.
        </li>
        <li>
          <b>Untuk mengaktifkan fitur pemilik mobil</b>, tambahan: (4) foto mobil tampak depan dengan pelat nomor terlihat jelas dan (5) foto STNK yang
          masih berlaku. Pelat dan merek mobil di aplikasi harus sama dengan STNK.
        </li>
        <li>
          Semua data diperiksa <b>manual oleh admin Numpang, maksimal 1x24 jam</b> sejak dikirim. Hasilnya dikirim lewat notifikasi. Jika ditolak, alasannya
          ditampilkan dan Anda bisa mengirim ulang.
        </li>
        <li>Nama akun harus sama dengan nama di KTP/SIM. Setelah diverifikasi, nama dan data mobil hanya bisa diubah lewat admin atau verifikasi ulang.</li>
        <li>
          <b>Kenapa ini perlu, demi keselamatan:</b> penumpang tahu siapa yang mengemudi dan mobil mana yang harus dinaiki; pemilik mobil tahu siapa yang
          masuk ke mobilnya; akun palsu dan penipu lebih sulit masuk; dan jika terjadi kejadian serius, ada data yang jelas untuk membantu korban dan pihak
          berwenang.
        </li>
        <li>
          Foto verifikasi <b>disimpan terenkripsi</b> dan <b>hanya bisa dilihat oleh tim verifikasi Numpang</b>. Foto KTP/SIM, wajah, STNK, dan nomor
          identitas Anda <b>tidak pernah ditampilkan ke pengguna lain</b>; mereka hanya melihat tanda &ldquo;Terverifikasi&rdquo;. Data ini hanya
          dibagikan kepada aparat penegak hukum jika diwajibkan oleh hukum.
        </li>
        <li>
          Memakai dokumen palsu, dokumen milik orang lain, foto wajah orang lain, atau mobil yang tidak sesuai STNK membuat akun <b>langsung diblokir</b> dan
          dapat kami laporkan kepada pihak berwenang.
        </li>
        <li>Anda dapat meminta penghapusan akun beserta foto verifikasi dengan menghubungi admin.</li>
      </ul>

      <h3>3. Kewajiban pemilik mobil</h3>
      <ul>
        <li>Memiliki SIM dan STNK yang berlaku, dan kendaraan dalam kondisi layak jalan. Hanya mengemudikan mobil yang sudah diverifikasi di aplikasi.</li>
        <li>Mobil dan pelat nomor sesuai dengan yang tercantum di trip.</li>
        <li>Mengemudi dengan aman, mematuhi aturan lalu lintas, tidak mengemudi dalam keadaan mengantuk, mabuk, atau di bawah pengaruh obat.</li>
        <li>Menjemput dan mengantar di titik yang tercantum di rute, sesuai jam yang disepakati.</li>
      </ul>

      <h3>4. Kewajiban penumpang</h3>
      <ul>
        <li>Datang tepat waktu di titik naik. Jika batal, batalkan lewat aplikasi secepatnya.</li>
        <li>Membayar sesuai harga yang disepakati di aplikasi.</li>
        <li>Bersikap sopan, menjaga kebersihan mobil, dan membawa barang sesuai jumlah koper yang dipesan.</li>
      </ul>

      <h3>5. Kode naik dan keselamatan</h3>
      <ul>
        <li>
          Saat naik, penumpang menunjukkan <b>kode naik</b> dari aplikasi dan pemilik mobil memasukkannya. Dengan begitu pemilik mobil dan penumpang sama-sama tahu
          penumpang sudah di dalam mobil.
        </li>
        <li>Penumpang: berikan kode hanya setelah memastikan pemilik mobil dan pelat nomor sesuai.</li>
        <li>Gunakan fitur lokasi live untuk berbagi perjalanan dengan keluarga. Dalam keadaan darurat, hubungi 112.</li>
      </ul>

      <h3>6. Harga, pembatalan, dan negosiasi</h3>
      <ul>
        <li>Harga adalah yang tertera atau yang disepakati lewat fitur tawar di aplikasi.</li>
        <li>Membatalkan mendadak atau tidak datang (no-show) berulang kali dapat dilaporkan dan berujung pada pembatasan akun.</li>
      </ul>

      <h3>7. Rating dan laporan</h3>
      <ul>
        <li>Setelah perjalanan, pemilik mobil dan penumpang dapat saling memberi rating. Berikan rating yang jujur.</li>
        <li>Gunakan tombol &ldquo;Laporkan&rdquo; untuk melaporkan pelanggaran ke admin. Laporan palsu atau untuk balas dendam dilarang.</li>
      </ul>

      <h3>8. Yang dilarang</h3>
      <ul>
        <li>Pelecehan, ancaman, kekerasan, atau diskriminasi dalam bentuk apa pun.</li>
        <li>Membawa narkoba, senjata, atau barang terlarang lainnya.</li>
        <li>Akun palsu, penipuan, atau memakai Numpang untuk usaha angkutan tanpa izin.</li>
      </ul>

      <h3>9. Pemblokiran akun</h3>
      <p>
        Admin dapat menangguhkan atau memblokir akun yang melanggar ketentuan ini. Akun yang diblokir tidak bisa masuk, dan trip maupun pesanan yang masih
        aktif akan dibatalkan.
      </p>

      <h3>10. Data dan privasi</h3>
      <p>
        Kami menyimpan data verifikasi (lihat bagian 2), riwayat trip, pesanan, harga, chat, dan lokasi selama trip berlangsung untuk keamanan dan penyelesaian masalah. Admin dapat membaca
        chat pesanan untuk menangani laporan. Nomor telepon hanya terlihat antara pemilik mobil dan penumpang di trip yang sudah disetujui.
      </p>

      <h3>11. Batas tanggung jawab</h3>
      <p>
        Numpang adalah platform penghubung, bukan perusahaan angkutan. Kami tidak bertanggung jawab atas perjalanan, pembayaran, atau kesepakatan yang
        dibuat di luar aplikasi.
      </p>

      <h3>12. Perubahan ketentuan</h3>
      <p>Ketentuan ini dapat diperbarui. Jika ada perubahan, Anda akan diminta menyetujui versi terbaru saat membuka aplikasi.</p>
    </div>
  );
}

/**
 * Popup with the terms. The accept button unlocks once the user ticks that
 * they understood the off-app rule. Without `onClose` it can't be dismissed.
 */
export function TermsModal({ open, onAccept, onClose, busy, acceptLabel = 'Setuju dan lanjutkan', footerExtra }) {
  const [ok, setOk] = useState(false);
  const body = useRef(null);
  useEffect(() => {
    if (open) {
      setOk(false);
      body.current?.scrollTo(0, 0);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet terms-sheet" role="dialog" aria-modal="true" aria-label="Syarat & Ketentuan Numpang">
        <div className="sheet-head">
          <h3>Syarat & Ketentuan Numpang</h3>
          {onClose && (
            <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Tutup">
              <Icon name="x" />
            </button>
          )}
        </div>
        <div className="sheet-body" ref={body}>
          <TermsContent />
        </div>
        <div className="sheet-foot stack" style={{ '--gap': '12px' }}>
          <label className="terms-check">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
            <span>
              Saya sudah membaca dan menyetujui Syarat & Ketentuan, dan <b>tidak akan melakukan perjalanan atau pembayaran di luar aplikasi Numpang</b>.
            </span>
          </label>
          <button className="btn btn-primary btn-block" disabled={!ok || busy} onClick={onAccept}>
            {acceptLabel}
          </button>
          {footerExtra}
        </div>
      </div>
    </div>
  );
}

export function TermsLink({ children = 'Syarat & Ketentuan' }) {
  return (
    <Link href="/syarat" target="_blank">
      {children}
    </Link>
  );
}
