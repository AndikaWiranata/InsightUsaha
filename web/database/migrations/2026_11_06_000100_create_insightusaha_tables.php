<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('businesses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('nama_usaha');
            $table->string('kota')->nullable();
            $table->string('jenis_usaha')->nullable();
            $table->time('jam_buka')->nullable();
            $table->time('jam_tutup')->nullable();
            $table->boolean('onboarding_selesai')->default(false);
            $table->json('pengaturan')->nullable(); // mis. parameter Apriori
            $table->timestamps();
        });

        Schema::create('uploads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('nama_file');
            $table->string('path')->nullable();
            $table->unsignedBigInteger('ukuran')->default(0);
            $table->json('pemetaan')->nullable();
            $table->string('mode', 10)->default('baru'); // baru | ganti | gabung
            $table->string('status', 20)->default('menunggu'); // menunggu | diproses | selesai | gagal | konflik
            $table->unsignedTinyInteger('progres')->default(0);
            $table->unsignedInteger('jumlah_baris_valid')->default(0);
            $table->unsignedInteger('jumlah_baris_ditolak')->default(0);
            $table->json('ringkasan')->nullable();
            $table->json('baris_ditolak')->nullable();
            $table->date('tanggal_mulai')->nullable();
            $table->date('tanggal_selesai')->nullable();
            $table->text('pesan_error')->nullable();
            $table->timestamp('dibuat_pada')->useCurrent();
            $table->timestamps();
            $table->index(['business_id', 'status']);
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('nama');
            $table->string('kategori')->nullable();
            $table->decimal('hpp', 14, 2)->nullable();
            $table->timestamps();
            $table->unique(['business_id', 'nama']);
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('upload_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('urutan')->default(0); // urutan dalam satu unggahan (untuk insert massal)
            $table->string('kode_transaksi')->nullable();
            $table->boolean('punya_kode')->default(false);
            $table->dateTime('waktu');
            $table->boolean('punya_jam')->default(false);
            $table->index(['business_id', 'waktu']);
            $table->index(['business_id', 'kode_transaksi']);
            $table->index(['upload_id', 'urutan']);
        });

        Schema::create('transaction_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('jumlah');
            $table->decimal('harga_satuan', 14, 2);
            $table->string('row_hash', 40)->nullable();
            $table->index('row_hash');
        });

        Schema::create('analysis_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('jenis', 20); // dashboard | produk | waktu | bundling | menu
            $table->date('periode_mulai');
            $table->date('periode_selesai');
            $table->string('parameter_hash', 40)->default('');
            $table->unsignedInteger('versi_data')->default(0);
            $table->json('hasil_json');
            $table->timestamps();
            $table->unique(['business_id', 'jenis', 'periode_mulai', 'periode_selesai', 'parameter_hash'], 'analysis_unique');
        });

        Schema::create('ai_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('periode', 30); // "2026-10-01_2026-10-31"
            $table->unsignedInteger('versi_data')->default(0);
            $table->text('isi')->nullable();
            $table->json('isi_json')->nullable();
            $table->string('status', 10)->default('ok'); // ok | gagal
            $table->string('umpan_balik', 20)->nullable(); // membantu | tidak_membantu
            $table->timestamps();
            $table->unique(['business_id', 'periode']);
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('paket', 10)->default('gratis'); // gratis | pro
            $table->dateTime('mulai')->nullable();
            $table->dateTime('berakhir')->nullable();
            $table->string('status', 15)->default('aktif'); // aktif | kedaluwarsa | menunggu
            $table->timestamp('pengingat_dikirim_pada')->nullable();
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('jumlah');
            $table->string('metode', 30)->nullable();
            $table->string('status', 15)->default('menunggu'); // menunggu | lunas | gagal | kedaluwarsa
            $table->string('ref_gateway')->unique();
            $table->text('url_pembayaran')->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('dibayar_pada')->nullable();
            $table->timestamps();
        });

        Schema::create('error_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->nullable()->constrained()->nullOnDelete();
            $table->string('jenis', 20); // impor | ai | pembayaran
            $table->text('pesan');
            $table->json('konteks')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('tanggal');
            $table->unique(['user_id', 'tanggal']);
        });
    }

    public function down(): void
    {
        foreach (['activity_logs', 'error_logs', 'payments', 'subscriptions', 'ai_summaries', 'analysis_results',
            'transaction_items', 'transactions', 'products', 'uploads', 'businesses'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
