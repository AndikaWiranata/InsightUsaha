<x-layouts.guest title="Masuk">
    <h1 class="text-2xl font-extrabold tracking-tight">Masuk</h1>

    @if (session('status'))
        <div class="mt-4 rounded-control bg-good-soft px-3 py-2 text-sm text-good-ink" role="status">{{ session('status') }}</div>
    @endif

    <form method="POST" action="{{ route('login') }}" class="mt-6 space-y-4" novalidate>
        @csrf
        <div>
            <label class="label" for="email">Email</label>
            <input class="input" id="email" type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="email"
                   @error('email') aria-invalid="true" aria-describedby="email-error" @enderror>
            @error('email')<p class="error" id="email-error">{{ $message }}</p>@enderror
        </div>
        <div>
            <label class="label" for="password">Kata sandi</label>
            <input class="input" id="password" type="password" name="password" required autocomplete="current-password">
            @error('password')<p class="error">{{ $message }}</p>@enderror
            <p class="mt-1.5 text-sm"><a href="{{ route('password.request') }}">Lupa kata sandi?</a></p>
        </div>
        <label class="flex min-h-11 items-center gap-2 text-sm text-ink-2" for="ingat">
            <input type="checkbox" id="ingat" name="ingat" value="1" class="h-4 w-4 accent-[var(--c-ink)]"> Biarkan saya tetap masuk di perangkat ini
        </label>
        <button class="btn-primary w-full">Masuk</button>
    </form>
    <p class="mt-6 border-t border-line pt-4 text-sm text-ink-2">Belum punya akun? <a href="{{ route('register') }}">Daftar gratis</a></p>
</x-layouts.guest>
