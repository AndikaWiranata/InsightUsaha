import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { downgrade } from '@/lib/payment';

/**
 * Dijalankan harian oleh Vercel Cron (vercel.json). Menurunkan langganan Pro yang berakhir ke Gratis tanpa menghapus data,
 * dan menandai langganan yang berakhir dalam 3 hari. Pengingat tampil di aplikasi; email pengingat butuh layanan email
 * terpisah (lihat README), jadi belum dikirim.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ message: 'unauthorized' }, { status: 401 });
  }
  const db = supabaseAdmin();
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 86400000);

  const { data: expired } = await db.from('subscriptions').select('id').eq('paket', 'pro').lt('berakhir', now.toISOString());
  for (const s of expired ?? []) await downgrade(s.id);

  const { data: reminded } = await db.from('subscriptions').update({ pengingat_dikirim_pada: now.toISOString() })
    .eq('paket', 'pro').eq('status', 'aktif').is('pengingat_dikirim_pada', null)
    .gte('berakhir', now.toISOString()).lte('berakhir', soon.toISOString()).select('id');

  return NextResponse.json({ diturunkan: expired?.length ?? 0, diingatkan: reminded?.length ?? 0 });
}
