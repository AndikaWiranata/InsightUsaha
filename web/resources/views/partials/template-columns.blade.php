<div class="table-wrap mt-3">
    <table class="table">
        <thead><tr><th>Kolom</th><th>Contoh</th><th>Perlu?</th><th>Dipakai untuk</th></tr></thead>
        <tbody>
            @foreach ([
                ['tanggal', '2026-10-01', true, 'Semua analisis'],
                ['jam', '08:15', false, 'Jam ramai'],
                ['id_transaksi', 'TRX001', false, 'Pasangan menu'],
                ['nama_produk', 'Kopi Susu', true, 'Analisis menu'],
                ['kategori', 'Minuman', false, 'Pengelompokan'],
                ['jumlah', '2', true, 'Jumlah terjual'],
                ['harga_satuan', '18000', true, 'Omzet dan untung'],
            ] as [$col, $ex, $req, $use])
                <tr>
                    <td><code class="text-sm">{{ $col }}</code></td>
                    <td class="text-ink-2">{{ $ex }}</td>
                    <td class="{{ $req ? 'font-bold' : 'text-muted' }}">{{ $req ? 'Wajib' : 'Opsional' }}</td>
                    <td class="text-ink-2">{{ $use }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>
<p class="help mt-2">Nama kolom berbeda? Tidak masalah, kamu bisa mencocokkan kolomnya setelah mengunggah.</p>
