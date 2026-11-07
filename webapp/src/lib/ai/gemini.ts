import 'server-only';

export type Content = { role: 'user' | 'model'; parts: { text: string }[] };

export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

/**
 * Panggil Gemini. Kuota gratis dihitung per model per hari (gemini-2.5-flash hanya 20 permintaan/hari),
 * jadi bila model utama kena batas (HTTP 429) dicoba model cadangan di GEMINI_FALLBACK_MODEL.
 */
export async function gemini(system: string, contents: Content[], opts: { json?: object; maxTokens?: number; temperature?: number } = {}) {
  const primary = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const fallback = process.env.GEMINI_FALLBACK_MODEL;
  try {
    return await callModel(primary, system, contents, opts);
  } catch (e) {
    if (fallback && fallback !== primary && (e as Error).message.startsWith('Gemini HTTP 429')) {
      return callModel(fallback, system, contents, opts);
    }
    throw e;
  }
}

async function callModel(model: string, system: string, contents: Content[], opts: { json?: object; maxTokens?: number; temperature?: number }) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxTokens ?? 4096,
        // Token "berpikir" ikut dihitung di batas output; tugas ini hanya merangkum angka jadi, jadi dimatikan.
        // Hanya keluarga gemini-2.5 yang menerima thinkingBudget 0; model lain menolak dengan HTTP 400.
        ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        ...(opts.json ? { responseMimeType: 'application/json', responseSchema: opts.json } : {}),
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${String(body?.error?.message ?? '').slice(0, 300)}`);
  if (body?.promptFeedback?.blockReason) throw new Error(`Gemini memblokir permintaan: ${body.promptFeedback.blockReason}`);
  const cand = body?.candidates?.[0];
  if (cand?.finishReason && cand.finishReason !== 'STOP') throw new Error(`Gemini berhenti tidak normal: ${cand.finishReason}`);
  const parts: { text?: string; thought?: boolean }[] = cand?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('').trim();
  if (!text) throw new Error('Jawaban AI kosong.');
  return text;
}
