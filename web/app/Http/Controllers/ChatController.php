<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Services\AnalysisService;
use App\Services\ChatService;
use App\Services\Period;
use Illuminate\Http\Request;

/** Chatbot "Tanya data": tanya-jawab tentang hasil analisis periode yang sedang dibuka. */
class ChatController extends Controller
{
    public function __construct(private ChatService $chat, private AnalysisService $analysis)
    {
    }

    private function business(Request $request): Business
    {
        return $request->attributes->get('business');
    }

    private function key(Business $business): string
    {
        return 'chat.'.$business->id;
    }

    public function history(Request $request)
    {
        return response()->json([
            'aktif' => $this->chat->enabled(),
            'punya_data' => $this->analysis->hasData($this->business($request)),
            'pesan' => $request->session()->get($this->key($this->business($request)), []),
        ]);
    }

    public function send(Request $request)
    {
        $data = $request->validate([
            'pesan' => ['required', 'string', 'max:500'],
            'periode' => ['nullable', 'string', 'max:10'],
            'mulai' => ['nullable', 'date'],
            'selesai' => ['nullable', 'date'],
        ], ['pesan.required' => 'Tulis pertanyaan dulu.', 'pesan.max' => 'Pertanyaan maksimal 500 karakter.']);

        $business = $this->business($request);
        $question = trim(preg_replace('/\s+/', ' ', $data['pesan']));
        if ($question === '') {
            return response()->json(['status' => 'invalid', 'pesan' => 'Tulis pertanyaan dulu.'], 422);
        }
        if (! $this->analysis->hasData($business)) {
            return response()->json(['status' => 'tanpa_data',
                'jawaban' => 'Belum ada data penjualan. Unggah file penjualan dulu di halaman Data, nanti aku bisa menjawab.']);
        }

        // Periode mengikuti halaman yang sedang dibuka; Gratis dibatasi 3 bulan terakhir.
        $period = Period::fromRequest(new Request(array_filter([
            'periode' => $data['periode'] ?? null, 'mulai' => $data['mulai'] ?? null, 'selesai' => $data['selesai'] ?? null,
        ])), $business->latestDataDate(), $this->analysis->minStart($business));

        $kinds = $business->isPro() ? ['dashboard', 'produk', 'waktu', 'bundling', 'menu'] : ['dashboard', 'produk', 'waktu'];
        try {
            $results = $this->analysis->get($business, $period, $kinds);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['status' => 'gagal', 'jawaban' => null]);
        }

        $history = $request->session()->get($this->key($business), []);
        $res = $this->chat->answer($business, $period, $results, $history, $question);

        if ($res['status'] === 'ok') {
            $history[] = ['role' => 'user', 'text' => $question];
            $history[] = ['role' => 'bot', 'text' => $res['jawaban'], 'periode' => $period->label()];
            $request->session()->put($this->key($business), array_slice($history, -ChatService::MAX_HISTORY));
        }

        return response()->json($res + ['periode' => $period->label()]);
    }

    public function reset(Request $request)
    {
        $request->session()->forget($this->key($this->business($request)));

        return response()->json(['ok' => true]);
    }
}
