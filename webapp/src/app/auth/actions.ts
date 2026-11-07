'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { JENIS_USAHA } from '@/lib/session';

export type FormState = { error?: string; fields?: Record<string, string>; fieldErrors?: Record<string, string>; ok?: string } | null;

const origin = async () => {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
};
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Arahkan hanya ke path internal, agar tautan masuk tidak bisa dipakai mengalihkan ke situs lain. */
const safeNext = (v: string) => (v.startsWith('/') && !v.startsWith('//') ? v : '/dashboard');

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, 'email').toLowerCase();
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password: String(form.get('password') ?? '') });
  if (error) {
    const msg = error.code === 'email_not_confirmed' ? 'Email belum diverifikasi. Cek kotak masuk kamu untuk tautan verifikasi.'
      : error.status === 429 ? 'Terlalu banyak percobaan masuk. Coba lagi beberapa saat lagi.'
      : 'Email atau kata sandi salah.';
    return { error: msg, fields: { email } };
  }
  redirect(safeNext(str(form, 'lanjut')));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const fields = { nama: str(form, 'nama'), email: str(form, 'email').toLowerCase(), nama_usaha: str(form, 'nama_usaha'), jenis_usaha: str(form, 'jenis_usaha') };
  const password = String(form.get('password') ?? '');
  const fe: Record<string, string> = {};
  if (!fields.nama) fe.nama = 'Nama wajib diisi.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) fe.email = 'Email harus berupa alamat email yang valid.';
  if (password.length < 8) fe.password = 'Kata sandi minimal 8 karakter.';
  else if (password !== String(form.get('password_confirmation') ?? '')) fe.password = 'Konfirmasi kata sandi tidak cocok.';
  if (!fields.nama_usaha) fe.nama_usaha = 'Nama usaha wajib diisi.';
  if (!JENIS_USAHA.includes(fields.jenis_usaha)) fe.jenis_usaha = 'Pilih jenis usaha.';
  if (Object.keys(fe).length) return { fieldErrors: fe, fields };

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({
    email: fields.email, password,
    options: { emailRedirectTo: `${await origin()}/auth/konfirmasi`, data: { nama: fields.nama, nama_usaha: fields.nama_usaha, jenis_usaha: fields.jenis_usaha } },
  });
  // Supabase tidak mengembalikan error untuk email terdaftar (mencegah pengintaian), tapi identities-nya kosong.
  if ((!error && data.user && data.user.identities?.length === 0) || error?.code === 'user_already_exists') {
    return { fieldErrors: { email: 'Email ini sudah terdaftar. Silakan masuk atau gunakan fitur lupa kata sandi.' }, fields };
  }
  if (error) return { error: error.status === 429 ? 'Terlalu banyak pendaftaran. Coba lagi beberapa saat lagi.' : `Pendaftaran gagal: ${error.message}`, fields };
  if (data.session) redirect('/data');
  redirect(`/daftar/cek-email?email=${encodeURIComponent(fields.email)}`);
}

export async function sendReset(_: FormState, form: FormData): Promise<FormState> {
  const sb = await supabaseServer();
  await sb.auth.resetPasswordForEmail(str(form, 'email').toLowerCase(), { redirectTo: `${await origin()}/auth/konfirmasi?lanjut=/atur-sandi` });
  // Pesan sama untuk email terdaftar/tidak agar tidak membocorkan daftar pengguna.
  return { ok: 'Jika email terdaftar, tautan atur ulang kata sandi sudah kami kirim. Cek kotak masuk kamu.' };
}

export async function setNewPassword(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get('password') ?? '');
  if (password.length < 8) return { fieldErrors: { password: 'Kata sandi minimal 8 karakter.' } };
  if (password !== String(form.get('password_confirmation') ?? '')) return { fieldErrors: { password: 'Konfirmasi kata sandi tidak cocok.' } };
  const sb = await supabaseServer();
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { error: 'Tautan atur ulang tidak valid atau sudah kedaluwarsa. Minta tautan baru.' };
  redirect('/dashboard');
}

export async function resendVerification(_: FormState, form: FormData): Promise<FormState> {
  const sb = await supabaseServer();
  const { error } = await sb.auth.resend({ type: 'signup', email: str(form, 'email'), options: { emailRedirectTo: `${await origin()}/auth/konfirmasi` } });
  return error ? { error: 'Belum bisa mengirim ulang. Tunggu sebentar lalu coba lagi.' } : { ok: 'Tautan verifikasi baru sudah dikirim.' };
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect('/');
}
