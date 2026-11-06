<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    protected $fillable = ['business_id', 'nama', 'kategori', 'hpp'];

    protected function casts(): array
    {
        return ['hpp' => 'float'];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }
}
