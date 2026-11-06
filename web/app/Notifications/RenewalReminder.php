<?php

namespace App\Notifications;

use App\Services\Format;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RenewalReminder extends Notification
{
    use Queueable;

    public function __construct(public \DateTimeInterface $endsAt)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Paket Pro InsightUsaha berakhir 3 hari lagi')
            ->greeting('Halo, '.$notifiable->nama.'!')
            ->line('Paket Pro kamu akan berakhir pada '.Format::date(\Carbon\Carbon::instance($this->endsAt)).'.')
            ->line('Perpanjang sekarang agar bundling, klasifikasi menu, ringkasan AI, dan laporan PDF tetap bisa dipakai.')
            ->action('Perpanjang langganan', route('langganan'))
            ->line('Jika tidak diperpanjang, akun turun ke paket Gratis. Data kamu tetap aman dan tidak dihapus.');
    }
}
