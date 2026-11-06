<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Upload extends Model
{
    protected $fillable = ['business_id', 'nama_file', 'path', 'ukuran', 'pemetaan', 'mode', 'status', 'progres',
        'jumlah_baris_valid', 'jumlah_baris_ditolak', 'ringkasan', 'baris_ditolak', 'tanggal_mulai',
        'tanggal_selesai', 'pesan_error', 'dibuat_pada'];

    protected function casts(): array
    {
        return [
            'pemetaan' => 'array', 'ringkasan' => 'array', 'baris_ditolak' => 'array',
            'tanggal_mulai' => 'date', 'tanggal_selesai' => 'date', 'dibuat_pada' => 'datetime',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function statusLabel(): string
    {
        return [
            'menunggu' => 'Menunggu', 'diproses' => 'Diproses', 'selesai' => 'Selesai',
            'gagal' => 'Gagal', 'konflik' => 'Perlu keputusan',
        ][$this->status] ?? $this->status;
    }
}
