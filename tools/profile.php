<?php
// Mengukur waktu tiap tahap analisis: php tools/profile.php (dijalankan dari folder web).
require __DIR__.'/../web/vendor/autoload.php';
$app = require __DIR__.'/../web/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$biz = App\Models\Business::first();
$period = App\Services\Period::make('2026-10-02', '2026-10-31', '30');
$svc = app(App\Services\AnalysisService::class);

$t = microtime(true);
$rows = $svc->rows($biz, $period->previousStart()->toDateString(), $period->end->toDateString());
printf("ambil baris: %d baris, %.2f s\n", count($rows['tanggal']), microtime(true) - $t);

$t = microtime(true);
$res = app(App\Services\AnalyticsClient::class)->analyze(['dashboard', 'produk', 'waktu', 'bundling', 'menu'], $rows, $period->toArray(),
    ['min_support' => 0.01, 'min_confidence' => 0.3, 'hpp' => (object) []]);
printf("layanan analitik: %.2f s\n", microtime(true) - $t);
printf("omzet: %s, transaksi: %s, aturan bundling: %d\n", $res['dashboard']['ringkasan']['omzet'],
    $res['dashboard']['ringkasan']['transaksi'], count($res['bundling']['aturan']));
