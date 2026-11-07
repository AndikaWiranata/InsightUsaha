'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export async function saveBundlingSettings(form: FormData) {
  const sup = Number(form.get('min_support'));
  const conf = Number(form.get('min_confidence'));
  if (!(sup >= 0.1 && sup <= 50) || !(conf >= 1 && conf <= 100)) redirect('/bundling?error=pengaturan');
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  await sb.from('businesses').update({ min_support: Math.round(sup * 100) / 10000, min_confidence: Math.round(conf * 100) / 10000 })
    .eq('user_id', auth.user!.id);
  revalidatePath('/', 'layout');
  redirect('/bundling?status=disimpan');
}
