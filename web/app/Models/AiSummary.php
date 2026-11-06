<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiSummary extends Model
{
    protected $fillable = ['business_id', 'periode', 'versi_data', 'isi', 'isi_json', 'status', 'umpan_balik'];

    protected function casts(): array
    {
        return ['isi_json' => 'array'];
    }
}
