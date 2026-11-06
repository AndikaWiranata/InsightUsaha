<x-layouts.guest title="Daftar">
    <h1 class="text-2xl font-extrabold tracking-tight">Buat akun</h1>
    <p class="mt-1 text-ink-2">Gratis. Setelah daftar, kamu langsung bisa mengunggah file penjualan.</p>

    <form method="POST" action="{{ route('register') }}" class="mt-6 space-y-4" novalidate data-busy-label="Mendaftarkan…">
        @csrf
        @foreach ([['nama', 'Nama kamu', 'text', 'name'], ['email', 'Email', 'email', 'email']] as [$f, $l, $t, $ac])
            <div>
                <label class="label" for="{{ $f }}">{{ $l }}</label>
                <input class="input" id="{{ $f }}" type="{{ $t }}" name="{{ $f }}" value="{{ old($f) }}" required autocomplete="{{ $ac }}"
                       @error($f) aria-invalid="true" aria-describedby="{{ $f }}-error" @enderror>
                @error($f)<p class="error" id="{{ $f }}-error">{{ $message }}</p>@enderror
            </div>
        @endforeach
        <div class="grid gap-4 sm:grid-cols-2">
            <div>
                <label class="label" for="password">Kata sandi</label>
                <input class="input" id="password" type="password" name="password" required minlength="8" autocomplete="new-password" aria-describedby="password-help">
                <p class="help" id="password-help">Minimal 8 karakter.</p>
                @error('password')<p class="error">{{ $message }}</p>@enderror
            </div>
            <div>
                <label class="label" for="password_confirmation">Ulangi kata sandi</label>
                <input class="input" id="password_confirmation" type="password" name="password_confirmation" required autocomplete="new-password">
            </div>
        </div>
        <div>
            <label class="label" for="nama_usaha">Nama usaha</label>
            <input class="input" id="nama_usaha" name="nama_usaha" value="{{ old('nama_usaha') }}" required placeholder="contoh: Kedai Kopi Rina">
            @error('nama_usaha')<p class="error">{{ $message }}</p>@enderror
        </div>
        <div>
            <label class="label" for="jenis_usaha">Jenis usaha</label>
            <select class="input" id="jenis_usaha" name="jenis_usaha" required>
                <option value="">Pilih jenis usaha</option>
                @foreach ($jenisUsaha as $j)
                    <option value="{{ $j }}" @selected(old('jenis_usaha') === $j)>{{ $j }}</option>
                @endforeach
            </select>
            @error('jenis_usaha')<p class="error">{{ $message }}</p>@enderror
        </div>
        <p class="text-sm text-muted">Dengan mendaftar, kamu menyetujui <a href="{{ route('privasi') }}">kebijakan privasi</a>.</p>
        <button class="btn-primary w-full">Buat akun</button>
    </form>
    <p class="mt-6 border-t border-line pt-4 text-sm text-ink-2">Sudah punya akun? <a href="{{ route('login') }}">Masuk</a></p>
</x-layouts.guest>
