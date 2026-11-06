<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/** Klien HTTP ke layanan analitik FastAPI. */
class AnalyticsClient
{
    private function http(int $timeout = 120): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('services.analytics.url'), '/'))
            ->withHeaders(['X-Service-Token' => (string) config('services.analytics.token')])
            ->acceptJson()
            ->timeout($timeout);
    }

    private function send(callable $call): array
    {
        try {
            $response = $call();
        } catch (ConnectionException $e) {
            throw new RuntimeException('Layanan analitik tidak dapat dihubungi. Coba lagi beberapa saat lagi.', 0, $e);
        }
        if ($response->status() === 422) {
            $detail = $response->json('detail');
            throw new AnalyticsValidationException(is_string($detail) ? $detail : 'File tidak valid.');
        }
        try {
            $response->throw();
        } catch (RequestException $e) {
            throw new RuntimeException('Layanan analitik mengalami gangguan (HTTP '.$response->status().').', 0, $e);
        }

        return $response->json() ?? [];
    }

    public function inspect(string $absolutePath, string $fileName, ?array $mapping = null): array
    {
        return $this->send(fn () => $this->http(60)
            ->attach('file', file_get_contents($absolutePath), $fileName)
            ->post('/inspect', $mapping ? ['mapping' => json_encode($mapping)] : []));
    }

    public function clean(string $absolutePath, string $fileName, array $mapping): array
    {
        return $this->send(fn () => $this->http(180)
            ->attach('file', file_get_contents($absolutePath), $fileName)
            ->post('/clean', ['mapping' => json_encode($mapping)]));
    }

    public function table(string $absolutePath, string $fileName): array
    {
        return $this->send(fn () => $this->http(60)
            ->attach('file', file_get_contents($absolutePath), $fileName)
            ->post('/table'));
    }

    public function analyze(array $kinds, array $rows, array $period, array $params = []): array
    {
        return $this->send(fn () => $this->http(120)->post('/analyze', [
            'jenis' => $kinds,
            'periode' => $period,
            'baris' => $rows,
            'parameter' => (object) $params,
        ]));
    }
}
