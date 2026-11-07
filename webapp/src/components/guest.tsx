import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './ui';
import { ThemeToggle } from './client';

export function GuestShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>
      <main id="konten" className="mx-auto mt-6 w-full max-w-md flex-1 sm:mt-12">
        <div className="card sm:p-7">{children}</div>
      </main>
      <footer className="mx-auto mt-8 w-full max-w-md text-sm text-muted">
        <Link href="/privasi">Kebijakan privasi</Link>
      </footer>
    </div>
  );
}

export function Field({ id, label, error, help, children }: { id: string; label: string; error?: string; help?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {help && <p className="help" id={`${id}-help`}>{help}</p>}
      {error && <p className="error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}
