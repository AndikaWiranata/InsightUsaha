'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Icon } from './icon';

// Tema disimpan di atribut <html data-theme> (dipasang skrip di layout sebelum render); event 'iu-theme' menandai perubahannya.
const subscribeTheme = (cb: () => void) => { window.addEventListener('iu-theme', cb); return () => window.removeEventListener('iu-theme', cb); };
const isDark = () => document.documentElement.dataset.theme === 'dark';

/** Tombol tema; label teks menyebut tema tujuan agar tidak bergantung ikon. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('iu-theme', next); } catch {}
    window.dispatchEvent(new Event('iu-theme'));
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={dark} className={`btn-ghost ${className}`}>
      {dark ? 'Tema terang' : 'Tema gelap'}
    </button>
  );
}

/** Navigasi samping; di HP tersembunyi di balik tombol "Menu" yang berlabel. */
export function MobileNav({ children }: { children: ReactNode }) {
  // Menu tertutup otomatis saat pindah halaman: status "terbuka" diikat ke path tempat menu dibuka.
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenAt(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="nav-utama"
              className="btn-ghost -mr-2 lg:hidden" data-nav-toggle>
        <Icon name="menu" /><span>{open ? 'Tutup' : 'Menu'}</span>
      </button>
      <nav id="nav-utama" aria-label="Navigasi utama"
           className={`${open ? 'block' : 'hidden'} absolute inset-x-0 top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-line bg-paper px-3 pb-5 lg:static lg:block lg:max-h-none lg:border-0 lg:bg-transparent`}>
        {children}
      </nav>
    </>
  );
}

export function NavLink({ href, children, exact }: { href: string; children: ReactNode; exact?: boolean }) {
  const path = usePathname();
  const qs = useSearchParams();
  const base = href.split('?')[0];
  const active = exact ? path === base : path === base || path.startsWith(base + '/');
  // Bawa periode yang sedang dipilih ke halaman analisis lain.
  const keep = ['/dashboard', '/produk', '/waktu', '/bundling', '/menu', '/laporan'].includes(base);
  const p = new URLSearchParams();
  for (const k of ['periode', 'mulai', 'selesai']) { const v = qs.get(k); if (v && keep) p.set(k, v); }
  const target = p.size ? `${base}?${p}` : href;
  return <Link href={target} className="nav-link" aria-current={active ? 'page' : undefined}>{children}</Link>;
}

const PRESETS: [string, string][] = [['7', '7 hari terakhir'], ['30', '30 hari terakhir'], ['90', '3 bulan terakhir'], ['kustom', 'Pilih tanggal sendiri']];

/** Filter periode; mengubah URL sehingga halaman server menghitung ulang. */
export function PeriodFilter({ preset, start, end, minStart }: { preset: string; start: string; end: string; minStart: string | null }) {
  const router = useRouter();
  const path = usePathname();
  const qs = useSearchParams();
  const [value, setValue] = useState(preset);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const go = (params: Record<string, string>) => {
    const p = new URLSearchParams(qs);
    ['periode', 'mulai', 'selesai', 'label'].forEach((k) => p.delete(k));
    Object.entries(params).forEach(([k, v]) => p.set(k, v));
    router.push(`${path}?${p}`);
  };
  return (
    <form className="flex flex-wrap items-end gap-2 md:justify-end" onSubmit={(e) => { e.preventDefault(); go({ periode: 'kustom', mulai: from, selesai: to }); }}>
      <div>
        <label htmlFor="periode" className="mb-1 block text-sm font-semibold text-muted md:text-right">Periode</label>
        <select id="periode" className="input w-auto pr-8" value={value}
                onChange={(e) => { setValue(e.target.value); if (e.target.value !== 'kustom') go({ periode: e.target.value }); }}>
          {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {value === 'kustom' && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="mulai" className="mb-1 block text-sm font-semibold text-muted">Dari</label>
            <input id="mulai" type="date" className="input" value={from} min={minStart ?? undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="selesai" className="mb-1 block text-sm font-semibold text-muted">Sampai</label>
            <input id="selesai" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn-primary">Terapkan</button>
        </div>
      )}
    </form>
  );
}

/** Tombol konfirmasi untuk aksi berbahaya di dalam form server action. */
export function ConfirmButton({ message, className, children }: { message: string; className: string; children: ReactNode }) {
  return <button className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</button>;
}
