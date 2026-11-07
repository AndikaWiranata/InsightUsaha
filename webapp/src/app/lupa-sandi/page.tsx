'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Field, GuestShell } from '@/components/guest';
import { sendReset } from '../auth/actions';

export default function Page() {
  const [state, action, pending] = useActionState(sendReset, null);
  return (
    <GuestShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Lupa kata sandi</h1>
      <p className="mt-1 text-ink-2">Masukkan email akunmu. Kami kirim tautan untuk membuat kata sandi baru.</p>
      {state?.ok && <p className="mt-4 rounded-control bg-good-soft px-3 py-2 text-sm text-good-ink" role="status">{state.ok}</p>}
      <form action={action} className="mt-6 space-y-4">
        <Field id="email" label="Email">
          <input className="input" id="email" type="email" name="email" required autoFocus autoComplete="email" />
        </Field>
        <button className="btn-primary w-full" disabled={pending}>{pending ? 'Mengirim…' : 'Kirim tautan'}</button>
      </form>
      <p className="mt-6 border-t border-line pt-4 text-sm"><Link href="/masuk">Kembali ke halaman masuk</Link></p>
    </GuestShell>
  );
}
