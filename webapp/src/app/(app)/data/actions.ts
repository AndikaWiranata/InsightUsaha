'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

// Fungsi database memeriksa sendiri bahwa unggahan milik usaha pengguna (my_business_id), jadi id dari form aman.
export async function deleteUpload(form: FormData) {
  const sb = await supabaseServer();
  await sb.rpc('hapus_unggahan', { p_upload: Number(form.get('id')) });
  revalidatePath('/', 'layout');
  redirect('/data?status=terhapus');
}

export async function deleteAll(form: FormData) {
  if (form.get('konfirmasi') !== 'HAPUS') redirect('/data?error=konfirmasi');
  const sb = await supabaseServer();
  await sb.rpc('hapus_semua_data');
  revalidatePath('/', 'layout');
  redirect('/data?status=terhapus');
}
