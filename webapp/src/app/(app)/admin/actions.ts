'use server';

import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getRole } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import { activatePro, downgrade } from '@/lib/payment';

export async function setPlan(form: FormData) {
  const who = await getRole();
  if (who.role !== 'admin') notFound();
  const { data: sub } = await supabaseAdmin().from('subscriptions').select('id').eq('business_id', Number(form.get('business_id'))).single();
  if (!sub) notFound();
  if (form.get('aksi') === 'pro') await activatePro(sub.id); else await downgrade(sub.id);
  revalidatePath('/admin');
  redirect('/admin?status=paket');
}
