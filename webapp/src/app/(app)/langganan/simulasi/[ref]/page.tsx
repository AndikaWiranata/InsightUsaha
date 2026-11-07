import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAccount } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { simulated } from '@/lib/payment';
import * as F from '@/lib/format';
import { simulatePay } from '../../actions';

export const metadata: Metadata = { title: 'Simulasi pembayaran' };

export default async function Page({ params }: PageProps<'/langganan/simulasi/[ref]'>) {
  if (!simulated()) notFound();
  const [{ ref }, acc] = await Promise.all([params, getAccount()]);
  const { data: pay } = await supabaseAdmin().from('payments').select('jumlah, ref_gateway, status, subscriptions!inner(business_id)')
    .eq('ref_gateway', ref).eq('subscriptions.business_id', acc.business.id).maybeSingle();
  if (!pay) notFound();
  return (
    <div className="card max-w-md sm:p-7">
      <p className="rounded-control bg-warn-soft px-3 py-2 text-sm font-semibold text-warn-ink">Mode simulasi: tidak ada uang yang dipotong.</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Bayar InsightUsaha Pro</h1>
      <p className="mt-1 text-ink-2">Tagihan <code className="text-sm">{pay.ref_gateway}</code></p>
      <p className="mt-3 text-3xl font-extrabold tabular">{F.rupiah(pay.jumlah)}</p>
      <p className="mt-2 text-sm text-muted">Halaman ini menggantikan payment gateway selama MIDTRANS_SERVER_KEY belum diisi.</p>
      <form action={simulatePay.bind(null, ref)} className="mt-6">
        <fieldset className="space-y-2">
          <legend className="label">Pilih metode untuk mensimulasikan pembayaran berhasil</legend>
          {[['qris', 'QRIS'], ['gopay', 'GoPay'], ['shopeepay', 'ShopeePay'], ['bank_transfer', 'Virtual account']].map(([v, l]) => (
            <button key={v} name="metode" value={v} className="btn-secondary w-full justify-start">{l}</button>
          ))}
        </fieldset>
        <button name="metode" value="batal" className="btn-ghost mt-3 w-full text-bad">Batalkan pembayaran</button>
      </form>
    </div>
  );
}
