<x-layouts.base title="Baca data penjualan warungmu">
    <header class="border-b border-line">
        <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
            <x-logo />
            <nav class="flex flex-wrap items-center gap-1" aria-label="Navigasi">
                <a href="#harga" class="btn-ghost">Harga</a>
                <x-theme-toggle class="hidden sm:inline-flex" />
                @auth
                    <a href="{{ route('dashboard') }}" class="btn-primary">Buka ringkasan</a>
                @else
                    <a href="{{ route('login') }}" class="btn-ghost">Masuk</a>
                    <a href="{{ route('register') }}" class="btn-primary">Daftar gratis</a>
                @endauth
            </nav>
        </div>
    </header>

    <main id="konten">
        @if (session('status'))
            <div class="mx-auto max-w-5xl px-4 pt-4 sm:px-6"><x-flash /></div>
        @endif

        {{-- Titik fokus: satu kalimat masalah + satu tindakan. --}}
        <section class="mx-auto max-w-5xl px-4 pt-12 pb-14 sm:px-6 sm:pt-20">
            <h1 class="max-w-3xl text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-6xl">
                Catatan penjualanmu sudah lengkap. Sekarang <span class="stabilo">baca isinya</span>.
            </h1>
            <p class="mt-6 max-w-2xl text-lg text-ink-2">
                Unggah file dari aplikasi kasir atau Excel. InsightUsaha menghitung menu yang naik dan turun, jam ramai,
                pasangan menu yang sering dibeli bersamaan, lalu menuliskannya dalam bahasa sehari-hari.
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href="{{ route('register') }}" class="btn-primary px-6 text-base">Buat akun gratis</a>
                <a href="#isi-laporan" class="btn-ghost text-base">Lihat isi laporannya</a>
            </div>
        </section>

        {{-- Isi laporan: ditulis sebagai daftar buku kas, bukan kartu fitur. --}}
        <section id="isi-laporan" class="border-y border-line bg-surface">
            <div class="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
                <div>
                    <h2 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Yang kamu dapat dari satu file penjualan</h2>
                    <p class="mt-3 text-ink-2">Semua dihitung dari datamu sendiri. Tidak ada angka contoh atau tebakan.</p>
                </div>
                <dl class="divide-y divide-line border-t border-b border-line">
                    @foreach ([
                        ['Omzet dan transaksi', 'Total omzet, jumlah transaksi, rata-rata belanja per transaksi, dibandingkan dengan periode sebelumnya.'],
                        ['Menu naik dan turun', 'Tiap menu diberi tanda Naik, Stabil, Turun, atau Baru. Menu yang terjual terlalu sedikit tidak diberi tanda supaya tidak menyesatkan.'],
                        ['Jam dan hari ramai', 'Tabel hari × jam untuk menentukan kapan menambah karyawan dan kapan pasang promo.'],
                        ['Pasangan menu', 'Menu yang sering dibeli bersamaan, ditulis seperti "67% pembeli Croissant juga membeli Kopi Susu".'],
                        ['Klasifikasi menu', 'Isi harga pokok tiap menu, lalu lihat mana yang laris dan untung, laris tapi tipis, atau perlu dirombak.'],
                        ['Ringkasan dan tanya jawab', 'Ringkasan singkat beserta tiga saran. Kamu juga bisa bertanya langsung soal datamu. Angkanya selalu diambil dari hasil hitungan.'],
                    ] as [$t, $d])
                        <div class="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
                            <dt class="font-bold">{{ $t }}</dt>
                            <dd class="text-ink-2">{{ $d }}</dd>
                        </div>
                    @endforeach
                </dl>
            </div>
        </section>

        <section class="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Format file yang bisa dibaca</h2>
            <p class="mt-3 max-w-2xl text-ink-2">
                Cukup empat kolom wajib: tanggal, nama produk, jumlah, dan harga satuan. Kolom jam dan nomor transaksi
                membuka analisis jam ramai dan pasangan menu. Nama kolom berbeda pun bisa dicocokkan saat mengunggah.
            </p>
            <div class="table-wrap mt-6">
                <table class="table tabular">
                    <thead><tr><th>tanggal</th><th>jam</th><th>id_transaksi</th><th>nama_produk</th><th>jumlah</th><th class="text-right">harga_satuan</th></tr></thead>
                    <tbody>
                        <tr><td>2026-10-01</td><td>08:15</td><td>TRX001</td><td>Kopi Susu Gula Aren</td><td>2</td><td class="text-right">18000</td></tr>
                        <tr><td>2026-10-01</td><td>08:15</td><td>TRX001</td><td>Croissant</td><td>1</td><td class="text-right">22000</td></tr>
                        <tr><td>2026-10-01</td><td>09:40</td><td>TRX002</td><td>Americano</td><td>1</td><td class="text-right">15000</td></tr>
                    </tbody>
                </table>
            </div>
            <p class="help">Contoh baris dari template yang bisa diunduh setelah mendaftar.</p>
        </section>

        <section id="harga" class="border-t border-line bg-surface">
            <div class="mx-auto max-w-5xl px-4 py-14 sm:px-6">
                <h2 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Harga</h2>
                <div class="mt-6 grid gap-4 md:grid-cols-[1fr_1.25fr]">
                    <div class="rounded-card border border-line p-6">
                        <h3 class="font-bold">Gratis</h3>
                        <p class="mt-1 text-3xl font-extrabold tabular">Rp0</p>
                        <ul class="mt-4 space-y-1.5 text-ink-2">
                            <li>1 unggahan per bulan</li>
                            <li>Data 3 bulan terakhir</li>
                            <li>Ringkasan omzet dan menu naik/turun</li>
                        </ul>
                        <a href="{{ route('register') }}" class="btn-secondary mt-6 w-full">Daftar paket Gratis</a>
                    </div>
                    <div class="rounded-card border-2 border-ink p-6">
                        <h3 class="font-bold">Pro</h3>
                        <p class="mt-1 text-3xl font-extrabold tabular">Rp49.000 <span class="text-base font-medium text-muted">per bulan</span></p>
                        <ul class="mt-4 space-y-1.5 text-ink-2">
                            <li>Unggahan tanpa batas dan seluruh riwayat data</li>
                            <li>Jam ramai, pasangan menu, klasifikasi menu</li>
                            <li>Ringkasan, saran, dan tanya jawab soal datamu</li>
                            <li>Laporan PDF</li>
                        </ul>
                        <a href="{{ route('register') }}" class="btn-primary mt-6 w-full">Daftar, lalu upgrade ke Pro</a>
                        <p class="mt-2 text-sm text-muted">Bayar lewat QRIS, e-wallet, atau virtual account.</p>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer class="border-t border-line">
        <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted sm:px-6">
            <span>InsightUsaha, Surabaya</span>
            <a href="{{ route('privasi') }}">Kebijakan privasi</a>
        </div>
    </footer>
</x-layouts.base>
