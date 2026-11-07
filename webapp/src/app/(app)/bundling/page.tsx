import type { Metadata } from 'next';
import Link from 'next/link';
import { analyze } from '@/lib/analysis';
import * as F from '@/lib/format';
import { Icon } from '@/components/icon';
import { PeriodHead } from '@/components/period-head';
import { EmptyData, Notice, ProRequired } from '@/components/ui';
import { loadContext, str } from '../page-data';
import { saveBundlingSettings } from './actions';

export const metadata: Metadata = { title: 'Paket bundling' };

export default async function Page({ searchParams }: PageProps<'/bundling'>) {
  const { acc, sp, period, minStart, hasData } = await loadContext(searchParams);
  if (!acc.isPro) return <ProRequired />;
  if (!hasData) return <EmptyData />;
  const { bundling: b } = await analyze(['bundling'], period);
  const best = b.aturan?.[0];

  return (
    <>
      <PeriodHead title="Pasangan menu untuk paket" sub="Menu yang sering dibeli dalam satu transaksi (algoritma Apriori)." period={period} minStart={minStart} />
      {str(sp.status) === 'disimpan' && <Notice tone="good">Pengaturan bundling disimpan.</Notice>}

      {b.status !== 'ok' ? (
        <div className="card flex items-start gap-3">
          <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div>
            <h2 className="font-bold">{b.status === 'tanpa_id' ? 'Perlu nomor transaksi' : 'Belum ada pasangan menu'}</h2>
            <p className="mt-1 text-sm text-ink-2">{b.pesan}</p>
            {b.status === 'tanpa_id' && <Link href="/data" className="btn-secondary mt-3">Unggah data dengan nomor transaksi</Link>}
          </div>
        </div>
      ) : (
        <>
          <section className="card sm:p-7">
            <h2 className="text-sm font-semibold text-muted">Pasangan paling kuat</h2>
            <p className="mt-2 text-2xl leading-snug font-extrabold tracking-tight sm:text-3xl"><span className="stabilo">{best.kalimat}</span></p>
            <p className="mt-3 text-ink-2">Coba jual <strong className="text-ink">{best.jika} + {best.maka}</strong> sebagai satu paket, atau tawarkan {best.maka} setiap ada yang memesan {best.jika}.</p>
            <p className="mt-3 text-sm text-muted">Dari {F.number(b.jumlah_transaksi)} transaksi, {F.number(b.transaksi_multi_produk)} berisi lebih dari satu menu.</p>
          </section>
          {b.aturan.length > 1 && (
            <section className="card mt-5">
              <h2 className="font-bold">Pasangan lainnya</h2>
              <ul className="mt-2 divide-y divide-line">
                {b.aturan.slice(1, 6).map((r) => (
                  <li key={r.jika + r.maka} className="py-3">
                    <p className="font-semibold">{r.kalimat}</p>
                    <p className="text-sm text-ink-2">Ide paket: {r.jika} + {r.maka}. Dibeli bersama di {F.number(r.jumlah_transaksi_bersama)} transaksi.</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="card mt-5">
            <h2 className="font-bold">Angka lengkap</h2>
            <div className="table-wrap mt-3">
              <table className="table">
                <thead><tr><th>Jika membeli</th><th>Juga membeli</th><th className="text-right">Support</th><th className="text-right">Confidence</th><th className="text-right">Lift</th><th className="text-right">Transaksi</th></tr></thead>
                <tbody className="tabular">
                  {b.aturan.map((r) => (
                    <tr key={r.jika + r.maka}><td className="font-semibold">{r.jika}</td><td>{r.maka}</td>
                      <td className="text-right">{F.number(r.support * 100, 1)}%</td><td className="text-right">{F.number(r.confidence * 100, 1)}%</td>
                      <td className="text-right">{F.number(r.lift, 2)}</td><td className="text-right">{F.number(r.jumlah_transaksi_bersama)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-3 space-y-1 text-sm text-muted">
              <div><dt className="inline font-semibold text-ink-2">Support:</dt> <dd className="inline">porsi transaksi yang berisi kedua menu.</dd></div>
              <div><dt className="inline font-semibold text-ink-2">Confidence:</dt> <dd className="inline">dari pembeli menu pertama, berapa persen juga membeli menu kedua.</dd></div>
              <div><dt className="inline font-semibold text-ink-2">Lift di atas 1:</dt> <dd className="inline">kedua menu lebih sering dibeli bersama daripada kebetulan.</dd></div>
            </dl>
          </section>
        </>
      )}

      <details className="card mt-5" open={str(sp.error) === 'pengaturan'}>
        <summary className="font-bold">Pengaturan lanjutan</summary>
        <form action={saveBundlingSettings} className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="label" htmlFor="min_support">Minimum support (%)</label>
            <input className="input" id="min_support" name="min_support" type="number" step={0.1} min={0.1} max={50} defaultValue={Number(acc.business.min_support) * 100} required />
          </div>
          <div>
            <label className="label" htmlFor="min_confidence">Minimum confidence (%)</label>
            <input className="input" id="min_confidence" name="min_confidence" type="number" step={1} min={1} max={100} defaultValue={Number(acc.business.min_confidence) * 100} required />
          </div>
          <button className="btn-secondary">Simpan dan hitung ulang</button>
        </form>
        {str(sp.error) === 'pengaturan' && <p className="error mt-2" role="alert">Support 0,1–50% dan confidence 1–100%.</p>}
        <p className="help mt-2">Bawaan: support 1%, confidence 30%. Hanya pasangan dengan lift di atas 1 yang ditampilkan.</p>
      </details>
    </>
  );
}
