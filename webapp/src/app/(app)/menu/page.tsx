import type { Metadata } from 'next';
import Link from 'next/link';
import { analyze } from '@/lib/analysis';
import * as F from '@/lib/format';
import { query } from '@/lib/period';
import { Icon } from '@/components/icon';
import { PeriodHead } from '@/components/period-head';
import { EmptyData, ProRequired } from '@/components/ui';
import type { Menu } from '@/lib/types';
import { loadContext } from '../page-data';

export const metadata: Metadata = { title: 'Klasifikasi menu' };

const INFO: Record<string, [string, string]> = {
  Star: ['Star', 'Laris dan untung besar'], Plowhorse: ['Plowhorse', 'Laris, untung tipis'],
  Puzzle: ['Puzzle', 'Kurang laku, untung besar'], Dog: ['Dog', 'Kurang laku, untung tipis'],
};

export default async function Page({ searchParams }: PageProps<'/menu'>) {
  const { acc, period, minStart, hasData } = await loadContext(searchParams);
  if (!acc.isPro) return <ProRequired />;
  if (!hasData) return <EmptyData />;
  const { menu: m } = await analyze(['menu'], period);
  const hppLink = `/produk?${new URLSearchParams(query(period))}#hpp`;

  return (
    <>
      <PeriodHead title="Klasifikasi menu" sub="Menu Engineering: seberapa laris × seberapa untung per porsi." period={period} minStart={minStart} />
      {m.status !== 'ok' ? (
        <div className="card flex items-start gap-3">
          <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div>
            <p className="text-sm text-ink-2">{m.pesan}</p>
            {m.status === 'hpp_kosong' && <Link href={hppLink} className="btn-primary mt-3">Isi HPP menu</Link>}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <section className="card" aria-labelledby="kuadran-title">
              <h2 id="kuadran-title" className="font-bold">Peta menu</h2>
              <p className="text-sm text-muted">
                Garis tegak: batas laris {F.number(Number(m.batas_popularitas) * 100, 1)}% (70% × 1/{m.jumlah_menu} menu).
                Garis datar: rata-rata untung per porsi {F.rupiah(m.batas_margin)}.
              </p>
              <Quadrant m={m} />
            </section>
            <section className="card" aria-labelledby="saran-title">
              <h2 id="saran-title" className="font-bold">Yang perlu dilakukan</h2>
              <div className="mt-2 divide-y divide-line">
                {Object.entries(INFO).map(([k, [name, desc]]) => {
                  const list = m.produk.filter((p) => p.kategori === k);
                  return (
                    <div key={k} className="py-3">
                      <h3 className="flex items-baseline justify-between gap-2">
                        <span className="font-bold">{name} <span className="font-normal text-muted">· {desc}</span></span>
                        <span className="text-sm text-muted tabular">{m.jumlah_kategori[k]} menu</span>
                      </h3>
                      <p className="mt-1 text-sm text-ink-2">{m.saran[k]}</p>
                      {list.length > 0 && <p className="mt-1.5 text-sm font-semibold">{list.map((p) => p.nama).join(', ')}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          <section className="card mt-5">
            <h2 className="font-bold">Detail per menu</h2>
            <div className="table-wrap mt-3">
              <table className="table">
                <thead><tr><th>Menu</th><th className="text-right">Terjual</th><th className="text-right">Kelarisan</th><th className="text-right">Harga rata-rata</th><th className="text-right">HPP</th><th className="text-right">Untung/porsi</th><th>Kelompok</th></tr></thead>
                <tbody className="tabular">
                  {m.produk.map((p) => (
                    <tr key={p.nama}><td className="font-semibold">{p.nama}</td><td className="text-right">{F.number(p.unit)}</td>
                      <td className="text-right">{F.number(Number(p.popularitas) * 100, 1)}%</td><td className="text-right">{F.rupiah(p.harga_rata_rata)}</td>
                      <td className="text-right">{F.rupiah(p.hpp)}</td><td className="text-right">{F.rupiah(p.margin_per_unit)}</td><td>{INFO[p.kategori][0]}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {m.belum_lengkap?.length > 0 && (
        <section className="card mt-5">
          <h2 className="font-bold">Belum lengkap ({m.belum_lengkap.length} menu)</h2>
          <p className="text-sm text-ink-2">Menu berikut belum punya HPP, jadi belum diklasifikasikan.</p>
          <p className="mt-2 text-sm">{m.belum_lengkap.map((p) => <span key={p.nama} className="tag mr-1 mb-1 bg-warn-soft text-warn-ink">{p.nama}: belum lengkap</span>)}</p>
          <Link href={hppLink} className="btn-secondary mt-3">Lengkapi HPP</Link>
        </section>
      )}
    </>
  );
}

function Quadrant({ m }: { m: Menu }) {
  const prods = m.produk;
  const W = 640, H = 380, pad = { l: 64, r: 16, t: 16, b: 44 };
  const xMax = Math.max(...prods.map((p) => Number(p.popularitas)), Number(m.batas_popularitas)) * 1.12;
  const ys = prods.map((p) => Number(p.margin_per_unit));
  const yMin = Math.min(0, ...ys), yMax = Math.max(...ys, Number(m.batas_margin)) * 1.12;
  const sx = (v: number) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const sy = (v: number) => H - pad.b - ((v - yMin) / ((yMax - yMin) || 1)) * (H - pad.t - pad.b);
  const tx = sx(Number(m.batas_popularitas)), ty = sy(Number(m.batas_margin));
  const labelled = new Set([...prods].sort((a, b) => b.unit - a.unit).slice(0, 8).map((p) => p.nama));
  const v = (n: string) => `var(--c-${n})`;
  return (
    <div className="mt-4 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-130" role="img" aria-label="Peta menu: posisi tiap menu menurut kelarisan dan untung per porsi. Daftar lengkapnya ada di tabel di bawah.">
        <rect x={tx} y={pad.t} width={W - pad.r - tx} height={ty - pad.t} style={{ fill: 'var(--heat-1)' }} />
        <text x={W - pad.r - 8} y={pad.t + 20} textAnchor="end" fontSize={14} fontWeight={800} style={{ fill: v('ink') }}>Star</text>
        <text x={pad.l + 8} y={pad.t + 20} fontSize={14} fontWeight={700} style={{ fill: v('ink-2') }}>Puzzle</text>
        <text x={W - pad.r - 8} y={H - pad.b - 8} textAnchor="end" fontSize={14} fontWeight={700} style={{ fill: v('ink-2') }}>Plowhorse</text>
        <text x={pad.l + 8} y={H - pad.b - 8} fontSize={14} fontWeight={700} style={{ fill: v('ink-2') }}>Dog</text>
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} style={{ stroke: v('field') }} />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} style={{ stroke: v('field') }} />
        <line x1={tx} y1={pad.t} x2={tx} y2={H - pad.b} strokeDasharray="5 4" style={{ stroke: v('muted') }} />
        <line x1={pad.l} y1={ty} x2={W - pad.r} y2={ty} strokeDasharray="5 4" style={{ stroke: v('muted') }} />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => <text key={f} x={sx(xMax * f)} y={H - pad.b + 17} textAnchor="middle" fontSize={12} style={{ fill: v('muted') }}>{F.number(xMax * f * 100)}%</text>)}
        {[0, 0.5, 1].map((f) => { const y = yMin + (yMax - yMin) * f; return <text key={f} x={pad.l - 6} y={sy(y) + 4} textAnchor="end" fontSize={12} style={{ fill: v('muted') }}>{F.number(y / 1000)} rb</text>; })}
        <text x={(pad.l + W - pad.r) / 2} y={H - 6} textAnchor="middle" fontSize={12} style={{ fill: v('ink-2') }}>Kelarisan (porsi dari semua menu terjual)</text>
        <text transform={`translate(14 ${(pad.t + H - pad.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} style={{ fill: v('ink-2') }}>Untung per porsi</text>
        {prods.map((p) => {
          const cx = sx(Number(p.popularitas)), cy = sy(Number(p.margin_per_unit));
          return (
            <g key={p.nama}>
              <title>{`${p.nama} (${p.kategori}): ${F.number(Number(p.popularitas) * 100, 1)}% terjual, untung ${F.rupiah(p.margin_per_unit)} per porsi`}</title>
              <circle cx={cx} cy={cy} r={6} strokeWidth={2} style={{ fill: v('brand'), stroke: v('surface') }} />
              {labelled.has(p.nama) && <text x={cx + 9} y={cy - 8} fontSize={12} fontWeight={600} style={{ fill: v('ink') }}>{p.nama.length > 18 ? p.nama.slice(0, 17) + '…' : p.nama}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
