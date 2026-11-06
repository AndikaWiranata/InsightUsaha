<x-layouts.app title="Data penjualan">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Data penjualan</h1>
            <p class="mt-1 text-ink-2">Unggah file baru, lihat riwayat unggahan, atau hapus data.</p>
        </div>
        <a href="{{ route('data.template') }}" class="btn-secondary"><x-icon name="download" class="h-4 w-4" /> Unduh template CSV</a>
    </div>

    <div class="mt-6"><x-flash :hide-errors="true" /></div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.8fr]">
        <section class="card" aria-labelledby="unggah-title">
            <h2 id="unggah-title" class="font-bold">Unggah file baru</h2>
            @if ($quota['limit'] !== null)
                <p class="mt-1 text-sm text-muted">Paket Gratis: {{ $quota['used'] }} dari {{ $quota['limit'] }} unggahan bulan ini terpakai.</p>
            @endif
            <div class="mt-4">
                @if ($quota['remaining'] === 0)
                    <div class="rounded-control border border-line bg-paper p-4 text-sm text-ink-2">
                        Jatah unggahan bulan ini sudah habis. <a href="{{ route('langganan') }}">Upgrade ke Pro</a> untuk unggahan tanpa batas.
                    </div>
                @else
                    @include('partials.upload-form')
                @endif
            </div>
            <details class="mt-4">
                <summary class="text-sm font-semibold text-brand">Kolom apa saja yang dibaca?</summary>
                @include('partials.template-columns')
            </details>
        </section>

        <section class="card" aria-labelledby="riwayat-title">
            <h2 id="riwayat-title" class="font-bold">Riwayat unggahan</h2>
            @if ($uploads->isEmpty())
                <p class="mt-4 text-sm text-ink-2">Belum ada unggahan. File yang kamu unggah akan tercatat di sini.</p>
            @else
                <div class="table-wrap mt-3">
                    <table class="table">
                        <thead><tr><th>File</th><th>Rentang data</th><th class="text-right">Masuk</th><th class="text-right">Ditolak</th><th>Status</th><th><span class="sr-only">Aksi</span></th></tr></thead>
                        <tbody>
                            @foreach ($uploads as $u)
                                @php
                                    $color = ['selesai' => 'bg-good-soft text-good-ink', 'gagal' => 'bg-bad-soft text-bad-ink',
                                        'konflik' => 'bg-warn-soft text-warn-ink'][$u->status] ?? 'border border-line text-ink-2';
                                    $mapped = collect(['tanggal', 'nama_produk', 'jumlah', 'harga_satuan'])
                                        ->every(fn ($f) => ! empty($u->pemetaan[$f] ?? null));
                                    $link = match (true) {
                                        $u->status === 'konflik' => route('data.conflict', $u->id),
                                        $u->status === 'menunggu' && ! $mapped => route('data.mapping', $u->id),
                                        default => route('data.show', $u->id),
                                    };
                                @endphp
                                <tr>
                                    <td class="max-w-56">
                                        <a href="{{ $link }}" class="block truncate font-semibold text-brand underline-offset-2 hover:underline">{{ $u->nama_file }}</a>
                                        <span class="text-sm text-muted">{{ \App\Services\Format::date($u->created_at) }}{{ $u->mode !== 'baru' ? ', '.($u->mode === 'ganti' ? 'mengganti data lama' : 'digabung') : '' }}</span>
                                    </td>
                                    <td class="whitespace-nowrap text-ink-2">{{ $u->tanggal_mulai ? \App\Services\Format::date($u->tanggal_mulai).' – '.\App\Services\Format::date($u->tanggal_selesai) : '–' }}</td>
                                    <td class="text-right tabular">{{ \App\Services\Format::number($u->jumlah_baris_valid) }}</td>
                                    <td class="text-right tabular">{{ \App\Services\Format::number($u->jumlah_baris_ditolak) }}</td>
                                    <td><span class="tag {{ $color }}">{{ $u->statusLabel() }}</span></td>
                                    <td class="text-right">
                                        <form method="POST" action="{{ route('data.hapus', $u->id) }}" data-confirm="Hapus unggahan {{ $u->nama_file }} beserta data penjualannya?">
                                            @csrf @method('DELETE')
                                            <button class="btn-ghost px-2 text-bad" aria-label="Hapus unggahan {{ $u->nama_file }}"><x-icon name="trash" class="h-4 w-4" /></button>
                                        </form>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                <div class="mt-4">{{ $uploads->links() }}</div>
            @endif
        </section>
    </div>

    <section class="mt-8 border-t border-line pt-6" aria-labelledby="hapus-title">
        <h2 id="hapus-title" class="font-bold text-bad">Hapus semua data penjualan</h2>
        <p class="mt-1 max-w-2xl text-sm text-ink-2">Menghapus semua unggahan, transaksi, menu, HPP, dan hasil analisis. Akunmu tetap ada. Tidak bisa dibatalkan.</p>
        <form method="POST" action="{{ route('data.hapus-semua') }}" class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" data-confirm="Yakin menghapus SEMUA data penjualan?">
            @csrf @method('DELETE')
            <div class="sm:w-64">
                <label for="konfirmasi" class="label">Ketik HAPUS untuk konfirmasi</label>
                <input id="konfirmasi" name="konfirmasi" class="input" autocomplete="off">
                @error('konfirmasi')<p class="error">{{ $message }}</p>@enderror
            </div>
            <button class="btn-danger">Hapus semua data</button>
        </form>
    </section>
</x-layouts.app>
