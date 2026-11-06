@php
    use App\Services\Format;
    $info = [
        'Star' => ['Star', 'Laris dan untung besar'],
        'Plowhorse' => ['Plowhorse', 'Laris, untung tipis'],
        'Puzzle' => ['Puzzle', 'Kurang laku, untung besar'],
        'Dog' => ['Dog', 'Kurang laku, untung tipis'],
    ];
@endphp
<x-layouts.app title="Klasifikasi menu">
    @include('partials.page-head', ['heading' => 'Klasifikasi menu', 'sub' => 'Menu Engineering: seberapa laris × seberapa untung per porsi.'])

    @if ($m)
        @if ($m['status'] !== 'ok')
            <div class="card flex items-start gap-3">
                <x-icon name="info" class="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div>
                    <p class="text-sm text-ink-2">{{ $m['pesan'] }}</p>
                    @if ($m['status'] === 'hpp_kosong')
                        <a href="{{ route('produk', $period->query()) }}#hpp" class="btn-primary mt-3">Isi HPP menu</a>
                    @endif
                </div>
            </div>
        @else
            @php
                $prods = $m['produk'];
                $W = 640; $H = 380; $pad = ['l' => 64, 'r' => 16, 't' => 16, 'b' => 44];
                $xMax = max(max(array_column($prods, 'popularitas')), $m['batas_popularitas']) * 1.12;
                $yVals = array_column($prods, 'margin_per_unit');
                $yMin = min(0, min($yVals));
                $yMax = max(max($yVals), $m['batas_margin']) * 1.12;
                $sx = fn ($v) => $pad['l'] + ($v / $xMax) * ($W - $pad['l'] - $pad['r']);
                $sy = fn ($v) => $H - $pad['b'] - (($v - $yMin) / (($yMax - $yMin) ?: 1)) * ($H - $pad['t'] - $pad['b']);
                $tx = $sx($m['batas_popularitas']);
                $ty = $sy($m['batas_margin']);
                $labelled = collect($prods)->sortByDesc('unit')->take(8)->pluck('nama')->all();
            @endphp

            <div class="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
                <section class="card" aria-labelledby="kuadran-title">
                    <h2 id="kuadran-title" class="font-bold">Peta menu</h2>
                    <p class="text-sm text-muted">
                        Garis tegak: batas laris {{ Format::number($m['batas_popularitas'] * 100, 1) }}% (70% × 1/{{ $m['jumlah_menu'] }} menu).
                        Garis datar: rata-rata untung per porsi {{ Format::rupiah($m['batas_margin']) }}.
                    </p>
                    <div class="mt-4 overflow-x-auto">
                        <svg viewBox="0 0 {{ $W }} {{ $H }}" class="h-auto w-full min-w-130" role="img" aria-label="Peta menu: posisi tiap menu menurut kelarisan dan untung per porsi. Daftar lengkapnya ada di tabel di bawah.">
                            <rect x="{{ $tx }}" y="{{ $pad['t'] }}" width="{{ $W - $pad['r'] - $tx }}" height="{{ $ty - $pad['t'] }}" style="fill: var(--heat-1)"/>
                            <text x="{{ $W - $pad['r'] - 8 }}" y="{{ $pad['t'] + 20 }}" text-anchor="end" font-size="14" font-weight="800" style="fill: var(--c-ink)">Star</text>
                            <text x="{{ $pad['l'] + 8 }}" y="{{ $pad['t'] + 20 }}" font-size="14" font-weight="700" style="fill: var(--c-ink-2)">Puzzle</text>
                            <text x="{{ $W - $pad['r'] - 8 }}" y="{{ $H - $pad['b'] - 8 }}" text-anchor="end" font-size="14" font-weight="700" style="fill: var(--c-ink-2)">Plowhorse</text>
                            <text x="{{ $pad['l'] + 8 }}" y="{{ $H - $pad['b'] - 8 }}" font-size="14" font-weight="700" style="fill: var(--c-ink-2)">Dog</text>
                            <line x1="{{ $pad['l'] }}" y1="{{ $H - $pad['b'] }}" x2="{{ $W - $pad['r'] }}" y2="{{ $H - $pad['b'] }}" style="stroke: var(--c-field)"/>
                            <line x1="{{ $pad['l'] }}" y1="{{ $pad['t'] }}" x2="{{ $pad['l'] }}" y2="{{ $H - $pad['b'] }}" style="stroke: var(--c-field)"/>
                            <line x1="{{ $tx }}" y1="{{ $pad['t'] }}" x2="{{ $tx }}" y2="{{ $H - $pad['b'] }}" stroke-dasharray="5 4" style="stroke: var(--c-muted)"/>
                            <line x1="{{ $pad['l'] }}" y1="{{ $ty }}" x2="{{ $W - $pad['r'] }}" y2="{{ $ty }}" stroke-dasharray="5 4" style="stroke: var(--c-muted)"/>
                            @foreach ([0, 0.25, 0.5, 0.75, 1] as $f)
                                @php $v = $xMax * $f; @endphp
                                <text x="{{ $sx($v) }}" y="{{ $H - $pad['b'] + 17 }}" text-anchor="middle" font-size="12" style="fill: var(--c-muted)">{{ Format::number($v * 100, 0) }}%</text>
                            @endforeach
                            @foreach ([0, 0.5, 1] as $f)
                                @php $v = $yMin + ($yMax - $yMin) * $f; @endphp
                                <text x="{{ $pad['l'] - 6 }}" y="{{ $sy($v) + 4 }}" text-anchor="end" font-size="12" style="fill: var(--c-muted)">{{ Format::number($v / 1000, 0) }} rb</text>
                            @endforeach
                            <text x="{{ ($pad['l'] + $W - $pad['r']) / 2 }}" y="{{ $H - 6 }}" text-anchor="middle" font-size="12" style="fill: var(--c-ink-2)">Kelarisan (porsi dari semua menu terjual)</text>
                            <text transform="translate(14 {{ ($pad['t'] + $H - $pad['b']) / 2 }}) rotate(-90)" text-anchor="middle" font-size="12" style="fill: var(--c-ink-2)">Untung per porsi</text>
                            @foreach ($prods as $p)
                                @php $cx = $sx($p['popularitas']); $cy = $sy($p['margin_per_unit']); @endphp
                                <g>
                                    <title>{{ $p['nama'] }} ({{ $p['kategori'] }}): {{ Format::number($p['popularitas'] * 100, 1) }}% terjual, untung {{ Format::rupiah($p['margin_per_unit']) }} per porsi</title>
                                    <circle cx="{{ $cx }}" cy="{{ $cy }}" r="6" stroke-width="2" style="fill: var(--c-brand); stroke: var(--c-surface)"/>
                                    @if (in_array($p['nama'], $labelled, true))
                                        <text x="{{ $cx + 9 }}" y="{{ $cy - 8 }}" font-size="12" font-weight="600" style="fill: var(--c-ink)">{{ \Illuminate\Support\Str::limit($p['nama'], 18) }}</text>
                                    @endif
                                </g>
                            @endforeach
                        </svg>
                    </div>
                </section>

                <section class="card" aria-labelledby="saran-title">
                    <h2 id="saran-title" class="font-bold">Yang perlu dilakukan</h2>
                    <div class="mt-2 divide-y divide-line">
                        @foreach ($info as $k => [$name, $desc])
                            @php $list = collect($prods)->where('kategori', $k); @endphp
                            <div class="py-3">
                                <h3 class="flex items-baseline justify-between gap-2">
                                    <span class="font-bold">{{ $name }} <span class="font-normal text-muted">· {{ $desc }}</span></span>
                                    <span class="text-sm text-muted tabular">{{ $m['jumlah_kategori'][$k] }} menu</span>
                                </h3>
                                <p class="mt-1 text-sm text-ink-2">{{ $m['saran'][$k] }}</p>
                                @if ($list->isNotEmpty())
                                    <p class="mt-1.5 text-sm font-semibold">{{ $list->pluck('nama')->implode(', ') }}</p>
                                @endif
                            </div>
                        @endforeach
                    </div>
                </section>
            </div>

            <section class="card mt-5">
                <h2 class="font-bold">Detail per menu</h2>
                <div class="table-wrap mt-3">
                    <table class="table">
                        <thead><tr><th>Menu</th><th class="text-right">Terjual</th><th class="text-right">Kelarisan</th><th class="text-right">Harga rata-rata</th><th class="text-right">HPP</th><th class="text-right">Untung/porsi</th><th>Kelompok</th></tr></thead>
                        <tbody class="tabular">
                            @foreach ($prods as $p)
                                <tr>
                                    <td class="font-semibold">{{ $p['nama'] }}</td>
                                    <td class="text-right">{{ Format::number($p['unit']) }}</td>
                                    <td class="text-right">{{ Format::number($p['popularitas'] * 100, 1) }}%</td>
                                    <td class="text-right">{{ Format::rupiah($p['harga_rata_rata']) }}</td>
                                    <td class="text-right">{{ Format::rupiah($p['hpp']) }}</td>
                                    <td class="text-right">{{ Format::rupiah($p['margin_per_unit']) }}</td>
                                    <td>{{ $info[$p['kategori']][0] }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </section>
        @endif

        @if (! empty($m['belum_lengkap']))
            <section class="card mt-5">
                <h2 class="font-bold">Belum lengkap ({{ count($m['belum_lengkap']) }} menu)</h2>
                <p class="text-sm text-ink-2">Menu berikut belum punya HPP, jadi belum diklasifikasikan.</p>
                <p class="mt-2 text-sm">
                    @foreach ($m['belum_lengkap'] as $p)
                        <span class="tag mr-1 mb-1 bg-warn-soft text-warn-ink">{{ $p['nama'] }}: belum lengkap</span>
                    @endforeach
                </p>
                <a href="{{ route('produk', $period->query()) }}#hpp" class="btn-secondary mt-3">Lengkapi HPP</a>
            </section>
        @endif
    @endif
</x-layouts.app>
