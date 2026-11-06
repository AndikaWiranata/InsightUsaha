@php
    use App\Services\Format;
    $s = $d['ringkasan'] ?? null;
    $c = $d['perubahan'] ?? [];
@endphp
<x-layouts.app title="Ringkasan">
    @include('partials.page-head', ['heading' => 'Ringkasan penjualan', 'sub' => $business->nama_usaha])

    @if ($d)
        @if (($s['transaksi'] ?? 0) === 0)
            <div class="mb-4 rounded-control border border-line bg-surface px-4 py-3 text-sm text-ink-2">
                Tidak ada transaksi pada periode ini. Pilih periode lain di atas.
            </div>
        @endif

        {{-- Titik fokus: omzet. Angka lain ditulis sebagai baris buku kas di sebelahnya. --}}
        <section class="card grid gap-6 sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:gap-10" aria-labelledby="omzet-label">
            <div>
                <h2 id="omzet-label" class="text-sm font-semibold text-muted">Total omzet</h2>
                <p class="mt-1 text-4xl font-extrabold tracking-tight tabular sm:text-5xl"><span class="stabilo">{{ Format::rupiah($s['omzet']) }}</span></p>
                <p class="mt-2"><x-change :value="$c['omzet']" /></p>
            </div>
            <dl class="divide-y divide-line self-end border-t border-line lg:border-t-0">
                <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 lg:pt-0">
                    <dt class="text-ink-2">Jumlah transaksi</dt>
                    <dd class="text-right"><span class="text-lg font-bold tabular">{{ Format::number($s['transaksi']) }}</span>
                        <span class="block"><x-change :value="$c['transaksi']" suffix="" /></span></dd>
                </div>
                <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                    <dt class="text-ink-2">Rata-rata per transaksi</dt>
                    <dd class="text-right"><span class="text-lg font-bold tabular">{{ Format::rupiah($s['rata_rata_transaksi']) }}</span>
                        <span class="block"><x-change :value="$c['rata_rata_transaksi']" suffix="" /></span></dd>
                </div>
                <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                    <dt class="text-ink-2">Menu terlaris</dt>
                    <dd class="min-w-0 text-right">
                        @if ($s['produk_terlaris'])
                            <span class="block truncate text-lg font-bold">{{ $s['produk_terlaris']['nama'] }}</span>
                            <span class="text-sm text-muted tabular">{{ Format::number($s['produk_terlaris']['unit']) }} terjual</span>
                            <span class="block"><x-change :value="$c['produk_terlaris_unit']" suffix="" /></span>
                        @else
                            <span class="text-lg font-bold">–</span>
                        @endif
                    </dd>
                </div>
            </dl>
        </section>

        <div class="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <section class="card" aria-labelledby="tren-title">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="tren-title" class="font-bold">Omzet per {{ ['harian' => 'hari', 'mingguan' => 'minggu', 'bulanan' => 'bulan'][$d['tren']['granularitas']] }}</h2>
                    <div class="flex rounded-control border border-line p-0.5 text-sm" role="group" aria-label="Kelompokkan omzet per">
                        @foreach (['harian' => 'Hari', 'mingguan' => 'Minggu', 'bulanan' => 'Bulan'] as $g => $label)
                            @php $on = $d['tren']['granularitas'] === $g; @endphp
                            <a href="{{ request()->fullUrlWithQuery(['granularitas' => $g]) }}"
                               class="inline-flex min-h-9 items-center rounded-[4px] px-3 font-semibold {{ $on ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-paper' }}"
                               @if ($on) aria-current="true" @endif>{{ $label }}</a>
                        @endforeach
                    </div>
                </div>
                <div class="relative mt-4 h-64">
                    <canvas data-trend-chart data-chart="{{ json_encode($d['tren']) }}" role="img"
                            aria-label="Grafik omzet per {{ $d['tren']['granularitas'] }}, {{ $period->label() }}. Angka lengkap ada di tabel di bawah grafik."></canvas>
                </div>
                <details class="mt-3">
                    <summary class="text-sm font-semibold text-brand">Lihat angkanya dalam tabel</summary>
                    <div class="table-wrap mt-2 max-h-64 overflow-y-auto">
                        <table class="table">
                            <thead><tr><th>Periode</th><th class="text-right">Omzet</th><th class="text-right">Transaksi</th></tr></thead>
                            <tbody class="tabular">
                                @foreach ($d['tren']['label'] as $i => $label)
                                    <tr><td>{{ $label }}</td><td class="text-right">{{ Format::rupiah($d['tren']['omzet'][$i]) }}</td><td class="text-right">{{ Format::number($d['tren']['transaksi'][$i]) }}</td></tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                </details>
            </section>

            <section class="card" aria-labelledby="ai-title">
                <h2 id="ai-title" class="font-bold">Ringkasan dan saran</h2>
                @if ($isPro)
                    <div class="mt-3" data-ai-summary data-url="{{ route('ai.ringkasan', $period->query()) }}">
                        <div data-ai-body><p class="text-sm text-muted" role="status">Menyusun ringkasan dari angka di atas…</p></div>
                        <div class="mt-5 hidden border-t border-line pt-3" data-ai-feedback data-url="{{ route('ai.umpan-balik') }}">
                            <p class="text-sm text-ink-2">Ringkasan ini membantu?</p>
                            <div class="mt-2 flex gap-2">
                                <button type="button" data-value="membantu" aria-pressed="false" class="btn-secondary aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-surface">Membantu</button>
                                <button type="button" data-value="tidak_membantu" aria-pressed="false" class="btn-secondary aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-surface">Tidak membantu</button>
                            </div>
                            <p class="mt-2 hidden text-sm text-good" data-thanks role="status">Terima kasih, masukanmu tercatat.</p>
                        </div>
                    </div>
                    <p class="mt-4 text-xs text-muted">Ditulis AI dari angka hasil analisis. Data transaksi mentah tidak dikirim ke AI.</p>
                @else
                    <p class="mt-3 text-sm text-ink-2">Dengan paket Pro, bagian ini berisi ringkasan singkat periode ini dan tiga saran tindakan.</p>
                    <a href="{{ route('langganan') }}" class="btn-secondary mt-4 w-full">Lihat paket Pro</a>
                @endif
            </section>
        </div>

        @if ($produk)
            <section class="card mt-5" aria-labelledby="gerak-title">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="gerak-title" class="font-bold">Menu yang paling berubah</h2>
                    <a href="{{ route('produk', $period->query()) }}" class="text-sm">Semua menu</a>
                </div>
                <div class="mt-3 grid gap-x-10 md:grid-cols-2">
                    @foreach ([['Naik', $produk['naik_teratas']], ['Turun', $produk['turun_teratas']]] as [$title, $list])
                        <div>
                            <h3 class="border-b border-line pb-2 text-sm font-semibold text-muted">{{ $title }}</h3>
                            @if (empty($list))
                                <p class="py-3 text-sm text-muted">Tidak ada menu yang {{ strtolower($title) }} lebih dari 10%.</p>
                            @else
                                <ul class="divide-y divide-line">
                                    @foreach ($list as $p)
                                        <li class="flex items-center justify-between gap-3 py-2.5 text-sm">
                                            <span class="min-w-0 truncate font-medium">{{ $p['nama'] }}</span>
                                            <span class="flex shrink-0 items-center gap-3">
                                                <span class="text-muted tabular">{{ Format::number($p['unit_lalu']) }} → {{ Format::number($p['unit']) }}</span>
                                                <x-change :value="$p['perubahan']" suffix="" />
                                            </span>
                                        </li>
                                    @endforeach
                                </ul>
                            @endif
                        </div>
                    @endforeach
                </div>
            </section>
        @endif
    @endif
</x-layouts.app>
