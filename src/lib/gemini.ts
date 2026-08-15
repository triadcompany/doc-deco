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
  signal?: AbortSignal,
  options?: { singleDocument?: boolean }
): Promise<string> {
  const chunksText = chunks.length > 0
    ? chunks.map((c, i) => `[${i + 1}] "${c.title}" (${c.author}, ${c.date}):\n${c.snippet}`).join('\n\n')
    : '(Nenhum trecho relevante encontrado nos documentos)';

  const scopeInstruction = options?.singleDocument
    ? `Você tem acesso ao texto integral de UM único documento, transcrito abaixo. Toda a conversa deve permanecer exclusivamente dentro deste documento — não traga informações de fora dele, mesmo que pareçam relacionadas ou familiares de outras pregações. Se o usuário perguntar algo que este documento não aborda, diga claramente que este documento específico não trata disso, em vez de responder com conhecimento geral.`
    : `Responda com base APENAS nos trechos fornecidos abaixo. Se a resposta não estiver nos trechos, diga claramente que não encontrou informação sobre isso nos documentos disponíveis.`;

  const systemPrompt = `Você é um assistente de estudo bíblico. Responda sempre em português do Brasil, usando linguagem bíblica — reverente, clara, citando as Escrituras pelo nome do livro, capítulo e versículo quando pertinente. ${scopeInstruction} Ao final da sua resposta, liste quais documentos você usou no formato: [Título (Autor, Data)].

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
