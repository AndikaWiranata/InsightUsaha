import type { Metadata } from 'next';
import { getAccount } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';
import { simulated } from '@/lib/payment';
import * as F from '@/lib/format';
import { Notice } from '@/components/ui';
import { checkout } from './actions';
import { str } from '../page-data';

export const metadata: Metadata = { title: 'Langganan' };

const PAY: Record<string, string> = { lunas: 'bg-good-soft text-good-ink', gagal: 'bg-bad-soft text-bad-ink', kedaluwarsa: 'border border-line text-muted' };

export default async function Page({ searchParams }: PageProps<'/langganan'>) {
  const [acc, sp] = await Promise.all([getAccount(), searchParams]);
  const sb = await supabaseServer();
  const { data: payments } = await sb.from('payments').select('*').order('created_at', { ascending: false }).limit(20);
  const status = str(sp.status);
  // Halaman ini dirender per permintaan (membaca sesi), jadi waktu sekarang aman dihitung di sini.
  const endsSoon = acc.isPro && !!acc.subscription.berakhir && new Date(acc.subscription.berakhir) < new Date(new Date().getTime() + 3 * 86400000);

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">Langganan</h1>
      {status === 'lunas' && <Notice tone="good">Pembayaran berhasil. Paket Pro sudah aktif!</Notice>}
      {status === 'batal' && <Notice>Pembayaran dibatalkan.</Notice>}
      {status === 'gagal' && <Notice tone="bad">Gagal membuat tagihan pembayaran. Silakan coba lagi.</Notice>}

      <section className="card sm:p-7" aria-labelledby="paket-title">
        <h2 id="paket-title" className="text-sm font-semibold text-muted">Paket aktif</h2>
        <p className="mt-1 text-3xl font-extrabold tracking-tight">{acc.isPro ? 'Pro' : 'Gratis'}</p>
        {acc.isPro ? (
          <p className="mt-2 text-ink-2">Berlaku sampai <strong className="text-ink">{F.date(acc.subscription.berakhir)}</strong>.
            Kalau tidak diperpanjang, akun turun ke Gratis dan datamu tetap tersimpan.</p>
        ) : <p className="mt-2 text-ink-2">1 unggahan per bulan, data 3 bulan terakhir, ringkasan omzet, menu naik/turun, dan jam ramai.</p>}
        {endsSoon && (
          <p className="mt-3 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn-ink" role="status">Paket Pro berakhir dalam 3 hari. Perpanjang di bawah agar fitur Pro tetap terbuka.</p>
        )}

        <div className="mt-6 grid gap-6 border-t border-line pt-6 md:grid-cols-[1.4fr_1fr] md:items-start">
          <div>
            <h3 className="font-bold">{acc.isPro ? 'Perpanjang Pro' : 'Upgrade ke Pro'}: <span className="tabular">Rp49.000</span> per bulan</h3>
            <ul className="mt-3 space-y-1.5 text-ink-2">
              <li>Unggahan tanpa batas dan seluruh riwayat data</li>
              <li>Pasangan menu dan klasifikasi menu</li>
              <li>Ringkasan dan tiga saran per periode</li>
              <li>Laporan PDF</li>
            </ul>
          </div>
          <form action={checkout}>
            <button className="btn-primary w-full">{acc.isPro ? 'Bayar perpanjangan 1 bulan' : 'Bayar dan aktifkan Pro'}</button>
            <p className="help text-center">QRIS, GoPay, ShopeePay, atau virtual account</p>
            {simulated() && <p className="mt-2 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn-ink">Mode simulasi: payment gateway belum diatur, pembayaran tidak sungguhan.</p>}
          </form>
        </div>
      </section>

      <section className="card mt-5" aria-labelledby="riwayat-bayar">
        <h2 id="riwayat-bayar" className="font-bold">Riwayat pembayaran</h2>
        {!payments?.length ? <p className="mt-3 text-sm text-muted">Belum ada pembayaran.</p> : (
          <div className="table-wrap mt-3">
            <table className="table">
              <thead><tr><th>Tanggal</th><th>No. tagihan</th><th>Metode</th><th className="text-right">Jumlah</th><th>Status</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{F.date(p.created_at)}</td>
                    <td><code className="text-sm">{p.ref_gateway}</code></td>
                    <td>{p.metode ? String(p.metode).replace(/_/g, ' ').toUpperCase() : '–'}</td>
                    <td className="text-right tabular">{F.rupiah(p.jumlah)}</td>
                    <td>
                      <span className={`tag ${PAY[p.status] ?? 'bg-warn-soft text-warn-ink'}`}>{p.status[0].toUpperCase() + p.status.slice(1)}</span>
                      {p.status === 'menunggu' && p.url_pembayaran && <a href={p.url_pembayaran} className="ml-2 text-sm">Lanjutkan bayar</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
