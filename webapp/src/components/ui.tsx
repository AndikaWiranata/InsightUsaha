import Link from 'next/link';
import type { ReactNode } from 'react';
import * as F from '@/lib/format';
import { Icon } from './icon';

/** Belum ada logo resmi (DESIGN.md): nama produk sebagai teks, "Usaha" diberi stabilo. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center text-lg font-extrabold tracking-tight text-ink no-underline">
      Insight<span className="stabilo">Usaha</span>
    </Link>
  );
}

/** Perubahan (%): tanda panah + angka + teks, tidak bergantung warna saja. */
export function Change({ value, suffix = 'dibanding periode lalu' }: { value: number | string | null | undefined; suffix?: string }) {
  if (value === null || value === undefined) return <span className="text-sm text-muted">Belum ada pembanding</span>;
  const n = Number(value);
  const icon = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  const cls = n === 0 ? 'text-muted' : n > 0 ? 'text-good' : 'text-bad';
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 text-sm">
      <span className={`inline-flex items-center font-bold tabular ${cls}`}><Icon name={icon} className="h-4 w-4" />{F.percent(n)}</span>
      {suffix && <span className="text-muted">{suffix}</span>}
    </span>
  );
}

const LABELS: Record<string, [string, string]> = {
  Naik: ['bg-good-soft text-good-ink', '▲ Naik'],
  Turun: ['bg-bad-soft text-bad-ink', '▼ Turun'],
  Stabil: ['border border-line text-ink-2', '= Stabil'],
  'Produk Baru': ['border border-brand text-brand', '+ Baru'],
};

export function ProductLabel({ label }: { label: string | null }) {
  const hit = label ? LABELS[label] : undefined;
  if (!hit) return <span className="text-sm text-muted">Data sedikit</span>;
  return <span className={`tag ${hit[0]}`}>{hit[1]}</span>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'good' | 'bad' | 'warn'; children: ReactNode }) {
  const map = {
    info: ['border-line bg-surface text-ink-2', 'info'],
    good: ['border-good/40 bg-good-soft text-good-ink', 'check'],
    bad: ['border-bad/40 bg-bad-soft text-bad-ink', 'alert'],
    warn: ['border-line bg-warn-soft text-warn-ink', 'alert'],
  } as const;
  const [cls, icon] = map[tone];
  return (
    <div className={`mb-4 flex items-start gap-2 rounded-control border px-4 py-3 text-sm ${cls}`} role={tone === 'bad' || tone === 'warn' ? 'alert' : 'status'}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function PageTitle({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-ink-2">{sub}</p>}
      </div>
      {children && <div className="md:text-right">{children}</div>}
    </div>
  );
}

export function EmptyData() {
  return (
    <div className="max-w-xl py-6 sm:py-12">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Belum ada data penjualan</h1>
      <p className="mt-3 text-lg text-ink-2">Unggah file penjualan pertamamu (Excel atau CSV). Halaman ini akan terisi otomatis setelah file selesai diproses.</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link href="/data" className="btn-primary">Unggah file penjualan</Link>
        <a href="/template-insightusaha.csv" download className="btn-secondary"><Icon name="download" className="h-4 w-4" /> Unduh template CSV</a>
      </div>
    </div>
  );
}

export function ProRequired() {
  return (
    <div className="max-w-xl py-6 sm:py-12">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Halaman ini ada di paket Pro</h1>
      <p className="mt-3 text-lg text-ink-2">
        Paket Pro (Rp49.000 per bulan) membuka pasangan menu untuk paket, klasifikasi menu, ringkasan dan saran,
        laporan PDF, serta unggahan tanpa batas.
      </p>
      <Link href="/langganan" className="btn-primary mt-6">Lihat cara upgrade</Link>
    </div>
  );
}
