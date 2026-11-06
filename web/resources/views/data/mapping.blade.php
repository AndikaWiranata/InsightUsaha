<x-layouts.app title="Cocokkan kolom">
    <a href="{{ route('data') }}" class="text-sm">← Data penjualan</a>
    <h1 class="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Cocokkan kolom file</h1>
    <p class="mt-1 max-w-2xl text-ink-2">
        Beberapa kolom di <strong class="text-ink">{{ $upload->nama_file }}</strong> tidak dikenali otomatis.
        Pilih kolom file yang berisi tiap data di bawah ini.
    </p>

    <div class="mt-6"><x-flash /></div>

    <div class="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        <form method="POST" action="{{ route('data.mapping.simpan', $upload->id) }}" class="card space-y-4" data-busy-label="Memproses…">
            @csrf
            @foreach ($labels as $field => $label)
                @php $req = in_array($field, $required, true); @endphp
                <div>
                    <label class="label" for="m-{{ $field }}">
                        {{ $label }} <span class="font-normal text-muted">({{ $req ? 'wajib' : 'opsional' }})</span>
                    </label>
                    <select id="m-{{ $field }}" name="pemetaan[{{ $field }}]" class="input" @if ($req) required @endif>
                        <option value="">{{ $req ? 'Pilih kolom' : 'Tidak ada' }}</option>
                        @foreach ($info['kolom'] as $col)
                            <option value="{{ $col }}" @selected(old('pemetaan.'.$field, $mapping[$field] ?? null) === $col)>{{ $col }}</option>
                        @endforeach
                    </select>
                </div>
            @endforeach
            <p class="help">Tanpa kolom jam, jam ramai hanya per hari. Tanpa nomor transaksi, pasangan menu tidak bisa dihitung.</p>
            <button class="btn-primary w-full">Proses data</button>
        </form>

        <section class="card">
            <h2 class="font-bold">Lima baris pertama file</h2>
            <p class="text-sm text-muted">{{ \App\Services\Format::number($info['jumlah_baris']) }} baris di file</p>
            <div class="table-wrap mt-3">
                <table class="table">
                    <thead><tr>@foreach ($info['kolom'] as $col)<th>{{ $col }}</th>@endforeach</tr></thead>
                    <tbody>
                        @foreach ($info['pratinjau'] as $row)
                            <tr>@foreach ($row as $cell)<td class="whitespace-nowrap">{{ $cell }}</td>@endforeach</tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </section>
    </div>
</x-layouts.app>
