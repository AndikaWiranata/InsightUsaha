'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Field } from '@/components/guest';
import { signIn } from '../auth/actions';

export function SignInForm() {
  const qs = useSearchParams();
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <>
      {qs.get('tautan') === 'kedaluwarsa' && (
        <p className="mt-4 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn-ink" role="alert">
          Tautan dari email sudah kedaluwarsa atau sudah dipakai. Silakan masuk, atau minta tautan baru.
        </p>
      )}
      <form action={action} className="mt-6 space-y-4" noValidate>
        <input type="hidden" name="lanjut" value={qs.get('lanjut') ?? '/dashboard'} />
        <Field id="email" label="Email" error={state?.error}>
          <input className="input" id="email" type="email" name="email" defaultValue={state?.fields?.email} required autoFocus
                 autoComplete="email" aria-invalid={state?.error ? true : undefined} aria-describedby={state?.error ? 'email-error' : undefined} />
        </Field>
        <div>
          <label className="label" htmlFor="password">Kata sandi</label>
          <input className="input" id="password" type="password" name="password" required autoComplete="current-password" />
          <p className="mt-1.5 text-sm"><Link href="/lupa-sandi">Lupa kata sandi?</Link></p>
        </div>
        <button className="btn-primary w-full" disabled={pending}>{pending ? 'Memeriksa…' : 'Masuk'}</button>
      </form>
      <p className="mt-6 border-t border-line pt-4 text-sm text-ink-2">Belum punya akun? <Link href="/daftar">Daftar gratis</Link></p>
    </>
  );
}
