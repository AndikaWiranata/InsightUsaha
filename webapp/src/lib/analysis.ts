import 'server-only';
import { supabaseServer } from './supabase/server';
import type { Period } from './period';
import type { Results } from './types';

export type Kind = 'dashboard' | 'produk' | 'waktu' | 'bundling' | 'menu';
const FN: Record<Kind, string> = {
  dashboard: 'analisis_dashboard', produk: 'analisis_produk', waktu: 'analisis_waktu', bundling: 'analisis_bundling', menu: 'analisis_menu',
};

/** Hasil fungsi analisis SQL. Berjalan atas nama pengguna, jadi RLS membatasi ke data usahanya. */
export async function analyze<K extends Kind>(kinds: K[], p: Period, extra: { granularitas?: string } = {}) {
  const sb = await supabaseServer();
  const entries = await Promise.all(kinds.map(async (k) => {
    const args: Record<string, unknown> = { d_start: p.start, d_end: p.end };
    if (k === 'dashboard' && extra.granularitas) args.granularitas = extra.granularitas;
    const { data, error } = await sb.rpc(FN[k], args);
    if (error) throw new Error(`Analisis ${k} gagal: ${error.message}`);
    return [k, data] as const;
  }));
  return Object.fromEntries(entries) as Pick<Results, K>;
}
