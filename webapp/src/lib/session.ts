import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';

export type Business = {
  id: number; nama_usaha: string; kota: string | null; jenis_usaha: string | null; jam_buka: string | null; jam_tutup: string | null;
  onboarding_selesai: boolean; min_support: number; min_confidence: number; versi_data: number;
};
export type Subscription = { paket: 'gratis' | 'pro'; status: string; berakhir: string | null; mulai: string };
export type Account = {
  userId: string; email: string; nama: string; role: 'owner' | 'admin';
  business: Business; subscription: Subscription; isPro: boolean; latestDataDate: string | null;
};

export const JENIS_USAHA = ['Kedai kopi', 'Warung makan', 'Restoran', 'Kafe', 'Bakery / kue', 'Minuman', 'Katering', 'Lainnya'];

/** Peran pengguna yang sedang masuk, tanpa memuat data usaha. Mengarahkan ke /masuk bila belum masuk. */
export async function getRole(): Promise<{ userId: string; email: string; nama: string; role: 'owner' | 'admin' }> {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/masuk');
  const { data: profile } = await sb.from('profiles').select('nama, role').eq('id', auth.user.id).single();
  if (!profile) redirect('/masuk');
  return { userId: auth.user.id, email: auth.user.email ?? '', nama: profile.nama, role: profile.role };
}

/**
 * Akun pemilik usaha yang sedang masuk beserta usahanya. Mengarahkan ke /masuk bila belum masuk.
 * Admin tidak mengelola usaha, jadi diarahkan ke panel admin.
 */
export async function getAccount(): Promise<Account> {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/masuk');

  const [{ data: profile }, { data: business }] = await Promise.all([
    sb.from('profiles').select('nama, role').eq('id', auth.user.id).single(),
    sb.from('businesses').select('*, subscriptions(paket, status, berakhir, mulai)').eq('user_id', auth.user.id).single(),
  ]);
  if (!profile) redirect('/masuk');
  if (profile.role === 'admin') redirect('/admin');
  if (!business) redirect('/masuk');

  const { subscriptions, ...biz } = business as Business & { subscriptions: Subscription };
  const sub = subscriptions;
  const isPro = sub.paket === 'pro' && sub.status === 'aktif' && (!sub.berakhir || new Date(sub.berakhir) > new Date());

  const { data: latest } = await sb.from('transactions').select('waktu').order('waktu', { ascending: false }).limit(1).maybeSingle();
  // Satu baris per pengguna per hari untuk metrik "pengguna aktif mingguan". Insert biasa, bukan upsert:
  // ON CONFLICT butuh policy SELECT yang tidak dimiliki tabel ini. Duplikat (kode 23505) memang diharapkan.
  await sb.from('activity_logs').insert({ user_id: auth.user.id });
  return {
    userId: auth.user.id, email: auth.user.email ?? '', nama: profile.nama, role: profile.role,
    business: biz, subscription: sub, isPro, latestDataDate: latest ? String(latest.waktu).slice(0, 10) : null,
  };
}
