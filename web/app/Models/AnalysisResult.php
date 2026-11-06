<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnalysisResult extends Model
{
    protected $fillable = ['business_id', 'jenis', 'periode_mulai', 'periode_selesai', 'parameter_hash',
        'versi_data', 'hasil_json'];

    protected function casts(): array
    {
        return ['hasil_json' => 'array', 'periode_mulai' => 'date', 'periode_selesai' => 'date'];
    }
}
