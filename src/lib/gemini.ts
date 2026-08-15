import { getStoredToken } from '@/integrations/supabase/client';

// OpenAI's API has no CORS headers for browser requests (by design, to stop
// client-exposed keys), so this goes through the login-service backend, which
// holds the real API key server-side and forwards the request.
const AI_PROXY_URL = `${import.meta.env.VITE_LOGIN_SERVICE_URL}/ai/chat`;

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

  const token = getStoredToken();
  const res = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
    body: JSON.stringify({ messages, temperature: 0.3, max_tokens: 2048 }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Erro na IA: ${err}`);
  }

  const data = await res.json();
  return data.content ?? '(sem resposta)';
}
