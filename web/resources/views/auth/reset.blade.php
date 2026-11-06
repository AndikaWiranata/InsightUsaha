<x-layouts.guest title="Kata sandi baru">
    <h1 class="text-2xl font-extrabold tracking-tight">Buat kata sandi baru</h1>
    <form method="POST" action="{{ route('password.update') }}" class="mt-6 space-y-4">
        @csrf
        <input type="hidden" name="token" value="{{ $token }}">
        <div>
            <label class="label" for="email">Email</label>
            <input class="input" id="email" type="email" name="email" value="{{ old('email', $email) }}" required autocomplete="email">
            @error('email')<p class="error">{{ $message }}</p>@enderror
        </div>
        <div>
            <label class="label" for="password">Kata sandi baru</label>
            <input class="input" id="password" type="password" name="password" required minlength="8" autocomplete="new-password" aria-describedby="password-help">
            <p class="help" id="password-help">Minimal 8 karakter.</p>
            @error('password')<p class="error">{{ $message }}</p>@enderror
        </div>
        <div>
            <label class="label" for="password_confirmation">Ulangi kata sandi baru</label>
            <input class="input" id="password_confirmation" type="password" name="password_confirmation" required autocomplete="new-password">
        </div>
        <button class="btn-primary w-full">Simpan kata sandi</button>
    </form>
</x-layouts.guest>
