<x-layouts.app title="Pengaturan">
    <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Pengaturan</h1>
    <div class="mt-6"><x-flash :hide-errors="true" /></div>

    <div class="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section class="card" aria-labelledby="profil-title">
            <h2 id="profil-title" class="font-bold">Profil</h2>
            <form method="POST" action="{{ route('pengaturan.profil') }}" class="mt-4 space-y-4">
                @csrf
                <div>
                    <label class="label" for="nama">Nama kamu</label>
                    <input class="input" id="nama" name="nama" value="{{ old('nama', $user->nama) }}" required autocomplete="name">
                    @error('nama')<p class="error">{{ $message }}</p>@enderror
                </div>
                <div>
                    <label class="label" for="email-akun">Email</label>
                    <input class="input bg-paper text-ink-2" id="email-akun" value="{{ $user->email }}" disabled>
                    <p class="help">Email dipakai untuk masuk dan tidak bisa diubah di sini.</p>
                </div>
                @include('partials.business-fields')
                <button class="btn-primary">Simpan profil</button>
            </form>
        </section>

        <div class="space-y-5">
            <section class="card" aria-labelledby="sandi-title">
                <h2 id="sandi-title" class="font-bold">Ubah kata sandi</h2>
                <form method="POST" action="{{ route('pengaturan.sandi') }}" class="mt-4 space-y-4">
                    @csrf
                    <div>
                        <label class="label" for="password_lama">Kata sandi lama</label>
                        <input class="input" id="password_lama" type="password" name="password_lama" autocomplete="current-password">
                        @error('password_lama')<p class="error">{{ $message }}</p>@enderror
                    </div>
                    <div>
                        <label class="label" for="password">Kata sandi baru</label>
                        <input class="input" id="password" type="password" name="password" minlength="8" autocomplete="new-password">
                        @error('password')<p class="error">{{ $message }}</p>@enderror
                    </div>
                    <div>
                        <label class="label" for="password_confirmation">Ulangi kata sandi baru</label>
                        <input class="input" id="password_confirmation" type="password" name="password_confirmation" autocomplete="new-password">
                    </div>
                    <button class="btn-secondary">Ubah kata sandi</button>
                </form>
            </section>

            <section class="border-t border-line pt-5" aria-labelledby="hapus-akun-title">
                <h2 id="hapus-akun-title" class="font-bold text-bad">Hapus akun</h2>
                <p class="mt-1 text-sm text-ink-2">Akun, profil usaha, semua data penjualan, hasil analisis, dan riwayat langganan dihapus permanen.</p>
                <form method="POST" action="{{ route('pengaturan.hapus-akun') }}" class="mt-4 space-y-3" data-confirm="Hapus akun beserta seluruh data secara permanen?">
                    @csrf @method('DELETE')
                    <div>
                        <label class="label" for="password_hapus">Kata sandi untuk konfirmasi</label>
                        <input class="input" id="password_hapus" type="password" name="password_hapus" autocomplete="current-password">
                        @error('password_hapus')<p class="error">{{ $message }}</p>@enderror
                    </div>
                    <button class="btn-danger">Hapus akun dan data</button>
                </form>
            </section>
        </div>
    </div>
</x-layouts.app>
