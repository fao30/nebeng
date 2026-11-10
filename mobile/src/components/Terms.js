import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../Icon';
import { colors, t } from '../theme';
import { Button } from '../ui';

// Same text as the web app (frontend/components/Terms.js). **bold** marks emphasis.
const KEY = {
  driver: [
    '**Jangan pernah mengambil penumpang di luar aplikasi**, termasuk kesepakatan lewat WhatsApp, telepon, atau langsung di jalan tanpa pesanan di Nebeng.',
    'Perjalanan di luar aplikasi **tidak bisa dilacak**: tidak ada lokasi live, tidak ada kode naik, dan tidak ada data siapa yang ada di mobil Anda. Demi keamanan Anda sendiri, semua penumpang harus punya pesanan yang sudah disetujui.',
    'Jangan meminta bayaran tambahan di luar harga yang disepakati di aplikasi.',
  ],
  passenger: [
    '**Jangan mau diajak naik atau membayar di luar aplikasi**, walaupun ditawari harga lebih murah.',
    'Perjalanan di luar aplikasi **tidak punya riwayat**: tidak tercatat siapa pemilik mobilnya, mobil dan pelatnya, rutenya, dan harganya. Jika terjadi masalah, kehilangan barang, atau sengketa, kami tidak bisa membantu.',
    'Naik hanya ke mobil yang pelatnya sama dengan yang tertera di aplikasi.',
  ],
  note: 'Nomor telepon yang terlihat setelah pesanan disetujui hanya untuk koordinasi penjemputan trip tersebut, bukan untuk membuat perjalanan baru di luar Nebeng. Pelanggaran aturan ini dapat membuat akun **diblokir**.',
};

const SECTIONS = [
  ['1. Akun', null, ['Anda berusia minimal 17 tahun, memakai nama asli, dan nomor WhatsApp yang aktif.', 'Satu orang satu akun. Jangan meminjamkan akun atau password kepada orang lain.', 'Anda bertanggung jawab atas semua aktivitas di akun Anda.']],
  [
    '2. Verifikasi identitas dan kendaraan',
    'Nebeng berarti naik mobil orang lain atau membawa orang lain di mobil Anda. Supaya setiap orang di dalam mobil jelas identitasnya, semua akun wajib diverifikasi sebelum bisa nebeng atau memberi tumpangan.',
    [
      '**Semua akun** mengirim: (1) foto KTP atau SIM yang masih berlaku, (2) **verifikasi wajah** berupa foto selfie langsung dari kamera, dan (3) selfie sambil memegang KTP/SIM yang sama.',
      '**Untuk mengaktifkan fitur pemilik mobil**, tambahan: (4) foto mobil tampak depan dengan pelat nomor terlihat jelas dan (5) foto STNK yang masih berlaku. Pelat dan merek mobil di aplikasi harus sama dengan STNK.',
      'Semua data diperiksa **manual oleh admin Nebeng, maksimal 1x24 jam** sejak dikirim. Hasilnya dikirim lewat notifikasi. Jika ditolak, alasannya ditampilkan dan Anda bisa mengirim ulang.',
      'Nama akun harus sama dengan nama di KTP/SIM. Setelah diverifikasi, nama dan data mobil hanya bisa diubah lewat admin atau verifikasi ulang.',
      '**Kenapa ini perlu, demi keselamatan:** penumpang tahu siapa yang mengemudi dan mobil mana yang harus dinaiki; pemilik mobil tahu siapa yang masuk ke mobilnya; akun palsu dan penipu lebih sulit masuk; dan jika terjadi kejadian serius, ada data yang jelas untuk membantu korban dan pihak berwenang.',
      'Foto verifikasi **disimpan terenkripsi** dan **hanya bisa dilihat oleh tim verifikasi Nebeng**. Foto KTP/SIM, wajah, STNK, dan nomor identitas Anda **tidak pernah ditampilkan ke pengguna lain**; mereka hanya melihat tanda "Terverifikasi". Data ini hanya dibagikan kepada aparat penegak hukum jika diwajibkan oleh hukum.',
      'Memakai dokumen palsu, dokumen milik orang lain, foto wajah orang lain, atau mobil yang tidak sesuai STNK membuat akun **langsung diblokir** dan dapat kami laporkan kepada pihak berwenang.',
      'Anda dapat meminta penghapusan akun beserta foto verifikasi dengan menghubungi admin.',
    ],
  ],
  [
    '3. Kewajiban pemilik mobil',
    null,
    [
      'Memiliki SIM dan STNK yang berlaku, dan kendaraan dalam kondisi layak jalan. Hanya mengemudikan mobil yang sudah diverifikasi di aplikasi.',
      'Mobil dan pelat nomor sesuai dengan yang tercantum di trip.',
      'Mengemudi dengan aman, mematuhi aturan lalu lintas, tidak mengemudi dalam keadaan mengantuk, mabuk, atau di bawah pengaruh obat.',
      'Menjemput dan mengantar di titik yang tercantum di rute, sesuai jam yang disepakati.',
    ],
  ],
  ['4. Kewajiban penumpang', null, ['Datang tepat waktu di titik naik. Jika batal, batalkan lewat aplikasi secepatnya.', 'Membayar sesuai harga yang disepakati di aplikasi.', 'Bersikap sopan, menjaga kebersihan mobil, dan membawa barang sesuai jumlah koper yang dipesan.']],
  [
    '5. Kode naik dan keselamatan',
    null,
    [
      'Saat naik, penumpang menunjukkan **kode naik** dari aplikasi dan pemilik mobil memasukkannya. Dengan begitu pemilik mobil dan penumpang sama-sama tahu penumpang sudah di dalam mobil.',
      'Penumpang: berikan kode hanya setelah memastikan pemilik mobil dan pelat nomor sesuai.',
      'Gunakan fitur lokasi live untuk berbagi perjalanan dengan keluarga. Dalam keadaan darurat, hubungi 112.',
    ],
  ],
  ['6. Harga, pembatalan, dan negosiasi', null, ['Harga adalah yang tertera atau yang disepakati lewat fitur tawar di aplikasi.', 'Membatalkan mendadak atau tidak datang (no-show) berulang kali dapat dilaporkan dan berujung pada pembatasan akun.']],
  ['7. Rating dan laporan', null, ['Setelah perjalanan, pemilik mobil dan penumpang dapat saling memberi rating. Berikan rating yang jujur.', 'Gunakan tombol "Laporkan" untuk melaporkan pelanggaran ke admin. Laporan palsu atau untuk balas dendam dilarang.']],
  ['8. Yang dilarang', null, ['Pelecehan, ancaman, kekerasan, atau diskriminasi dalam bentuk apa pun.', 'Membawa narkoba, senjata, atau barang terlarang lainnya.', 'Akun palsu, penipuan, atau memakai Nebeng untuk usaha angkutan tanpa izin.']],
  ['9. Pemblokiran akun', 'Admin dapat menangguhkan atau memblokir akun yang melanggar ketentuan ini. Akun yang diblokir tidak bisa masuk, dan trip maupun pesanan yang masih aktif akan dibatalkan.', null],
  [
    '10. Data dan privasi',
    'Kami menyimpan data verifikasi (lihat bagian 2), riwayat trip, pesanan, harga, chat, dan lokasi selama trip berlangsung untuk keamanan dan penyelesaian masalah. Admin dapat membaca chat pesanan untuk menangani laporan. Nomor telepon hanya terlihat antara pemilik mobil dan penumpang di trip yang sudah disetujui.',
    null,
  ],
  ['11. Batas tanggung jawab', 'Nebeng adalah platform penghubung, bukan perusahaan angkutan. Kami tidak bertanggung jawab atas perjalanan, pembayaran, atau kesepakatan yang dibuat di luar aplikasi.', null],
  ['12. Perubahan ketentuan', 'Ketentuan ini dapat diperbarui. Jika ada perubahan, Anda akan diminta menyetujui versi terbaru saat membuka aplikasi.', null],
];

function Rich({ children, style }) {
  const parts = String(children).split('**');
  return (
    <Text style={[t.small, style]}>
      {parts.map((p, i) => (
        <Text key={i} style={i % 2 ? { fontWeight: '800', color: colors.ink } : null}>
          {p}
        </Text>
      ))}
    </Text>
  );
}

function Bullets({ items }) {
  return items.map((x, i) => (
    <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
      <Text style={t.small}>•</Text>
      <Rich style={{ flex: 1 }}>{x}</Rich>
    </View>
  ));
}

export function TermsContent() {
  return (
    <View style={{ gap: 6 }}>
      <Text style={t.xs}>Berlaku sejak 10 November 2026</Text>
      <Rich>Nebeng menghubungkan orang yang ingin **nebeng** (**penumpang**) dengan **pemilik mobil** yang searah dan punya kursi kosong. Dengan membuat akun, Anda setuju dengan ketentuan di bawah ini.</Rich>
      <View style={{ backgroundColor: colors.amber50, borderRadius: 14, padding: 14, marginVertical: 8, gap: 6, borderWidth: 1, borderColor: '#efd9ad' }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="shield" color={colors.amber} />
          <Text style={[t.body, t.strong, { flex: 1 }]}>Aturan utama: semua perjalanan dan pembayaran lewat aplikasi Nebeng</Text>
        </View>
        <Text style={[t.body, t.strong, { marginTop: 6 }]}>Untuk pemilik mobil</Text>
        <Bullets items={KEY.driver} />
        <Text style={[t.body, t.strong, { marginTop: 8 }]}>Untuk penumpang</Text>
        <Bullets items={KEY.passenger} />
        <Rich style={{ marginTop: 8 }}>{KEY.note}</Rich>
      </View>
      {SECTIONS.map(([h, p, list]) => (
        <View key={h} style={{ marginTop: 10 }}>
          <Text style={[t.h3, { marginBottom: 4 }]}>{h}</Text>
          {p && <Rich>{p}</Rich>}
          {list && <Bullets items={list} />}
        </View>
      ))}
    </View>
  );
}

/** Full-screen terms. Accept unlocks after ticking the off-app rule. */
export function TermsModal({ open, onAccept, onClose, busy, acceptLabel = 'Setuju dan lanjutkan', onDecline }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (open) setOk(false);
  }, [open]);
  return (
    <Modal visible={!!open} animationType="slide" onRequestClose={onClose || (() => {})}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.line2 }}>
          <Text style={t.h3}>Syarat & Ketentuan Nebeng</Text>
          {onClose && (
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Tutup">
              <Icon name="x" />
            </Pressable>
          )}
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          <TermsContent />
        </ScrollView>
        <View style={{ padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: colors.line2 }}>
          <Pressable onPress={() => setOk(!ok)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }} accessibilityRole="checkbox" accessibilityState={{ checked: ok }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: ok ? colors.primary : colors.muted, backgroundColor: ok ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              {ok && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
            </View>
            <Rich style={{ flex: 1 }}>Saya sudah membaca dan menyetujui Syarat & Ketentuan, dan **tidak akan melakukan perjalanan atau pembayaran di luar aplikasi Nebeng**.</Rich>
          </Pressable>
          <Button title={acceptLabel} disabled={!ok} busy={busy} onPress={onAccept} />
          {onDecline && (
            <Text onPress={onDecline} style={{ textAlign: 'center', color: colors.ink2, fontWeight: '600' }}>
              Tidak setuju, keluar
            </Text>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
