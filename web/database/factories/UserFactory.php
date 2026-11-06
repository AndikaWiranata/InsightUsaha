<?php

namespace Database\Factories;

use App\Models\Business;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'nama' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'role' => 'owner',
            'remember_token' => Str::random(10),
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => 'admin']);
    }

    /** Pemilik usaha lengkap dengan business + langganan. */
    public function withBusiness(string $paket = 'gratis'): static
    {
        return $this->afterCreating(function (User $user) use ($paket) {
            $business = Business::create([
                'user_id' => $user->id, 'nama_usaha' => 'Usaha '.$user->id, 'jenis_usaha' => 'Kedai kopi',
                'onboarding_selesai' => true,
            ]);
            Subscription::create([
                'business_id' => $business->id, 'paket' => $paket, 'status' => 'aktif', 'mulai' => now(),
                'berakhir' => $paket === 'pro' ? now()->addMonth() : null,
            ]);
        });
    }
}
