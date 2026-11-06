<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Notifications\RenewalReminder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** F10 Langganan & pembayaran, F11 admin. */
class SubscriptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_simulated_checkout_activates_pro(): void
    {
        config(['services.midtrans.server_key' => '']);
        $user = User::factory()->withBusiness()->create();
        $this->actingAs($user)->post('/langganan/bayar')->assertRedirect();
        $payment = Payment::first();
        $this->post(route('langganan.simulasi.bayar', $payment->ref_gateway), ['metode' => 'qris'])->assertRedirect(route('langganan'));

        $this->assertTrue($user->business->fresh()->isPro());
        $this->assertSame('lunas', $payment->fresh()->status);
    }

    public function test_webhook_with_valid_signature_updates_status(): void
    {
        config(['services.midtrans.server_key' => 'SB-secret']);
        $user = User::factory()->withBusiness()->create();
        $sub = $user->business->subscription;
        $payment = $sub->payments()->create(['jumlah' => 49000, 'status' => 'menunggu', 'ref_gateway' => 'IU-1-TEST']);

        $payload = ['order_id' => 'IU-1-TEST', 'status_code' => '200', 'gross_amount' => '49000.00',
            'transaction_status' => 'settlement', 'payment_type' => 'qris', 'fraud_status' => 'accept'];
        $payload['signature_key'] = hash('sha512', 'IU-1-TEST20049000.00SB-secret');

        $this->postJson('/webhook/pembayaran', array_merge($payload, ['signature_key' => 'salah']))->assertForbidden();
        $this->postJson('/webhook/pembayaran', $payload)->assertOk();
        $this->assertSame('lunas', $payment->fresh()->status);
        $this->assertTrue($user->business->fresh()->isPro());

        // Idempoten: notifikasi ulang tidak menambah masa aktif.
        $end = $sub->fresh()->berakhir;
        $this->postJson('/webhook/pembayaran', $payload)->assertOk();
        $this->assertEquals($end, $sub->fresh()->berakhir);
    }

    public function test_reminder_and_downgrade_without_deleting_data(): void
    {
        Notification::fake();
        $soon = User::factory()->withBusiness('pro')->create();
        $soon->business->subscription->update(['berakhir' => now()->addDays(2)]);
        $expired = User::factory()->withBusiness('pro')->create();
        $expired->business->subscription->update(['berakhir' => now()->subDay()]);
        $expired->business->products()->create(['nama' => 'Kopi']);

        $this->artisan('langganan:periksa')->assertSuccessful();

        Notification::assertSentTo($soon, RenewalReminder::class);
        $this->assertFalse($expired->business->fresh()->isPro());
        $this->assertSame('gratis', $expired->business->subscription->fresh()->paket);
        $this->assertDatabaseHas('products', ['nama' => 'Kopi', 'business_id' => $expired->business->id]);
    }

    public function test_admin_panel_only_for_admin(): void
    {
        $owner = User::factory()->withBusiness()->create();
        $this->actingAs($owner)->get('/admin')->assertForbidden();

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('/admin')->assertOk()->assertSee($owner->email)->assertSee('Pelanggan berbayar');
    }
}
