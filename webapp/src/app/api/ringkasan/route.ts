import { NextResponse, type NextRequest } from 'next/server';
import { getAccount } from '@/lib/session';
import { analyze } from '@/lib/analysis';
import { minStartFor, resolvePeriod } from '@/lib/period';
import { getSummary } from '@/lib/ai/service';

// Pemanggilan Gemini (dengan satu kali coba ulang) bisa lebih dari batas bawaan fungsi Vercel.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const acc = await getAccount();
  if (!acc.isPro) return NextResponse.json({ status: 'pro' }, { status: 403 });
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const period = resolvePeriod(q, acc.latestDataDate, acc.isPro ? null : minStartFor(acc.latestDataDate));
  try {
    const results = await analyze(['dashboard', 'produk', 'waktu', 'bundling', 'menu'], period);
    return NextResponse.json(await getSummary(acc.business.id, acc.business.versi_data, period, results));
  } catch {
    return NextResponse.json({ status: 'gagal' });
  }
}
