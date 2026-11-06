<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordId extends ResetPassword
{
    protected function buildMailMessage($url): MailMessage
    {
        return (new MailMessage)
            ->subject('Atur ulang kata sandi InsightUsaha')
            ->greeting('Halo!')
            ->line('Kami menerima permintaan untuk mengatur ulang kata sandi akun kamu.')
            ->action('Atur ulang kata sandi', $url)
            ->line('Tautan ini berlaku selama '.config('auth.passwords.users.expire').' menit.')
            ->line('Jika kamu tidak meminta ini, abaikan email ini.');
    }
}
