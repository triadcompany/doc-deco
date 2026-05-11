const GEMINI_API_KEY = 'AIzaSyBI-MZmksJEwrh5LmF1Z46yZByaPdTDSfo';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface GeminiMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GeminiChunk {
  title: string;
  author: string;
  date: string;
  snippet: string;
}

export async function askGemini(
  question: string,
  chunks: GeminiChunk[],
  history: GeminiMessage[],
  signal?: AbortSignal
): Promise<string> {
  const chunksText = chunks.length > 0
    ? chunks.map((c, i) => `[${i + 1}] "${c.title}" (${c.author}, ${c.date}):\n${c.snippet}`).join('\n\n')
    : '(Nenhum trecho relevante encontrado nos documentos)';

  const systemPrompt = `Você é um assistente de estudo bíblico. Responda com base APENAS nos trechos fornecidos abaixo. Se a resposta não estiver nos trechos, diga claramente que não encontrou informação sobre isso nos documentos disponíveis. Ao final da sua resposta, liste quais documentos você usou no formato: [Título (Autor, Data)].

TRECHOS RELEVANTES:
${chunksText}`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Entendido. Vou responder apenas com base nos trechos fornecidos.' }] },
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: question }] },
  ];

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(sem resposta)';
}
