<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ErrorLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['business_id', 'jenis', 'pesan', 'konteks'];

    protected function casts(): array
    {
        return ['konteks' => 'array'];
    }

    public static function catat(string $jenis, string $pesan, ?int $businessId = null, array $konteks = []): void
    {
        try {
            static::create(['business_id' => $businessId, 'jenis' => $jenis, 'pesan' => mb_substr($pesan, 0, 2000),
                'konteks' => $konteks]);
        } catch (\Throwable) {
            // Log error tidak boleh membuat proses utama gagal.
        }
    }
}
