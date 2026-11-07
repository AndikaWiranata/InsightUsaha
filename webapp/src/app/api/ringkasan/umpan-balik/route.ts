import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { periode, nilai } = await req.json().catch(() => ({}));
  if (typeof periode !== 'string' || periode.length > 30) return NextResponse.json({ ok: false }, { status: 422 });
  const sb = await supabaseServer();
  const { data } = await sb.rpc('beri_umpan_balik', { p_periode: periode, p_nilai: nilai });
  return NextResponse.json({ ok: Boolean(data) }, { status: data ? 200 : 422 });
}
