<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;

/** Format angka & tanggal gaya Indonesia. */
class Format
{
    private const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    public static function rupiah(float|int|null $v): string
    {
        return 'Rp'.number_format((float) ($v ?? 0), 0, ',', '.');
    }

    public static function number(float|int|null $v, int $decimals = 0): string
    {
        return number_format((float) ($v ?? 0), $decimals, ',', '.');
    }

    public static function percent(?float $v, bool $sign = true): string
    {
        if ($v === null) {
            return '–';
        }
        $abs = abs($v);
        $s = number_format($abs, fmod($abs, 1.0) == 0.0 ? 0 : 1, ',', '.').'%';
        if (! $sign) {
            return $s;
        }

        return ($v > 0 ? '+' : ($v < 0 ? '−' : '')).$s;
    }

    public static function date(CarbonInterface|string|null $d): string
    {
        if ($d === null) {
            return '–';
        }
        $d = is_string($d) ? Carbon::parse($d) : $d;

        return $d->day.' '.self::BULAN[$d->month - 1].' '.$d->year;
    }
}
