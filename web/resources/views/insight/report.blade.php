<x-layouts.app title="Laporan PDF">
    @if (! $hasData)
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Laporan PDF</h1>
        <div class="card mt-6 text-sm text-ink-2">Belum ada data penjualan. <a href="{{ route('data') }}">Unggah data</a> terlebih dahulu.</div>
    @else
        @include('partials.page-head', ['heading' => 'Laporan PDF', 'sub' => 'Untuk disimpan, dicetak, atau dikirim ke rekan usaha.', 'error' => null])
        @error('laporan')<div class="mb-4 rounded-control bg-bad-soft px-4 py-3 text-sm text-bad-ink" role="alert">{{ $message }}</div>@enderror
        <section class="card max-w-xl">
            <h2 class="font-bold">Isi laporan periode {{ $period->label() }}</h2>
            <ol class="mt-3 list-decimal space-y-1 pl-5 text-ink-2">
                <li>Omzet, transaksi, rata-rata per transaksi, menu terlaris</li>
                <li>Ringkasan dan tiga saran</li>
                <li>Omzet per hari/minggu/bulan</li>
                <li>Menu naik dan turun</li>
                <li>Jam ramai dan sepi</li>
                <li>Pasangan menu untuk paket</li>
                <li>Klasifikasi menu (bila HPP sudah diisi)</li>
            </ol>
            <a href="{{ route('laporan.pdf', $period->query()) }}" class="btn-primary mt-5"><x-icon name="download" class="h-4 w-4" /> Unduh PDF</a>
            <p class="help mt-2">Pembuatan PDF butuh beberapa detik.</p>
        </section>
    @endif
</x-layouts.app>
