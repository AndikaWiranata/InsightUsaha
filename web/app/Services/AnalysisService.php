<?php

namespace App\Services;

use App\Models\AnalysisResult;
use App\Models\Business;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Mengambil data per periode (selalu dibatasi business_id), memanggil layanan analitik,
 * dan menyimpan hasil ke analysis_results agar halaman berikutnya cepat.
 */
class AnalysisService
{
    public const KINDS = ['dashboard', 'produk', 'waktu', 'bundling', 'menu'];

    public function __construct(private AnalyticsClient $analytics)
    {
    }

    /** Batas awal data yang boleh dilihat (paket Gratis: 3 bulan terakhir). */
    public function minStart(Business $business): ?CarbonImmutable
    {
        if ($business->isPro()) {
            return null;
        }
        $latest = $business->latestDataDate();

        return $latest ? CarbonImmutable::parse($latest)->subDays(89) : null;
    }

    public function hasData(Business $business): bool
    {
        return DB::table('transactions')->where('business_id', $business->id)->exists();
    }

    /**
     * @param  list<string>  $kinds
     * @return array<string, array>
     */
    public function get(Business $business, Period $period, array $kinds, array $extra = []): array
    {
        $version = $business->dataVersion();
        $params = $this->params($business, $extra);
        $out = [];
        $missing = [];

        foreach ($kinds as $kind) {
            $hash = $this->paramHash($kind, $params);
            $cached = AnalysisResult::where('business_id', $business->id)
                ->where('jenis', $kind)
                ->whereDate('periode_mulai', $period->start->toDateString())
                ->whereDate('periode_selesai', $period->end->toDateString())
                ->where('parameter_hash', $hash)
                ->first();
            if ($cached && $cached->versi_data === $version) {
                $out[$kind] = $cached->hasil_json;
            } else {
                $missing[] = $kind;
            }
        }

        if ($missing) {
            $rows = $this->rows($business, $period->previousStart()->toDateString(), $period->end->toDateString());
            $fresh = $this->analytics->analyze($missing, $rows, $period->toArray(), $params);
            foreach ($missing as $kind) {
                $result = $fresh[$kind] ?? [];
                AnalysisResult::updateOrCreate(
                    [
                        'business_id' => $business->id,
                        'jenis' => $kind,
                        'periode_mulai' => $period->start->toDateString(),
                        'periode_selesai' => $period->end->toDateString(),
                        'parameter_hash' => $this->paramHash($kind, $params),
                    ],
                    ['versi_data' => $version, 'hasil_json' => $result],
                );
                $out[$kind] = $result;
            }
        }

        return $out;
    }

    private function params(Business $business, array $extra): array
    {
        $apriori = $business->aprioriSettings();
        $hpp = DB::table('products')->where('business_id', $business->id)->whereNotNull('hpp')
            ->pluck('hpp', 'nama')->map(fn ($v) => (float) $v)->all();

        return array_merge([
            'min_support' => $apriori['min_support'],
            'min_confidence' => $apriori['min_confidence'],
            'hpp' => (object) $hpp,
        ], $extra);
    }

    private function paramHash(string $kind, array $params): string
    {
        return match ($kind) {
            'bundling' => sha1(json_encode([$params['min_support'], $params['min_confidence']])),
            'menu' => sha1(json_encode($params['hpp'])),
            'dashboard' => sha1(json_encode($params['granularitas'] ?? 'auto')),
            default => '',
        };
    }

    /**
     * Baris penjualan dalam format kolom untuk layanan analitik.
     * Data ini hanya dikirim ke layanan analitik internal, tidak pernah ke API LLM.
     */
    public function rows(Business $business, string $start, string $end): array
    {
        $out = ['tanggal' => [], 'jam' => [], 'trx' => [], 'punya_kode' => [], 'produk' => [], 'jumlah' => [], 'harga' => []];

        DB::table('transaction_items as i')
            ->join('transactions as t', 't.id', '=', 'i.transaction_id')
            ->join('products as p', 'p.id', '=', 'i.product_id')
            ->where('t.business_id', $business->id)
            ->where('p.business_id', $business->id)
            ->whereBetween('t.waktu', [$start.' 00:00:00', $end.' 23:59:59'])
            ->select('t.id', 't.waktu', 't.punya_jam', 't.punya_kode', 't.kode_transaksi', 'p.nama', 'i.jumlah', 'i.harga_satuan')
            ->orderBy('t.id')
            ->lazy(5000)
            ->each(function ($r) use (&$out) {
                $waktu = (string) $r->waktu;
                $date = substr($waktu, 0, 10);
                $hasCode = (bool) $r->punya_kode;
                $out['tanggal'][] = $date;
                $out['jam'][] = $r->punya_jam ? substr($waktu, 11, 5) : null;
                $out['trx'][] = $hasCode ? 'k|'.$date.'|'.$r->kode_transaksi : 'i|'.$r->id;
                $out['punya_kode'][] = $hasCode;
                $out['produk'][] = $r->nama;
                $out['jumlah'][] = (int) $r->jumlah;
                $out['harga'][] = (float) $r->harga_satuan;
            });

        return $out;
    }
}
