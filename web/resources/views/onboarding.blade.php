<x-layouts.app title="Mulai">
    <div class="max-w-2xl">
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Halo, {{ auth()->user()->nama }}.</h1>
        <p class="mt-1 text-ink-2">Tiga langkah sampai ringkasan penjualanmu terisi.</p>

        <ol class="mt-6 grid grid-cols-3 gap-2" aria-label="Langkah">
            @foreach (['Profil usaha', 'Siapkan file', 'Unggah'] as $i => $label)
                @php $state = $step > $i + 1 ? 'selesai' : ($step === $i + 1 ? 'sekarang' : 'nanti'); @endphp
                <li @if ($state === 'sekarang') aria-current="step" @endif>
                    <div class="h-1.5 rounded-full {{ $state === 'nanti' ? 'bg-line' : 'bg-ink' }}"></div>
                    <div class="mt-1.5 text-sm {{ $state === 'sekarang' ? 'font-bold text-ink' : 'text-muted' }}">
                        {{ $i + 1 }}. {{ $label }}<span class="sr-only"> ({{ $state }})</span>
                    </div>
                </li>
            @endforeach
        </ol>

        <div class="card mt-6 sm:p-7">
            <x-flash />
            @if ($step === 1)
                <h2 class="text-lg font-bold">Profil usaha</h2>
                <form method="POST" action="{{ route('onboarding.simpan') }}" class="mt-4 space-y-4">
                    @csrf
                    @include('partials.business-fields')
                    <button class="btn-primary w-full sm:w-auto">Simpan dan lanjut</button>
                </form>
            @elseif ($step === 2)
                <h2 class="text-lg font-bold">Siapkan file penjualan</h2>
                <p class="mt-2 text-ink-2">Pakai ekspor dari aplikasi kasir atau catatan Excel. Kolom yang dibaca:</p>
                @include('partials.template-columns')
                <div class="mt-5 flex flex-col gap-2 sm:flex-row">
                    <a href="{{ route('data.template') }}" class="btn-secondary"><x-icon name="download" class="h-4 w-4" /> Unduh template CSV</a>
                    <a href="{{ route('onboarding', ['langkah' => 3]) }}" class="btn-primary">File sudah siap</a>
                </div>
            @else
                <h2 class="text-lg font-bold">Unggah file pertama</h2>
                <p class="mt-2 text-ink-2">Setelah diunggah, data diproses otomatis dan kamu melihat hasil impornya.</p>
                <div class="mt-4">@include('partials.upload-form')</div>
                <form method="POST" action="{{ route('onboarding.selesai') }}" class="mt-4">
                    @csrf
                    <button class="btn-ghost px-0 underline underline-offset-2">Lewati, unggah nanti</button>
                </form>
            @endif
        </div>
    </div>
</x-layouts.app>
