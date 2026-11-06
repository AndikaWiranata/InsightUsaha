<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessUpload;
use App\Models\Business;
use App\Models\Upload;
use App\Services\AnalyticsClient;
use App\Services\AnalyticsValidationException;
use App\Services\ImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** F2 Unggah & validasi data, halaman /data. */
class DataController extends Controller
{
    public const FIELD_LABELS = [
        'tanggal' => 'Tanggal', 'jam' => 'Jam', 'id_transaksi' => 'ID transaksi', 'nama_produk' => 'Nama produk',
        'kategori' => 'Kategori', 'jumlah' => 'Jumlah', 'harga_satuan' => 'Harga satuan',
    ];

    public const REQUIRED = ['tanggal', 'nama_produk', 'jumlah', 'harga_satuan'];

    public function __construct(private AnalyticsClient $analytics, private ImportService $import)
    {
    }

    private function business(Request $request): Business
    {
        return $request->attributes->get('business');
    }

    private function findUpload(Request $request, int $id): Upload
    {
        // Selalu dibatasi per business_id.
        return Upload::where('business_id', $this->business($request)->id)->findOrFail($id);
    }

    public function index(Request $request)
    {
        $business = $this->business($request);

        return view('data.index', [
            'uploads' => $business->uploads()->latest('id')->paginate(15),
            'quota' => $this->quota($business),
        ]);
    }

    /** @return array{limit: int|null, used: int, remaining: int|null} */
    public function quota(Business $business): array
    {
        if ($business->isPro()) {
            return ['limit' => null, 'used' => 0, 'remaining' => null];
        }
        $used = $business->uploads()->where('status', 'selesai')
            ->where('created_at', '>=', now()->startOfMonth())->count();

        return ['limit' => 1, 'used' => $used, 'remaining' => max(0, 1 - $used)];
    }

    public function template()
    {
        $csv = "tanggal,jam,id_transaksi,nama_produk,kategori,jumlah,harga_satuan\n"
            ."2026-10-01,08:15,TRX001,Kopi Susu Gula Aren,Minuman,2,18000\n"
            ."2026-10-01,08:15,TRX001,Croissant,Makanan,1,22000\n"
            ."2026-10-01,09:40,TRX002,Americano,Minuman,1,15000\n";

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="template-insightusaha.csv"',
        ]);
    }

    public function store(Request $request)
    {
        $business = $this->business($request);
        $request->validate([
            'file' => ['required', 'file', 'max:10240', function ($attr, $file, $fail) {
                $ext = Str::lower($file->getClientOriginalExtension());
                if (! in_array($ext, ['csv', 'xlsx'], true)) {
                    $fail('Format file tidak didukung. Gunakan file .xlsx atau .csv.');
                }
            }],
        ], [
            'file.required' => 'Pilih file penjualan terlebih dahulu.',
            'file.max' => 'Ukuran file maksimal 10 MB.',
        ]);

        $quota = $this->quota($business);
        if ($quota['remaining'] === 0) {
            return back()->withErrors(['file' => 'Paket Gratis hanya bisa 1 unggahan per bulan. Upgrade ke Pro untuk unggahan tanpa batas.']);
        }

        $file = $request->file('file');
        $ext = Str::lower($file->getClientOriginalExtension());
        $path = $file->storeAs('uploads/'.$business->id, Str::uuid().'.'.$ext, 'local');
        $upload = $business->uploads()->create([
            'nama_file' => Str::limit($file->getClientOriginalName(), 200, ''),
            'path' => $path,
            'ukuran' => $file->getSize(),
            'status' => 'menunggu',
            'dibuat_pada' => now(),
        ]);

        try {
            $info = $this->analytics->inspect($this->import->absolutePath($upload), $upload->nama_file);
        } catch (AnalyticsValidationException $e) {
            $upload->update(['status' => 'gagal', 'pesan_error' => $e->getMessage(), 'progres' => 100]);
            \App\Models\ErrorLog::catat('impor', $e->getMessage(), $business->id, ['upload_id' => $upload->id]);

            return redirect()->route('data')->withErrors(['file' => $e->getMessage()]);
        } catch (\Throwable $e) {
            $upload->update(['status' => 'gagal', 'pesan_error' => $e->getMessage(), 'progres' => 100]);
            \App\Models\ErrorLog::catat('impor', $e->getMessage(), $business->id, ['upload_id' => $upload->id]);

            return redirect()->route('data')->withErrors(['file' => $e->getMessage()]);
        }

        $upload->update(['pemetaan' => $info['pemetaan']]);

        // Jika kolom wajib tidak dikenali otomatis, pengguna memetakan kolom.
        if (! empty($info['kolom_wajib_kurang'])) {
            return redirect()->route('data.mapping', $upload);
        }

        return $this->proceed($upload, $info);
    }

    public function mapping(Request $request, int $id)
    {
        $upload = $this->findUpload($request, $id);
        abort_unless(in_array($upload->status, ['menunggu', 'konflik'], true), 404);

        try {
            $info = $this->analytics->inspect($this->import->absolutePath($upload), $upload->nama_file);
        } catch (\Throwable $e) {
            return redirect()->route('data')->withErrors(['file' => $e->getMessage()]);
        }

        return view('data.mapping', [
            'upload' => $upload,
            'info' => $info,
            'labels' => self::FIELD_LABELS,
            'required' => self::REQUIRED,
            'mapping' => $upload->pemetaan ?? $info['pemetaan'],
        ]);
    }

    public function saveMapping(Request $request, int $id)
    {
        $upload = $this->findUpload($request, $id);
        abort_unless(in_array($upload->status, ['menunggu', 'konflik'], true), 404);
        $input = $request->input('pemetaan', []);
        $mapping = [];
        foreach (array_keys(self::FIELD_LABELS) as $field) {
            $v = $input[$field] ?? null;
            $mapping[$field] = is_string($v) && $v !== '' ? $v : null;
        }
        $missing = array_filter(self::REQUIRED, fn ($f) => $mapping[$f] === null);
        if ($missing) {
            return back()->withErrors(['pemetaan' => 'Kolom wajib belum dipilih: '
                .implode(', ', array_map(fn ($f) => self::FIELD_LABELS[$f], $missing))])->withInput();
        }
        $used = array_filter($mapping);
        if (count($used) !== count(array_unique($used))) {
            return back()->withErrors(['pemetaan' => 'Satu kolom file tidak boleh dipakai untuk dua isian berbeda.'])->withInput();
        }

        try {
            $info = $this->analytics->inspect($this->import->absolutePath($upload), $upload->nama_file, $mapping);
        } catch (\Throwable $e) {
            return back()->withErrors(['pemetaan' => $e->getMessage()]);
        }
        if (! empty($info['kolom_wajib_kurang'])) {
            return back()->withErrors(['pemetaan' => 'Pemetaan kolom belum lengkap.'])->withInput();
        }
        $upload->update(['pemetaan' => $info['pemetaan']]);

        return $this->proceed($upload, $info);
    }

    /** Cek tabrakan rentang tanggal, lalu jalankan job impor. */
    private function proceed(Upload $upload, array $info)
    {
        $business = $upload->business;
        $start = $info['tanggal_mulai'] ?? null;
        $end = $info['tanggal_selesai'] ?? null;
        $upload->update(['tanggal_mulai' => $start, 'tanggal_selesai' => $end]);

        if ($start && $end && $this->import->overlaps($business, $start, $end, $upload->id)) {
            $upload->update(['status' => 'konflik']);

            return redirect()->route('data.conflict', $upload);
        }

        $upload->update(['mode' => 'baru', 'status' => 'menunggu']);
        ProcessUpload::dispatch($upload->id);

        return redirect()->route('data.show', $upload);
    }

    public function conflict(Request $request, int $id)
    {
        $upload = $this->findUpload($request, $id);
        abort_unless($upload->status === 'konflik', 404);

        return view('data.conflict', ['upload' => $upload]);
    }

    public function resolveConflict(Request $request, int $id)
    {
        $upload = $this->findUpload($request, $id);
        abort_unless($upload->status === 'konflik', 404);
        $data = $request->validate(['mode' => ['required', 'in:ganti,gabung,batal']]);

        if ($data['mode'] === 'batal') {
            $this->import->deleteUpload($upload);

            return redirect()->route('data')->with('status', 'Unggahan dibatalkan.');
        }

        $upload->update(['mode' => $data['mode'], 'status' => 'menunggu']);
        ProcessUpload::dispatch($upload->id);

        return redirect()->route('data.show', $upload);
    }

    public function show(Request $request, int $id)
    {
        $upload = $this->findUpload($request, $id);

        return view('data.show', ['upload' => $upload]);
    }

    public function status(Request $request, int $id)
    {
        $upload = $this->findUpload($request, $id);

        return response()->json([
            'status' => $upload->status,
            'progres' => $upload->progres,
            'selesai' => in_array($upload->status, ['selesai', 'gagal'], true),
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $upload = $this->findUpload($request, $id);
        $this->import->deleteUpload($upload);

        return redirect()->route('data')->with('status', 'Unggahan dan data penjualannya sudah dihapus.');
    }

    public function destroyAll(Request $request)
    {
        $request->validate(['konfirmasi' => ['required', 'in:HAPUS']], [
            'konfirmasi.in' => 'Ketik HAPUS untuk mengonfirmasi.',
            'konfirmasi.required' => 'Ketik HAPUS untuk mengonfirmasi.',
        ]);
        $this->import->deleteAllData($this->business($request));

        return redirect()->route('data')->with('status', 'Seluruh data penjualan sudah dihapus.');
    }
}
