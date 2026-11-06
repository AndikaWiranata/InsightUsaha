<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class MakeAdmin extends Command
{
    protected $signature = 'admin:buat {email} {--nama=Admin} {--password=}';

    protected $description = 'Buat atau jadikan pengguna sebagai admin sistem';

    public function handle(): int
    {
        $email = strtolower($this->argument('email'));
        $password = $this->option('password') ?: \Illuminate\Support\Str::password(14);
        $user = User::firstOrNew(['email' => $email]);
        $isNew = ! $user->exists;
        $user->fill(['nama' => $user->nama ?? $this->option('nama'), 'role' => 'admin']);
        if ($isNew || $this->option('password')) {
            $user->password = $password;
        }
        $user->email_verified_at ??= now();
        $user->save();

        $this->info("Admin siap: {$email}".($isNew || $this->option('password') ? " (kata sandi: {$password})" : ''));

        return self::SUCCESS;
    }
}
