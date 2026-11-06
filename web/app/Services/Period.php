<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * Periode analisis. Preset dihitung mundur dari tanggal data terakhir (bukan hari ini),
 * karena data yang diunggah UMKM sering berhenti beberapa hari sebelum tanggal unggah.
 */
class Period
{
    public const PRESETS = ['7' => '7 hari', '30' => '30 hari', '90' => '3 bulan', 'kustom' => 'Rentang kustom'];

    public function __construct(
        public readonly CarbonImmutable $start,
        public readonly CarbonImmutable $end,
        public readonly string $preset,
    ) {
    }

    public static function fromRequest(Request $request, ?string $latestDataDate, ?CarbonImmutable $minStart = null): self
    {
        $anchor = $latestDataDate ? CarbonImmutable::parse($latestDataDate) : CarbonImmutable::today();
        $preset = (string) $request->query('periode', '30');

        if ($preset === 'kustom') {
            try {
                $start = CarbonImmutable::parse((string) $request->query('mulai'))->startOfDay();
                $end = CarbonImmutable::parse((string) $request->query('selesai'))->startOfDay();
            } catch (\Throwable) {
                $start = $anchor->subDays(29)->startOfDay();
                $end = $anchor->startOfDay();
            }
            if ($end->lessThan($start)) {
                [$start, $end] = [$end, $start];
            }
            if ($start->diffInDays($end) > 366) {
                $start = $end->subDays(365);
            }
        } else {
            $days = in_array($preset, ['7', '30', '90'], true) ? (int) $preset : 30;
            $preset = (string) $days;
            $end = $anchor->startOfDay();
            $start = $end->subDays($days - 1);
        }

        if ($minStart && $start->lessThan($minStart)) {
            $start = $minStart->startOfDay();
            if ($end->lessThan($start)) {
                $end = $start;
            }
        }

        return new self($start, $end, $preset);
    }

    public static function make(string $start, string $end, string $preset = 'kustom'): self
    {
        return new self(CarbonImmutable::parse($start)->startOfDay(), CarbonImmutable::parse($end)->startOfDay(), $preset);
    }

    public function days(): int
    {
        return (int) $this->start->diffInDays($this->end) + 1;
    }

    public function previousStart(): CarbonImmutable
    {
        return $this->start->subDays($this->days());
    }

    public function previousEnd(): CarbonImmutable
    {
        return $this->start->subDay();
    }

    public function toArray(): array
    {
        return [
            'mulai' => $this->start->toDateString(),
            'selesai' => $this->end->toDateString(),
            'lalu_mulai' => $this->previousStart()->toDateString(),
            'lalu_selesai' => $this->previousEnd()->toDateString(),
        ];
    }

    public function key(): string
    {
        return $this->start->toDateString().'_'.$this->end->toDateString();
    }

    public function label(): string
    {
        return Format::date($this->start).' – '.Format::date($this->end);
    }

    public function previousLabel(): string
    {
        return Format::date($this->previousStart()).' – '.Format::date($this->previousEnd());
    }

    public function query(): array
    {
        return $this->preset === 'kustom'
            ? ['periode' => 'kustom', 'mulai' => $this->start->toDateString(), 'selesai' => $this->end->toDateString()]
            : ['periode' => $this->preset];
    }
}
