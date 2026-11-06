@props(['name', 'class' => 'h-5 w-5'])
@php
// Ikon garis sudut tegas (stroke 2, miter) hanya untuk aksi/status yang maknanya terbantu ikon. Lihat DESIGN.md.
$paths = [
    'upload' => 'M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v5h16v-5',
    'download' => 'M12 4v11M7.5 10.5 12 15l4.5-4.5M4 20h16',
    'trash' => 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    'alert' => 'M12 3 2 20h20zM12 10v4M12 17v.5',
    'info' => 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5V8',
    'check' => 'M4.5 12.5 9.5 17.5 19.5 6.5',
    'up' => 'M6 15l6-6 6 6',
    'down' => 'M6 9l6 6 6-6',
    'flat' => 'M5 12h14',
    'menu' => 'M4 7h16M4 12h16M4 17h16',
    'close' => 'M6 6l12 12M18 6 6 18',
    'send' => 'M4 12h14M13 6l6 6-6 6',
    'lock' => 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    'chat' => 'M4 5h16v11H9l-5 4z',
];
@endphp
<svg {{ $attributes->merge(['class' => $class]) }} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false"><path d="{{ $paths[$name] ?? '' }}"/></svg>
