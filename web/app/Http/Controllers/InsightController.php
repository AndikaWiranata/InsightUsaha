<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\ErrorLog;
use App\Models\Product;
use App\Services\AiSummaryService;
use App\Services\AnalysisService;
use App\Services\AnalyticsClient;
use App\Services\Period;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Halaman analisis: dashboard (F3+F8), produk (F4+HPP), waktu (F5), bundling (F6), menu (F7), laporan (F9). */
class InsightController extends Controller
{
    public function __construct(private AnalysisService $analysis, private AiSummaryService $ai)
    {
    }

    private function business(Request $request): Business
    {
        return $request->attributes->get('business');
    }

    private function period(Request $request, Business $business): Period
    {
        return Period::fromRequest($request, $business->latestDataDate(), $this->analysis->minStart($business));
    }

    /** Menjalankan analisis dengan penanganan error yang ramah. */
    private function load(Request $request, array $kinds, array $extra = []): array
    {
        $business = $this->business($request);
        if (! $this->analysis->hasData($business)) {
            return [$business, null, null, null];
        }
        $period = $this->period($request, $business);
        try {
            $results = $this->analysis->get($business, $period, $kinds, $extra);

            return [$business, $period, $results, null];
        } catch (\Throwable $e) {
            report($e);
            ErrorLog::catat('analitik', $e->getMessage(), $business->id);

            return [$business, $period, null, 'Analisis belum bisa ditampilkan: '.$e->getMessage()];
        }
    }

    private function common(Business $business, ?Period $period, ?string $error): array
    {
        return [
            'business' => $business,
            'period' => $period,
            'error' => $error,
            'presets' => Period::PRESETS,
            'isPro' => $business->isPro(),
            'minStart' => $this->analysis->minStart($business),
        ];
    }

    public function dashboard(Request $request)
    {
        $gran = $request->query('granularitas');
        $extra = in_array($gran, ['harian', 'mingguan', 'bulanan'], true) ? ['granularitas' => $gran] : [];
        $kinds = ['dashboard', 'produk'];
        $business = $this->business($request);
        if ($business->isPro()) {
            $kinds = ['dashboard', 'produk', 'waktu', 'bundling', 'menu'];
        }
        [$business, $period, $results, $error] = $this->load($request, $kinds, $extra);

        if ($results === null && $error === null) {
            return view('insight.empty', $this->common($business, $period, $error));
        }

        $summary = null;
        if ($results && $business->isPro()) {
            $summary = $this->ai->find($business, $period);
        }

        return view('insight.dashboard', $this->common($business, $period, $error) + [
            'd' => $results['dashboard'] ?? null,
            'produk' => $results['produk'] ?? null,
            'summary' => $summary,
            'granularitas' => $gran,
        ]);
    }

    /** Dipanggil via fetch dari dashboard agar halaman tetap cepat (< 3 detik) walau API AI lambat/gagal. */
    public function aiSummary(Request $request)
    {
        $business = $this->business($request);
        if (! $business->isPro()) {
            return response()->json(['status' => 'pro'], 403);
        }
        [$business, $period, $results, $error] = $this->load($request, ['dashboard', 'produk', 'waktu', 'bundling', 'menu']);
        if (! $results) {
            return response()->json(['status' => 'gagal']);
        }
        $summary = $this->ai->getOrCreate($business, $period, $results);

        return response()->json([
            'status' => $summary->status,
            'periode' => $summary->periode,
            'temuan' => $summary->isi_json['temuan'] ?? [],
            'saran' => $summary->isi_json['saran'] ?? [],
            'umpan_balik' => $summary->umpan_balik,
        ]);
    }

    public function aiFeedback(Request $request)
    {
        $data = $request->validate(['periode' => ['required', 'string', 'max:30'], 'nilai' => ['required', 'in:membantu,tidak_membantu']]);
        $ok = $this->ai->feedback($this->business($request), $data['periode'], $data['nilai']);

        return response()->json(['ok' => $ok]);
    }

    public function products(Request $request)
    {
        [$business, $period, $results, $error] = $this->load($request, ['produk']);
        if ($results === null && $error === null) {
            return view('insight.empty', $this->common($business, $period, $error));
        }
        $hpp = Product::where('business_id', $business->id)->orderBy('nama')->get();
        $filter = $request->query('label');

        return view('insight.products', $this->common($business, $period, $error) + [
            'p' => $results['produk'] ?? null,
            'products' => $hpp,
            'filter' => $filter,
        ]);
    }

    public function saveHpp(Request $request)
    {
        $business = $this->business($request);
        $data = $request->validate(['hpp' => ['array'], 'hpp.*' => ['nullable', 'numeric', 'min:0', 'max:100000000']],
            ['hpp.*.numeric' => 'HPP harus berupa angka.', 'hpp.*.min' => 'HPP tidak boleh negatif.']);

        foreach ($data['hpp'] ?? [] as $productId => $value) {
            Product::where('business_id', $business->id)->whereKey((int) $productId)
                ->update(['hpp' => $value === null || $value === '' ? null : $value]);
        }

        return back()->with('status', 'HPP berhasil disimpan.');
    }

    /** Unggah file HPP: kolom nama_produk + hpp. */
    public function uploadHpp(Request $request, AnalyticsClient $analytics)
    {
        $business = $this->business($request);
        $request->validate(['file_hpp' => ['required', 'file', 'max:2048', function ($a, $f, $fail) {
            if (! in_array(Str::lower($f->getClientOriginalExtension()), ['csv', 'xlsx'], true)) {
                $fail('Format file tidak didukung. Gunakan file .xlsx atau .csv.');
            }
        }]], ['file_hpp.required' => 'Pilih file HPP terlebih dahulu.']);

        $file = $request->file('file_hpp');
        $path = $file->storeAs('tmp', Str::uuid().'.'.Str::lower($file->getClientOriginalExtension()), 'local');
        try {
            $table = $analytics->table(Storage::disk('local')->path($path), $file->getClientOriginalName());
        } catch (\Throwable $e) {
            return back()->withErrors(['file_hpp' => $e->getMessage()]);
        } finally {
            Storage::disk('local')->delete($path);
        }

        $norm = fn ($s) => preg_replace('/[^a-z0-9]+/', '_', Str::lower(trim((string) $s)));
        $cols = array_map($norm, $table['kolom'] ?? []);
        $iName = array_search('nama_produk', $cols, true);
        if ($iName === false) {
            $iName = array_search('produk', $cols, true);
        }
        $iHpp = array_search('hpp', $cols, true);
        if ($iName === false || $iHpp === false) {
            return back()->withErrors(['file_hpp' => 'File HPP harus punya kolom "nama_produk" dan "hpp".']);
        }

        $products = Product::where('business_id', $business->id)->get()->keyBy(fn ($p) => Str::lower($p->nama));
        $updated = 0;
        $unknown = [];
        foreach ($table['baris'] as $row) {
            $name = preg_replace('/\s+/', ' ', trim((string) ($row[$iName] ?? '')));
            $raw = preg_replace('/[^0-9.,]/', '', (string) ($row[$iHpp] ?? ''));
            if ($name === '' || $raw === '') {
                continue;
            }
            $value = preg_match('/^\d{1,3}(\.\d{3})+(,\d+)?$/', $raw) ? (float) str_replace(['.', ','], ['', '.'], $raw)
                : (float) str_replace(',', '.', $raw);
            $p = $products->get(Str::lower($name));
            if ($p) {
                $p->update(['hpp' => $value]);
                $updated++;
            } else {
                $unknown[] = $name;
            }
        }
        $msg = "HPP {$updated} produk berhasil diperbarui.";
        if ($unknown) {
            $msg .= ' Produk tidak dikenal: '.implode(', ', array_slice($unknown, 0, 5)).(count($unknown) > 5 ? ', …' : '').'.';
        }

        return back()->with('status', $msg);
    }

    public function hppTemplate(Request $request)
    {
        $business = $this->business($request);
        $lines = ['nama_produk,hpp'];
        foreach (Product::where('business_id', $business->id)->orderBy('nama')->get() as $p) {
            $name = str_contains($p->nama, ',') ? '"'.str_replace('"', '""', $p->nama).'"' : $p->nama;
            $lines[] = $name.','.($p->hpp !== null ? (int) round($p->hpp) : '');
        }

        return response(implode("\n", $lines)."\n", 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="hpp-produk.csv"',
        ]);
    }

    public function time(Request $request)
    {
        [$business, $period, $results, $error] = $this->load($request, ['waktu']);
        if ($results === null && $error === null) {
            return view('insight.empty', $this->common($business, $period, $error));
        }

        return view('insight.time', $this->common($business, $period, $error) + ['w' => $results['waktu'] ?? null]);
    }

    public function bundling(Request $request)
    {
        [$business, $period, $results, $error] = $this->load($request, ['bundling']);
        if ($results === null && $error === null) {
            return view('insight.empty', $this->common($business, $period, $error));
        }

        return view('insight.bundling', $this->common($business, $period, $error) + [
            'b' => $results['bundling'] ?? null,
            'settings' => $business->aprioriSettings(),
        ]);
    }

    public function saveBundlingSettings(Request $request)
    {
        $business = $this->business($request);
        $data = $request->validate([
            'min_support' => ['required', 'numeric', 'min:0.1', 'max:50'],
            'min_confidence' => ['required', 'numeric', 'min:1', 'max:100'],
        ]);
        $p = $business->pengaturan ?? [];
        $p['min_support'] = round($data['min_support'] / 100, 4);
        $p['min_confidence'] = round($data['min_confidence'] / 100, 4);
        $business->update(['pengaturan' => $p]);

        return back()->with('status', 'Pengaturan bundling disimpan.');
    }

    public function menu(Request $request)
    {
        [$business, $period, $results, $error] = $this->load($request, ['menu']);
        if ($results === null && $error === null) {
            return view('insight.empty', $this->common($business, $period, $error));
        }

        return view('insight.menu', $this->common($business, $period, $error) + ['m' => $results['menu'] ?? null]);
    }

    public function report(Request $request)
    {
        $business = $this->business($request);
        $period = $this->analysis->hasData($business) ? $this->period($request, $business) : null;

        return view('insight.report', $this->common($business, $period, null) + [
            'hasData' => $period !== null,
        ]);
    }

    public function reportPdf(Request $request)
    {
        [$business, $period, $results, $error] = $this->load($request, ['dashboard', 'produk', 'waktu', 'bundling', 'menu']);
        if (! $results) {
            return redirect()->route('laporan')->withErrors(['laporan' => $error ?? 'Belum ada data untuk dibuat laporan.']);
        }
        $summary = $this->ai->getOrCreate($business, $period, $results);

        $pdf = Pdf::loadView('pdf.report', [
            'business' => $business,
            'period' => $period,
            'r' => $results,
            'summary' => $summary,
        ])->setPaper('a4');

        return $pdf->download('laporan-insightusaha-'.$period->key().'.pdf');
    }
}
