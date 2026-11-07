import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/ui';
import { ThemeToggle } from '@/components/client';

export const metadata: Metadata = { title: 'Kebijakan privasi' };

export default function Page() {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2 sm:px-6"><Logo /><ThemeToggle /></div>
      </header>
      <main id="konten" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article className="space-y-4 leading-relaxed text-ink-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Kebijakan privasi</h1>
          <p>Kebijakan ini menjelaskan cara InsightUsaha mengelola data pribadi dan data usahamu, mengacu pada Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.</p>
          <h2 className="pt-2 text-xl font-bold text-ink">Data yang kami simpan</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Data akun: nama, email, dan kata sandi (disimpan terenkripsi oleh Supabase Auth, tidak bisa dibaca siapa pun).</li>
            <li>Profil usaha: nama usaha, kota, jenis usaha, jam buka.</li>
            <li>Data penjualan yang kamu unggah: tanggal, jam, nomor transaksi, nama menu, jumlah, harga, dan HPP. File aslinya dibaca di perangkatmu dan tidak disimpan di server.</li>
          </ul>
          <h2 className="pt-2 text-xl font-bold text-ink">Untuk apa dipakai</h2>
          <p>Hanya untuk menampilkan analisis dan laporan bagi usahamu sendiri. Basis data memisahkan data per usaha, jadi data satu usaha tidak bisa dilihat pengguna lain.</p>
          <h2 className="pt-2 text-xl font-bold text-ink">Pihak ketiga</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-ink">Supabase</strong>: menyimpan akun dan data penjualan.</li>
            <li><strong className="text-ink">Penyedia AI (Google Gemini)</strong>: untuk ringkasan dan tanya jawab, kami hanya mengirim angka hasil hitungan (misalnya total omzet, persentase perubahan, nama menu terlaris) dan pertanyaan yang kamu ketik. Baris transaksi mentah tidak pernah dikirim.</li>
            <li><strong className="text-ink">Payment gateway</strong>: menerima nama, email, dan nominal tagihan untuk memproses pembayaran.</li>
          </ul>
          <h2 className="pt-2 text-xl font-bold text-ink">Hak kamu</h2>
          <p>Kamu bisa mengubah profil kapan saja, menghapus data penjualan di halaman Data penjualan, atau menghapus akun beserta seluruh datanya di halaman Pengaturan. Penghapusan bersifat permanen.</p>
          <h2 className="pt-2 text-xl font-bold text-ink">Keamanan</h2>
          <p>Koneksi memakai HTTPS, kata sandi dikelola Supabase Auth, dan percobaan masuk dibatasi untuk mencegah tebak-tebakan kata sandi.</p>
          <p className="pt-4"><Link href="/">Kembali ke halaman utama</Link></p>
        </article>
      </main>
    </>
  );
}
