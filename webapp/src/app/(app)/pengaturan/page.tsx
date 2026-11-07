import type { Metadata } from 'next';
import { getAccount, JENIS_USAHA } from '@/lib/session';
import { ConfirmButton } from '@/components/client';
import { Notice } from '@/components/ui';
import { deleteAccount, savePassword, saveProfile } from './actions';
import { str } from '../page-data';

export const metadata: Metadata = { title: 'Pengaturan' };

const ERR: Record<string, string> = {
  profil: 'Nama dan nama usaha wajib diisi, jenis usaha harus dipilih.',
  sandi: 'Kata sandi baru minimal 8 karakter dan konfirmasinya harus sama.',
  sandi_lama: 'Kata sandi lama salah.',
  hapus: 'Kata sandi salah. Akun tidak dihapus.',
};

export default async function Page({ searchParams }: PageProps<'/pengaturan'>) {
  const [acc, sp] = await Promise.all([getAccount(), searchParams]);
  const b = acc.business;
  const error = str(sp.error);
  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">Pengaturan</h1>
      {str(sp.status) === 'profil' && <Notice tone="good">Profil berhasil disimpan.</Notice>}
      {str(sp.status) === 'sandi' && <Notice tone="good">Kata sandi berhasil diubah.</Notice>}
      {error && ERR[error] && <Notice tone="bad">{ERR[error]}</Notice>}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="card" aria-labelledby="profil-title">
          <h2 id="profil-title" className="font-bold">Profil</h2>
          <form action={saveProfile} className="mt-4 space-y-4">
            <div><label className="label" htmlFor="nama">Nama kamu</label><input className="input" id="nama" name="nama" defaultValue={acc.nama} required autoComplete="name" /></div>
            <div>
              <label className="label" htmlFor="email-akun">Email</label>
              <input className="input bg-paper text-ink-2" id="email-akun" value={acc.email} disabled readOnly />
              <p className="help">Email dipakai untuk masuk dan tidak bisa diubah di sini.</p>
            </div>
            <div><label className="label" htmlFor="nama_usaha">Nama usaha</label><input className="input" id="nama_usaha" name="nama_usaha" defaultValue={b.nama_usaha} required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="kota">Kota</label><input className="input" id="kota" name="kota" defaultValue={b.kota ?? 'Surabaya'} /></div>
              <div>
                <label className="label" htmlFor="jenis_usaha">Jenis usaha</label>
                <select className="input" id="jenis_usaha" name="jenis_usaha" defaultValue={b.jenis_usaha ?? ''} required>
                  {JENIS_USAHA.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label" htmlFor="jam_buka">Jam buka</label><input className="input" id="jam_buka" name="jam_buka" type="time" defaultValue={b.jam_buka?.slice(0, 5) ?? ''} /></div>
              <div><label className="label" htmlFor="jam_tutup">Jam tutup</label><input className="input" id="jam_tutup" name="jam_tutup" type="time" defaultValue={b.jam_tutup?.slice(0, 5) ?? ''} /></div>
            </div>
            <button className="btn-primary">Simpan profil</button>
          </form>
        </section>

        <div className="space-y-5">
          <section className="card" aria-labelledby="sandi-title">
            <h2 id="sandi-title" className="font-bold">Ubah kata sandi</h2>
            <form action={savePassword} className="mt-4 space-y-4">
              <div><label className="label" htmlFor="password_lama">Kata sandi lama</label><input className="input" id="password_lama" name="password_lama" type="password" required autoComplete="current-password" /></div>
              <div><label className="label" htmlFor="password">Kata sandi baru</label><input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" /></div>
              <div><label className="label" htmlFor="password_confirmation">Ulangi kata sandi baru</label><input className="input" id="password_confirmation" name="password_confirmation" type="password" required autoComplete="new-password" /></div>
              <button className="btn-secondary">Ubah kata sandi</button>
            </form>
          </section>

          <section className="border-t border-line pt-5" aria-labelledby="hapus-akun-title">
            <h2 id="hapus-akun-title" className="font-bold text-bad">Hapus akun</h2>
            <p className="mt-1 text-sm text-ink-2">Akun, profil usaha, semua data penjualan, ringkasan AI, dan riwayat langganan dihapus permanen.</p>
            <form action={deleteAccount} className="mt-4 space-y-3">
              <div><label className="label" htmlFor="password_hapus">Kata sandi untuk konfirmasi</label><input className="input" id="password_hapus" name="password_hapus" type="password" required autoComplete="current-password" /></div>
              <ConfirmButton message="Hapus akun beserta seluruh data secara permanen?" className="btn-danger">Hapus akun dan data</ConfirmButton>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
