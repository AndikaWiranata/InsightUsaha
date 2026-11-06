<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ChatService;
use App\Services\Period;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Chatbot "Tanya data". */
class ChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.analytics.url' => 'http://analytics.test', 'services.gemini.key' => 'test-key',
            'services.gemini.model' => 'gemini-2.5-flash']);
        Http::preventStrayRequests();
    }

    private function results(): array
    {
        return [
            'dashboard' => ['ringkasan' => ['omzet' => 90237000, 'transaksi' => 3001, 'rata_rata_transaksi' => 30069,
                'produk_terlaris' => ['nama' => 'Kopi Susu', 'unit' => 1509, 'omzet' => 1]],
                'perubahan' => ['omzet' => -0.1, 'transaksi' => -3.3, 'rata_rata_transaksi' => 3.3]],
            'produk' => ['produk' => [['nama' => 'Kopi Susu', 'unit' => 1509, 'unit_lalu' => 1527, 'omzet' => 27162000,
                'perubahan' => -1.2, 'label' => 'Stabil']], 'naik_teratas' => [], 'turun_teratas' => [], 'baru' => []],
        ];
    }

    private function gemini(string $text): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(['candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [['text' => $text]]]]]])
            ->push(['candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [['text' => $text]]]]]])]);
    }

    public function test_answer_with_numbers_from_facts_is_accepted(): void
    {
        $this->gemini('Omzet kamu Rp90.237.000 dengan 3.001 transaksi. Menu terlaris Kopi Susu, 1.509 unit.');
        $user = User::factory()->withBusiness()->create();
        $res = app(ChatService::class)->answer($user->business, Period::make('2026-10-02', '2026-10-31'), $this->results(), [], 'Berapa omzetku?');

        $this->assertSame('ok', $res['status']);
        Http::assertSent(function ($req) {
            $body = json_encode($req->data());

            // Hanya agregat: tidak ada baris transaksi / kode transaksi; key lewat header, bukan URL.
            return $req->hasHeader('x-goog-api-key', 'test-key') && ! str_contains($req->url(), 'key=')
                && str_contains($body, 'Rp90.237.000') && ! str_contains($body, 'TRX');
        });
    }

    public function test_answer_with_invented_number_is_rejected_after_retry(): void
    {
        $this->gemini('Omzet kamu kira-kira Rp95.000.000, naik 12%.');
        $user = User::factory()->withBusiness()->create();
        $res = app(ChatService::class)->answer($user->business, Period::make('2026-10-02', '2026-10-31'), $this->results(), [], 'Berapa omzetku?');

        $this->assertSame('ditolak', $res['status']);
        $this->assertNull($res['jawaban']);
        Http::assertSentCount(2);
        $this->assertDatabaseHas('error_logs', ['jenis' => 'ai']);
    }

    public function test_numbers_from_users_question_may_be_repeated(): void
    {
        $this->gemini('Target Rp100.000.000 belum tercapai, omzetmu Rp90.237.000.');
        $user = User::factory()->withBusiness()->create();
        $res = app(ChatService::class)->answer($user->business, Period::make('2026-10-02', '2026-10-31'), $this->results(), [],
            'Apakah target Rp100.000.000 tercapai?');
        $this->assertSame('ok', $res['status']);
    }

    public function test_chat_endpoint_requires_login_and_stores_history_per_business(): void
    {
        $this->postJson('/tanya', ['pesan' => 'halo'])->assertUnauthorized();

        $user = User::factory()->withBusiness()->create();
        $this->actingAs($user)->postJson('/tanya', ['pesan' => 'Menu apa yang laris?'])
            ->assertOk()->assertJson(['status' => 'tanpa_data']);

        $this->getJson('/tanya')->assertOk()->assertJson(['aktif' => true, 'punya_data' => false, 'pesan' => []]);
        $this->postJson('/tanya', ['pesan' => ''])->assertStatus(422);
    }

    public function test_chat_endpoint_answers_from_analysis(): void
    {
        $user = User::factory()->withBusiness()->create();
        $upload = $user->business->uploads()->create(['nama_file' => 'a.csv', 'status' => 'selesai', 'dibuat_pada' => now()]);
        DB::table('transactions')->insert(['business_id' => $user->business->id, 'upload_id' => $upload->id, 'waktu' => '2026-10-10 08:00:00']);

        Http::fake([
            'analytics.test/analyze' => Http::response($this->results() + ['waktu' => ['kosong' => true, 'per_hari' => []]]),
            'generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['finishReason' => 'STOP',
                'content' => ['parts' => [['text' => 'Menu terlaris kamu Kopi Susu, 1.509 unit.']]]]]]),
        ]);

        $this->actingAs($user)->postJson('/tanya', ['pesan' => 'Menu apa yang paling laku?', 'periode' => '30'])
            ->assertOk()->assertJson(['status' => 'ok', 'jawaban' => 'Menu terlaris kamu Kopi Susu, 1.509 unit.']);
        $this->getJson('/tanya')->assertJsonCount(2, 'pesan');
        $this->deleteJson('/tanya')->assertOk();
        $this->getJson('/tanya')->assertJsonCount(0, 'pesan');
    }

    public function test_chat_disabled_without_gemini_key(): void
    {
        config(['services.gemini.key' => '']);
        $user = User::factory()->withBusiness()->create();
        $this->actingAs($user)->getJson('/tanya')->assertJson(['aktif' => false]);
    }
}
