@php
    use App\Services\Format;
    $s = $upload->ringkasan ?? [];
    $done = in_array($upload->status, ['selesai', 'gagal'], true);
@endphp
<x-layouts.app title="Hasil impor">
    <a href="{{ route('data') }}" class="text-sm">← Data penjualan</a>
    <h1 class="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Hasil impor</h1>
    <p class="text-ink-2">{{ $upload->nama_file }}</p>

    <div class="mt-6"><x-flash /></div>

    @if (! $done)
        <div class="card max-w-xl" data-upload-progress data-url="{{ route('data.status', $upload->id) }}">
            <div class="flex items-center justify-between">
                <span class="font-bold" id="progres-label">Sedang memproses data…</span>
                <span class="text-muted tabular" data-text>{{ $upload->progres }}%</span>
            </div>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-labelledby="progres-label"
                 aria-valuemin="0" aria-valuemax="100" aria-valuenow="{{ $upload->progres }}">
                <div class="h-full rounded-full bg-ink transition-[width]" data-bar style="width: {{ $upload->progres }}%"></div>
            </div>
            <p class="mt-3 text-sm text-muted">Boleh tinggalkan halaman ini, prosesnya tetap berjalan.</p>
        </div>
    @elseif ($upload->status === 'gagal')
        <div class="card max-w-xl border-bad/40">
            <div class="flex items-start gap-3">
                <x-icon name="alert" class="h-6 w-6 shrink-0 text-bad" />
                <div>
                    <h2 class="font-bold">Impor gagal</h2>
                    <p class="mt-1 text-ink-2">{{ $upload->pesan_error }}</p>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <a href="{{ route('data') }}" class="btn-primary">Unggah ulang</a>
                        <a href="{{ route('data.template') }}" class="btn-secondary">Unduh template CSV</a>
                    </div>
                </div>
            </div>
        </div>
    @else
        <section class="card sm:p-7">
            <p class="text-xl font-bold sm:text-2xl">
                <span class="stabilo">{{ Format::number($upload->jumlah_baris_valid) }} baris</span> masuk,
                data {{ Format::date($upload->tanggal_mulai) }} sampai {{ Format::date($upload->tanggal_selesai) }}.
            </p>
            <dl class="mt-5 grid gap-x-8 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-3">
                <div class="flex justify-between gap-2 sm:block"><dt class="text-muted">Ditolak</dt><dd class="font-bold tabular {{ $upload->jumlah_baris_ditolak ? 'text-bad' : '' }}">{{ Format::number($upload->jumlah_baris_ditolak) }} baris</dd></div>
                <div class="flex justify-between gap-2 sm:block"><dt class="text-muted">Duplikat dihapus</dt><dd class="font-bold tabular">{{ Format::number(($s['duplikat_dihapus'] ?? 0) + ($s['duplikat_dilewati_gabung'] ?? 0)) }} baris</dd></div>
                <div class="flex justify-between gap-2 sm:block"><dt class="text-muted">Cara simpan</dt><dd class="font-bold">{{ ['baru' => 'Data baru', 'ganti' => 'Mengganti data lama', 'gabung' => 'Digabung'][$upload->mode] }}</dd></div>
            </dl>
            <ul class="mt-4 space-y-1.5 text-sm text-ink-2">
                <li class="flex gap-2"><x-icon :name="($s['punya_jam'] ?? false) ? 'check' : 'info'" class="mt-0.5 h-4 w-4 shrink-0 {{ ($s['punya_jam'] ?? false) ? 'text-good' : 'text-muted' }}" />
                    {{ ($s['punya_jam'] ?? false) ? 'Ada kolom jam: tabel hari × jam tersedia.' : 'Tidak ada kolom jam: jam ramai hanya ditampilkan per hari.' }}</li>
                <li class="flex gap-2"><x-icon :name="($s['punya_id_transaksi'] ?? false) ? 'check' : 'info'" class="mt-0.5 h-4 w-4 shrink-0 {{ ($s['punya_id_transaksi'] ?? false) ? 'text-good' : 'text-muted' }}" />
                    {{ ($s['punya_id_transaksi'] ?? false) ? 'Ada nomor transaksi: pasangan menu bisa dihitung.' : 'Tidak ada nomor transaksi: pasangan menu tidak bisa dihitung.' }}</li>
            </ul>
            <div class="mt-6 flex flex-wrap gap-2">
                <a href="{{ route('dashboard') }}" class="btn-primary">Lihat ringkasan penjualan</a>
                <a href="{{ route('data') }}" class="btn-secondary">Unggah file lain</a>
            </div>
        </section>

        @if ($upload->jumlah_baris_ditolak > 0)
            <section class="card mt-5">
                <h2 class="font-bold">Baris yang dilewati</h2>
                <p class="text-sm text-ink-2">Baris ini tidak diimpor. Baris lain tetap diproses. Perbaiki di file aslinya lalu unggah lagi bila perlu.</p>
                <ul class="mt-3 flex flex-wrap gap-2">
                    @foreach ($s['alasan_ditolak'] ?? [] as $reason => $n)
                        <li class="tag bg-bad-soft text-bad-ink">{{ $reason }}: {{ Format::number($n) }}</li>
                    @endforeach
                </ul>
                <div class="table-wrap mt-3 max-h-80 overflow-y-auto">
                    <table class="table">
                        <thead class="sticky top-0 bg-surface"><tr><th>Baris ke-</th><th>Alasan</th></tr></thead>
                        <tbody>
                            @foreach ($upload->baris_ditolak ?? [] as $r)
                                <tr><td class="tabular">{{ $r['baris'] }}</td><td>{{ $r['alasan'] }}</td></tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                @if (count($upload->baris_ditolak ?? []) < $upload->jumlah_baris_ditolak)
                    <p class="help">Menampilkan {{ count($upload->baris_ditolak ?? []) }} baris pertama.</p>
                @endif
            </section>
        @endif
    @endif
</x-layouts.app>
