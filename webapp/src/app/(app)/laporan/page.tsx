import type { Metadata } from 'next';
import Link from 'next/link';
import { PeriodHead } from '@/components/period-head';
import { EmptyData, ProRequired } from '@/components/ui';
import { label, query } from '@/lib/period';
import { loadContext } from '../page-data';

export const metadata: Metadata = { title: 'Laporan PDF' };

export default async function Page({ searchParams }: PageProps<'/laporan'>) {
  const { acc, period, minStart, hasData } = await loadContext(searchParams);
  if (!acc.isPro) return <ProRequired />;
  if (!hasData) return <EmptyData />;
  return (
    <>
      <PeriodHead title="Laporan PDF" sub="Untuk disimpan, dicetak, atau dikirim ke rekan usaha." period={period} minStart={minStart} />
      <section className="card max-w-xl">
        <h2 className="font-bold">Isi laporan periode {label(period)}</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-2">
          <li>Omzet, transaksi, rata-rata per transaksi, menu terlaris</li>
          <li>Ringkasan dan tiga saran</li>
          <li>Omzet per hari/minggu/bulan</li>
          <li>Menu naik dan turun</li>
          <li>Jam ramai dan sepi</li>
          <li>Pasangan menu untuk paket</li>
          <li>Klasifikasi menu (bila HPP sudah diisi)</li>
        </ol>
        <Link href={`/laporan/cetak?${new URLSearchParams(query(period))}`} target="_blank" className="btn-primary mt-5">Buka laporan untuk disimpan sebagai PDF</Link>
        <p className="help mt-2">Laporan terbuka di tab baru. Pilih <strong>Simpan sebagai PDF</strong> pada jendela cetak.</p>
      </section>
    </>
  );
}
