@php use App\Services\Format; @endphp
<x-layouts.app title="Paket bundling">
    @include('partials.page-head', ['heading' => 'Pasangan menu untuk paket', 'sub' => 'Menu yang sering dibeli dalam satu transaksi (algoritma Apriori).'])

    @if ($b)
        @if ($b['status'] !== 'ok')
            <div class="card flex items-start gap-3">
                <x-icon name="info" class="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div>
                    <h2 class="font-bold">{{ $b['status'] === 'tanpa_id' ? 'Perlu nomor transaksi' : 'Belum ada pasangan menu' }}</h2>
                    <p class="mt-1 text-sm text-ink-2">{{ $b['pesan'] }}</p>
                    @if ($b['status'] === 'tanpa_id')
                        <a href="{{ route('data') }}" class="btn-secondary mt-3">Unggah data dengan nomor transaksi</a>
                    @endif
                </div>
            </div>
        @else
            @php $best = $b['aturan'][0]; @endphp
            {{-- Titik fokus: pasangan terkuat sebagai kalimat. --}}
            <section class="card sm:p-7">
                <h2 class="text-sm font-semibold text-muted">Pasangan paling kuat</h2>
                <p class="mt-2 text-2xl leading-snug font-extrabold tracking-tight sm:text-3xl"><span class="stabilo">{{ $best['kalimat'] }}</span></p>
                <p class="mt-3 text-ink-2">Coba jual <strong class="text-ink">{{ $best['jika'] }} + {{ $best['maka'] }}</strong> sebagai satu paket, atau tawarkan {{ $best['maka'] }} setiap ada yang memesan {{ $best['jika'] }}.</p>
                <p class="mt-3 text-sm text-muted">
                    Dari {{ Format::number($b['jumlah_transaksi']) }} transaksi, {{ Format::number($b['transaksi_multi_produk']) }} berisi lebih dari satu menu.
                </p>
            </section>

            @if (count($b['aturan']) > 1)
                <section class="card mt-5">
                    <h2 class="font-bold">Pasangan lainnya</h2>
                    <ul class="mt-2 divide-y divide-line">
                        @foreach (array_slice($b['aturan'], 1, 5) as $r)
                            <li class="py-3">
                                <p class="font-semibold">{{ $r['kalimat'] }}</p>
                                <p class="text-sm text-ink-2">Ide paket: {{ $r['jika'] }} + {{ $r['maka'] }}. Dibeli bersama di {{ Format::number($r['jumlah_transaksi_bersama']) }} transaksi.</p>
                            </li>
                        @endforeach
                    </ul>
                </section>
            @endif

            <section class="card mt-5">
                <h2 class="font-bold">Angka lengkap</h2>
                <div class="table-wrap mt-3">
                    <table class="table">
                        <thead><tr><th>Jika membeli</th><th>Juga membeli</th><th class="text-right">Support</th><th class="text-right">Confidence</th><th class="text-right">Lift</th><th class="text-right">Transaksi</th></tr></thead>
                        <tbody class="tabular">
                            @foreach ($b['aturan'] as $r)
                                <tr>
                                    <td class="font-semibold">{{ $r['jika'] }}</td>
                                    <td>{{ $r['maka'] }}</td>
                                    <td class="text-right">{{ Format::number($r['support'] * 100, 1) }}%</td>
                                    <td class="text-right">{{ Format::number($r['confidence'] * 100, 1) }}%</td>
                                    <td class="text-right">{{ Format::number($r['lift'], 2) }}</td>
                                    <td class="text-right">{{ Format::number($r['jumlah_transaksi_bersama']) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                <dl class="mt-3 space-y-1 text-sm text-muted">
                    <div><dt class="inline font-semibold text-ink-2">Support:</dt> <dd class="inline">porsi transaksi yang berisi kedua menu.</dd></div>
                    <div><dt class="inline font-semibold text-ink-2">Confidence:</dt> <dd class="inline">dari pembeli menu pertama, berapa persen juga membeli menu kedua.</dd></div>
                    <div><dt class="inline font-semibold text-ink-2">Lift di atas 1:</dt> <dd class="inline">kedua menu lebih sering dibeli bersama daripada kebetulan.</dd></div>
                </dl>
            </section>
        @endif

        <details class="card mt-5" @if ($errors->has('min_support') || $errors->has('min_confidence')) open @endif>
            <summary class="font-bold">Pengaturan lanjutan</summary>
            <form method="POST" action="{{ route('bundling.pengaturan') }}" class="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end">
                @csrf
                <div>
                    <label class="label" for="min_support">Minimum support (%)</label>
                    <input class="input" id="min_support" type="number" step="0.1" min="0.1" max="50" name="min_support" value="{{ old('min_support', $settings['min_support'] * 100) }}">
                    @error('min_support')<p class="error">{{ $message }}</p>@enderror
                </div>
                <div>
                    <label class="label" for="min_confidence">Minimum confidence (%)</label>
                    <input class="input" id="min_confidence" type="number" step="1" min="1" max="100" name="min_confidence" value="{{ old('min_confidence', $settings['min_confidence'] * 100) }}">
                    @error('min_confidence')<p class="error">{{ $message }}</p>@enderror
                </div>
                <button class="btn-secondary">Simpan dan hitung ulang</button>
            </form>
            <p class="help mt-2">Bawaan: support 1%, confidence 30%. Hanya pasangan dengan lift di atas 1 yang ditampilkan.</p>
        </details>
    @endif
</x-layouts.app>
