import './globals.css';
import { Providers } from './providers';
import Nav from '@/components/Nav';

export const metadata = {
  title: 'Numpang — berbagi tumpangan',
  description: 'Cari tumpangan searah atau isi kursi kosong mobil Anda, dalam kota maupun antar kota.',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Mulish:wght@400..900&display=swap"
        />
      </head>
      <body>
        <Providers>
          <Nav />
          <main className="page">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
