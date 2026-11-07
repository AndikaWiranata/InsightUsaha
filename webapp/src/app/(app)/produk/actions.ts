'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

/** Simpan HPP dari form (field hpp-<id>) atau dari file HPP yang dibaca di browser. RLS membatasi ke produk sendiri. */
export async function saveHpp(form: FormData) {
  const updates: { id: number; hpp: number | null }[] = [];
  for (const [k, v] of form.entries()) {
    const m = /^hpp-(\d+)$/.exec(k);
    if (!m) continue;
    const s = String(v).trim();
    const n = s === '' ? null : Number(s);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100_000_000)) continue;
    updates.push({ id: Number(m[1]), hpp: n });
  }
  const sb = await supabaseServer();
  await Promise.all(updates.map((u) => sb.from('products').update({ hpp: u.hpp }).eq('id', u.id)));
  revalidatePath('/', 'layout');
  redirect('/produk?status=hpp#hpp');
}
