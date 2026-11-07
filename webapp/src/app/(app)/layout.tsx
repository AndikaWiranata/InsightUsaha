import { Suspense } from 'react';
import { Logo } from '@/components/ui';
import { MobileNav, NavLink, ThemeToggle } from '@/components/client';
import { Chat } from '@/components/chat';
import { getAccount, getRole } from '@/lib/session';
import { signOut } from '../auth/actions';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="lg:flex">
      <header className="sticky top-0 z-30 border-b border-line bg-paper lg:fixed lg:inset-y-0 lg:w-60 lg:border-r lg:border-b-0">
        <div className="relative flex h-14 items-center justify-between px-4 lg:block lg:h-auto lg:px-0">
          <Suspense fallback={<div className="lg:px-5 lg:pt-6 lg:pb-4"><Logo href="/" /></div>}><Nav /></Suspense>
        </div>
      </header>
      <main id="konten" className="min-w-0 flex-1 lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-9">
          <Suspense fallback={<p className="text-muted" role="status">Memuat…</p>}>{children}</Suspense>
        </div>
      </main>
      <Suspense fallback={null}><OwnerChat /></Suspense>
    </div>
  );
}

const ANALISIS: [string, string, boolean][] = [
  ['/dashboard', 'Ringkasan', false], ['/produk', 'Produk', false], ['/waktu', 'Jam ramai', false],
  ['/bundling', 'Paket bundling', true], ['/menu', 'Klasifikasi menu', true], ['/laporan', 'Laporan PDF', true],
];

const Footer = () => (
  <div className="mt-5 flex flex-wrap items-center gap-1 border-t border-line px-1 pt-4">
    <ThemeToggle />
    <form action={signOut}><button className="btn-ghost">Keluar</button></form>
  </div>
);

/** Admin tidak punya usaha, jadi menunya hanya panel admin; pemilik usaha mendapat menu analisis. */
async function Nav() {
  const who = await getRole();
  if (who.role === 'admin') {
    return (
      <>
        <div className="lg:px-5 lg:pt-6 lg:pb-4"><Logo href="/admin" /></div>
        <MobileNav>
          <div className="mb-4 border-b border-line px-3 pb-4">
            <div className="truncate text-sm font-bold">{who.nama || 'Admin'}</div>
            <div className="mt-0.5 text-sm text-muted">Admin sistem</div>
          </div>
          <ul className="space-y-0.5"><li><NavLink href="/admin">Panel admin</NavLink></li></ul>
          <Footer />
        </MobileNav>
      </>
    );
  }

  const acc = await getAccount();
  return (
    <>
      <div className="lg:px-5 lg:pt-6 lg:pb-4"><Logo href="/dashboard" /></div>
      <MobileNav>
        <div className="mb-4 border-b border-line px-3 pb-4">
          <div className="truncate text-sm font-bold">{acc.business.nama_usaha}</div>
          <div className="mt-0.5 text-sm text-muted">Paket {acc.isPro ? 'Pro' : 'Gratis'}</div>
        </div>
        <ul className="space-y-0.5">
          {ANALISIS.map(([href, label, pro]) => (
            <li key={href}>
              <NavLink href={href}>
                <span className="flex-1">{label}</span>
                {pro && !acc.isPro && <span className="text-xs font-semibold text-muted">Pro</span>}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="mt-5 mb-1 px-3 text-xs font-semibold text-muted">Akun</p>
        <ul className="space-y-0.5">
          <li><NavLink href="/data">Data penjualan</NavLink></li>
          <li><NavLink href="/langganan">Langganan</NavLink></li>
          <li><NavLink href="/pengaturan">Pengaturan</NavLink></li>
        </ul>
        <Footer />
      </MobileNav>
    </>
  );
}

/** Tanya Data hanya untuk pemilik usaha. */
async function OwnerChat() {
  const who = await getRole();
  return who.role === 'admin' ? null : <Chat />;
}
