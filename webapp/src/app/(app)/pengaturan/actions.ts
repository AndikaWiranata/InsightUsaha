'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getAccount, JENIS_USAHA } from '@/lib/session';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Cek kata sandi tanpa menyentuh sesi yang sedang aktif (klien terpisah, tanpa cookie). */
async function passwordOk(email: string, password: string) {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  return !error;
}

export async function saveProfile(form: FormData) {
  const nama = str(form, 'nama'), nama_usaha = str(form, 'nama_usaha'), jenis_usaha = str(form, 'jenis_usaha');
  const time = (k: string) => (/^\d{2}:\d{2}$/.test(str(form, k)) ? str(form, k) : null);
  if (!nama || !nama_usaha || !JENIS_USAHA.includes(jenis_usaha)) redirect('/pengaturan?error=profil');
  const acc = await getAccount();
  const sb = await supabaseServer();
  await Promise.all([
    sb.from('profiles').update({ nama: nama.slice(0, 100) }).eq('id', acc.userId),
    sb.from('businesses').update({ nama_usaha: nama_usaha.slice(0, 150), kota: str(form, 'kota').slice(0, 100) || null, jenis_usaha,
      jam_buka: time('jam_buka'), jam_tutup: time('jam_tutup') }).eq('user_id', acc.userId),
  ]);
  revalidatePath('/', 'layout');
  redirect('/pengaturan?status=profil');
}

export async function savePassword(form: FormData) {
  const pw = String(form.get('password') ?? '');
  if (pw.length < 8 || pw !== String(form.get('password_confirmation') ?? '')) redirect('/pengaturan?error=sandi');
  const acc = await getAccount();
  if (!(await passwordOk(acc.email, String(form.get('password_lama') ?? '')))) redirect('/pengaturan?error=sandi_lama');
  const sb = await supabaseServer();
  const { error } = await sb.auth.updateUser({ password: pw });
  redirect(error ? '/pengaturan?error=sandi' : '/pengaturan?status=sandi');
}

/** Hapus akun beserta seluruh data (UU PDP). Baris usaha, transaksi, dll. ikut terhapus lewat ON DELETE CASCADE. */
export async function deleteAccount(form: FormData) {
  const acc = await getAccount();
  if (!(await passwordOk(acc.email, String(form.get('password_hapus') ?? '')))) redirect('/pengaturan?error=hapus');
  const sb = await supabaseServer();
  await sb.auth.signOut();
  await supabaseAdmin().auth.admin.deleteUser(acc.userId);
  redirect('/?akun=dihapus');
}
