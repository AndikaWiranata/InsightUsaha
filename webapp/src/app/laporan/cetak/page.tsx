import type { Metadata } from 'next';
import { Suspense } from 'react';
import { analyze } from '@/lib/analysis';
import { getSummary } from '@/lib/ai/service';
import * as F from '@/lib/format';
import { label, previousLabel } from '@/lib/period';
import { ProRequired } from '@/components/ui';
import { loadContext } from '../../(app)/page-data';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Laporan penjualan' };

export default function Page({ searchParams }: PageProps<'/laporan/cetak'>) {
  return <Suspense fallback={<p className="p-8 text-muted">Menyiapkan laporan…</p>}><Report searchParams={searchParams} /></Suspense>;
}

/** Laporan F9 sebagai halaman cetak; PDF dibuat lewat "Simpan sebagai PDF" di browser, tanpa beban server. */
async function Report({ searchParams }: { searchParams: PageProps<'/laporan/cetak'>['searchParams'] }) {
  const { acc, period } = await loadContext(searchParams);
  if (!acc.isPro) return <main className="mx-auto max-w-3xl px-4"><ProRequired /></main>;
  const r = await analyze(['dashboard', 'produk', 'waktu', 'bundling', 'menu'], period);
  const summary = await getSummary(acc.business.id, acc.business.versi_data, period, r);
  const d = r.dashboard, s = d.ringkasan, c = d.perubahan;
  const pct = (v: unknown) => (v === null || v === undefined ? 'belum ada pembanding' : `${F.percent(Number(v))} dibanding periode lalu`);
  const maxOmzet = Math.max(1, ...d.tren.omzet.map(Number));

  return (
    <main id="konten" className="report mx-auto max-w-3xl bg-surface px-6 py-8 text-sm text-ink print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <p className="text-ink-2">Pilih <strong>Simpan sebagai PDF</strong> sebagai tujuan cetak.</p>
        <PrintButton />
      </div>
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink pb-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Laporan penjualan</h1>
          <p className="text-ink-2">{acc.business.nama_usaha}{acc.business.kota ? `, ${acc.business.kota}` : ''}</p>
        </div>
        <p className="text-right text-muted">Periode {label(period)}<br />Pembanding {previousLabel(period)}<br />Dibuat {F.date(new Date())}</p>
      </header>

      <Section title="Ringkasan">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([['Total omzet', F.rupiah(s.omzet), pct(c.omzet)], ['Jumlah transaksi', F.number(s.transaksi), pct(c.transaksi)],
             ['Rata-rata transaksi', F.rupiah(s.rata_rata_transaksi), pct(c.rata_rata_transaksi)],
             ['Menu terlaris', s.produk_terlaris?.nama ?? '–', s.produk_terlaris ? `${F.number(s.produk_terlaris.unit)} terjual` : '']] as const)
            .map(([k, v, n]) => <div key={k} className="rounded-control border border-line p-3"><dt className="text-muted">{k}</dt><dd className="text-base font-bold">{v}</dd><dd className="text-xs text-muted">{n}</dd></div>)}
        </dl>
      </Section>

      <Section title="Ringkasan dan saran">
        {summary.status === 'ok' ? (
          <>
            <ul className="list-disc space-y-1 pl-5">{summary.temuan.map((t) => <li key={t}>{t}</li>)}</ul>
            <ol className="mt-3 list-decimal space-y-1 pl-5">{summary.saran.map((t) => <li key={t}>{t}</li>)}</ol>
          </>
        ) : <p className="text-muted">Ringkasan belum tersedia.</p>}
      </Section>

      <Section title={`Omzet per ${{ harian: 'hari', mingguan: 'minggu', bulanan: 'bulan' }[d.tren.granularitas as string]}`}>
        <table className="table">
          <thead><tr><th>Periode</th><th className="w-1/2">Omzet</th><th className="text-right">Rupiah</th><th className="text-right">Transaksi</th></tr></thead>
          <tbody className="tabular">
            {d.tren.label.map((l: string, i: number) => (
              <tr key={l}><td>{F.trendLabel(l)}</td>
                <td><div className="h-2 bg-brand print:[print-color-adjust:exact]" style={{ width: `${Math.max(0.5, (Number(d.tren.omzet[i]) / maxOmzet) * 100)}%` }} /></td>
                <td className="text-right">{F.rupiah(d.tren.omzet[i])}</td><td className="text-right">{F.number(d.tren.transaksi[i])}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Menu naik dan turun">
        <table className="table">
          <thead><tr><th>Menu</th><th className="text-right">Periode ini</th><th className="text-right">Periode lalu</th><th className="text-right">Perubahan</th><th>Tanda</th></tr></thead>
          <tbody className="tabular">
            {r.produk.produk.slice(0, 25).map((x) => (
              <tr key={x.nama}><td>{x.nama}</td><td className="text-right">{F.number(x.unit)}</td><td className="text-right">{F.number(x.unit_lalu)}</td>
                <td className="text-right">{F.percent(x.perubahan)}</td><td>{x.label ?? 'Data sedikit'}</td></tr>
            ))}
          </tbody>
        </table>
        {r.produk.produk.length > 25 && <p className="mt-1 text-muted">Menampilkan 25 dari {r.produk.produk.length} menu terlaris.</p>}
      </Section>

      {!r.waktu.kosong && (
        <Section title="Jam ramai dan sepi">
          <div className="grid grid-cols-2 gap-6">
            {([['Tersibuk', r.waktu.tersibuk], ['Tersepi', r.waktu.tersepi]] as const).map(([t, list]) => (
              <div key={t}><h3 className="font-bold">{t}</h3>
                <ul className="mt-1 list-disc pl-5">{list.map((x, i) => <li key={i}>{x.hari}{x.jam ? ` ${x.jam}` : ''}: {F.number(x.transaksi)} transaksi</li>)}</ul></div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Pasangan menu">
        {r.bundling.status === 'ok' ? (
          <table className="table">
            <thead><tr><th>Saran</th><th className="text-right">Support</th><th className="text-right">Confidence</th><th className="text-right">Lift</th></tr></thead>
            <tbody className="tabular">{r.bundling.aturan.slice(0, 10).map((a) => (
              <tr key={a.jika + a.maka}><td>{a.kalimat}</td><td className="text-right">{F.number(a.support * 100, 1)}%</td>
                <td className="text-right">{F.number(a.confidence * 100, 1)}%</td><td className="text-right">{F.number(a.lift, 2)}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="text-muted">{r.bundling.pesan}</p>}
      </Section>

      <Section title="Klasifikasi menu">
        {r.menu.status === 'ok' ? (
          <table className="table">
            <thead><tr><th>Menu</th><th className="text-right">Kelarisan</th><th className="text-right">Untung/porsi</th><th>Kelompok</th></tr></thead>
            <tbody className="tabular">{r.menu.produk.map((x) => (
              <tr key={x.nama}><td>{x.nama}</td><td className="text-right">{F.number(Number(x.popularitas) * 100, 1)}%</td><td className="text-right">{F.rupiah(x.margin_per_unit)}</td><td>{x.kategori}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="text-muted">{r.menu.pesan}</p>}
      </Section>
      <p className="mt-8 text-xs text-muted">Dibuat otomatis oleh InsightUsaha.</p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="mb-2 border-b border-line pb-1 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}
