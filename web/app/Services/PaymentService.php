<?php

namespace App\Services;

use App\Models\Business;
use App\Models\ErrorLog;
use App\Models\Payment;
use App\Models\Subscription;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * F10 Langganan & pembayaran.
 *
 * Gateway: Midtrans Snap (QRIS, GoPay/ShopeePay/e-wallet, virtual account).
 * Jika MIDTRANS_SERVER_KEY kosong dan aplikasi berjalan di lingkungan lokal, dipakai
 * mode simulasi agar alur bisa diuji tanpa akun gateway.
 */
class PaymentService
{
    public function simulated(): bool
    {
        return (string) config('services.midtrans.server_key') === '';
    }

    public function subscriptionFor(Business $business): Subscription
    {
        return $business->subscription()->firstOrCreate([], ['paket' => 'gratis', 'status' => 'aktif', 'mulai' => now()]);
    }

    public function createCheckout(Business $business): Payment
    {
        $sub = $this->subscriptionFor($business);
        $ref = 'IU-'.$business->id.'-'.now()->format('ymdHis').'-'.Str::upper(Str::random(4));
        $payment = $sub->payments()->create([
            'jumlah' => Subscription::HARGA_PRO,
            'status' => 'menunggu',
            'ref_gateway' => $ref,
        ]);

        if ($this->simulated()) {
            $payment->update(['url_pembayaran' => route('langganan.simulasi', $payment->ref_gateway)]);

            return $payment;
        }

        $user = $business->user;
        $base = config('services.midtrans.production') ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
        $response = Http::withBasicAuth((string) config('services.midtrans.server_key'), '')
            ->acceptJson()
            ->timeout(30)
            ->post($base.'/snap/v1/transactions', [
                'transaction_details' => ['order_id' => $ref, 'gross_amount' => Subscription::HARGA_PRO],
                'item_details' => [[
                    'id' => 'PRO-1BLN', 'price' => Subscription::HARGA_PRO, 'quantity' => 1,
                    'name' => 'InsightUsaha Pro 1 bulan',
                ]],
                'customer_details' => ['first_name' => $user->nama, 'email' => $user->email],
                'enabled_payments' => ['other_qris', 'gopay', 'shopeepay', 'bca_va', 'bni_va', 'bri_va', 'permata_va', 'echannel'],
                'callbacks' => ['finish' => route('langganan')],
            ]);

        if (! $response->successful() || ! $response->json('redirect_url')) {
            $payment->update(['status' => 'gagal', 'payload' => $response->json()]);
            ErrorLog::catat('pembayaran', 'Gagal membuat transaksi Midtrans: HTTP '.$response->status(), $business->id);
            throw new \RuntimeException('Gagal membuat tagihan pembayaran. Silakan coba lagi.');
        }
        $payment->update(['url_pembayaran' => $response->json('redirect_url')]);

        return $payment;
    }

    public function verifySignature(array $payload): bool
    {
        $expected = hash('sha512', ($payload['order_id'] ?? '').($payload['status_code'] ?? '')
            .($payload['gross_amount'] ?? '').config('services.midtrans.server_key'));

        return hash_equals($expected, (string) ($payload['signature_key'] ?? ''));
    }

    /** Diproses dari webhook (atau simulasi). Idempoten. */
    public function handleNotification(array $payload): ?Payment
    {
        $payment = Payment::where('ref_gateway', (string) ($payload['order_id'] ?? ''))->first();
        if (! $payment) {
            return null;
        }
        $status = (string) ($payload['transaction_status'] ?? '');
        $fraud = (string) ($payload['fraud_status'] ?? 'accept');

        $newStatus = match (true) {
            in_array($status, ['settlement', 'capture'], true) && $fraud === 'accept' => 'lunas',
            in_array($status, ['deny', 'cancel', 'failure'], true) => 'gagal',
            $status === 'expire' => 'kedaluwarsa',
            default => 'menunggu',
        };

        DB::transaction(function () use ($payment, $payload, $newStatus) {
            $payment->refresh();
            $alreadyPaid = $payment->status === 'lunas';
            $payment->update([
                'status' => $alreadyPaid ? 'lunas' : $newStatus,
                'metode' => $payload['payment_type'] ?? $payment->metode,
                'payload' => $payload,
                'dibayar_pada' => $newStatus === 'lunas' && ! $alreadyPaid ? now() : $payment->dibayar_pada,
            ]);
            if ($newStatus === 'lunas' && ! $alreadyPaid) {
                $this->activatePro($payment->subscription);
            }
        });

        return $payment->fresh();
    }

    public function activatePro(Subscription $sub): void
    {
        $base = ($sub->paket === 'pro' && $sub->status === 'aktif' && $sub->berakhir && $sub->berakhir->isFuture())
            ? $sub->berakhir : now();
        $sub->update([
            'paket' => 'pro',
            'status' => 'aktif',
            'mulai' => $sub->paket === 'pro' && $sub->mulai ? $sub->mulai : now(),
            'berakhir' => $base->copy()->addMonthNoOverflow(),
            'pengingat_dikirim_pada' => null,
        ]);
    }

    /** Turunkan ke Gratis tanpa menghapus data. */
    public function downgrade(Subscription $sub): void
    {
        $sub->update(['paket' => 'gratis', 'status' => 'aktif', 'berakhir' => null, 'pengingat_dikirim_pada' => null]);
    }
}
