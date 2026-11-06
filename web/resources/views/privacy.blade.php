<x-layouts.base title="Kebijakan privasi">
    <header class="border-b border-line">
        <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-2 sm:px-6">
            <x-logo />
            <x-theme-toggle />
        </div>
    </header>
    <main id="konten" class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article class="space-y-4 leading-relaxed text-ink-2">
            <h1 class="text-3xl font-extrabold tracking-tight text-ink">Kebijakan privasi</h1>
            <p>Kebijakan ini menjelaskan cara InsightUsaha mengelola data pribadi dan data usahamu, mengacu pada
                Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.</p>
            <h2 class="pt-2 text-xl font-bold text-ink">Data yang kami simpan</h2>
            <ul class="list-disc space-y-1 pl-5">
                <li>Data akun: nama, email, dan kata sandi (disimpan dalam bentuk hash, tidak bisa dibaca siapa pun).</li>
                <li>Profil usaha: nama usaha, kota, jenis usaha, jam buka.</li>
                <li>Data penjualan yang kamu unggah: tanggal, jam, nomor transaksi, nama menu, jumlah, harga, dan HPP.</li>
            </ul>
            <h2 class="pt-2 text-xl font-bold text-ink">Untuk apa dipakai</h2>
            <p>Hanya untuk menampilkan analisis dan laporan bagi usahamu sendiri. Data satu usaha tidak bisa dilihat pengguna lain.</p>
            <h2 class="pt-2 text-xl font-bold text-ink">Pihak ketiga</h2>
            <ul class="list-disc space-y-1 pl-5">
                <li><strong class="text-ink">Penyedia AI (Google Gemini)</strong>: untuk ringkasan dan tanya jawab, kami hanya mengirim angka hasil hitungan (misalnya total omzet, persentase perubahan, nama menu terlaris) dan pertanyaan yang kamu ketik. Baris transaksi mentah tidak pernah dikirim.</li>
                <li><strong class="text-ink">Payment gateway</strong>: menerima nama, email, dan nominal tagihan untuk memproses pembayaran.</li>
                <li><strong class="text-ink">Layanan email</strong>: untuk verifikasi, atur ulang kata sandi, dan pengingat langganan.</li>
            </ul>
            <h2 class="pt-2 text-xl font-bold text-ink">Hak kamu</h2>
            <p>Kamu bisa mengubah profil kapan saja, menghapus data penjualan di halaman Data penjualan, atau menghapus akun beserta seluruh datanya di halaman Pengaturan. Penghapusan bersifat permanen. Salinan cadangan basis data disimpan paling lama 7 hari lalu dihapus otomatis.</p>
            <h2 class="pt-2 text-xl font-bold text-ink">Keamanan</h2>
            <p>Koneksi memakai HTTPS, kata sandi di-hash dengan bcrypt, dan percobaan masuk dibatasi untuk mencegah tebak-tebakan kata sandi.</p>
            <p class="pt-4"><a href="{{ route('home') }}">Kembali ke halaman utama</a></p>
        </article>
    </main>
</x-layouts.base>
