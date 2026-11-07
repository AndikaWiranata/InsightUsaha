'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { resendVerification } from '../../auth/actions';

export function ResendForm() {
  const email = useSearchParams().get('email') ?? '';
  const [state, action, pending] = useActionState(resendVerification, null);
  return (
    <>
      <p className="mt-2 text-ink-2">
        Tautan verifikasi sudah dikirim ke <strong className="text-ink">{email || 'email kamu'}</strong>.
        Klik tautan itu untuk mulai memakai InsightUsaha.
      </p>
      {state?.ok && <p className="mt-4 rounded-control bg-good-soft px-3 py-2 text-sm text-good-ink" role="status">{state.ok}</p>}
      {state?.error && <p className="mt-4 rounded-control bg-bad-soft px-3 py-2 text-sm text-bad-ink" role="alert">{state.error}</p>}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <form action={action} className="flex-1">
          <input type="hidden" name="email" value={email} />
          <button className="btn-primary w-full" disabled={pending || !email}>{pending ? 'Mengirim…' : 'Kirim ulang email'}</button>
        </form>
        <Link href="/masuk" className="btn-secondary">Ke halaman masuk</Link>
      </div>
      <p className="mt-4 text-sm text-muted">Tidak ketemu? Periksa folder spam atau promosi.</p>
    </>
  );
}
