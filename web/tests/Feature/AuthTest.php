<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** F1 Autentikasi & profil usaha. */
class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function registerPayload(array $override = []): array
    {
        return array_merge([
            'nama' => 'Rina', 'email' => 'rina@contoh.id', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123',
            'nama_usaha' => 'Kedai Rina', 'jenis_usaha' => 'Kedai kopi',
        ], $override);
    }

    public function test_register_creates_user_business_and_free_subscription(): void
    {
        Notification::fake();
        $this->post('/register', $this->registerPayload())->assertRedirect(route('verification.notice'));

        $user = User::where('email', 'rina@contoh.id')->first();
        $this->assertNotNull($user);
        $this->assertSame('Kedai Rina', $user->business->nama_usaha);
        $this->assertSame('gratis', $user->business->paket());
        $this->assertNotSame('rahasia123', $user->password); // di-hash
    }

    public function test_registered_email_is_rejected_with_clear_message(): void
    {
        User::factory()->withBusiness()->create(['email' => 'rina@contoh.id']);
        $this->post('/register', $this->registerPayload())
            ->assertSessionHasErrors(['email' => 'Email ini sudah terdaftar. Silakan masuk atau gunakan fitur lupa kata sandi.']);
    }

    public function test_password_minimum_8_characters(): void
    {
        $this->post('/register', $this->registerPayload(['password' => 'pendek', 'password_confirmation' => 'pendek']))
            ->assertSessionHasErrors('password');
    }

    public function test_guest_opening_dashboard_is_redirected_to_login(): void
    {
        foreach (['/dashboard', '/produk', '/waktu', '/data', '/bundling', '/pengaturan'] as $url) {
            $this->get($url)->assertRedirect('/login');
        }
    }

    public function test_unverified_user_is_sent_to_verification(): void
    {
        $user = User::factory()->unverified()->withBusiness()->create();
        $this->actingAs($user)->get('/dashboard')->assertRedirect(route('verification.notice'));
    }

    public function test_login_and_rate_limit(): void
    {
        $user = User::factory()->withBusiness()->create(['email' => 'budi@contoh.id']);
        $this->post('/login', ['email' => 'budi@contoh.id', 'password' => 'password'])->assertRedirect(route('dashboard'));
        $this->assertAuthenticatedAs($user);
        $this->post('/logout');

        for ($i = 0; $i < 5; $i++) {
            $this->post('/login', ['email' => 'budi@contoh.id', 'password' => 'salah']);
        }
        $this->post('/login', ['email' => 'budi@contoh.id', 'password' => 'password'])
            ->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_forgot_password_sends_reset_link(): void
    {
        Notification::fake();
        $user = User::factory()->withBusiness()->create();
        $this->post('/forgot', ['email' => $user->email])->assertSessionHas('status');
        Notification::assertSentTo($user, \App\Notifications\ResetPasswordId::class);
    }

    public function test_delete_account_removes_all_data(): void
    {
        $user = User::factory()->withBusiness()->create();
        $bizId = $user->business->id;
        $this->actingAs($user)->delete('/pengaturan/akun', ['password_hapus' => 'password'])
            ->assertSessionHasNoErrors()->assertRedirect('/');
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('businesses', ['id' => $bizId]);
    }
}
