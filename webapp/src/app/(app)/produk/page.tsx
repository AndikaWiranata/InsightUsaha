import type { Metadata } from 'next';
import Link from 'next/link';
import { analyze } from '@/lib/analysis';
import * as F from '@/lib/format';
import { query } from '@/lib/period';
import { supabaseServer } from '@/lib/supabase/server';
import { Icon } from '@/components/icon';
import { PeriodHead } from '@/components/period-head';
import { EmptyData, Notice, ProductLabel } from '@/components/ui';
import { loadContext, str } from '../page-data';
import { HppUpload } from './hpp-upload';
import { saveHpp } from './actions';

export const metadata: Metadata = { title: 'Produk' };

const FILTERS: [string, string][] = [['', 'Semua'], ['Naik', 'Naik'], ['Stabil', 'Stabil'], ['Turun', 'Turun'], ['Produk Baru', 'Baru'], ['tanpa', 'Data sedikit']];

export default async function Page({ searchParams }: PageProps<'/produk'>) {
  const { sp, period, minStart, hasData } = await loadContext(searchParams);
  const sb = await supabaseServer();
  const { data: products } = await sb.from('products').select('id, nama, kategori, hpp').order('nama');
  const filter = str(sp.label) ?? '';
  const pq = new URLSearchParams(query(period));
  const p = hasData ? (await analyze(['produk'], period)).produk : null;
  const items = (p?.produk ?? []).filter((x) => (filter === 'tanpa' ? x.label === null : !filter || x.label === filter));

  return (
    <>
      {p ? <PeriodHead title="Menu naik dan turun" sub="Unit terjual periode ini dibanding periode sebelumnya." period={period} minStart={minStart} />
         : <EmptyData />}
      {str(sp.status) === 'hpp' && <Notice tone="good">HPP berhasil disimpan.</Notice>}

      {p && (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="Saring menurut tanda">
            {FILTERS.map(([k, l]) => {
              const n = k === '' ? p.produk.length : k === 'tanpa' ? p.jumlah_label['Tanpa label'] : p.jumlah_label[k];
              const on = filter === k;
              const q = new URLSearchParams(pq); if (k) q.set('label', k);
              return (
                <Link key={k} href={`/produk?${q}`} aria-current={on ? 'true' : undefined}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-sm font-semibold ${on ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-field'}`}>
                  {l} <span className={`tabular ${on ? '' : 'text-muted'}`}>{n}</span>
                </Link>
              );
            })}
          </nav>
          <section className="card mt-4" aria-label="Daftar menu">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Menu</th><th className="text-right">Periode ini</th><th className="text-right">Periode lalu</th><th className="text-right">Perubahan</th><th>Tanda</th><th className="text-right">Omzet</th></tr></thead>
                <tbody className="tabular">
                  {items.length ? items.map((r) => (
                    <tr key={r.nama}>
                      <td className="font-semibold">{r.nama}</td>
                      <td className="text-right">{F.number(r.unit)}</td>
                      <td className="text-right text-ink-2">{F.number(r.unit_lalu)}</td>
                      <td className="text-right">{F.percent(r.perubahan)}</td>
                      <td><ProductLabel label={r.label} /></td>
                      <td className="text-right text-ink-2">{F.rupiah(r.omzet)}</td>
                    </tr>
                  )) : <tr><td colSpan={6} className="py-8 text-center text-muted">Tidak ada menu dengan tanda ini.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="help mt-3">
              Perubahan = (periode ini − periode lalu) ÷ periode lalu × 100%. Naik lebih dari +10%, Turun kurang dari −10%,
              selain itu Stabil. Menu yang terjual kurang dari 5 di kedua periode tidak diberi tanda.
            </p>
          </section>
        </>
      )}

      <section className="card mt-5" id="hpp" aria-labelledby="hpp-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="hpp-title" className="font-bold">Harga pokok (HPP) per porsi</h2>
            <p className="text-sm text-ink-2">Dipakai untuk klasifikasi menu. Boleh diisi sebagian dulu.</p>
          </div>
          {!!products?.length && (
            <a href="/api/hpp-template" className="btn-secondary shrink-0"><Icon name="download" className="h-4 w-4" /> Unduh daftar menu (CSV)</a>
          )}
        </div>
        {!products?.length ? <p className="mt-4 text-sm text-muted">Belum ada menu. Menu muncul otomatis setelah data penjualan diunggah.</p> : (
          <>
            <HppUpload products={products.map((x) => ({ id: x.id, nama: x.nama }))} />
            <form action={saveHpp} className="mt-4">
              <div className="table-wrap max-h-112 overflow-y-auto">
                <table className="table">
                  <thead className="sticky top-0 bg-surface"><tr><th>Menu</th><th>Kategori</th><th className="w-44">HPP (Rp)</th></tr></thead>
                  <tbody>
                    {products.map((x) => (
                      <tr key={x.id}>
                        <td className="font-semibold"><label htmlFor={`hpp-${x.id}`}>{x.nama}</label></td>
                        <td className="text-ink-2">{x.kategori ?? '–'}</td>
                        <td><input id={`hpp-${x.id}`} name={`hpp-${x.id}`} type="number" min={0} step={1} inputMode="numeric" className="input tabular"
                                   defaultValue={x.hpp !== null ? Math.round(Number(x.hpp)) : ''} placeholder="belum diisi" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn-primary mt-4">Simpan HPP</button>
            </form>
          </>
        )}
      </section>
    </>
  );
}
