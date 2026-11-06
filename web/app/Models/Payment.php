<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = ['subscription_id', 'jumlah', 'metode', 'status', 'ref_gateway', 'url_pembayaran',
        'payload', 'dibayar_pada'];

    protected function casts(): array
    {
        return ['payload' => 'array', 'dibayar_pada' => 'datetime'];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}
