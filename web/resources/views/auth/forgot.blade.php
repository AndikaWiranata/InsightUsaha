<x-layouts.guest title="Lupa kata sandi">
    <h1 class="text-2xl font-extrabold tracking-tight">Lupa kata sandi</h1>
    <p class="mt-1 text-ink-2">Masukkan email akunmu. Kami kirim tautan untuk membuat kata sandi baru.</p>

    @if (session('status'))
        <div class="mt-4 rounded-control bg-good-soft px-3 py-2 text-sm text-good-ink" role="status">{{ session('status') }}</div>
    @endif

    <form method="POST" action="{{ route('password.email') }}" class="mt-6 space-y-4" data-busy-label="Mengirim…">
        @csrf
        <div>
            <label class="label" for="email">Email</label>
            <input class="input" id="email" type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="email">
            @error('email')<p class="error">{{ $message }}</p>@enderror
        </div>
        <button class="btn-primary w-full">Kirim tautan</button>
    </form>
    <p class="mt-6 border-t border-line pt-4 text-sm"><a href="{{ route('login') }}">Kembali ke halaman masuk</a></p>
</x-layouts.guest>
