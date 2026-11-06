<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Business extends Model
{
    use HasFactory;

    public const JENIS_USAHA = [
        'Kedai kopi', 'Warung makan', 'Restoran', 'Kafe', 'Bakery / kue', 'Minuman', 'Katering', 'Lainnya',
    ];

    protected $fillable = ['user_id', 'nama_usaha', 'kota', 'jenis_usaha', 'jam_buka', 'jam_tutup',
        'onboarding_selesai', 'pengaturan'];

    protected function casts(): array
    {
        return ['onboarding_selesai' => 'boolean', 'pengaturan' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function uploads(): HasMany
    {
        return $this->hasMany(Upload::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function analysisResults(): HasMany
    {
        return $this->hasMany(AnalysisResult::class);
    }

    public function aiSummaries(): HasMany
    {
        return $this->hasMany(AiSummary::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /** Setiap usaha punya satu baris langganan yang diperbarui (lihat PaymentService). */
    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    public function latestDataDate(): ?string
    {
        $max = $this->transactions()->max('waktu');

        return $max ? substr((string) $max, 0, 10) : null;
    }

    public function isPro(): bool
    {
        $s = $this->subscription;

        return $s !== null && $s->paket === 'pro' && $s->status === 'aktif'
            && ($s->berakhir === null || $s->berakhir->isFuture());
    }

    public function paket(): string
    {
        return $this->isPro() ? 'pro' : 'gratis';
    }

    /** Versi data naik setiap ada impor/hapus data, dipakai untuk membatalkan cache analisis. */
    public function dataVersion(): int
    {
        return (int) ($this->pengaturan['versi_data'] ?? 0);
    }

    public function bumpDataVersion(): void
    {
        $p = $this->pengaturan ?? [];
        $p['versi_data'] = ((int) ($p['versi_data'] ?? 0)) + 1;
        $this->pengaturan = $p;
        $this->save();
    }

    public function aprioriSettings(): array
    {
        return [
            'min_support' => (float) ($this->pengaturan['min_support'] ?? 0.01),
            'min_confidence' => (float) ($this->pengaturan['min_confidence'] ?? 0.30),
        ];
    }
}
