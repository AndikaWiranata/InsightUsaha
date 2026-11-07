import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { handleNotification, simulated, verifySignature } from '@/lib/payment';

/** Notifikasi HTTP Midtrans. Ditolak bila tanda tangan tidak cocok atau gateway belum diatur. */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  if (simulated() || !verifySignature(payload)) {
    await supabaseAdmin().from('error_logs').insert({ jenis: 'pembayaran', pesan: 'Webhook ditolak: tanda tangan tidak valid.', konteks: { order_id: payload.order_id ?? null } });
    return NextResponse.json({ message: 'invalid signature' }, { status: 403 });
  }
  return NextResponse.json({ ok: await handleNotification(payload) });
}
