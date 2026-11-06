{{-- Filter periode: satu baris di atas isi halaman. --}}
<form method="GET" class="flex flex-wrap items-end gap-2 md:justify-end" data-period-form>
    @foreach (request()->except(['periode', 'mulai', 'selesai', 'page']) as $k => $v)
        @if (is_string($v))<input type="hidden" name="{{ $k }}" value="{{ $v }}">@endif
    @endforeach
    <div>
        <label for="periode" class="mb-1 block text-sm font-semibold text-muted md:text-right">Periode</label>
        <select id="periode" name="periode" class="input w-auto pr-8">
            @foreach ($presets as $val => $label)
                <option value="{{ $val }}" @selected($period?->preset === (string) $val)>{{ $val === 'kustom' ? 'Pilih tanggal sendiri' : $label.' terakhir' }}</option>
            @endforeach
        </select>
    </div>
    <div class="hidden" data-custom>
        <div class="flex flex-wrap items-end gap-2">
            <div>
                <label for="mulai" class="mb-1 block text-sm font-semibold text-muted">Dari</label>
                <input id="mulai" type="date" name="mulai" class="input" value="{{ $period?->start->toDateString() }}"
                       @if ($minStart) min="{{ $minStart->toDateString() }}" @endif>
            </div>
            <div>
                <label for="selesai" class="mb-1 block text-sm font-semibold text-muted">Sampai</label>
                <input id="selesai" type="date" name="selesai" class="input" value="{{ $period?->end->toDateString() }}">
            </div>
            <button class="btn-primary">Terapkan</button>
        </div>
    </div>
    <noscript><button class="btn-secondary">Tampilkan</button></noscript>
</form>
@if ($period)
    <p class="mt-2 text-sm text-muted">
        {{ $period->label() }}, dibanding {{ $period->previousLabel() }}.
        @if ($minStart) Paket Gratis menampilkan 3 bulan terakhir. @endif
    </p>
@endif
