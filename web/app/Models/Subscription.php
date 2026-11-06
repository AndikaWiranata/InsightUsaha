<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends Model
{
    public const HARGA_PRO = 49000;

    protected $fillable = ['business_id', 'paket', 'mulai', 'berakhir', 'status', 'pengingat_dikirim_pada'];

    protected function casts(): array
    {
        return ['mulai' => 'datetime', 'berakhir' => 'datetime', 'pengingat_dikirim_pada' => 'datetime'];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
