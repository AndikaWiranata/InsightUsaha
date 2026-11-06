<?php

namespace App\Services;

use App\Models\Business;
use App\Models\ErrorLog;
use App\Models\Upload;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Menyimpan hasil pembersihan file ke tabel transactions / transaction_items.
 *
 * Asumsi: data tanpa id_transaksi diperlakukan "1 baris = 1 transaksi".
 * Data dengan id_transaksi dikelompokkan per (tanggal, id_transaksi).
 */
class ImportService
{
    private const CHUNK = 1000;

    public function __construct(private AnalyticsClient $analytics)
    {
    }

    public function absolutePath(Upload $upload): string
    {
        return Storage::disk('local')->path($upload->path);
    }

    /** Apakah rentang tanggal unggahan bertabrakan dengan data yang sudah ada? */
    public function overlaps(Business $business, string $start, string $end, ?int $exceptUploadId = null): bool
    {
        return DB::table('transactions')
            ->where('business_id', $business->id)
            ->when($exceptUploadId, fn ($q) => $q->where('upload_id', '!=', $exceptUploadId))
            ->whereBetween('waktu', [$start.' 00:00:00', $end.' 23:59:59'])
            ->exists();
    }

    public function process(Upload $upload): void
    {
        $business = $upload->business;
        $upload->update(['status' => 'diproses', 'progres' => 5, 'pesan_error' => null]);

        try {
            $result = $this->analytics->clean($this->absolutePath($upload), $upload->nama_file, $upload->pemetaan ?? []);
        } catch (AnalyticsValidationException $e) {
            $this->fail($upload, $e->getMessage());

            return;
        } catch (\Throwable $e) {
            $this->fail($upload, 'Gagal memproses file: '.$e->getMessage());

            return;
        }

        $upload->update(['progres' => 40]);
        $rows = $result['baris'] ?? [];
        $summary = $result['ringkasan'] ?? [];
        $count = count($rows['tanggal'] ?? []);

        if ($count === 0) {
            $this->fail($upload, 'Tidak ada baris valid di file ini. Periksa format tanggal, jumlah, dan harga.', $result);

            return;
        }

        try {
            DB::transaction(function () use ($upload, $business, $rows, $summary, $count, $result) {
                $start = $summary['tanggal_mulai'];
                $end = $summary['tanggal_selesai'];

                if ($upload->mode === 'ganti') {
                    // Hapus data lama pada rentang tanggal yang sama (dibatasi per business_id).
                    DB::table('transactions')
                        ->where('business_id', $business->id)
                        ->where('upload_id', '!=', $upload->id)
                        ->whereBetween('waktu', [$start.' 00:00:00', $end.' 23:59:59'])
                        ->delete();
                }

                $existingHashes = [];
                if ($upload->mode === 'gabung') {
                    $existingHashes = DB::table('transaction_items as i')
                        ->join('transactions as t', 't.id', '=', 'i.transaction_id')
                        ->where('t.business_id', $business->id)
                        ->where('t.punya_kode', true)
                        ->whereBetween('t.waktu', [$start.' 00:00:00', $end.' 23:59:59'])
                        ->pluck('i.row_hash')->flip()->all();
                }

                $productIds = $this->upsertProducts($business, $rows);
                $skipped = 0;

                // Kelompokkan baris menjadi transaksi.
                $groups = [];
                for ($i = 0; $i < $count; $i++) {
                    $kode = $rows['id_transaksi'][$i];
                    if ($kode !== null && isset($existingHashes[$rows['hash'][$i]])) {
                        $skipped++;

                        continue;
                    }
                    $key = $kode !== null ? 'k|'.$rows['tanggal'][$i].'|'.$kode : 'r|'.$i;
                    $groups[$key][] = $i;
                }

                $urutan = 0;
                $trxRows = [];
                foreach ($groups as $indices) {
                    $first = $indices[0];
                    $jam = $rows['jam'][$first];
                    $trxRows[] = [
                        'business_id' => $business->id,
                        'upload_id' => $upload->id,
                        'urutan' => ++$urutan,
                        'kode_transaksi' => $rows['id_transaksi'][$first],
                        'punya_kode' => $rows['id_transaksi'][$first] !== null,
                        'waktu' => $rows['tanggal'][$first].' '.($jam ?? '00:00').':00',
                        'punya_jam' => $jam !== null,
                    ];
                }
                foreach (array_chunk($trxRows, self::CHUNK) as $chunk) {
                    DB::table('transactions')->insert($chunk);
                }
                $upload->update(['progres' => 70]);

                $trxIds = DB::table('transactions')->where('upload_id', $upload->id)->pluck('id', 'urutan')->all();
                $items = [];
                $urutan = 0;
                foreach ($groups as $indices) {
                    $trxId = $trxIds[++$urutan];
                    foreach ($indices as $i) {
                        $items[] = [
                            'transaction_id' => $trxId,
                            'product_id' => $productIds[$rows['nama_produk'][$i]],
                            'jumlah' => (int) $rows['jumlah'][$i],
                            'harga_satuan' => $rows['harga_satuan'][$i],
                            'row_hash' => $rows['hash'][$i],
                        ];
                    }
                    if (count($items) >= self::CHUNK) {
                        DB::table('transaction_items')->insert($items);
                        $items = [];
                    }
                }
                if ($items) {
                    DB::table('transaction_items')->insert($items);
                }

                $summary['duplikat_dilewati_gabung'] = $skipped;
                $upload->update([
                    'status' => 'selesai',
                    'progres' => 100,
                    'jumlah_baris_valid' => $count - $skipped,
                    'jumlah_baris_ditolak' => (int) ($summary['jumlah_baris_ditolak'] ?? 0),
                    'ringkasan' => $summary,
                    'baris_ditolak' => $result['ditolak'] ?? [],
                    'tanggal_mulai' => $start,
                    'tanggal_selesai' => $end,
                ]);
            });
        } catch (\Throwable $e) {
            report($e);
            $this->fail($upload, 'Gagal menyimpan data ke basis data. Silakan coba lagi.');

            return;
        }

        $business->bumpDataVersion();
    }

    /** @return array<string,int> nama produk => id */
    private function upsertProducts(Business $business, array $rows): array
    {
        $categories = [];
        foreach ($rows['nama_produk'] as $i => $name) {
            if (! isset($categories[$name]) || $categories[$name] === null) {
                $categories[$name] = $rows['kategori'][$i] ?? null;
            }
        }
        $now = now();
        $payload = [];
        foreach ($categories as $name => $cat) {
            $payload[] = ['business_id' => $business->id, 'nama' => $name, 'kategori' => $cat,
                'created_at' => $now, 'updated_at' => $now];
        }
        foreach (array_chunk($payload, 500) as $chunk) {
            DB::table('products')->insertOrIgnore($chunk);
        }
        // Lengkapi kategori untuk produk lama yang belum punya kategori.
        foreach ($categories as $name => $cat) {
            if ($cat !== null) {
                DB::table('products')->where('business_id', $business->id)->where('nama', $name)
                    ->whereNull('kategori')->update(['kategori' => $cat]);
            }
        }

        return DB::table('products')->where('business_id', $business->id)
            ->whereIn('nama', array_keys($categories))->pluck('id', 'nama')->all();
    }

    private function fail(Upload $upload, string $message, array $result = []): void
    {
        $upload->update([
            'status' => 'gagal',
            'progres' => 100,
            'pesan_error' => $message,
            'ringkasan' => $result['ringkasan'] ?? $upload->ringkasan,
            'baris_ditolak' => $result['ditolak'] ?? $upload->baris_ditolak,
            'jumlah_baris_ditolak' => (int) ($result['ringkasan']['jumlah_baris_ditolak'] ?? 0),
        ]);
        ErrorLog::catat('impor', $message, $upload->business_id, ['upload_id' => $upload->id, 'file' => $upload->nama_file]);
    }

    /** Hapus satu unggahan beserta transaksinya. */
    public function deleteUpload(Upload $upload): void
    {
        DB::transaction(function () use ($upload) {
            DB::table('transactions')->where('business_id', $upload->business_id)->where('upload_id', $upload->id)->delete();
            if ($upload->path) {
                Storage::disk('local')->delete($upload->path);
            }
            $upload->delete();
        });
        $upload->business->bumpDataVersion();
    }

    /** Hapus seluruh data penjualan usaha (unggahan, transaksi, produk, hasil analisis). */
    public function deleteAllData(Business $business): void
    {
        DB::transaction(function () use ($business) {
            Storage::disk('local')->deleteDirectory('uploads/'.$business->id);
            DB::table('transactions')->where('business_id', $business->id)->delete();
            DB::table('uploads')->where('business_id', $business->id)->delete();
            DB::table('products')->where('business_id', $business->id)->delete();
            DB::table('analysis_results')->where('business_id', $business->id)->delete();
            DB::table('ai_summaries')->where('business_id', $business->id)->delete();
        });
        $business->bumpDataVersion();
    }
}
