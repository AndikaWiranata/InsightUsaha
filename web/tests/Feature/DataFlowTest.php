<?php

namespace Tests\Feature;

use App\Models\Upload;
use App\Models\User;
use App\Services\AiSummaryService;
use App\Services\ImportService;
use App\Services\Period;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** F2 unggah, multi-tenant, F8 fallback & validasi angka. Layanan analitik dipalsukan dengan Http::fake. */
class DataFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['services.analytics.url' => 'http://analytics.test', 'services.anthropic.key' => '',
            'services.ai.provider' => 'gemini', 'services.gemini.key' => '']);
        Http::preventStrayRequests(); // test tidak boleh memanggil API sungguhan
    }

    private function geminiFacts(): array
    {
        return ['omzet_teks' => 'Rp1.250.000', 'perubahan_omzet_teks' => '+12,5%'];
    }

    public function test_gemini_summary_is_parsed(): void
    {
        config(['services.gemini.key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [[
            'finishReason' => 'STOP',
            'content' => ['parts' => [['text' => json_encode([
                'temuan' => ['Omzet kamu Rp1.250.000, naik +12,5%.'], 'saran' => ['Pertahankan menu andalan.'],
            ])]]],
        ]]])]);

        $out = (fn () => $this->callModel(['omzet_teks' => 'Rp1.250.000'], null))->call(app(AiSummaryService::class));
        $this->assertSame(['Omzet kamu Rp1.250.000, naik +12,5%.'], $out['temuan']);
        Http::assertSent(fn ($req) => $req->hasHeader('x-goog-api-key', 'test-key')
            && $req['generationConfig']['thinkingConfig']['thinkingBudget'] === 0
            && ! str_contains($req->url(), 'key='));
    }

    public function test_gemini_truncated_answer_is_treated_as_failure(): void
    {
        config(['services.gemini.key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [[
            'finishReason' => 'MAX_TOKENS', 'content' => ['parts' => [['text' => '{"temuan": ["Omzet']]],
        ]]])]);

        $facts = $this->geminiFacts();
        $this->expectExceptionMessage('MAX_TOKENS');
        (fn () => $this->callModel($facts, null))->call(app(AiSummaryService::class));
    }

    private function cleanResponse(array $dates, ?string $kode = 'TRX1'): array
    {
        $n = count($dates);

        return [
            'baris' => [
                'tanggal' => $dates,
                'jam' => array_fill(0, $n, '08:15'),
                'id_transaksi' => array_fill(0, $n, $kode),
                'nama_produk' => array_fill(0, $n, 'Kopi Susu'),
                'kategori' => array_fill(0, $n, 'Minuman'),
                'jumlah' => array_fill(0, $n, 2),
                'harga_satuan' => array_fill(0, $n, 18000),
                'hash' => array_map(fn ($i) => sha1((string) $i.$dates[$i]), array_keys($dates)),
            ],
            'ditolak' => [['baris' => 5, 'alasan' => 'Tanggal kosong atau tidak valid']],
            'ringkasan' => [
                'jumlah_baris_valid' => $n, 'jumlah_baris_ditolak' => 1,
                'alasan_ditolak' => ['Tanggal kosong atau tidak valid' => 1],
                'duplikat_dihapus' => 0, 'tanggal_mulai' => min($dates), 'tanggal_selesai' => max($dates),
                'punya_jam' => true, 'punya_id_transaksi' => $kode !== null,
            ],
        ];
    }

    private function fakeAnalytics(array $clean, array $missing = []): void
    {
        Http::fake([
            'analytics.test/inspect' => Http::response([
                'kolom' => ['tanggal', 'nama_produk', 'jumlah', 'harga_satuan'], 'pratinjau' => [],
                'pemetaan' => ['tanggal' => 'tanggal', 'jam' => null, 'id_transaksi' => null, 'nama_produk' => 'nama_produk',
                    'kategori' => null, 'jumlah' => 'jumlah', 'harga_satuan' => 'harga_satuan'],
                'kolom_wajib_kurang' => $missing, 'jumlah_baris' => 3,
                'tanggal_mulai' => $clean['ringkasan']['tanggal_mulai'], 'tanggal_selesai' => $clean['ringkasan']['tanggal_selesai'],
            ]),
            'analytics.test/clean' => Http::response($clean),
        ]);
    }

    public function test_non_csv_xlsx_file_is_rejected(): void
    {
        $user = User::factory()->withBusiness()->create();
        $this->actingAs($user)->post('/data', ['file' => UploadedFile::fake()->create('data.pdf', 10)])
            ->assertSessionHasErrors(['file' => 'Format file tidak didukung. Gunakan file .xlsx atau .csv.']);
        $this->assertSame(0, Upload::count());
    }

    public function test_upload_imports_valid_rows_and_reports_rejected(): void
    {
        $user = User::factory()->withBusiness()->create();
        $this->fakeAnalytics($this->cleanResponse(['2026-10-01', '2026-10-02']));

        $res = $this->actingAs($user)->post('/data', ['file' => UploadedFile::fake()->createWithContent('jual.csv', "a,b\n1,2\n")]);
        $upload = Upload::first();
        $res->assertRedirect(route('data.show', $upload->id));

        $upload->refresh();
        $this->assertSame('selesai', $upload->status); // queue sync di test
        $this->assertSame(2, $upload->jumlah_baris_valid);
        $this->assertSame(1, $upload->jumlah_baris_ditolak);
        $this->assertSame(2, DB::table('transactions')->where('business_id', $user->business->id)->count());

        $this->get(route('data.show', $upload->id))->assertSee('Baris yang dilewati')->assertSee('Tanggal kosong atau tidak valid');
    }

    public function test_unknown_columns_redirect_to_mapping(): void
    {
        $user = User::factory()->withBusiness()->create();
        $this->fakeAnalytics($this->cleanResponse(['2026-10-01']), ['tanggal']);
        $this->actingAs($user)->post('/data', ['file' => UploadedFile::fake()->createWithContent('x.csv', "a\n1\n")])
            ->assertRedirect(route('data.mapping', Upload::first()->id));
    }

    public function test_overlapping_upload_asks_replace_or_merge(): void
    {
        $user = User::factory()->withBusiness('pro')->create();
        $this->fakeAnalytics($this->cleanResponse(['2026-10-01', '2026-10-02']));
        $this->actingAs($user)->post('/data', ['file' => UploadedFile::fake()->createWithContent('a.csv', "a\n")]);

        $res = $this->post('/data', ['file' => UploadedFile::fake()->createWithContent('b.csv', "a\n")]);
        $second = Upload::latest('id')->first();
        $res->assertRedirect(route('data.conflict', $second->id));
        $this->assertSame('konflik', $second->status);
        $this->get(route('data.conflict', $second->id))->assertSee('Ganti data lama')->assertSee('Gabungkan');

        // Pilih "ganti": data lama di rentang itu diganti.
        $this->post(route('data.conflict.simpan', $second->id), ['mode' => 'ganti']);
        $this->assertSame(2, DB::table('transactions')->count());
        $this->assertSame(0, DB::table('transactions')->where('upload_id', Upload::first()->id)->count());
    }

    public function test_free_plan_limited_to_one_upload_per_month(): void
    {
        $user = User::factory()->withBusiness()->create();
        $this->fakeAnalytics($this->cleanResponse(['2026-10-01']));
        $this->actingAs($user)->post('/data', ['file' => UploadedFile::fake()->createWithContent('a.csv', "a\n")]);
        $this->post('/data', ['file' => UploadedFile::fake()->createWithContent('b.csv', "a\n")])->assertSessionHasErrors('file');
    }

    public function test_user_cannot_access_another_users_data(): void
    {
        $owner = User::factory()->withBusiness()->create();
        $other = User::factory()->withBusiness()->create();
        $this->fakeAnalytics($this->cleanResponse(['2026-10-01']));
        $this->actingAs($owner)->post('/data', ['file' => UploadedFile::fake()->createWithContent('a.csv', "a\n")]);
        $upload = Upload::first();

        $this->actingAs($other);
        $this->get(route('data.show', $upload->id))->assertNotFound();
        $this->get(route('data.status', $upload->id))->assertNotFound();
        $this->delete(route('data.hapus', $upload->id))->assertNotFound();
        $this->assertDatabaseHas('uploads', ['id' => $upload->id]);

        // Query analisis untuk pengguna lain tidak mengembalikan baris milik pemilik.
        $rows = app(\App\Services\AnalysisService::class)->rows($other->business, '2026-01-01', '2026-12-31');
        $this->assertSame([], $rows['tanggal']);
        $rowsOwner = app(\App\Services\AnalysisService::class)->rows($owner->business, '2026-01-01', '2026-12-31');
        $this->assertCount(1, $rowsOwner['tanggal']);
    }

    public function test_pro_pages_blocked_for_free_plan(): void
    {
        $user = User::factory()->withBusiness()->create();
        $this->actingAs($user)->get('/bundling')->assertForbidden()->assertSee('Halaman ini ada di paket Pro');
        $this->get('/menu')->assertForbidden();
        $this->get('/laporan')->assertForbidden();
    }

    public function test_dashboard_shows_when_ai_fails(): void
    {
        $user = User::factory()->withBusiness('pro')->create();
        $this->fakeAnalytics($this->cleanResponse(['2026-10-01']));
        $this->actingAs($user)->post('/data', ['file' => UploadedFile::fake()->createWithContent('a.csv', "a\n")]);

        $dashboard = ['periode' => [], 'ringkasan' => ['omzet' => 36000, 'transaksi' => 1, 'rata_rata_transaksi' => 36000, 'unit_terjual' => 2,
            'produk_terlaris' => ['nama' => 'Kopi Susu', 'unit' => 2, 'omzet' => 36000]], 'ringkasan_lalu' => [],
            'perubahan' => ['omzet' => null, 'transaksi' => null, 'rata_rata_transaksi' => null, 'produk_terlaris_unit' => null],
            'tren' => ['granularitas' => 'harian', 'label' => ['1 Okt'], 'omzet' => [36000], 'transaksi' => [1]], 'hari_berdata' => 1];
        Http::fake(['analytics.test/analyze' => Http::response([
            'dashboard' => $dashboard,
            'produk' => ['produk' => [], 'jumlah_label' => ['Naik' => 0, 'Stabil' => 0, 'Turun' => 0, 'Produk Baru' => 0, 'Tanpa label' => 0], 'naik_teratas' => [], 'turun_teratas' => [], 'baru' => []],
            'waktu' => ['kosong' => true], 'bundling' => ['status' => 'kosong', 'aturan' => [], 'pesan' => ''], 'menu' => ['status' => 'kosong', 'produk' => [], 'belum_lengkap' => [], 'pesan' => ''],
        ])]);

        $this->get('/dashboard?periode=7')->assertOk()->assertSee('Rp36.000')->assertSee('Menyusun ringkasan');
        // API AI tidak dikonfigurasi / gagal → status gagal, UI menampilkan "Ringkasan belum tersedia".
        $this->getJson('/dashboard/ringkasan-ai?periode=7')->assertOk()->assertJson(['status' => 'gagal']);
        $this->assertDatabaseHas('error_logs', ['jenis' => 'ai']);
    }

    public function test_ai_number_guard_rejects_invented_numbers(): void
    {
        $ai = app(AiSummaryService::class);
        $facts = ['omzet_teks' => 'Rp1.250.000', 'perubahan_omzet_teks' => '+12,5%', 'waktu_tersibuk' => ['Sabtu jam 08.00–09.00'],
            'produk_terlaris' => ['nama' => 'Kopi', 'unit_teks' => '120 unit']];
        $allowed = $ai->allowedNumbers($facts);

        $ok = ['temuan' => ['Omzet kamu Rp1.250.000, naik +12,5%.', 'Kopi terjual 120 unit, paling ramai Sabtu jam 08.00–09.00.'], 'saran' => ['Tambah stok kopi.']];
        $this->assertSame([], $ai->foreignNumbers($ok, $allowed));

        $bad = ['temuan' => ['Omzet kamu Rp1.300.000 dan naik 15%.'], 'saran' => ['Diskon 20% di jam sepi.']];
        $this->assertEqualsCanonicalizing(['1300000', '15', '20'], $ai->foreignNumbers($bad, $allowed));
    }

    public function test_ai_facts_contain_only_aggregates(): void
    {
        $ai = app(AiSummaryService::class);
        $facts = $ai->buildFacts([
            'dashboard' => ['ringkasan' => ['omzet' => 1000, 'transaksi' => 2, 'rata_rata_transaksi' => 500, 'produk_terlaris' => null],
                'perubahan' => ['omzet' => 10.0, 'transaksi' => null, 'rata_rata_transaksi' => null]],
            'produk' => ['naik_teratas' => [], 'turun_teratas' => [], 'baru' => []],
        ], Period::make('2026-10-01', '2026-10-07'));
        $json = json_encode($facts);
        $this->assertStringNotContainsString('TRX', $json);
        $this->assertArrayNotHasKey('baris', $facts);
        $this->assertSame('Rp1.000', $facts['omzet_teks']);
    }

    public function test_import_service_merge_skips_duplicate_rows(): void
    {
        $user = User::factory()->withBusiness('pro')->create();
        $clean = $this->cleanResponse(['2026-10-01', '2026-10-02']);
        $this->fakeAnalytics($clean);
        $this->actingAs($user)->post('/data', ['file' => UploadedFile::fake()->createWithContent('a.csv', "a\n")]);

        $this->post('/data', ['file' => UploadedFile::fake()->createWithContent('b.csv', "a\n")]);
        $second = Upload::latest('id')->first();
        $this->post(route('data.conflict.simpan', $second->id), ['mode' => 'gabung']);
        $second->refresh();
        $this->assertSame('selesai', $second->status);
        $this->assertSame(0, $second->jumlah_baris_valid); // semua baris sudah ada
        $this->assertSame(2, DB::table('transaction_items')->count());
    }
}
