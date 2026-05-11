const OPENAI_API_KEY = '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';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

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

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ];

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    signal,
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: 2048 }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '(sem resposta)';
}
