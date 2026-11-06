@php
    $biz = $currentBusiness ?? auth()->user()?->business;
    $pro = $biz?->isPro() ?? false;
    $nav = [
        ['dashboard', 'Ringkasan', false],
        ['produk', 'Produk', false],
        ['waktu', 'Jam ramai', false],
        ['bundling', 'Paket bundling', true],
        ['menu', 'Klasifikasi menu', true],
        ['laporan', 'Laporan PDF', true],
    ];
    $navAkun = [
        ['data', 'Data penjualan'],
        ['langganan', 'Langganan'],
        ['pengaturan', 'Pengaturan'],
    ];
    $periodQuery = request()->only(['periode', 'mulai', 'selesai']);
    $current = fn ($route) => request()->routeIs($route, $route.'.*');
@endphp
<x-layouts.base :title="$title ?? null">
    <div class="lg:flex">
        <header class="sticky top-0 z-30 border-b border-line bg-paper lg:fixed lg:inset-y-0 lg:w-60 lg:border-r lg:border-b-0">
            <div class="flex h-14 items-center justify-between px-4 lg:h-auto lg:px-5 lg:pt-6 lg:pb-4">
                <x-logo :href="route('dashboard')" />
                <button type="button" class="btn-ghost -mr-2 lg:hidden" data-nav-toggle aria-expanded="false" aria-controls="nav-utama">
                    <x-icon name="menu" />
                    <span>Menu</span>
                </button>
            </div>
            <nav id="nav-utama" data-nav class="hidden max-h-[calc(100dvh-3.5rem)] overflow-y-auto px-3 pb-5 lg:block lg:max-h-none" aria-label="Navigasi utama">
                @if ($biz)
                    <div class="mb-4 border-b border-line px-3 pb-4">
                        <div class="truncate text-sm font-bold">{{ $biz->nama_usaha }}</div>
                        <div class="mt-0.5 text-sm text-muted">Paket {{ $pro ? 'Pro' : 'Gratis' }}</div>
                    </div>
                @endif
                <ul class="space-y-0.5">
                    @foreach ($nav as [$route, $label, $needsPro])
                        <li>
                            <a href="{{ route($route, $periodQuery) }}" class="nav-link" @if ($current($route)) aria-current="page" @endif>
                                <span class="flex-1">{{ $label }}</span>
                                @if ($needsPro && ! $pro)<span class="text-xs font-semibold text-muted">Pro</span>@endif
                            </a>
                        </li>
                    @endforeach
                </ul>
                <p class="mt-5 mb-1 px-3 text-xs font-semibold text-muted">Akun</p>
                <ul class="space-y-0.5">
                    @foreach ($navAkun as [$route, $label])
                        <li><a href="{{ route($route) }}" class="nav-link" @if ($current($route)) aria-current="page" @endif>{{ $label }}</a></li>
                    @endforeach
                    @if (auth()->user()?->isAdmin())
                        <li><a href="{{ route('admin') }}" class="nav-link" @if ($current('admin')) aria-current="page" @endif>Panel admin</a></li>
                    @endif
                </ul>
                <div class="mt-5 flex flex-wrap items-center gap-1 border-t border-line px-1 pt-4">
                    <x-theme-toggle />
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button class="btn-ghost">Keluar</button>
                    </form>
                </div>
            </nav>
        </header>

        <main id="konten" class="min-w-0 flex-1 lg:pl-60">
            <div class="mx-auto max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-9">
                {{ $slot }}
            </div>
        </main>
    </div>

    @if ($biz)
        @include('partials.chat')
    @endif
</x-layouts.base>
