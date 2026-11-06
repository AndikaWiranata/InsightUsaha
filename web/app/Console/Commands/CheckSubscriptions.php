<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Notifications\RenewalReminder;
use App\Services\PaymentService;
use Illuminate\Console\Command;

/** Pengingat H-3 & penurunan otomatis ke paket Gratis (tanpa menghapus data). */
class CheckSubscriptions extends Command
{
    protected $signature = 'langganan:periksa';

    protected $description = 'Kirim pengingat perpanjangan H-3 dan turunkan langganan yang kedaluwarsa ke Gratis';

    public function handle(PaymentService $payments): int
    {
        $reminded = 0;
        Subscription::with('business.user')
            ->where('paket', 'pro')->where('status', 'aktif')
            ->whereNull('pengingat_dikirim_pada')
            ->whereBetween('berakhir', [now(), now()->addDays(3)])
            ->each(function (Subscription $s) use (&$reminded) {
                $s->business?->user?->notify(new RenewalReminder($s->berakhir));
                $s->update(['pengingat_dikirim_pada' => now()]);
                $reminded++;
            });

        $downgraded = 0;
        Subscription::where('paket', 'pro')->where('berakhir', '<', now())
            ->each(function (Subscription $s) use ($payments, &$downgraded) {
                $payments->downgrade($s);
                $downgraded++;
            });

        $this->info("Pengingat dikirim: {$reminded}. Diturunkan ke Gratis: {$downgraded}.");

        return self::SUCCESS;
    }
}
