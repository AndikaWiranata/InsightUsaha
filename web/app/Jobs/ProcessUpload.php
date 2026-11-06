<?php

namespace App\Jobs;

use App\Models\Upload;
use App\Services\ImportService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Memproses file unggahan di latar belakang (F2). */
class ProcessUpload implements ShouldQueue
{
    use Queueable;

    public int $timeout = 300;

    public int $tries = 1;

    public function __construct(public int $uploadId)
    {
    }

    public function handle(ImportService $import): void
    {
        $upload = Upload::find($this->uploadId);
        if (! $upload || $upload->status === 'selesai') {
            return;
        }
        $import->process($upload);
    }

    public function failed(\Throwable $e): void
    {
        Upload::whereKey($this->uploadId)->update([
            'status' => 'gagal', 'progres' => 100,
            'pesan_error' => 'Proses impor terhenti. Silakan unggah ulang file.',
        ]);
    }
}
