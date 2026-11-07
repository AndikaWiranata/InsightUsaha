// Pembersihan file penjualan (F2). Aturan diturunkan dari versi Python lama (lihat riwayat git);
// kesetaraannya diuji di tests/parse.test.ts terhadap hasil Python pada file contoh yang sama.

export const FIELDS = ['tanggal', 'jam', 'id_transaksi', 'nama_produk', 'kategori', 'jumlah', 'harga_satuan'] as const;
export type Field = (typeof FIELDS)[number];
export const REQUIRED: Field[] = ['tanggal', 'nama_produk', 'jumlah', 'harga_satuan'];
export const MAX_ROWS = 50_000;
export const MAX_REJECT_DETAIL = 500;
export type Mapping = Record<Field, string | null>;
export type Cell = string | number | boolean | Date | null | undefined;

const SYNONYMS: Record<Field, string[]> = {
  tanggal: ['tanggal', 'tgl', 'date', 'tanggal_transaksi', 'tgl_transaksi', 'waktu', 'tanggal_penjualan'],
  jam: ['jam', 'time', 'pukul', 'jam_transaksi', 'waktu_transaksi'],
  id_transaksi: ['id_transaksi', 'no_transaksi', 'nomor_transaksi', 'kode_transaksi', 'no_struk', 'nomor_struk', 'receipt',
    'receipt_number', 'receipt_no', 'invoice', 'no_invoice', 'order_id', 'transaction_id', 'id_order', 'no_nota', 'nota'],
  nama_produk: ['nama_produk', 'produk', 'nama_item', 'item', 'item_name', 'menu', 'nama_menu', 'product', 'product_name',
    'nama_barang', 'barang'],
  kategori: ['kategori', 'category', 'kategori_produk', 'jenis'],
  jumlah: ['jumlah', 'qty', 'quantity', 'kuantitas', 'jumlah_terjual', 'banyak', 'jml', 'item_sold'],
  harga_satuan: ['harga_satuan', 'harga', 'price', 'unit_price', 'harga_jual', 'harga_per_item', 'harga_item'],
};

export const REASON = {
  tanggal: 'Tanggal kosong atau tidak valid',
  produk: 'Nama produk kosong',
  jumlah: 'Jumlah harus angka bulat lebih dari 0',
  harga: 'Harga satuan kosong atau tidak valid',
} as const;

const isBlank = (v: Cell) =>
  v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) || (typeof v === 'string' && v.trim() === '');

const normHeader = (h: string) => String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function suggestMapping(columns: string[]): Mapping {
  const byNorm = new Map(columns.map((c) => [normHeader(c), c]));
  const used = new Set<string>();
  const out = {} as Mapping;
  for (const f of FIELDS) {
    const hit = SYNONYMS[f].map((s) => byNorm.get(s)).find((c) => c !== undefined && !used.has(c)) ?? null;
    out[f] = hit;
    if (hit) used.add(hit);
  }
  return out;
}

export const missingRequired = (m: Mapping) => REQUIRED.filter((f) => !m[f]);

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function validDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? iso(y, m, d) : null;
}

const RE_ISO = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2})[:.](\d{2})(?::(\d{2}))?)?/;
const RE_DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2})[:.](\d{2})(?::(\d{2}))?)?/;
const RE_TIME = /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/;

/** Nomor seri tanggal Excel (dengan pecahan jam) ke tanggal dan jam. */
function fromExcelSerial(v: number): [string, [number, number] | null] {
  const ms = Math.round((v - 25569) * 86400 * 1000);
  const dt = new Date(ms);
  const t: [number, number] | null = dt.getUTCHours() || dt.getUTCMinutes() ? [dt.getUTCHours(), dt.getUTCMinutes()] : null;
  return [iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()), t];
}

export function parseDate(v: Cell): [string | null, [number, number] | null] {
  if (isBlank(v)) return [null, null];
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return [null, null];
    const t: [number, number] | null = v.getUTCHours() || v.getUTCMinutes() ? [v.getUTCHours(), v.getUTCMinutes()] : null;
    return [iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()), t];
  }
  if (typeof v === 'number') return v > 20000 && v < 80000 ? fromExcelSerial(v) : [null, null];
  if (typeof v === 'boolean') return [null, null];
  const s = String(v).trim();
  let m = RE_ISO.exec(s);
  let y: number, mo: number, d: number;
  if (m) {
    [y, mo, d] = [+m[1], +m[2], +m[3]];
  } else {
    m = RE_DMY.exec(s);
    if (!m) return [null, null];
    [d, mo, y] = [+m[1], +m[2], +m[3]];
  }
  const date = validDate(y, mo, d);
  if (!date) return [null, null];
  let t: [number, number] | null = null;
  if (m[4] !== undefined) {
    const hh = +m[4], mm = +m[5];
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60 && (hh || mm)) t = [hh, mm];
  }
  return [date, t];
}

export function parseTime(v: Cell): [number, number] | null {
  if (isBlank(v)) return null;
  if (v instanceof Date) return [v.getUTCHours(), v.getUTCMinutes()];
  if (typeof v === 'number') {
    if (v >= 0 && v < 1) {
      const minutes = Math.round(v * 24 * 60);
      return [Math.floor(minutes / 60) % 24, minutes % 60];
    }
    return null;
  }
  if (typeof v === 'boolean') return null;
  const s = String(v).trim();
  const m = RE_TIME.exec(s);
  if (!m) return parseDate(s)[1];
  const hh = +m[1], mm = +m[2];
  return hh >= 0 && hh < 24 && mm >= 0 && mm < 60 ? [hh, mm] : null;
}

/** Angka gaya Indonesia: "Rp18.000", "1.250,50", "18,000.00", "2,5". */
export function parseNumber(v: Cell): number | null {
  if (isBlank(v) || typeof v === 'boolean' || v instanceof Date) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/^(rp\.?|idr)/i, '').trim().replace(/ /g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  else if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Rapikan spasi dan ubah ke Huruf Kapital Tiap Kata, agar "americano " dan "Americano" jadi satu produk. */
export function normalizeName(v: Cell): string | null {
  if (isBlank(v)) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.split(' ').map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function normalizeCode(v: Cell): string | null {
  if (isBlank(v)) return null;
  if (typeof v === 'number' && Number.isInteger(v)) return String(v);
  const s = String(v).trim();
  return s || null;
}

export type CleanRow = {
  tanggal: string; jam: string | null; id_transaksi: string | null; nama_produk: string;
  kategori: string | null; jumlah: number; harga_satuan: number; hash: string;
};
export type CleanResult = {
  baris: CleanRow[];
  ditolak: { baris: number; alasan: string }[];
  ringkasan: {
    jumlah_baris_file: number; jumlah_baris_valid: number; jumlah_baris_ditolak: number;
    alasan_ditolak: Record<string, number>; duplikat_dihapus: number; jam_tidak_valid: number;
    tanggal_mulai: string | null; tanggal_selesai: string | null; punya_jam: boolean; punya_id_transaksi: boolean;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;
// Bentuk angka di kunci duplikat mengikuti str(float) Python, misalnya 18000 -> "18000.0".
const pyFloat = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));

/** Bersihkan baris yang sudah dipetakan. `rows` sudah tanpa baris kosong; nomor baris = indeks + 2 (seperti di Excel). */
export function cleanRows(rows: Record<string, Cell>[], mapping: Mapping): CleanResult {
  const col = (r: Record<string, Cell>, f: Field): Cell => (mapping[f] ? r[mapping[f]!] : null);
  const out: CleanRow[] = [];
  const ditolak: CleanResult['ditolak'] = [];
  const reasons: Record<string, number> = {};
  const seen = new Set<string>();
  let duplikat = 0;
  let jamInvalid = 0;

  const reject = (rowNo: number, reason: string) => {
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    if (ditolak.length < MAX_REJECT_DETAIL) ditolak.push({ baris: rowNo, alasan: reason });
  };

  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const [d, tFromDate] = parseDate(col(r, 'tanggal'));
    if (!d) return reject(rowNo, REASON.tanggal);
    const produk = normalizeName(col(r, 'nama_produk'));
    if (!produk) return reject(rowNo, REASON.produk);
    const qty = parseNumber(col(r, 'jumlah'));
    if (qty === null || !Number.isInteger(qty) || qty <= 0) return reject(rowNo, REASON.jumlah);
    const harga = parseNumber(col(r, 'harga_satuan'));
    if (harga === null || harga < 0) return reject(rowNo, REASON.harga);

    let t: [number, number] | null = null;
    if (mapping.jam) {
      t = parseTime(col(r, 'jam'));
      if (t === null && !isBlank(col(r, 'jam'))) jamInvalid++;
    }
    t ??= tFromDate;
    const jam = t ? `${pad(t[0])}:${pad(t[1])}` : null;
    const kode = normalizeCode(col(r, 'id_transaksi'));
    const kategori = normalizeName(col(r, 'kategori'));
    const hargaR = round2(harga);
    const key = `${d}|${jam ?? ''}|${kode ?? ''}|${produk.toLowerCase()}|${qty}|${pyFloat(hargaR)}`;

    // Duplikat hanya dihapus bila ada ID transaksi; tanpa ID, dua baris sama bisa memang dua penjualan.
    if (kode !== null) {
      if (seen.has(key)) { duplikat++; return; }
      seen.add(key);
    }
    out.push({ tanggal: d, jam, id_transaksi: kode, nama_produk: produk, kategori, jumlah: qty, harga_satuan: hargaR, hash: key });
  });

  const dates = out.map((x) => x.tanggal).sort();
  return {
    baris: out,
    ditolak,
    ringkasan: {
      jumlah_baris_file: rows.length,
      jumlah_baris_valid: out.length,
      jumlah_baris_ditolak: Object.values(reasons).reduce((a, b) => a + b, 0),
      alasan_ditolak: reasons,
      duplikat_dihapus: duplikat,
      jam_tidak_valid: jamInvalid,
      tanggal_mulai: dates[0] ?? null,
      tanggal_selesai: dates[dates.length - 1] ?? null,
      punya_jam: out.some((x) => x.jam !== null),
      punya_id_transaksi: out.some((x) => x.id_transaksi !== null),
    },
  };
}

/** Buang baris yang semua selnya kosong (dilakukan sebelum penomoran baris, sama seperti versi Python). */
export const dropBlankRows = (rows: Record<string, Cell>[]) => rows.filter((r) => !Object.values(r).every(isBlank));
