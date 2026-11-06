@php use App\Services\Format; @endphp
<x-layouts.app title="Panel admin">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Panel admin</h1>
        <a href="{{ route('admin.logs') }}" class="btn-secondary">Semua log error</a>
    </div>
    <div class="mt-6"><x-flash /></div>

    <section class="card" aria-label="Statistik">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
            @foreach ([
                ['Pengguna terdaftar', Format::number($stats['pengguna'])],
                ['Aktif 7 hari terakhir', Format::number($stats['aktif_mingguan'])],
                ['Pelanggan berbayar', Format::number($stats['berbayar'])],
                ['Pendapatan bulan ini', Format::rupiah($stats['pendapatan'])],
                ['Sudah unggah data', $stats['aktivasi'].'%'],
            ] as [$label, $value])
                <div><dt class="text-sm text-muted">{{ $label }}</dt><dd class="mt-0.5 text-xl font-extrabold tabular">{{ $value }}</dd></div>
            @endforeach
        </dl>
        <p class="mt-4 border-t border-line pt-3 text-sm text-ink-2">
            Ringkasan AI dinilai membantu: {{ $stats['membantu'] !== null ? $stats['membantu'].'% dari '.$stats['umpan_balik'].' penilaian' : 'belum ada penilaian' }}.
        </p>
    </section>

    <section class="card mt-5" aria-labelledby="pengguna-title">
        <h2 id="pengguna-title" class="font-bold">Pengguna</h2>
        <form method="GET" class="mt-3 flex gap-2" role="search">
            <label for="q" class="sr-only">Cari nama, email, atau usaha</label>
            <input id="q" name="q" value="{{ $q }}" class="input max-w-xs" placeholder="Nama, email, atau usaha">
            <button class="btn-secondary">Cari</button>
        </form>
        <div class="table-wrap mt-3">
            <table class="table">
                <thead><tr><th>Pengguna</th><th>Usaha</th><th>Paket</th><th>Berakhir</th><th class="text-right">Unggahan</th><th>Terdaftar</th><th><span class="sr-only">Aksi</span></th></tr></thead>
                <tbody>
                    @forelse ($users as $u)
                        @php
                            $sub = $u->business?->subscription;
                            $pro = $u->business?->isPro();
                        @endphp
                        <tr>
                            <td><div class="font-semibold">{{ $u->nama }}</div><div class="text-sm text-muted">{{ $u->email }}{{ $u->email_verified_at ? '' : ' (belum verifikasi)' }}</div></td>
                            <td>{{ $u->business?->nama_usaha ?? '–' }}<div class="text-sm text-muted">{{ $u->business?->kota }}</div></td>
                            <td class="{{ $pro ? 'font-bold' : 'text-ink-2' }}">{{ $pro ? 'Pro' : 'Gratis' }}</td>
                            <td class="whitespace-nowrap">{{ $pro ? Format::date($sub->berakhir) : '–' }}</td>
                            <td class="text-right tabular">{{ Format::number($u->jumlah_unggahan) }}</td>
                            <td class="whitespace-nowrap">{{ Format::date($u->created_at) }}</td>
                            <td>
                                <form method="POST" action="{{ route('admin.langganan', $u) }}" data-confirm="Ubah paket {{ $u->email }}?">
                                    @csrf
                                    <input type="hidden" name="aksi" value="{{ $pro ? 'gratis' : 'pro' }}">
                                    <button class="btn-ghost px-2 text-sm whitespace-nowrap">{{ $pro ? 'Turunkan ke Gratis' : 'Beri Pro 1 bulan' }}</button>
                                </form>
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="7" class="py-8 text-center text-muted">Tidak ada pengguna yang cocok.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        <div class="mt-4">{{ $users->links() }}</div>
    </section>

    <section class="card mt-5" aria-labelledby="log-title">
        <h2 id="log-title" class="font-bold">Log error terbaru</h2>
        @include('admin.partials.log-table', ['logs' => $logs])
    </section>
</x-layouts.app>
