@php
    use App\Services\Format;
    $items = collect($p['produk'] ?? []);
    if ($filter === 'tanpa') {
        $items = $items->whereNull('label');
    } elseif ($filter) {
        $items = $items->where('label', $filter);
    }
@endphp
<x-layouts.app title="Produk">
    @include('partials.page-head', ['heading' => 'Menu naik dan turun', 'sub' => 'Unit terjual periode ini dibanding periode sebelumnya.'])

    @if ($p)
        @php $counts = $p['jumlah_label']; @endphp
        <nav class="flex flex-wrap gap-2" aria-label="Saring menurut tanda">
            @foreach (['' => 'Semua', 'Naik' => 'Naik', 'Stabil' => 'Stabil', 'Turun' => 'Turun', 'Produk Baru' => 'Baru', 'tanpa' => 'Data sedikit'] as $key => $label)
                @php
                    $n = $key === '' ? count($p['produk']) : ($key === 'tanpa' ? $counts['Tanpa label'] : $counts[$key]);
                    $active = (string) ($filter ?? '') === (string) $key;
                @endphp
                <a href="{{ request()->fullUrlWithQuery(['label' => $key === '' ? null : $key]) }}"
                   class="inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-sm font-semibold {{ $active ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-field' }}"
                   @if ($active) aria-current="true" @endif>
                    {{ $label }} <span class="tabular {{ $active ? '' : 'text-muted' }}">{{ $n }}</span>
                </a>
            @endforeach
        </nav>

        <section class="card mt-4" aria-label="Daftar menu">
            <div class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Menu</th>
                            <th class="text-right">Periode ini</th>
                            <th class="text-right">Periode lalu</th>
                            <th class="text-right">Perubahan</th>
                            <th>Tanda</th>
                            <th class="text-right">Omzet</th>
                        </tr>
                    </thead>
                    <tbody class="tabular">
                        @forelse ($items as $row)
                            <tr>
                                <td class="font-semibold">{{ $row['nama'] }}</td>
                                <td class="text-right">{{ Format::number($row['unit']) }}</td>
                                <td class="text-right text-ink-2">{{ Format::number($row['unit_lalu']) }}</td>
                                <td class="text-right">{{ Format::percent($row['perubahan']) }}</td>
                                <td><x-product-label :label="$row['label']" /></td>
                                <td class="text-right text-ink-2">{{ Format::rupiah($row['omzet']) }}</td>
                            </tr>
                        @empty
                            <tr><td colspan="6" class="py-8 text-center text-muted">Tidak ada menu dengan tanda ini.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            <p class="help mt-3">
                Perubahan = (periode ini − periode lalu) ÷ periode lalu × 100%. Naik lebih dari +10%, Turun kurang dari −10%,
                selain itu Stabil. Menu yang terjual kurang dari 5 di kedua periode tidak diberi tanda.
            </p>
        </section>
    @endif

    <section class="card mt-5" id="hpp" aria-labelledby="hpp-title">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <h2 id="hpp-title" class="font-bold">Harga pokok (HPP) per porsi</h2>
                <p class="text-sm text-ink-2">Dipakai untuk klasifikasi menu. Boleh diisi sebagian dulu.</p>
            </div>
            <a href="{{ route('produk.hpp.template') }}" class="btn-secondary shrink-0"><x-icon name="download" class="h-4 w-4" /> Unduh daftar menu (CSV)</a>
        </div>

        <form method="POST" action="{{ route('produk.hpp.unggah') }}" enctype="multipart/form-data" class="mt-4 rounded-control border border-dashed border-field p-3" data-busy-label="Mengunggah…">
            @csrf
            <label for="file_hpp" class="label">Atau unggah file HPP</label>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input id="file_hpp" type="file" name="file_hpp" accept=".csv,.xlsx" data-accept-ext="csv,xlsx" class="text-sm file:mr-3 file:min-h-11 file:rounded-control file:border file:border-field file:bg-surface file:px-3 file:font-semibold file:text-ink">
                <button type="submit" class="btn-secondary sm:ml-auto">Unggah HPP</button>
            </div>
            <p class="help">Kolom <code>nama_produk</code> dan <code>hpp</code>. Unduh daftar menu di atas, isi kolom hpp, lalu unggah.</p>
            <p class="error hidden" data-file-error role="alert"></p>
            @error('file_hpp')<p class="error" role="alert">{{ $message }}</p>@enderror
        </form>

        @if ($products->isEmpty())
            <p class="mt-4 text-sm text-muted">Belum ada menu. Menu muncul otomatis setelah data penjualan diunggah.</p>
        @else
            <form method="POST" action="{{ route('produk.hpp') }}" class="mt-4">
                @csrf
                <div class="table-wrap max-h-112 overflow-y-auto">
                    <table class="table">
                        <thead class="sticky top-0 bg-surface"><tr><th>Menu</th><th>Kategori</th><th class="w-44">HPP (Rp)</th></tr></thead>
                        <tbody>
                            @foreach ($products as $prod)
                                <tr>
                                    <td class="font-semibold"><label for="hpp-{{ $prod->id }}">{{ $prod->nama }}</label></td>
                                    <td class="text-ink-2">{{ $prod->kategori ?? '–' }}</td>
                                    <td>
                                        <input id="hpp-{{ $prod->id }}" type="number" min="0" step="1" inputmode="numeric" class="input tabular"
                                               name="hpp[{{ $prod->id }}]" value="{{ old('hpp.'.$prod->id, $prod->hpp !== null ? (int) round($prod->hpp) : '') }}" placeholder="belum diisi">
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                <button class="btn-primary mt-4">Simpan HPP</button>
            </form>
        @endif
    </section>
</x-layouts.app>
