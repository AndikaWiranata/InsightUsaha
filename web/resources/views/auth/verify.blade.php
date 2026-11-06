<x-layouts.guest title="Verifikasi email">
    <h1 class="text-2xl font-extrabold tracking-tight">Cek email kamu</h1>
    <p class="mt-2 text-ink-2">
        Tautan verifikasi sudah dikirim ke <strong class="text-ink">{{ auth()->user()->email }}</strong>.
        Klik tautan itu untuk mulai memakai InsightUsaha.
    </p>
    @if (session('status'))
        <div class="mt-4 rounded-control bg-good-soft px-3 py-2 text-sm text-good-ink" role="status">{{ session('status') }}</div>
    @endif
    <div class="mt-6 flex flex-col gap-2 sm:flex-row">
        <form method="POST" action="{{ route('verification.send') }}" class="flex-1">
            @csrf
            <button class="btn-primary w-full">Kirim ulang email</button>
        </form>
        <form method="POST" action="{{ route('logout') }}">
            @csrf
            <button class="btn-secondary w-full">Keluar</button>
        </form>
    </div>
    <p class="mt-4 text-sm text-muted">Tidak ketemu? Periksa folder spam atau promosi.</p>
</x-layouts.guest>
