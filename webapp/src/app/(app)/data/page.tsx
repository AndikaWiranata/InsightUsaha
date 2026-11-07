import type { Metadata } from 'next';
import { getAccount } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';
import * as F from '@/lib/format';
import { Icon } from '@/components/icon';
import { ConfirmButton } from '@/components/client';
import { Uploader } from './uploader';
import { deleteAll, deleteUpload } from './actions';

export const metadata: Metadata = { title: 'Data penjualan' };

const STATUS: Record<string, [string, string]> = {
  selesai: ['bg-good-soft text-good-ink', 'Selesai'], gagal: ['bg-bad-soft text-bad-ink', 'Gagal'], diproses: ['border border-line text-ink-2', 'Diproses'],
};

export default async function Page({ searchParams }: PageProps<'/data'>) {
  const acc = await getAccount();
  const sb = await supabaseServer();
  const { data: uploads } = await sb.from('uploads')
    .select('id, nama_file, mode, status, jumlah_baris_valid, jumlah_baris_ditolak, tanggal_mulai, tanggal_selesai, dibuat_pada, pesan_error')
    .order('dibuat_pada', { ascending: false }).limit(50);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const used = (uploads ?? []).filter((u) => u.status === 'selesai' && new Date(u.dibuat_pada) >= monthStart).length;
  const quotaLeft = acc.isPro ? null : Math.max(0, 1 - used);
  const sp = await searchParams;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Data penjualan</h1>
          <p className="mt-1 text-ink-2">Unggah file baru, lihat riwayat unggahan, atau hapus data.</p>
        </div>
        <a href="/template-insightusaha.csv" download className="btn-secondary"><Icon name="download" className="h-4 w-4" /> Unduh template CSV</a>
      </div>
      {sp.status === 'terhapus' && <p className="mb-4 rounded-control bg-good-soft px-4 py-3 text-sm text-good-ink" role="status">Data sudah dihapus.</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.8fr]">
        <section className="card" aria-labelledby="unggah-title">
          <h2 id="unggah-title" className="font-bold">Unggah file baru</h2>
          {quotaLeft !== null && <p className="mt-1 text-sm text-muted">Paket Gratis: {used} dari 1 unggahan bulan ini terpakai.</p>}
          <div className="mt-4">
            {quotaLeft === 0 ? (
              <div className="rounded-control border border-line bg-paper p-4 text-sm text-ink-2">
                Jatah unggahan bulan ini sudah habis. <a href="/langganan">Upgrade ke Pro</a> untuk unggahan tanpa batas.
              </div>
            ) : <Uploader />}
          </div>
        </section>

        <section className="card" aria-labelledby="riwayat-title">
          <h2 id="riwayat-title" className="font-bold">Riwayat unggahan</h2>
          {!uploads?.length ? (
            <p className="mt-4 text-sm text-ink-2">Belum ada unggahan. File yang kamu unggah akan tercatat di sini.</p>
          ) : (
            <div className="table-wrap mt-3">
              <table className="table">
                <thead><tr><th>File</th><th>Rentang data</th><th className="text-right">Masuk</th><th className="text-right">Ditolak</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id}>
                      <td className="max-w-56">
                        <span className="block truncate font-semibold">{u.nama_file}</span>
                        <span className="text-sm text-muted">{F.date(u.dibuat_pada)}{u.mode !== 'baru' ? `, ${u.mode === 'ganti' ? 'mengganti data lama' : 'digabung'}` : ''}</span>
                      </td>
                      <td className="whitespace-nowrap text-ink-2">{u.tanggal_mulai ? `${F.date(u.tanggal_mulai)} – ${F.date(u.tanggal_selesai)}` : '–'}</td>
                      <td className="text-right tabular">{F.number(u.jumlah_baris_valid)}</td>
                      <td className="text-right tabular">{F.number(u.jumlah_baris_ditolak)}</td>
                      <td><span className={`tag ${STATUS[u.status][0]}`}>{STATUS[u.status][1]}</span></td>
                      <td className="text-right">
                        <form action={deleteUpload}>
                          <input type="hidden" name="id" value={u.id} />
                          <ConfirmButton message={`Hapus unggahan ${u.nama_file} beserta data penjualannya?`} className="btn-ghost px-2 text-bad">
                            <Icon name="trash" className="h-4 w-4" /><span className="sr-only">Hapus unggahan {u.nama_file}</span>
                          </ConfirmButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="mt-8 border-t border-line pt-6" aria-labelledby="hapus-title">
        <h2 id="hapus-title" className="font-bold text-bad">Hapus semua data penjualan</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">Menghapus semua unggahan, transaksi, menu, HPP, dan ringkasan AI. Akunmu tetap ada. Tidak bisa dibatalkan.</p>
        <form action={deleteAll} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:w-64">
            <label htmlFor="konfirmasi" className="label">Ketik HAPUS untuk konfirmasi</label>
            <input id="konfirmasi" name="konfirmasi" className="input" autoComplete="off" required pattern="HAPUS" />
            {sp.error === 'konfirmasi' && <p className="error" role="alert">Ketik HAPUS untuk mengonfirmasi.</p>}
          </div>
          <ConfirmButton message="Yakin menghapus SEMUA data penjualan?" className="btn-danger">Hapus semua data</ConfirmButton>
        </form>
      </section>
    </>
  );
}
