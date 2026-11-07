import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from './supabase/server';

/**
 * F10 Langganan & pembayaran lewat Midtrans Snap (QRIS, e-wallet, VA).
 * Tanpa MIDTRANS_SERVER_KEY dipakai mode simulasi agar alur bisa diuji tanpa akun gateway.
 * Status langganan hanya diubah di server (secret key); RLS membuat pengguna tidak bisa mengubahnya sendiri.
 */
export const HARGA_PRO = 49000;
export const simulated = () => !process.env.MIDTRANS_SERVER_KEY;

export async function createCheckout(businessId: number, user: { nama: string; email: string }, origin: string) {
  const db = supabaseAdmin();
  const { data: sub } = await db.from('subscriptions').select('id').eq('business_id', businessId).single();
  const ref = `IU-${businessId}-${Date.now().toString(36)}-${randomBytes(2).toString('hex').toUpperCase()}`;
  await db.from('payments').insert({ subscription_id: sub!.id, jumlah: HARGA_PRO, status: 'menunggu', ref_gateway: ref });

  if (simulated()) {
    const url = `${origin}/langganan/simulasi/${ref}`;
    await db.from('payments').update({ url_pembayaran: url }).eq('ref_gateway', ref);
    return url;
  }

  const base = process.env.MIDTRANS_PRODUCTION === 'true' ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const res = await fetch(`${base}/snap/v1/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString('base64') },
    body: JSON.stringify({
      transaction_details: { order_id: ref, gross_amount: HARGA_PRO },
      item_details: [{ id: 'PRO-1BLN', price: HARGA_PRO, quantity: 1, name: 'InsightUsaha Pro 1 bulan' }],
      customer_details: { first_name: user.nama, email: user.email },
      enabled_payments: ['other_qris', 'gopay', 'shopeepay', 'bca_va', 'bni_va', 'bri_va', 'permata_va', 'echannel'],
      callbacks: { finish: `${origin}/langganan` },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.redirect_url) {
    await db.from('payments').update({ status: 'gagal', payload: body }).eq('ref_gateway', ref);
    await db.from('error_logs').insert({ jenis: 'pembayaran', pesan: `Gagal membuat transaksi Midtrans: HTTP ${res.status}`, business_id: businessId });
    throw new Error('Gagal membuat tagihan pembayaran. Silakan coba lagi.');
  }
  await db.from('payments').update({ url_pembayaran: body.redirect_url }).eq('ref_gateway', ref);
  return body.redirect_url as string;
}

export function verifySignature(p: Record<string, unknown>) {
  const expected = createHash('sha512')
    .update(`${p.order_id ?? ''}${p.status_code ?? ''}${p.gross_amount ?? ''}${process.env.MIDTRANS_SERVER_KEY ?? ''}`).digest('hex');
  const got = String(p.signature_key ?? '');
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Proses notifikasi pembayaran (webhook atau simulasi). Idempoten: notifikasi ulang tidak menambah masa aktif. */
export async function handleNotification(p: Record<string, unknown>) {
  const db = supabaseAdmin();
  const { data: pay } = await db.from('payments').select('id, status, subscription_id').eq('ref_gateway', String(p.order_id ?? '')).maybeSingle();
  if (!pay) return false;
  const st = String(p.transaction_status ?? '');
  const fraud = String(p.fraud_status ?? 'accept');
  const next = ['settlement', 'capture'].includes(st) && fraud === 'accept' ? 'lunas'
    : ['deny', 'cancel', 'failure'].includes(st) ? 'gagal' : st === 'expire' ? 'kedaluwarsa' : 'menunggu';
  const already = pay.status === 'lunas';

  // Ubah status hanya bila belum lunas, sehingga dua notifikasi bersamaan tidak memperpanjang dua kali.
  const { data: changed } = await db.from('payments')
    .update({ status: already ? 'lunas' : next, metode: p.payment_type ?? null, payload: p, ...(next === 'lunas' && !already ? { dibayar_pada: new Date().toISOString() } : {}) })
    .eq('id', pay.id).neq('status', 'lunas').select('id');
  if (next === 'lunas' && !already && changed?.length) await activatePro(pay.subscription_id);
  return true;
}

export async function activatePro(subscriptionId: number) {
  const db = supabaseAdmin();
  const { data: s } = await db.from('subscriptions').select('*').eq('id', subscriptionId).single();
  const stillPro = s.paket === 'pro' && s.status === 'aktif' && s.berakhir && new Date(s.berakhir) > new Date();
  const base = stillPro ? new Date(s.berakhir) : new Date();
  const end = new Date(base);
  end.setMonth(end.getMonth() + 1);
  await db.from('subscriptions').update({
    paket: 'pro', status: 'aktif', mulai: stillPro ? s.mulai : new Date().toISOString(), berakhir: end.toISOString(), pengingat_dikirim_pada: null,
  }).eq('id', subscriptionId);
}

/** Turunkan ke Gratis tanpa menghapus data. */
export async function downgrade(subscriptionId: number) {
  await supabaseAdmin().from('subscriptions').update({ paket: 'gratis', status: 'aktif', berakhir: null, pengingat_dikirim_pada: null }).eq('id', subscriptionId);
}
