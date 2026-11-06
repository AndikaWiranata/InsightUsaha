@props(['value', 'invert' => false, 'suffix' => 'dibanding periode lalu'])
{{-- Perubahan (%): tanda panah + angka + teks, tidak bergantung warna saja. --}}
@if ($value === null)
    <span class="text-sm text-muted">Belum ada pembanding</span>
@else
    @php
        $good = $invert ? $value < 0 : $value > 0;
        $icon = $value > 0 ? 'up' : ($value < 0 ? 'down' : 'flat');
        $cls = $value == 0 ? 'text-muted' : ($good ? 'text-good' : 'text-bad');
    @endphp
    <span class="inline-flex flex-wrap items-center gap-x-1 text-sm">
        <span class="inline-flex items-center font-bold tabular {{ $cls }}"><x-icon :name="$icon" class="h-4 w-4" />{{ \App\Services\Format::percent($value) }}</span>
        @if ($suffix)<span class="text-muted">{{ $suffix }}</span>@endif
    </span>
@endif
