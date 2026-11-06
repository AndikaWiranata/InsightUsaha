<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransactionItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['transaction_id', 'product_id', 'jumlah', 'harga_satuan', 'row_hash'];
}
