<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\ErrorLog;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;

/** F10 Langganan & pembayaran. */
class SubscriptionController extends Controller
{
    public function __construct(private PaymentService $payments)
    {
    }

    private function business(Request $request): Business
    {
        return $request->attributes->get('business');
    }

    public function index(Request $request)
    {
        $business = $this->business($request);
        $sub = $this->payments->subscriptionFor($business);

        return view('subscription', [
            'business' => $business,
            'sub' => $sub,
            'isPro' => $business->isPro(),
            'payments' => $sub->payments()->latest('id')->limit(20)->get(),
            'simulated' => $this->payments->simulated(),
        ]);
    }

    public function checkout(Request $request)
    {
        try {
            $payment = $this->payments->createCheckout($this->business($request));
        } catch (\Throwable $e) {
            return back()->withErrors(['bayar' => $e->getMessage()]);
        }

        return redirect()->away($payment->url_pembayaran);
    }

    /** Halaman simulasi gateway (hanya bila MIDTRANS_SERVER_KEY kosong). */
    public function simulate(Request $request, string $ref)
    {
        abort_unless($this->payments->simulated(), 404);
        $payment = $this->ownedPayment($request, $ref);

        return view('payment-simulator', ['payment' => $payment]);
    }

    public function simulatePay(Request $request, string $ref)
    {
        abort_unless($this->payments->simulated(), 404);
        $payment = $this->ownedPayment($request, $ref);
        $data = $request->validate(['metode' => ['required', 'in:qris,gopay,shopeepay,bank_transfer,batal']]);
        $this->payments->handleNotification([
            'order_id' => $payment->ref_gateway,
            'transaction_status' => $data['metode'] === 'batal' ? 'cancel' : 'settlement',
            'payment_type' => $data['metode'] === 'batal' ? null : $data['metode'],
            'fraud_status' => 'accept',
            'simulasi' => true,
        ]);

        return redirect()->route('langganan')->with('status', $data['metode'] === 'batal'
            ? 'Pembayaran dibatalkan.' : 'Pembayaran berhasil. Paket Pro sudah aktif!');
    }

    private function ownedPayment(Request $request, string $ref): Payment
    {
        $business = $this->business($request);

        return Payment::where('ref_gateway', $ref)
            ->whereHas('subscription', fn ($q) => $q->where('business_id', $business->id))
            ->firstOrFail();
    }

    /** Webhook payment gateway (Midtrans HTTP notification). */
    public function webhook(Request $request)
    {
        $payload = $request->all();
        if ($this->payments->simulated() || ! $this->payments->verifySignature($payload)) {
            ErrorLog::catat('pembayaran', 'Webhook ditolak: tanda tangan tidak valid.', null, ['order_id' => $payload['order_id'] ?? null]);

            return response()->json(['message' => 'invalid signature'], 403);
        }
        $payment = $this->payments->handleNotification($payload);

        return response()->json(['ok' => $payment !== null]);
    }
}
