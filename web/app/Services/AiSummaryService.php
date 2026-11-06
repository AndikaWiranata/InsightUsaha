<?php

namespace App\Services;

use Anthropic\Client;
use App\Models\AiSummary;
use App\Models\Business;
use App\Models\ErrorLog;
use Illuminate\Support\Facades\Http;

/**
 * F8 Ringkasan & saran AI.
 *
 * - Hanya HASIL AGREGAT yang dikirim ke API LLM (lihat buildFacts()), tidak pernah baris transaksi.
 * - Setiap angka di keluaran model divalidasi terhadap angka di fakta; jika ada angka asing,
 *   ringkasan ditolak (dicoba ulang sekali, lalu dianggap gagal).
 * - Ringkasan disimpan per periode + versi data, sehingga tidak dibuat ulang setiap halaman dibuka.
 */
class AiSummaryService
{
    private const SYSTEM = <<<'TXT'
Kamu adalah asisten analis untuk pemilik UMKM kuliner di Indonesia. Tugasmu menulis ringkasan singkat
dari hasil analisis penjualan yang diberikan dalam bentuk JSON "fakta".

Aturan wajib:
- Tulis dalam bahasa Indonesia santai yang mudah dipahami pemilik warung/kedai, sapa dengan "kamu".
- Berikan 3 sampai 5 temuan utama dan tepat 3 saran tindakan yang konkret dan bisa langsung dilakukan.
- Total maksimal sekitar 150 kata.
- SETIAP angka yang kamu tulis HARUS disalin persis dari nilai teks di fakta (field yang berakhiran "_teks"
  atau nama hari/jam). Jangan menghitung, membulatkan, menjumlahkan, atau mengarang angka baru.
  Jangan menulis angka urutan seperti "pertama/kedua" dalam bentuk digit. Jika ragu, tulis tanpa angka.
- Jangan menyebut data yang tidak ada di fakta. Jika suatu bagian kosong, abaikan saja.
TXT;

    public function provider(): string
    {
        return config('services.ai.provider') === 'anthropic' ? 'anthropic' : 'gemini';
    }

    public function enabled(): bool
    {
        return (string) config('services.'.$this->provider().'.key') !== '';
    }

    public function periodKey(Period $period): string
    {
        return $period->key();
    }

    public function find(Business $business, Period $period): ?AiSummary
    {
        $s = AiSummary::where('business_id', $business->id)->where('periode', $period->key())->first();

        return $s && $s->versi_data === $business->dataVersion() ? $s : null;
    }

    /** Ambil ringkasan dari cache, atau buat baru. Tidak pernah melempar exception. */
    public function getOrCreate(Business $business, Period $period, array $results): AiSummary
    {
        $existing = $this->find($business, $period);
        if ($existing && $existing->status === 'ok') {
            return $existing;
        }

        $facts = $this->buildFacts($results, $period);
        $summary = AiSummary::firstOrNew(['business_id' => $business->id, 'periode' => $period->key()]);
        $summary->versi_data = $business->dataVersion();

        if (($results['dashboard']['ringkasan']['transaksi'] ?? 0) === 0) {
            $summary->fill(['status' => 'gagal', 'isi' => null, 'isi_json' => null])->save();

            return $summary;
        }

        if (! $this->enabled()) {
            $summary->fill(['status' => 'gagal', 'isi' => null, 'isi_json' => null])->save();
            ErrorLog::catat('ai', 'API key untuk penyedia AI "'.$this->provider().'" belum diatur.', $business->id);

            return $summary;
        }

        $allowed = $this->allowedNumbers($facts);
        $error = null;
        for ($attempt = 1; $attempt <= 2; $attempt++) {
            try {
                $out = $this->callModel($facts, $error);
                $bad = $this->foreignNumbers($out, $allowed);
                if ($bad === []) {
                    $summary->fill([
                        'status' => 'ok',
                        'isi_json' => $out,
                        'isi' => $this->toText($out),
                        'umpan_balik' => $summary->exists && $summary->status === 'ok' ? $summary->umpan_balik : null,
                    ])->save();

                    return $summary;
                }
                $error = 'Angka berikut tidak ada di fakta: '.implode(', ', $bad).'. Tulis ulang tanpa angka tersebut.';
                ErrorLog::catat('ai', 'Ringkasan AI ditolak karena angka tidak sesuai fakta: '.implode(', ', $bad),
                    $business->id, ['percobaan' => $attempt, 'periode' => $period->key()]);
            } catch (\Throwable $e) {
                ErrorLog::catat('ai', 'Gagal memanggil API AI: '.$e->getMessage(), $business->id,
                    ['percobaan' => $attempt, 'periode' => $period->key()]);
                break;
            }
        }

        $summary->fill(['status' => 'gagal', 'isi' => null, 'isi_json' => null])->save();

        return $summary;
    }

    /** @return array{temuan: list<string>, saran: list<string>} */
    protected function callModel(array $facts, ?string $correction): array
    {
        $prompt = "Berikut fakta hasil analisis penjualan (JSON):\n\n"
            .json_encode($facts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
            ."\n\nTulis temuan utama dan saran tindakan sesuai aturan.";
        if ($correction) {
            $prompt .= "\n\nPerbaikan dari percobaan sebelumnya: ".$correction;
        }

        $text = $this->provider() === 'anthropic' ? $this->callAnthropic($prompt) : $this->callGemini($prompt);

        return $this->parseOutput($text);
    }

    /** Google Gemini (REST generateContent) dengan keluaran JSON terstruktur. */
    private function callGemini(string $prompt): string
    {
        $model = (string) config('services.gemini.model');
        $response = Http::withHeaders(['x-goog-api-key' => (string) config('services.gemini.key')])
            ->acceptJson()
            ->timeout(60)
            ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                'systemInstruction' => ['parts' => [['text' => self::SYSTEM]]],
                'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                'generationConfig' => [
                    'temperature' => 0.4,
                    // Token "berpikir" Gemini 2.5 ikut dihitung di batas output; tugas ini hanya merangkum
                    // angka yang sudah jadi, jadi mode berpikir dimatikan (lebih cepat & tidak terpotong).
                    'maxOutputTokens' => 8192,
                    'thinkingConfig' => ['thinkingBudget' => 0],
                    'responseMimeType' => 'application/json',
                    'responseSchema' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'temuan' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                            'saran' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                        ],
                        'required' => ['temuan', 'saran'],
                    ],
                ],
            ]);

        if (! $response->successful()) {
            // Jangan mencatat URL/header agar API key tidak masuk log.
            throw new \RuntimeException('Gemini HTTP '.$response->status().': '
                .mb_substr((string) $response->json('error.message', ''), 0, 300));
        }
        if ($block = $response->json('promptFeedback.blockReason')) {
            throw new \RuntimeException('Gemini memblokir permintaan: '.$block);
        }
        $finish = $response->json('candidates.0.finishReason');
        if ($finish !== null && $finish !== 'STOP') {
            throw new \RuntimeException('Gemini berhenti tidak normal: '.$finish);
        }
        $text = '';
        foreach ($response->json('candidates.0.content.parts', []) as $part) {
            if (empty($part['thought']) && isset($part['text'])) {
                $text .= $part['text'];
            }
        }

        return $text;
    }

    /** Anthropic Claude (alternatif, AI_PROVIDER=anthropic). */
    private function callAnthropic(string $prompt): string
    {
        $client = new Client(apiKey: (string) config('services.anthropic.key'));

        $message = $client->beta->messages->create(
            model: (string) config('services.anthropic.model'),
            maxTokens: 4000,
            system: self::SYSTEM,
            messages: [['role' => 'user', 'content' => $prompt]],
            outputConfig: [
                'effort' => 'low',
                'format' => [
                    'type' => 'json_schema',
                    'schema' => [
                        'type' => 'object',
                        'properties' => [
                            'temuan' => ['type' => 'array', 'items' => ['type' => 'string']],
                            'saran' => ['type' => 'array', 'items' => ['type' => 'string']],
                        ],
                        'required' => ['temuan', 'saran'],
                        'additionalProperties' => false,
                    ],
                ],
            ],
            // Jika model utama menolak (refusal), API mengalihkan ke model cadangan secara otomatis.
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );

        if ($message->stopReason === 'refusal') {
            throw new \RuntimeException('Model menolak membuat ringkasan.');
        }
        $text = '';
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }

        return $text;
    }

    /** @return array{temuan: list<string>, saran: list<string>} */
    private function parseOutput(string $text): array
    {
        $data = json_decode($text, true);
        if (! is_array($data) || ! isset($data['temuan'], $data['saran'])) {
            throw new \RuntimeException('Format jawaban AI tidak valid.');
        }
        $clean = fn ($list) => array_values(array_filter(array_map(
            fn ($s) => trim((string) $s), is_array($list) ? $list : []), fn ($s) => $s !== ''));
        $temuan = array_slice($clean($data['temuan']), 0, 5);
        $saran = array_slice($clean($data['saran']), 0, 3);
        if (count($temuan) < 1 || count($saran) < 1) {
            throw new \RuntimeException('Jawaban AI kosong.');
        }

        return ['temuan' => $temuan, 'saran' => $saran];
    }

    private function toText(array $out): string
    {
        return "Temuan utama:\n- ".implode("\n- ", $out['temuan'])."\n\nSaran:\n- ".implode("\n- ", $out['saran']);
    }

    /**
     * Fakta agregat yang dikirim ke LLM. Tidak berisi baris transaksi, nama pelanggan, atau ID.
     * Setiap angka disertakan sebagai teks siap pakai agar model cukup menyalinnya.
     */
    public function buildFacts(array $r, Period $period): array
    {
        $d = $r['dashboard'] ?? [];
        $s = $d['ringkasan'] ?? [];
        $c = $d['perubahan'] ?? [];
        $facts = [
            'periode' => $period->label(),
            'periode_pembanding' => $period->previousLabel(),
            'omzet_teks' => Format::rupiah($s['omzet'] ?? 0),
            'perubahan_omzet_teks' => $c['omzet'] !== null ? Format::percent($c['omzet']) : 'tidak ada data pembanding',
            'jumlah_transaksi_teks' => Format::number($s['transaksi'] ?? 0),
            'perubahan_transaksi_teks' => $c['transaksi'] !== null ? Format::percent($c['transaksi']) : 'tidak ada data pembanding',
            'rata_rata_nilai_transaksi_teks' => Format::rupiah($s['rata_rata_transaksi'] ?? 0),
            'produk_terlaris' => $s['produk_terlaris'] ? [
                'nama' => $s['produk_terlaris']['nama'],
                'unit_teks' => Format::number($s['produk_terlaris']['unit']).' unit',
            ] : null,
        ];

        $p = $r['produk'] ?? [];
        $map = fn ($i) => ['nama' => $i['nama'], 'perubahan_teks' => Format::percent($i['perubahan']),
            'unit_teks' => Format::number($i['unit']).' unit'];
        $facts['produk_naik'] = array_map($map, array_slice($p['naik_teratas'] ?? [], 0, 3));
        $facts['produk_turun'] = array_map($map, array_slice($p['turun_teratas'] ?? [], 0, 3));
        $facts['produk_baru'] = array_map(fn ($i) => ['nama' => $i['nama'], 'unit_teks' => Format::number($i['unit']).' unit'],
            array_slice($p['baru'] ?? [], 0, 3));

        if (isset($r['waktu']) && ! ($r['waktu']['kosong'] ?? true)) {
            $slot = fn ($x) => trim($x['hari'].' '.($x['jam'] ? 'jam '.$x['jam'] : ''));
            $facts['waktu_tersibuk'] = array_map($slot, $r['waktu']['tersibuk'] ?? []);
            $facts['waktu_tersepi'] = array_map($slot, $r['waktu']['tersepi'] ?? []);
        }

        if (($r['bundling']['status'] ?? null) === 'ok') {
            $facts['pasangan_produk'] = array_map(fn ($a) => ['kalimat' => $a['kalimat']],
                array_slice($r['bundling']['aturan'], 0, 3));
        }

        if (($r['menu']['status'] ?? null) === 'ok') {
            $groups = [];
            foreach ($r['menu']['produk'] as $m) {
                $groups[$m['kategori']][] = $m['nama'];
            }
            $facts['klasifikasi_menu'] = array_map(fn ($names) => array_slice($names, 0, 3), $groups);
        }

        return $facts;
    }

    /** @return array<string,true> nilai angka yang diizinkan (dinormalisasi) */
    public function allowedNumbers(array $facts): array
    {
        $allowed = [];
        array_walk_recursive($facts, function ($v) use (&$allowed) {
            if (is_string($v)) {
                foreach ($this->extractNumbers($v) as $n) {
                    $allowed[$n] = true;
                }
            }
        });

        return $allowed;
    }

    /** @return list<string> angka di keluaran yang tidak berasal dari fakta */
    public function foreignNumbers(array $out, array $allowed): array
    {
        $bad = [];
        foreach (array_merge($out['temuan'] ?? [], $out['saran'] ?? []) as $line) {
            foreach ($this->extractNumbers($line) as $n) {
                if (! isset($allowed[$n])) {
                    $bad[$n] = true;
                }
            }
        }

        return array_keys($bad);
    }

    /**
     * Mengambil angka dari teks berformat Indonesia ("Rp1.250.000", "12,5%", "08.00–09.00", "1.234")
     * dan mengembalikannya dalam bentuk ternormalisasi ("1250000", "12.5", "8").
     *
     * @return list<string>
     */
    public function extractNumbers(string $text): array
    {
        preg_match_all('/\d+(?:[.,]\d+)*/u', $text, $m);
        $out = [];
        foreach ($m[0] as $tok) {
            if (preg_match('/^\d{1,3}(\.\d{3})+(,\d+)?$/', $tok)) {        // 1.250.000 atau 1.250,5
                $n = (float) str_replace(['.', ','], ['', '.'], $tok);
            } elseif (preg_match('/^\d{1,2}\.\d{2}$/', $tok)) {             // jam 08.00
                $n = (float) explode('.', $tok)[0];
                $out[] = $this->norm((float) explode('.', $tok)[1]);
            } elseif (preg_match('/^\d+,\d+$/', $tok)) {                    // 12,5
                $n = (float) str_replace(',', '.', $tok);
            } else {
                $n = (float) str_replace(',', '', $tok);
            }
            $out[] = $this->norm($n);
        }

        return $out;
    }

    private function norm(float $n): string
    {
        return rtrim(rtrim(number_format($n, 4, '.', ''), '0'), '.');
    }

    public function feedback(Business $business, string $periodKey, string $value): bool
    {
        if (! in_array($value, ['membantu', 'tidak_membantu'], true)) {
            return false;
        }

        return AiSummary::where('business_id', $business->id)->where('periode', $periodKey)
            ->where('status', 'ok')->update(['umpan_balik' => $value]) > 0;
    }
}
