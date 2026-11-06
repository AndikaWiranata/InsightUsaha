@props(['label'])
@php
    $map = [
        'Naik' => ['bg-good-soft text-good-ink', '▲ Naik'],
        'Turun' => ['bg-bad-soft text-bad-ink', '▼ Turun'],
        'Stabil' => ['border border-line text-ink-2', '= Stabil'],
        'Produk Baru' => ['border border-brand text-brand', '+ Baru'],
    ];
@endphp
@if ($label && isset($map[$label]))
    <span class="tag {{ $map[$label][0] }}">{{ $map[$label][1] }}</span>
@else
    <span class="text-sm text-muted">Data sedikit</span>
@endif
