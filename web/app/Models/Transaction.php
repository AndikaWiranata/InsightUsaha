<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transaction extends Model
{
    public $timestamps = false;

    protected $fillable = ['business_id', 'upload_id', 'urutan', 'kode_transaksi', 'punya_kode', 'waktu', 'punya_jam'];

    protected function casts(): array
    {
        return ['waktu' => 'datetime', 'punya_kode' => 'boolean', 'punya_jam' => 'boolean'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }
}
