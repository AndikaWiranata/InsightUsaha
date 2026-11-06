<x-layouts.app title="Data bertabrakan">
    <div class="max-w-xl">
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Sudah ada data di tanggal yang sama</h1>
        <p class="mt-2 text-ink-2">
            File <strong class="text-ink">{{ $upload->nama_file }}</strong> berisi data
            {{ \App\Services\Format::date($upload->tanggal_mulai) }} – {{ \App\Services\Format::date($upload->tanggal_selesai) }}.
            Sebagian tanggal itu sudah terisi dari unggahan sebelumnya.
        </p>
        <form method="POST" action="{{ route('data.conflict.simpan', $upload->id) }}" class="mt-6">
            @csrf
            <fieldset class="space-y-3">
                <legend class="label">Mau diapakan?</legend>
                @foreach ([
                    ['ganti', 'Ganti data lama', 'Data lama di rentang tanggal ini dihapus, lalu diganti isi file baru. Pilih ini kalau file baru adalah versi yang sudah dibetulkan.'],
                    ['gabung', 'Gabungkan', 'Data baru ditambahkan. Baris yang sama persis (nomor transaksi, menu, jumlah, harga) dilewati supaya tidak dobel.'],
                    ['batal', 'Batalkan unggahan', 'File ini tidak diproses.'],
                ] as $i => [$val, $title, $desc])
                    <label class="flex gap-3 rounded-card border border-line bg-surface p-4 hover:border-field has-[:checked]:border-2 has-[:checked]:border-ink">
                        <input type="radio" name="mode" value="{{ $val }}" class="mt-1 h-4 w-4 accent-[var(--c-ink)]" @checked($i === 0)>
                        <span><span class="block font-bold">{{ $title }}</span><span class="text-sm text-ink-2">{{ $desc }}</span></span>
                    </label>
                @endforeach
            </fieldset>
            <button class="btn-primary mt-5 w-full sm:w-auto">Lanjutkan</button>
        </form>
    </div>
</x-layouts.app>
