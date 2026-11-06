@props(['class' => ''])
{{-- Tombol tema terang/gelap; label teks menyebut tema tujuan agar tidak bergantung ikon. --}}
<button type="button" data-theme-toggle class="btn-ghost {{ $class }}" aria-pressed="false">
    <span data-theme-label>Tema gelap</span>
</button>
