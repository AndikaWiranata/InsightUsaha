import type { Metadata } from 'next';
import Link from 'next/link';
import { analyze } from '@/lib/analysis';
import * as F from '@/lib/format';
import { query } from '@/lib/period';
import { TrendChart } from '@/components/charts';
import { PeriodHead } from '@/components/period-head';
import { Change, EmptyData, Notice } from '@/components/ui';
import { loadContext, str } from '../page-data';
import { AiSummary } from './ai-summary';

export const metadata: Metadata = { title: 'Ringkasan' };

const GRAN: Record<string, string> = { harian: 'hari', mingguan: 'minggu', bulanan: 'bulan' };

export default async function Page({ searchParams }: PageProps<'/dashboard'>) {
  const { acc, sp, period, minStart, hasData } = await loadContext(searchParams);
  if (!hasData) return <EmptyData />;
  const gran = str(sp.granularitas);
  const { dashboard: d, produk } = await analyze(['dashboard', 'produk'], period, { granularitas: GRAN[gran ?? ''] ? gran : undefined });
  const s = d.ringkasan, c = d.perubahan;
  const pq = new URLSearchParams(query(period));

  return (
    <>
      <PeriodHead title="Ringkasan penjualan" sub={acc.business.nama_usaha} period={period} minStart={minStart} />
      {!Number(s.transaksi) && <Notice>Tidak ada transaksi pada periode ini. Pilih periode lain di atas.</Notice>}

      {/* Titik fokus: omzet. Angka lain ditulis sebagai baris buku kas di sebelahnya. */}
      <section className="card grid gap-6 sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:gap-10" aria-labelledby="omzet-label">
        <div>
          <h2 id="omzet-label" className="text-sm font-semibold text-muted">Total omzet</h2>
          <p className="mt-1 text-4xl font-extrabold tracking-tight tabular sm:text-5xl"><span className="stabilo">{F.rupiah(s.omzet)}</span></p>
          <p className="mt-2"><Change value={c.omzet} /></p>
        </div>
        <dl className="divide-y divide-line self-end border-t border-line lg:border-t-0">
          <Row label="Jumlah transaksi" value={F.number(s.transaksi)} change={c.transaksi} />
          <Row label="Rata-rata per transaksi" value={F.rupiah(s.rata_rata_transaksi)} change={c.rata_rata_transaksi} />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <dt className="text-ink-2">Menu terlaris</dt>
            <dd className="min-w-0 text-right">
              {s.produk_terlaris ? (
                <>
                  <span className="block truncate text-lg font-bold">{s.produk_terlaris.nama}</span>
                  <span className="text-sm text-muted tabular">{F.number(s.produk_terlaris.unit)} terjual</span>
                  <span className="block"><Change value={c.produk_terlaris_unit} suffix="" /></span>
                </>
              ) : <span className="text-lg font-bold">–</span>}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="card" aria-labelledby="tren-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="tren-title" className="font-bold">Omzet per {GRAN[d.tren.granularitas]}</h2>
            <div className="flex rounded-control border border-line p-0.5 text-sm" role="group" aria-label="Kelompokkan omzet per">
              {Object.entries({ harian: 'Hari', mingguan: 'Minggu', bulanan: 'Bulan' }).map(([g, l]) => {
                const on = d.tren.granularitas === g;
                const p = new URLSearchParams(pq); p.set('granularitas', g);
                return (
                  <Link key={g} href={`/dashboard?${p}`} aria-current={on ? 'true' : undefined}
                        className={`inline-flex min-h-9 items-center rounded-[4px] px-3 font-semibold ${on ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-paper'}`}>{l}</Link>
                );
              })}
            </div>
          </div>
          <TrendChart labels={d.tren.label.map(F.trendLabel)} omzet={d.tren.omzet.map(Number)} transaksi={d.tren.transaksi.map(Number)}
                      ariaLabel={`Grafik omzet per ${GRAN[d.tren.granularitas]}. Angka lengkap ada di tabel di bawah grafik.`} />
          <details className="mt-3">
            <summary className="text-sm font-semibold text-brand">Lihat angkanya dalam tabel</summary>
            <div className="table-wrap mt-2 max-h-64 overflow-y-auto">
              <table className="table">
                <thead><tr><th>Periode</th><th className="text-right">Omzet</th><th className="text-right">Transaksi</th></tr></thead>
                <tbody className="tabular">
                  {d.tren.label.map((l: string, i: number) => (
                    <tr key={l}><td>{F.trendLabel(l)}</td><td className="text-right">{F.rupiah(d.tren.omzet[i])}</td><td className="text-right">{F.number(d.tren.transaksi[i])}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section className="card" aria-labelledby="ai-title">
          <h2 id="ai-title" className="font-bold">Ringkasan dan saran</h2>
          {acc.isPro ? (
            <>
              <AiSummary query={pq.toString()} />
              <p className="mt-4 text-xs text-muted">Ditulis AI dari angka hasil analisis. Data transaksi mentah tidak dikirim ke AI.</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-ink-2">Dengan paket Pro, bagian ini berisi ringkasan singkat periode ini dan tiga saran tindakan.</p>
              <Link href="/langganan" className="btn-secondary mt-4 w-full">Lihat paket Pro</Link>
            </>
          )}
        </section>
      </div>

      <section className="card mt-5" aria-labelledby="gerak-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="gerak-title" className="font-bold">Menu yang paling berubah</h2>
          <Link href={`/produk?${pq}`} className="text-sm">Semua menu</Link>
        </div>
        <div className="mt-3 grid gap-x-10 md:grid-cols-2">
          {([['Naik', produk.naik_teratas], ['Turun', produk.turun_teratas]] as const).map(([title, list]) => (
            <div key={title}>
              <h3 className="border-b border-line pb-2 text-sm font-semibold text-muted">{title}</h3>
              {!list.length ? <p className="py-3 text-sm text-muted">Tidak ada menu yang {title.toLowerCase()} lebih dari 10%.</p> : (
                <ul className="divide-y divide-line">
                  {list.map((p) => (
                    <li key={p.nama} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate font-medium">{p.nama}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-muted tabular">{F.number(p.unit_lalu)} → {F.number(p.unit)}</span>
                        <Change value={p.perubahan} suffix="" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Row({ label, value, change }: { label: string; value: string; change: unknown }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 lg:first:pt-0">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right"><span className="text-lg font-bold tabular">{value}</span><span className="block"><Change value={change as number} suffix="" /></span></dd>
    </div>
  );
}
