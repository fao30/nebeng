export default function manifest() {
  return {
    name: 'Numpang: berbagi tumpangan',
    short_name: 'Numpang',
    description: 'Cari tumpangan searah atau isi kursi kosong mobil Anda, dalam kota maupun antar kota.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f7ff',
    theme_color: '#155DFC',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
