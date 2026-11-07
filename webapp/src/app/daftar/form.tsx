'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Field } from '@/components/guest';
import { signUp } from '../auth/actions';

export function SignUpForm({ jenisUsaha }: { jenisUsaha: string[] }) {
  const [state, action, pending] = useActionState(signUp, null);
  const f = state?.fields ?? {};
  const e = state?.fieldErrors ?? {};
  const inv = (k: string) => (e[k] ? { 'aria-invalid': true, 'aria-describedby': `${k}-error` } : {});
  return (
    <>
      {state?.error && <p className="mt-4 rounded-control bg-bad-soft px-3 py-2 text-sm text-bad-ink" role="alert">{state.error}</p>}
      <form action={action} className="mt-6 space-y-4" noValidate>
        <Field id="nama" label="Nama kamu" error={e.nama}>
          <input className="input" id="nama" name="nama" defaultValue={f.nama} required autoComplete="name" {...inv('nama')} />
        </Field>
        <Field id="email" label="Email" error={e.email}>
          <input className="input" id="email" type="email" name="email" defaultValue={f.email} required autoComplete="email" {...inv('email')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="password" label="Kata sandi" help="Minimal 8 karakter." error={e.password}>
            <input className="input" id="password" type="password" name="password" required minLength={8} autoComplete="new-password"
                   aria-describedby="password-help" />
          </Field>
          <Field id="password_confirmation" label="Ulangi kata sandi">
            <input className="input" id="password_confirmation" type="password" name="password_confirmation" required autoComplete="new-password" />
          </Field>
        </div>
        <Field id="nama_usaha" label="Nama usaha" error={e.nama_usaha}>
          <input className="input" id="nama_usaha" name="nama_usaha" defaultValue={f.nama_usaha} required placeholder="contoh: Kedai Kopi Rina" {...inv('nama_usaha')} />
        </Field>
        <Field id="jenis_usaha" label="Jenis usaha" error={e.jenis_usaha}>
          <select className="input" id="jenis_usaha" name="jenis_usaha" defaultValue={f.jenis_usaha ?? ''} required {...inv('jenis_usaha')}>
            <option value="">Pilih jenis usaha</option>
            {jenisUsaha.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </Field>
        <p className="text-sm text-muted">Dengan mendaftar, kamu menyetujui <Link href="/privasi">kebijakan privasi</Link>.</p>
        <button className="btn-primary w-full" disabled={pending}>{pending ? 'Mendaftarkan…' : 'Buat akun'}</button>
      </form>
      <p className="mt-6 border-t border-line pt-4 text-sm text-ink-2">Sudah punya akun? <Link href="/masuk">Masuk</Link></p>
    </>
  );
}
