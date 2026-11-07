// Pengecekan angka: setiap angka di jawaban AI harus berasal dari fakta agregat (F8, F12).

const norm = (n: number) => String(Number(n.toFixed(4)));

/** Ambil angka dari teks berformat Indonesia ("Rp1.250.000", "12,5%", "08.00–09.00") dalam bentuk ternormalisasi. */
export function extractNumbers(text: string): string[] {
  const out: string[] = [];
  for (const tok of text.match(/\d+(?:[.,]\d+)*/g) ?? []) {
    let n: number;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(tok)) n = Number(tok.replace(/\./g, '').replace(',', '.'));
    else if (/^\d{1,2}\.\d{2}$/.test(tok)) {
      const [h, m] = tok.split('.');
      out.push(norm(Number(m)));
      n = Number(h);
    } else if (/^\d+,\d+$/.test(tok)) n = Number(tok.replace(',', '.'));
    else n = Number(tok.replace(/,/g, ''));
    out.push(norm(n));
  }
  return out;
}

export function allowedNumbers(facts: unknown): Set<string> {
  const allowed = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') extractNumbers(v).forEach((n) => allowed.add(n));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(facts);
  return allowed;
}

export const foreignNumbers = (texts: string[], allowed: Set<string>) =>
  [...new Set(texts.flatMap(extractNumbers).filter((n) => !allowed.has(n)))];

/** Model kecil kadang menyalin nama field ("omzet_teks") alih-alih nilainya; jawaban seperti itu ditolak. */
export const leakedFieldNames = (texts: string[]) => [...new Set(texts.flatMap((t) => t.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? []))];
