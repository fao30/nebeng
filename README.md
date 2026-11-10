# Nebeng — aplikasi berbagi tumpangan

Web app car sharing ala BlaBlaCar: satu akun bisa menjadi **penumpang** dan **driver** (ganti mode di bar atas),
trip dalam kota maupun antar kota berbasis titik jemput/antar di peta, negosiasi harga, dan live location sharing.

- `backend/` — API Go (hanya standard library, Go 1.24+). Penyimpanan in-memory + snapshot file JSON.
- `frontend/` — Next.js 15 (App Router, JavaScript). Peta Leaflet + OpenStreetMap, pencarian alamat via Nominatim.

## Fitur

Logika inti mengikuti aplikasi bibig (React Native), dibawa ke web.

**Harga dan kursi per segmen**
- Rute = asal → titik stop (maks. 10, di mana saja) → tujuan. Tiap ruas punya harga per kursi sendiri
  (ada harga saran Rp650/km jarak jalan, bisa diubah dengan tombol +/−).
- Penumpang membayar ruas yang ia tempuh saja; naik/turun di tengah ruas dihitung proporsional.
- Kursi dan koper dihitung per ruas: kursi yang kosong setelah penumpang turun bisa dipesan lagi untuk ruas berikutnya.
- Perkiraan jam lewat di setiap titik (dan jam jemput tiap penumpang) dihitung otomatis.

**Mode penumpang**
- Cari trip dari titik jemput & antar, masing-masing dengan radius sendiri. Contoh: antar ke Tambun radius 15 km →
  trip yang berakhir di Cikarang ikut muncul. Pencocokan memakai seluruh rute + titik stop dan arah perjalanan.
- Urutkan: paling awal, termurah, terdekat dari titik jemput, terdekat ke tujuan.
- Filter jam berangkat (dengan jumlah trip per rentang), koper, dan kenyamanan
  (pesan instan, maks. 2 di belakang, paket, barang besar, hewan, kursi bayi, merokok).
- Pesan: pilih titik jemput/antar, jumlah orang & koper. **Pesan instan** langsung terkonfirmasi bila setuju harga driver;
  bisa juga **ajukan harga sendiri** (negosiasi bolak-balik).
- **Minta tumpangan**: pasang permintaan; driver menawarkan harga + jam jemput, penumpang terima/tawar/tolak.

**Mode driver**
- Buat trip bertahap: Rute → Waktu → Harga per ruas → Detail (kursi, koper, kenyamanan, pesan instan/persetujuan) → Tinjau.
- Halaman trip: harga per ruas, keterisian kursi per ruas, daftar penumpang & negosiasi, mulai/selesai/batal trip.
- Permintaan penumpang: searah trip tertentu (jarak dari rute & titik stop) atau per area, dengan radius jemput/antar.
  Menawarkan tumpangan wajib memilih trip yang sudah dibuat; harga & jam jemput terisi otomatis dari trip.

**Kontak, patokan, dan chat**
- Nama lengkap, nomor telepon, dan pelat nomor hanya terlihat setelah pesanan terkonfirmasi di trip yang sama
  (kartu "Peserta trip" dengan tombol telepon & WhatsApp). Sebelum itu hanya nama depan + inisial dan model mobil.
- Setiap titik jemput, antar, dan titik stop bisa diberi patokan, misalnya "depan Indomaret, pagar hijau".
- Chat per pesanan antara driver dan penumpang (selama negosiasi atau terkonfirmasi), real-time lewat
  Server-Sent Events: pesan dan perubahan tawaran langsung muncul di layar lawan bicara.

**Panel admin (CRM)** — `/admin`, login dengan akun tim (lihat bawah)
- Ringkasan: pengguna, trip aktif, pesanan, nilai transaksi, permintaan terbuka, jumlah chat.
- Tarif & waktu tempuh: harga saran per km, harga minimum per ruas, menit per km (dalam kota / antar kota),
  faktor jarak jalan. Langsung dipakai untuk harga saran dan perkiraan jam di seluruh aplikasi.
- Trip: filter tanggal, harga per kursi, nama/email/telepon driver atau penumpang, status; detail pesanan & chat.
- Percakapan: semua chat dan tawar-menawar, bisa dicari per nama dan tanggal.
- Pengguna: daftar akun dengan jumlah trip, pesanan, permintaan.
- Tambah admin lain lewat env backend `ADMIN_EMAILS=email1@x.com,email2@y.com` (akun harus sudah daftar).

**Live location**
- Driver dan penumpang yang terkonfirmasi berbagi GPS (tiap ±3 detik), tampil real-time (Server-Sent Events).
- Link pantau publik `/live/<token>` untuk keluarga, tanpa login.

**Tampilan**
- Font Plus Jakarta Sans, palet ungu-nila, kartu dengan garis waktu rute, tab bawah di HP, panel filter dari bawah layar.

## Akun demo (dibuat otomatis saat data kosong)

| Email | Peran contoh |
|---|---|
| budi@demo.id, rina@demo.id | driver (sudah punya trip Jakarta–Bandung, Bogor–Jakarta, Sukabumi–Bogor, dll.) |
| sari@demo.id, andi@demo.id | penumpang (Sari sudah terkonfirmasi di trip Monas–KM 97 + chat, Andi sedang nego trip Semanggi) |

Password semua akun demo: `demo123`. Matikan dengan `SEED_DEMO=false`.

**Akun tim (admin):** `fakhrul@nebeng.id`, `nanda@nebeng.id`, `admin@nebeng.id`. Akun ini dibuat ulang otomatis
setiap server menyala (`backend/accounts.go`). Repo ini publik, jadi yang disimpan hanya hash PBKDF2;
password dibagikan terpisah, tidak pernah di-commit.

## Menjalankan lokal

```bash
# backend
cd backend
go run .                 # http://localhost:8080

# frontend (terminal lain)
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev              # http://localhost:3000
```

Catatan: GPS browser hanya jalan di `https://` atau `localhost`. Untuk tes live sharing dari HP, pakai URL hasil deploy.

## Peta dan pencarian alamat

Urutan penyedia (otomatis, dengan cadangan bila gagal):

0. **Google Maps Platform** — `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (+ opsional `NEXT_PUBLIC_GOOGLE_MAP_ID`).
   Peta Google Maps + pencarian **Places API (New) Autocomplete** dengan session token (koordinat diambil
   hanya saat alamat dipilih) + Geocoding API untuk klik di peta. Aktifkan ketiga API itu dan billing di
   Google Cloud, batasi key ke domain Anda (HTTP referrers) dan ke tiga API tersebut. Sesuai ketentuan Google,
   hasil Places hanya ditampilkan di peta Google, jadi bila key diisi, peta juga memakai Google.
1. **MapTiler** — `NEXT_PUBLIC_MAPTILER_KEY`. Tile peta di Leaflet + Geocoding API untuk kolom titik jemput/antar
   (dibatasi ke Indonesia, diurutkan dekat lokasi). Jika tile gagal dimuat, peta beralih ke OpenStreetMap.
2. **AMap** ([mapsplatform.opnavi.com](https://mapsplatform.opnavi.com)) — `NEXT_PUBLIC_AMAP_KEY`,
   `NEXT_PUBLIC_AMAP_SECURITY_CODE`, `NEXT_PUBLIC_AMAP_REGION` (`sg`/`de`). Dipakai hanya bila MapTiler tidak diisi.
3. **OpenStreetMap + Nominatim** — tanpa key.

Pencarian memakai `useDebounce` (350 ms): request baru dikirim setelah berhenti mengetik, request lama
dibatalkan (AbortController), dan hasil disimpan di cache.

Isi env di Vercel → Settings → Environment Variables, lalu **Redeploy**. Batasi key ke domain Anda di dashboard
penyedia (MapTiler: *Allowed HTTP Origins*). Jangan commit key: repo ini publik.

## Deploy untuk testing

Vercel cocok untuk Next.js, tetapi tidak cocok untuk API ini (butuh proses yang terus hidup untuk live streaming
dan menyimpan data di memori). Jadi: **backend ke Render (gratis), frontend ke Vercel.**

### 1. Push ke GitHub
```bash
git init && git add . && git commit -m "Nebeng"
git remote add origin git@github.com:<akun>/nebeng.git && git push -u origin main
```

### 2. Backend → Render
1. render.com → **New → Blueprint** → pilih repo. `render.yaml` otomatis membuat service `nebeng-api` dari `backend/Dockerfile`.
2. Tunggu build, buka `https://nebeng-api-xxxx.onrender.com/api/health` → harus `{"ok":true}`.

Alternatif: Railway / Fly.io / VPS dengan Dockerfile yang sama. Variabel env:

| Env | Default | Keterangan |
|---|---|---|
| `PORT` | 8080 | |
| `JWT_SECRET` | (dev) | **wajib** diisi di server |
| `ALLOWED_ORIGINS` | `*` | isi domain Vercel untuk produksi, pisahkan koma |
| `DATA_FILE` | `data/nebeng.json` | lokasi snapshot data |
| `SEED_DEMO` | `true` | buat akun & trip demo jika data kosong |
| `APP_TIMEZONE` | Asia/Jakarta | untuk filter tanggal |

> Render free tier tidur setelah 15 menit idle (request pertama ±30 detik) dan disknya tidak permanen:
> data kembali ke data demo saat restart. Untuk produksi, ganti `store.go` dengan Postgres.

### 3. Frontend → Vercel
1. vercel.com → **Add New → Project** → pilih repo, **Root Directory: `frontend`** (framework Next.js terdeteksi otomatis).
2. Environment Variable: `NEXT_PUBLIC_API_URL = https://nebeng-api-xxxx.onrender.com`
3. Deploy. Atau via CLI:
   ```bash
   cd frontend && npx vercel --prod -e NEXT_PUBLIC_API_URL=https://nebeng-api-xxxx.onrender.com
   ```

## Skenario uji cepat
1. Login `andi@demo.id` (mode Penumpang) → **Cari trip**, titik antar "Tambun", radius antar 15 km → muncul trip Semanggi → Cikarang (via Bekasi Barat).
   Isi juga titik jemput "Cawang" & antar "Bandung" → muncul trip Monas → Gedung Sate (stop di Cawang dan rest area KM 97).
2. Buka trip → pesan 1 kursi, ajukan Rp95.000.
3. Login `budi@demo.id` di browser lain → mode Driver → **Trip saya** → buka trip → tawar balik Rp105.000.
4. Andi menerima → nomor WhatsApp kedua pihak muncul.
5. Budi → **Mulai trip dan bagikan lokasi** (izinkan GPS). Andi membuka trip → posisi mobil bergerak di peta; salin link pantau dan buka di HP lain.
6. Budi → **Permintaan penumpang** → tab "Berdasarkan area" → tawarkan trip ke permintaan Sari; login Sari → **Minta tumpangan** → terima/tawar.

## API ringkas

| Method | Path | |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | `{name,email,phone,password}` → `{token,user}` |
| GET/PUT | /api/me | profil & kendaraan |
| GET | /api/trips?from_lat&from_lng&from_radius_km&to_lat&to_lng&to_radius_km&date&kind&seats&luggage | cari trip; `order_by=earliest|cheapest|nearest_pickup|nearest_dropoff`, filter `instant,pets,smoking,baby_seat,parcel,cargo,max2_back=1` |
| POST | /api/trips | buat trip `{origin, stops[], destination, depart_at, seats, luggage, max_luggage, segment_prices[], negotiable, instant_booking, amenities{max2_back,pets,smoking,baby_seat,parcel,cargo}}` |
| GET | /api/trips/{id}?from_lat&from_lng&to_lat&to_lng | detail + `quote` (harga, kursi, koper, jam jemput untuk ruas Anda) |
| POST | /api/trips/{id}/status | `{action: start|complete|cancel}` |
| POST | /api/trips/{id}/bookings | pesan `{pickup, dropoff, seats, luggage, price, message}` |
| POST | /api/bookings/{id}/respond | `{action: accept|counter|reject|cancel, price, message}` |
| GET/POST | /api/requests | permintaan penumpang (`trip_id` atau area, + `from_radius_km`/`to_radius_km`) |
| POST | /api/requests/{id}/offer | driver menawarkan trip `{trip_id, price, message, offered_time}` |
| POST | /api/requests/{id}/cancel | |
| GET | /api/my/trips, /api/my/bookings, /api/my/requests | dashboard |
| GET | /api/trips/{id}/share | token link pantau |
| POST | /api/trips/{id}/location | kirim GPS `{lat,lng,heading,speed}` |
| GET | /api/live/{token}, /api/live/{token}/stream | snapshot & SSE publik |
| GET/POST | /api/bookings/{id}/messages | chat pesanan (driver/penumpang; admin baca) |
| GET | /api/bookings/{id}/stream?token= | SSE real-time: pesan baru & perubahan pesanan |
| GET | /api/settings | tarif & waktu tempuh (publik) |
| PUT | /api/admin/settings | ubah tarif & waktu tempuh (admin) |
| GET | /api/admin/stats, /api/admin/trips, /api/admin/users, /api/admin/conversations | CRM admin |

## Batasan versi ini
- Rute digambar sebagai garis lurus antar titik (asal → stop → tujuan); pencocokan juga memakai garis ini,
  jadi makin banyak titik stop, makin akurat. Untuk rute jalan sebenarnya, tambahkan OSRM/Google Directions.
- Belum ada pembayaran, rating, dan notifikasi push (halaman dan chat memperbarui data berkala).
- Nominatim & tile OSM gratis punya batas pemakaian; pakai penyedia berbayar untuk produksi.
