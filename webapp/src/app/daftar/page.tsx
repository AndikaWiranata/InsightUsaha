import type { Metadata } from 'next';
import { GuestShell } from '@/components/guest';
import { JENIS_USAHA } from '@/lib/session';
import { SignUpForm } from './form';

export const metadata: Metadata = { title: 'Daftar' };

export default function Page() {
  return (
    <GuestShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Buat akun</h1>
      <p className="mt-1 text-ink-2">Gratis. Setelah daftar, kamu langsung bisa mengunggah file penjualan.</p>
      <SignUpForm jenisUsaha={JENIS_USAHA} />
    </GuestShell>
  );
}
