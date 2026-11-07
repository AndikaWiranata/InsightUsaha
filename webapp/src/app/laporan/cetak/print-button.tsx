'use client';

import { Icon } from '@/components/icon';

export function PrintButton() {
  return <button type="button" className="btn-primary shrink-0" onClick={() => window.print()}><Icon name="download" className="h-4 w-4" /> Simpan sebagai PDF</button>;
}
