import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRole } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/server';
import * as F from '@/lib/format';
import { ConfirmButton } from '@/components/client';
import { Notice } from '@/components/ui';
import { setPlan } from './actions';
import { str } from '../page-data';

export const metadata: Metadata = { title: 'Panel admin' };

const JENIS: Record<string, string> = { ai: 'API AI', impor: 'Impor', pembayaran: 'Pembayaran', analitik: 'Analitik' };

/** F11. Membaca lintas usaha dengan secret key, jadi akses dicek di sini (role admin), bukan oleh RLS. */
export default async function Page({ searchParams }: PageProps<'/admin'>) {
  const [who, sp] = await Promise.all([getRole(), searchParams]);
  if (who.role !== 'admin') notFound();
  const db = supabaseAdmin();
  const q = (str(sp.q) ?? '').trim();
  const jenis = str(sp.jenis) ?? '';
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekAgo = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);

  const [{ data: users }, { data: owners }, { data: active }, { data: paid }, { data: payments }, { data: uploads }, { data: feedback }, logs] = await Promise.all([
    db.from('profiles').select('id, nama, role, created_at, businesses(id, nama_usaha, kota, subscriptions(paket, status, berakhir))')
      .eq('role', 'owner').order('created_at', { ascending: false }).limit(200),
    db.from('profiles').select('id').eq('role', 'owner'),
    db.from('activity_logs').select('user_id').gte('tanggal', weekAgo),
    db.from('subscriptions').select('id').eq('paket', 'pro').eq('status', 'aktif').gt('berakhir', now.toISOString()),
    db.from('payments').select('jumlah').eq('status', 'lunas').gte('dibayar_pada', monthStart),
    db.from('uploads').select('business_id, status'),
    db.from('ai_summaries').select('umpan_balik').not('umpan_balik', 'is', null),
    (jenis && JENIS[jenis] ? db.from('error_logs').select('*').eq('jenis', jenis) : db.from('error_logs').select('*')).order('id', { ascending: false }).limit(50),
  ]);
  const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map(authUsers.users.map((u) => [u.id, { email: u.email ?? '', verified: Boolean(u.email_confirmed_at) }]));

  const uploadCount = new Map<number, number>();
  const activated = new Set<number>();
  for (const u of uploads ?? []) {
    uploadCount.set(u.business_id, (uploadCount.get(u.business_id) ?? 0) + 1);
    if (u.status === 'selesai') activated.add(u.business_id);
  }
  const helpful = (feedback ?? []).filter((f) => f.umpan_balik === 'membantu').length;
  const totalOwners = owners?.length ?? 0;
  type Row = { id: string; nama: string; created_at: string;
    businesses: { id: number; nama_usaha: string; kota: string | null; subscriptions: { paket: string; status: string; berakhir: string | null } | null } | null };
  const rows = ((users ?? []) as unknown as Row[]).map((u) => {
    const b = u.businesses, s = b?.subscriptions;
    const pro = s && s.paket === 'pro' && s.status === 'aktif' && (!s.berakhir || new Date(s.berakhir) > now);
    return { ...u, b, s, pro, ...emails.get(u.id), uploads: b ? uploadCount.get(b.id) ?? 0 : 0 };
  }).filter((r) => !q || [r.nama, r.email, r.b?.nama_usaha].some((v) => v?.toLowerCase().includes(q.toLowerCase())));

  const stats: [string, string][] = [
    ['Pengguna terdaftar', F.number(totalOwners)],
    ['Aktif 7 hari terakhir', F.number(new Set((active ?? []).map((a) => a.user_id)).size)],
    ['Pelanggan berbayar', F.number(paid?.length ?? 0)],
    ['Pendapatan bulan ini', F.rupiah((payments ?? []).reduce((t, p) => t + p.jumlah, 0))],
    ['Sudah unggah data', `${totalOwners ? Math.round((activated.size / totalOwners) * 100) : 0}%`],
  ];

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">Panel admin</h1>
      {str(sp.status) === 'paket' && <Notice tone="good">Paket pengguna diperbarui.</Notice>}
      <section className="card" aria-label="Statistik">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
          {stats.map(([l, v]) => <div key={l}><dt className="text-sm text-muted">{l}</dt><dd className="mt-0.5 text-xl font-extrabold tabular">{v}</dd></div>)}
        </dl>
        <p className="mt-4 border-t border-line pt-3 text-sm text-ink-2">
          Ringkasan AI dinilai membantu: {feedback?.length ? `${Math.round((helpful / feedback.length) * 100)}% dari ${feedback.length} penilaian` : 'belum ada penilaian'}.
        </p>
      </section>

      <section className="card mt-5" aria-labelledby="pengguna-title">
        <h2 id="pengguna-title" className="font-bold">Pengguna</h2>
        <form className="mt-3 flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Cari nama, email, atau usaha</label>
          <input id="q" name="q" defaultValue={q} className="input max-w-xs" placeholder="Nama, email, atau usaha" />
          <button className="btn-secondary">Cari</button>
        </form>
        <div className="table-wrap mt-3">
          <table className="table">
            <thead><tr><th>Pengguna</th><th>Usaha</th><th>Paket</th><th>Berakhir</th><th className="text-right">Unggahan</th><th>Terdaftar</th><th><span className="sr-only">Aksi</span></th></tr></thead>
            <tbody>
              {rows.length ? rows.map((r) => (
                <tr key={r.id}>
                  <td><div className="font-semibold">{r.nama}</div><div className="text-sm text-muted">{r.email}{r.verified ? '' : ' (belum verifikasi)'}</div></td>
                  <td>{r.b?.nama_usaha ?? '–'}<div className="text-sm text-muted">{r.b?.kota}</div></td>
                  <td className={r.pro ? 'font-bold' : 'text-ink-2'}>{r.pro ? 'Pro' : 'Gratis'}</td>
                  <td className="whitespace-nowrap">{r.pro ? F.date(r.s?.berakhir) : '–'}</td>
                  <td className="text-right tabular">{F.number(r.uploads)}</td>
                  <td className="whitespace-nowrap">{F.date(r.created_at)}</td>
                  <td>{r.b && (
                    <form action={setPlan}>
                      <input type="hidden" name="business_id" value={r.b.id} />
                      <input type="hidden" name="aksi" value={r.pro ? 'gratis' : 'pro'} />
                      <ConfirmButton message={`Ubah paket ${r.email}?`} className="btn-ghost px-2 text-sm whitespace-nowrap">{r.pro ? 'Turunkan ke Gratis' : 'Beri Pro 1 bulan'}</ConfirmButton>
                    </form>
                  )}</td>
                </tr>
              )) : <tr><td colSpan={7} className="py-8 text-center text-muted">Tidak ada pengguna yang cocok.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-5" aria-labelledby="log-title">
        <h2 id="log-title" className="font-bold">Log error</h2>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Saring jenis log">
          {[['', 'Semua'], ...Object.entries(JENIS)].map(([k, l]) => (
            <Link key={k} href={k ? `/admin?jenis=${k}` : '/admin'} aria-current={jenis === k ? 'true' : undefined}
                  className={`inline-flex min-h-11 items-center rounded-control border px-3 text-sm font-semibold ${jenis === k ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-field'}`}>{l}</Link>
          ))}
        </nav>
        {!logs.data?.length ? <p className="mt-3 text-sm text-muted">Belum ada error tercatat.</p> : (
          <div className="table-wrap mt-3">
            <table className="table">
              <thead><tr><th>Waktu</th><th>Jenis</th><th>Usaha</th><th>Pesan</th></tr></thead>
              <tbody>{logs.data.map((l) => (
                <tr key={l.id}>
                  <td className="text-sm whitespace-nowrap tabular">{new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td><span className="tag border border-line text-ink-2">{JENIS[l.jenis] ?? l.jenis}</span></td>
                  <td className="text-sm tabular">{l.business_id ? `#${l.business_id}` : '–'}</td>
                  <td className="max-w-xl text-sm text-ink-2">{String(l.pesan).slice(0, 220)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
