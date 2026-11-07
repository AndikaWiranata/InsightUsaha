import { supabaseServer } from '@/lib/supabase/server';

/** Daftar menu milik usaha sebagai CSV (nama_produk,hpp) untuk diisi lalu diunggah kembali. */
export async function GET() {
  const sb = await supabaseServer();
  const { data } = await sb.from('products').select('nama, hpp').order('nama');
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = ['nama_produk,hpp', ...(data ?? []).map((p) => `${esc(p.nama)},${p.hpp !== null ? Math.round(Number(p.hpp)) : ''}`)];
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="hpp-produk.csv"' },
  });
}
