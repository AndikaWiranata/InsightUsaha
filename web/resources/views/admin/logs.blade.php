<x-layouts.app title="Log error">
    <a href="{{ route('admin') }}" class="text-sm">← Panel admin</a>
    <h1 class="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Log error</h1>
    <nav class="mt-4 flex flex-wrap gap-2" aria-label="Saring jenis log">
        @foreach (['' => 'Semua', 'impor' => 'Impor', 'ai' => 'API AI', 'analitik' => 'Analitik', 'pembayaran' => 'Pembayaran'] as $k => $label)
            @php $on = (string) $jenis === (string) $k; @endphp
            <a href="{{ route('admin.logs', $k ? ['jenis' => $k] : []) }}"
               class="inline-flex min-h-11 items-center rounded-control border px-3 text-sm font-semibold {{ $on ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-field' }}"
               @if ($on) aria-current="true" @endif>{{ $label }}</a>
        @endforeach
    </nav>
    <section class="card mt-4">
        @include('admin.partials.log-table', ['logs' => $logs])
        <div class="mt-4">{{ $logs->links() }}</div>
    </section>
</x-layouts.app>
