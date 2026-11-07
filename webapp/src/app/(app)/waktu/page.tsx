import type { Metadata } from 'next';
import { analyze } from '@/lib/analysis';
import * as F from '@/lib/format';
import { label } from '@/lib/period';
import { DayChart } from '@/components/charts';
import { Icon } from '@/components/icon';
import { PeriodHead } from '@/components/period-head';
import { EmptyData, Notice } from '@/components/ui';
import type { Slot } from '@/lib/types';
import { loadContext } from '../page-data';

export const metadata: Metadata = { title: 'Jam ramai' };

/** Skala heatmap memakai token --heat-1..7 (tema terang & gelap); teks tiap langkah lulus 4.5:1. */
function cellStyle(v: number, max: number) {
  if (!v || !max) return { background: 'transparent', color: 'var(--c-muted)' };
  const i = 1 + Math.min(6, Math.floor((v / max) * 6.999));
  return { background: `var(--heat-${i})`, color: `var(--heat-ink-${i})` };
}

export default async function Page({ searchParams }: PageProps<'/waktu'>) {
  const { period, minStart, hasData } = await loadContext(searchParams);
  if (!hasData) return <EmptyData />;
  const { waktu: w } = await analyze(['waktu'], period);
  const top = w.tersibuk?.[0];

  return (
    <>
      <PeriodHead title="Jam ramai dan sepi" sub="Dihitung dari jumlah transaksi, bukan omzet." period={period} minStart={minStart} />
      {w.kosong ? <Notice>Tidak ada transaksi pada periode ini. Pilih periode lain di atas.</Notice> : (
        <>
          {top && (
            <p className="text-xl leading-snug font-bold sm:text-2xl">
              Paling ramai: <span className="stabilo">{top.hari}{top.jam ? `, ${top.jam}` : ''}</span>{' '}
              <span className="font-medium text-ink-2">({F.number(top.transaksi)} transaksi)</span>
            </p>
          )}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <SlotList title="Waktu tersibuk" hint="Pastikan stok dan karyawan cukup." slots={w.tersibuk} accent />
            <SlotList title="Waktu tersepi" hint="Cocok untuk promo jam tertentu atau diskon paket." slots={w.tersepi} />
          </div>

          {w.punya_jam && w.heatmap ? <Heatmap h={w.heatmap} caption={`Jumlah transaksi per hari dan jam, ${label(period)}`} /> : (
            <div className="mt-5 flex items-start gap-2 rounded-control border border-line bg-surface px-4 py-3 text-sm text-ink-2">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Data kamu tidak punya kolom jam, jadi pola ditampilkan per hari saja. Sertakan kolom <code>jam</code> (format 08:15) saat mengunggah untuk melihat tabel hari × jam.</span>
            </div>
          )}

          <section className="card mt-5">
            <h2 className="font-bold">Rata-rata transaksi per hari</h2>
            <p className="text-sm text-muted">Jumlah transaksi dibagi berapa kali hari itu muncul dalam periode.</p>
            <DayChart labels={w.per_hari.map((d) => d.hari)} values={w.per_hari.map((d) => Number(d.rata_rata_transaksi))} />
            <div className="table-wrap mt-4">
              <table className="table">
                <thead><tr><th>Hari</th><th className="text-right">Total transaksi</th><th className="text-right">Rata-rata per hari</th><th className="text-right">Omzet</th></tr></thead>
                <tbody className="tabular">
                  {w.per_hari.map((r) => (
                    <tr key={r.hari}><td className="font-medium">{r.hari}</td><td className="text-right">{F.number(r.transaksi)}</td>
                      <td className="text-right">{F.number(r.rata_rata_transaksi, 1)}</td><td className="text-right">{F.rupiah(r.omzet)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function SlotList({ title, hint, slots, accent }: { title: string; hint: string; slots: Slot[]; accent?: boolean }) {
  return (
    <section className="card">
      <h2 className="font-bold">{title}</h2>
      <p className="text-sm text-muted">{hint}</p>
      <ol className="mt-3 divide-y divide-line border-t border-line">
        {slots.map((s, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
            <span><span className={`mr-2 font-extrabold tabular ${accent ? 'text-brand' : 'text-muted'}`}>{i + 1}.</span>
              <span className="font-semibold">{s.hari}</span>{s.jam ? `, ${s.jam}` : ''}</span>
            <span className="text-ink-2 tabular">{F.number(s.transaksi)} transaksi</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Heatmap({ h, caption }: { h: { hari: string[]; jam: string[]; nilai: number[][] }; caption: string }) {
  const max = Math.max(0, ...h.nilai.flat());
  return (
    <section className="card mt-5">
      <h2 className="font-bold">Transaksi per hari dan jam</h2>
      <p className="text-sm text-muted">Angka di kotak = jumlah transaksi selama periode. Makin gelap makin ramai.</p>
      <div className="relative mt-4 overflow-x-auto pb-1">
        <table className="border-separate tabular" style={{ borderSpacing: 3 }}>
          <caption className="sr-only">{caption}</caption>
          <thead><tr><td className="w-16" />{h.jam.map((j) => <th key={j} scope="col" className="px-0.5 text-center text-xs font-semibold text-muted">{j}</th>)}</tr></thead>
          <tbody>
            {h.hari.map((hari, di) => (
              <tr key={hari}>
                <th scope="row" className="pr-2 text-left text-sm font-semibold text-ink-2">{hari}</th>
                {h.nilai[di].map((v, ji) => (
                  <td key={ji} className="h-9 min-w-9 rounded-[4px] text-center text-xs font-semibold" style={cellStyle(v, max)}>
                    {v || ''}<span className="sr-only">{v ? '' : '0'} transaksi, {hari} jam {h.jam[ji]}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm text-muted" aria-hidden="true">
        Sepi
        <span className="flex overflow-hidden rounded-[3px]">{[1, 2, 3, 4, 5, 6, 7].map((i) => <span key={i} className="h-3 w-5" style={{ background: `var(--heat-${i})` }} />)}</span>
        Ramai
      </div>
    </section>
  );
}
