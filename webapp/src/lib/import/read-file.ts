// Membaca file .csv/.xlsx di browser menjadi baris {kolom: nilai}. File tidak pernah dikirim ke server.
import Papa from 'papaparse';
import type { Cell } from './parse';
import { dropBlankRows, MAX_ROWS } from './parse';

export class FileError extends Error {}
export const MAX_BYTES = 10 * 1024 * 1024;

export type Table = { kolom: string[]; baris: Record<string, Cell>[] };

/** Delimiter dari baris judul: koma, titik koma, tab, atau garis tegak (ekspor Excel Indonesia sering memakai ";"). */
function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t', '|'].map((d) => [d, header.split(d).length - 1] as const);
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : ',';
}

async function readCsv(file: File): Promise<Table> {
  const buf = await file.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1252').decode(buf);
  }
  text = text.replace(/^﻿/, '');
  if (!text.trim()) throw new FileError('File kosong.');
  const res = Papa.parse<Record<string, string>>(text, {
    header: true, delimiter: detectDelimiter(text), skipEmptyLines: true, transformHeader: (h) => h.trim(),
  });
  return { kolom: (res.meta.fields ?? []).filter(Boolean), baris: res.data };
}

async function readXlsx(file: File): Promise<Table> {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file);
  const rows = (Array.isArray(sheets[0]) ? sheets : (sheets as unknown as { data: unknown[][] }[])[0]?.data ?? []) as Cell[][];
  if (!rows.length) throw new FileError('File kosong.');
  const kolom = rows[0].map((h) => String(h ?? '').trim());
  const baris = rows.slice(1).map((r) => Object.fromEntries(kolom.map((k, i) => [k, r[i] ?? null])));
  return { kolom: kolom.filter(Boolean), baris };
}

export async function readSalesFile(file: File): Promise<Table> {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
    throw new FileError('Format file tidak didukung. Gunakan file .xlsx atau .csv.');
  }
  if (file.size > MAX_BYTES) throw new FileError('Ukuran file melebihi 10 MB.');
  let table: Table;
  try {
    table = name.endsWith('.csv') ? await readCsv(file) : await readXlsx(file);
  } catch (e) {
    if (e instanceof FileError) throw e;
    throw new FileError(`File tidak bisa dibaca: ${(e as Error).message}`);
  }
  if (!table.kolom.length) throw new FileError('File tidak memiliki baris judul kolom.');
  table.baris = dropBlankRows(table.baris);
  if (table.baris.length > MAX_ROWS) {
    throw new FileError(`File berisi ${table.baris.length.toLocaleString('id-ID')} baris. Batas maksimal 50.000 baris.`);
  }
  return table;
}
