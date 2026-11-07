'use client';

import { useActionState } from 'react';
import { Field, GuestShell } from '@/components/guest';
import { setNewPassword } from '../auth/actions';

export default function Page() {
  const [state, action, pending] = useActionState(setNewPassword, null);
  return (
    <GuestShell>
      <h1 className="text-2xl font-extrabold tracking-tight">Buat kata sandi baru</h1>
      {state?.error && <p className="mt-4 rounded-control bg-bad-soft px-3 py-2 text-sm text-bad-ink" role="alert">{state.error}</p>}
      <form action={action} className="mt-6 space-y-4">
        <Field id="password" label="Kata sandi baru" help="Minimal 8 karakter." error={state?.fieldErrors?.password}>
          <input className="input" id="password" type="password" name="password" required minLength={8} autoComplete="new-password" aria-describedby="password-help" />
        </Field>
        <Field id="password_confirmation" label="Ulangi kata sandi baru">
          <input className="input" id="password_confirmation" type="password" name="password_confirmation" required autoComplete="new-password" />
        </Field>
        <button className="btn-primary w-full" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan kata sandi'}</button>
      </form>
    </GuestShell>
  );
}
