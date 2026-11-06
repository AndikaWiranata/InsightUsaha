<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

class VerifyEmailId extends VerifyEmail
{
    protected function buildMailMessage($url): MailMessage
    {
        return (new MailMessage)
            ->subject('Verifikasi email InsightUsaha')
            ->greeting('Halo!')
            ->line('Klik tombol di bawah untuk memverifikasi alamat email kamu.')
            ->action('Verifikasi email', $url)
            ->line('Jika kamu tidak mendaftar di InsightUsaha, abaikan email ini.');
    }
}
