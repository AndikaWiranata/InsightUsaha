'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAccount } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createCheckout, handleNotification, simulated } from '@/lib/payment';

export async function checkout() {
  const acc = await getAccount();
  const h = await headers();
  let url: string;
  try {
    url = await createCheckout(acc.business.id, { nama: acc.nama, email: acc.email }, `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`);
  } catch {
    redirect('/langganan?status=gagal');
  }
  redirect(url);
}

const METODE = ['qris', 'gopay', 'shopeepay', 'bank_transfer', 'batal'];

/** Halaman simulasi gateway (hanya tanpa MIDTRANS_SERVER_KEY). Tagihan harus milik usaha pengguna. */
export async function simulatePay(ref: string, form: FormData) {
  if (!simulated()) redirect('/langganan');
  const metode = String(form.get('metode'));
  if (!METODE.includes(metode)) redirect('/langganan');
  const acc = await getAccount();
  const db = supabaseAdmin();
  const { data } = await db.from('payments').select('id, subscriptions!inner(business_id)').eq('ref_gateway', ref)
    .eq('subscriptions.business_id', acc.business.id).maybeSingle();
  if (!data) redirect('/langganan');
  await handleNotification({ order_id: ref, transaction_status: metode === 'batal' ? 'cancel' : 'settlement',
    payment_type: metode === 'batal' ? null : metode, fraud_status: 'accept', simulasi: true });
  revalidatePath('/', 'layout');
  redirect(`/langganan?status=${metode === 'batal' ? 'batal' : 'lunas'}`);
}
