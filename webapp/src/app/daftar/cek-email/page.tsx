import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GuestShell } from '@/components/guest';
import { ResendForm } from './form';

export const metadata: Metadata = { title: 'Cek email' };

export default function Page() {
  return (
    <GuestShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Cek email kamu</h1>
      <Suspense fallback={null}><ResendForm /></Suspense>
    </GuestShell>
  );
}
