@php
    use App\Services\Format;
    // Skala heatmap memakai token --heat-1..7 (tema terang & gelap), teks tiap langkah lulus 4.5:1.
    $cell = function (int $v, int $max) {
        if ($v === 0 || $max === 0) {
            return 'background: transparent; color: var(--c-muted)';
        }
        $i = 1 + (int) min(6, floor(($v / $max) * 6.999));

        return "background: var(--heat-{$i}); color: var(--heat-ink-{$i})";
    };
@endphp
<x-layouts.app title="Jam ramai">
    @include('partials.page-head', ['heading' => 'Jam ramai dan sepi', 'sub' => 'Dihitung dari jumlah transaksi, bukan omzet.'])

    @if ($w)
        @if ($w['kosong'])
            <div class="card text-sm text-ink-2">Tidak ada transaksi pada periode ini. Pilih periode lain di atas.</div>
        @else
            @php $top = $w['tersibuk'][0] ?? null; @endphp
            @if ($top)
                {{-- Titik fokus: satu kalimat jawaban "kapan paling ramai". --}}
                <p class="text-xl leading-snug font-bold sm:text-2xl">
                    Paling ramai: <span class="stabilo">{{ $top['hari'] }}{{ $top['jam'] ? ', '.$top['jam'] : '' }}</span>
                    <span class="font-medium text-ink-2">({{ Format::number($top['transaksi']) }} transaksi)</span>
                </p>
            @endif

            <div class="mt-5 grid gap-5 md:grid-cols-2">
                <section class="card">
                    <h2 class="font-bold">Waktu tersibuk</h2>
                    <p class="text-sm text-muted">Pastikan stok dan karyawan cukup.</p>
                    <ol class="mt-3 divide-y divide-line border-t border-line">
                        @foreach ($w['tersibuk'] as $i => $s)
                            <li class="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                                <span><span class="mr-2 font-extrabold text-brand tabular">{{ $i + 1 }}.</span><span class="font-semibold">{{ $s['hari'] }}</span>@if ($s['jam']), {{ $s['jam'] }}@endif</span>
                                <span class="text-ink-2 tabular">{{ Format::number($s['transaksi']) }} transaksi</span>
                            </li>
                        @endforeach
                    </ol>
                </section>
                <section class="card">
                    <h2 class="font-bold">Waktu tersepi</h2>
                    <p class="text-sm text-muted">Cocok untuk promo jam tertentu atau diskon paket.</p>
                    <ol class="mt-3 divide-y divide-line border-t border-line">
                        @foreach ($w['tersepi'] as $i => $s)
                            <li class="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                                <span><span class="mr-2 font-extrabold text-muted tabular">{{ $i + 1 }}.</span><span class="font-semibold">{{ $s['hari'] }}</span>@if ($s['jam']), {{ $s['jam'] }}@endif</span>
                                <span class="text-ink-2 tabular">{{ Format::number($s['transaksi']) }} transaksi</span>
                            </li>
                        @endforeach
                    </ol>
                </section>
            </div>

            @if ($w['punya_jam'] && $w['heatmap'])
                @php
                    $h = $w['heatmap'];
                    $max = max(array_map('max', $h['nilai']) ?: [0]);
                @endphp
                <section class="card mt-5">
                    <h2 class="font-bold">Transaksi per hari dan jam</h2>
                    <p class="text-sm text-muted">Angka di kotak = jumlah transaksi selama periode. Makin gelap makin ramai.</p>
                    <div class="relative mt-4 overflow-x-auto pb-1">
                        <table class="border-separate tabular" style="border-spacing: 3px">
                            <caption class="sr-only">Jumlah transaksi per hari dan jam, {{ $period->label() }}</caption>
                            <thead>
                                <tr>
                                    <td class="w-16"></td>
                                    @foreach ($h['jam'] as $jam)
                                        <th scope="col" class="px-0.5 text-center text-xs font-semibold text-muted">{{ $jam }}</th>
                                    @endforeach
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($h['hari'] as $di => $hari)
                                    <tr>
                                        <th scope="row" class="pr-2 text-left text-sm font-semibold text-ink-2">{{ $hari }}</th>
                                        @foreach ($h['nilai'][$di] as $ji => $v)
                                            <td class="h-9 min-w-9 rounded-[4px] text-center text-xs font-semibold" style="{{ $cell($v, $max) }}">
                                                {{ $v ?: '' }}<span class="sr-only">{{ $v ? '' : '0' }} transaksi, {{ $hari }} jam {{ $h['jam'][$ji] }}</span>
                                            </td>
                                        @endforeach
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-3 flex items-center gap-2 text-sm text-muted" aria-hidden="true">
                        Sepi
                        <span class="flex overflow-hidden rounded-[3px]">@for ($i = 1; $i <= 7; $i++)<span class="h-3 w-5" style="background: var(--heat-{{ $i }})"></span>@endfor</span>
                        Ramai
                    </div>
                </section>
            @else
                <div class="mt-5 flex items-start gap-2 rounded-control border border-line bg-surface px-4 py-3 text-sm text-ink-2">
                    <x-icon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Data kamu tidak punya kolom jam, jadi pola ditampilkan per hari saja. Sertakan kolom <code>jam</code> (format 08:15) saat mengunggah untuk melihat tabel hari × jam.</span>
                </div>
            @endif

            <section class="card mt-5">
                <h2 class="font-bold">Rata-rata transaksi per hari</h2>
                <p class="text-sm text-muted">Jumlah transaksi dibagi berapa kali hari itu muncul dalam periode.</p>
                @php
                    $dayChart = ['label' => array_column($w['per_hari'], 'hari'), 'nilai' => array_column($w['per_hari'], 'rata_rata_transaksi')];
                @endphp
                <div class="relative mt-4 h-56">
                    <canvas data-day-chart role="img" aria-label="Grafik rata-rata transaksi per hari. Angkanya ada di tabel di bawah."
                            data-chart="{{ json_encode($dayChart) }}"></canvas>
                </div>
                <div class="table-wrap mt-4">
                    <table class="table">
                        <thead><tr><th>Hari</th><th class="text-right">Total transaksi</th><th class="text-right">Rata-rata per hari</th><th class="text-right">Omzet</th></tr></thead>
                        <tbody class="tabular">
                            @foreach ($w['per_hari'] as $row)
                                <tr>
                                    <td class="font-medium">{{ $row['hari'] }}</td>
                                    <td class="text-right">{{ Format::number($row['transaksi']) }}</td>
                                    <td class="text-right">{{ Format::number($row['rata_rata_transaksi'], 1) }}</td>
                                    <td class="text-right">{{ Format::rupiah($row['omzet']) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </section>
        @endif
    @endif
</x-layouts.app>
