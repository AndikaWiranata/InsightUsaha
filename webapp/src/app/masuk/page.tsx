import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GuestShell } from '@/components/guest';
import { SignInForm } from './form';

export const metadata: Metadata = { title: 'Masuk' };

export default function Page() {
  return (
    <GuestShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Masuk</h1>
      <Suspense fallback={null}><SignInForm /></Suspense>
    </GuestShell>
  );
}
