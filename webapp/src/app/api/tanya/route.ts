import { NextResponse, type NextRequest } from 'next/server';
import { getAccount } from '@/lib/session';
import { analyze } from '@/lib/analysis';
import { label, minStartFor, resolvePeriod } from '@/lib/period';
import { answerQuestion, type ChatMessage } from '@/lib/ai/service';

// Pemanggilan Gemini (dengan satu kali coba ulang) bisa lebih dari batas bawaan fungsi Vercel.
export const maxDuration = 60;

// Batas sederhana per pengguna per instance server: 20 pertanyaan per menit.
const hits = new Map<string, number[]>();
function limited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > 20;
}

export async function POST(req: NextRequest) {
  const acc = await getAccount();
  const body = await req.json().catch(() => ({}));
  const question = String(body.pesan ?? '').replace(/\s+/g, ' ').trim();
  if (!question) return NextResponse.json({ status: 'invalid', pesan: 'Tulis pertanyaan dulu.' }, { status: 422 });
  if (question.length > 500) return NextResponse.json({ status: 'invalid', pesan: 'Pertanyaan maksimal 500 karakter.' }, { status: 422 });
  if (limited(acc.userId)) return NextResponse.json({ status: 'limit' }, { status: 429 });
  if (!acc.latestDataDate) {
    return NextResponse.json({ status: 'tanpa_data', jawaban: 'Belum ada data penjualan. Unggah file penjualan dulu di halaman Data penjualan, nanti aku bisa menjawab.' });
  }

  // Periode mengikuti halaman yang sedang dibuka; Gratis dibatasi 3 bulan terakhir dan tanpa bundling/menu.
  const period = resolvePeriod({ periode: body.periode ?? undefined, mulai: body.mulai ?? undefined, selesai: body.selesai ?? undefined },
    acc.latestDataDate, acc.isPro ? null : minStartFor(acc.latestDataDate));
  const raw: unknown[] = Array.isArray(body.riwayat) ? body.riwayat.slice(-12) : [];
  const history: ChatMessage[] = raw
    .filter((m): m is ChatMessage => typeof m === 'object' && m !== null && ['user', 'bot'].includes((m as ChatMessage).role)
      && typeof (m as ChatMessage).text === 'string')
    .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
  try {
    const results = await analyze(acc.isPro ? ['dashboard', 'produk', 'waktu', 'bundling', 'menu'] : ['dashboard', 'produk', 'waktu'], period);
    const res = await answerQuestion(acc.business.id, acc.business.nama_usaha, period, results, history, question);
    return NextResponse.json({ ...res, periode: label(period) });
  } catch {
    return NextResponse.json({ status: 'gagal', jawaban: null });
  }
}
