import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// Plus Jakarta Sans: dibuat desainer tipe Indonesia, angka tabularnya jelas di layar kecil (DESIGN.md).
const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: { default: 'InsightUsaha', template: '%s · InsightUsaha' },
  description: 'Baca data penjualan warung dan kedaimu: menu naik dan turun, jam ramai, pasangan menu, dan saran tindakan.',
};

// Terapkan tema sebelum render agar tidak berkedip: pilihan pengguna, lalu setelan perangkat.
const THEME_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem('iu-theme')}catch(e){}
if(t!=='light'&&t!=='dark'){t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
document.documentElement.setAttribute('data-theme',t)})()`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="id" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <a href="#konten" className="sr-only z-50 rounded-control bg-ink px-3 py-2 text-surface focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          Lewati ke konten
        </a>
        {children}
      </body>
    </html>
  );
}
