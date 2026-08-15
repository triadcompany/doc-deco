import { useState, useEffect, useCallback, useRef } from 'react';

const PT_STOPWORDS = new Set([
  'quem', 'qual', 'quais', 'quando', 'como', 'onde', 'porque', 'pois', 'sera',
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'para', 'com', 'que', 'se', 'mas', 'ou', 'e', 'ao', 'aos',
  'foi', 'ser', 'ter', 'ha', 'ja', 'mais', 'so', 'nao', 'bem', 'muito',
  'tambem', 'ate', 'sobre', 'este', 'esta', 'esse', 'essa', 'isso', 'isto',
  'aqui', 'la', 'me', 'te', 'lhe', 'seu', 'sua', 'seus', 'suas', 'sao',
  'meu', 'minha', 'pode', 'diz', 'disse', 'faz', 'fez', 'vai', 'vem',
]);

function extractKeyTerms(question: string): string {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[?!.,;:]/g, ' ');

  const terms = normalized
    .split(/\s+/)
    .filter((w) => w.length > 2 && !PT_STOPWORDS.has(w));

  return terms.join(' ');
}
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { askGemini, GeminiMessage } from '@/lib/gemini';
import { PDFDocument } from '@/lib/types';

export interface AIChatFilters {
  author?: string;
  tags?: string[];
  documentIds?: string[];
}

export interface AIReference {
  documentId: string;
  title: string;
  author: string;
  date: string;
  snippet: string;
}

export interface AIMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  references: AIReference[];
  createdAt: string;
}

export interface AIChat {
  id: string;
  title: string;
  filters: AIChatFilters;
  createdAt: string;
  updatedAt: string;
}

type SearchFn = (
  term: string,
  searchType: 'exact' | 'proximity',
  filters?: { author?: string; translator?: string; tags?: string[]; startDate?: string; endDate?: string }
) => Promise<(PDFDocument & { snippet?: string })[]>;

export const DOCUMENT_SUMMARY_PROMPT = `Faça um resumo completo deste documento. Responda em português, com linguagem bíblica, seguindo exatamente esta estrutura:

1. Escrituras usadas — todas as passagens bíblicas citadas no documento (livro, capítulo e versículo).
2. Citações de William Branham (profeta) — as declarações mais relevantes atribuídas a ele no texto.
3. 10 frases de impacto — dez frases marcantes utilizadas no documento, tal como aparecem no texto.
4. Linha de pensamento — como o raciocínio se desenvolve do início ao fim da mensagem.
5. Tópicos — os principais temas abordados no documento.`;

export function useAIChat(searchContent: SearchFn) {
  const { user } = useAuth();
  const [chats, setChats] = useState<AIChat[]>([]);
  const [activeChat, setActiveChat] = useState<AIChat | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [filters, setFilters] = useState<AIChatFilters>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const docContentCache = useRef<Map<string, { title: string; author: string; date: string; content: string }>>(new Map());

  const fetchChats = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ai_chats' as any)
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setChats((data as any[]).map(toAIChat));
  }, [user?.id]);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('ai_messages' as any)
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setMessages(data ? (data as any[]).map(toAIMessage) : []);
    setLoading(false);
  }, []);

  const createChat = async (): Promise<AIChat | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('ai_chats' as any)
      .insert({ user_id: user.id, title: 'Novo Chat', filters: {} })
      .select()
      .single();
    if (error || !data) return null;
    const chat = toAIChat(data as any);
    setChats((prev) => [chat, ...prev]);
    setActiveChat(chat);
    setMessages([]);
    setFilters({});
    return chat;
  };

  const selectChat = async (chat: AIChat) => {
    setActiveChat(chat);
    setFilters(chat.filters || {});
    await fetchMessages(chat.id);
  };

  const deleteChat = async (id: string) => {
    await supabase.from('ai_chats' as any).delete().eq('id', id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChat?.id === id) {
      setActiveChat(null);
      setMessages([]);
    }
  };

  const updateFilters = async (newFilters: AIChatFilters) => {
    setFilters(newFilters);
    if (activeChat) {
      await supabase.from('ai_chats' as any).update({ filters: newFilters }).eq('id', activeChat.id);
      setActiveChat((c) => (c ? { ...c, filters: newFilters } : c));
    }
  };

  const cancelMessage = () => {
    abortRef.current?.abort();
  };

  const sendMessage = async (text: string, chatOverride?: AIChat, filtersOverride?: AIChatFilters, titleOverride?: string) => {
    const chat = chatOverride ?? activeChat;
    const effectiveFilters = filtersOverride ?? filters;
    if (!chat || !text.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);

    const tempId = crypto.randomUUID();
    const tempUserMsg: AIMessage = {
      id: tempId,
      chatId: chat.id,
      role: 'user',
      content: text,
      references: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // 1. Retrieve relevant chunks. A chat scoped to exactly one document gets that
      // document's full text instead of fragmentary keyword-matched snippets — needed
      // for a faithful summary/deep-dive that stays entirely within that one PDF.
      const singleDocId = effectiveFilters.documentIds?.length === 1 ? effectiveFilters.documentIds[0] : null;
      let chunks: { documentId: string; title: string; author: string; date: string; snippet: string }[];

      if (singleDocId) {
        let doc = docContentCache.current.get(singleDocId);
        if (!doc) {
          const { data } = await supabase
            .from('documents')
            .select('id, title, author, date, content')
            .eq('id', singleDocId)
            .single();
          if (data) {
            doc = { title: (data as any).title, author: (data as any).author, date: (data as any).date, content: (data as any).content || '' };
            docContentCache.current.set(singleDocId, doc);
          }
        }
        chunks = doc ? [{ documentId: singleDocId, title: doc.title, author: doc.author, date: doc.date, snippet: doc.content }] : [];
      } else {
        const searchFilters: any = {};
        if (effectiveFilters.author) searchFilters.author = effectiveFilters.author;
        if (effectiveFilters.tags?.length) searchFilters.tags = effectiveFilters.tags;

        const keyTerms = extractKeyTerms(text);
        const results = await searchContent(keyTerms || text, 'proximity', searchFilters);

        let filtered = results;
        if (effectiveFilters.documentIds?.length) {
          filtered = results.filter((r) => effectiveFilters.documentIds!.includes(r.id));
        }

        chunks = filtered.slice(0, 10).map((r) => ({
          documentId: r.id,
          title: r.title,
          author: r.author,
          date: r.date,
          snippet: r.snippet || '',
        }));
      }

      // 2. Build conversation history for Gemini
      const history: GeminiMessage[] = messages
        .slice(-10)
        .map((m) => ({ role: m.role === 'user' ? 'user' : ('model' as const), content: m.content }));

      // 3. Call Gemini
      const answer = await askGemini(text, chunks, history, controller.signal, { singleDocument: !!singleDocId });

      // 4. Extract references mentioned in the answer
      const references: AIReference[] = chunks.filter(
        (c) => answer.includes(c.title) || answer.includes(c.author)
      );

      // 5. Persist messages
      await supabase.from('ai_messages' as any).insert({
        chat_id: chat.id,
        role: 'user',
        content: text,
        doc_references: [],
      });

      const { data: assistantData } = await supabase
        .from('ai_messages' as any)
        .insert({ chat_id: chat.id, role: 'assistant', content: answer, doc_references: references })
        .select()
        .single();

      // 6. Update chat title on first message
      const isFirstMessage = messages.length === 0;
      if (isFirstMessage) {
        const title = titleOverride ?? (text.length > 60 ? text.slice(0, 60) + '...' : text);
        await supabase.from('ai_chats' as any).update({ title, updated_at: new Date().toISOString() }).eq('id', chat.id);
        setActiveChat((c) => (c ? { ...c, title } : c));
        setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, title } : c)));
      } else {
        await supabase.from('ai_chats' as any).update({ updated_at: new Date().toISOString() }).eq('id', chat.id);
      }

      const assistantMsg: AIMessage = assistantData
        ? toAIMessage(assistantData as any)
        : { id: crypto.randomUUID(), chatId: chat.id, role: 'assistant', content: answer, references, createdAt: new Date().toISOString() };

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const confirmedUserMsg: AIMessage = { ...tempUserMsg, id: crypto.randomUUID() };
        return [...withoutTemp, confirmedUserMsg, assistantMsg];
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (err?.name !== 'AbortError') {
        console.error('Erro ao enviar mensagem:', err);
        throw err;
      }
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  };

  // Opens a new chat scoped to exactly one document and immediately asks for the
  // structured summary — the "Resumir com IA" entry point from the PDF viewer.
  const startDocumentSummary = async (doc: PDFDocument) => {
    const chat = await createChat();
    if (!chat) return;
    const newFilters: AIChatFilters = { documentIds: [doc.id] };
    setFilters(newFilters);
    await supabase.from('ai_chats' as any).update({ filters: newFilters }).eq('id', chat.id);
    setActiveChat((c) => (c ? { ...c, filters: newFilters } : c));
    await sendMessage(DOCUMENT_SUMMARY_PROMPT, chat, newFilters, doc.title);
  };

  return { chats, activeChat, messages, filters, loading, sending, createChat, selectChat, deleteChat, updateFilters, sendMessage, cancelMessage, startDocumentSummary };
}

function toAIChat(d: any): AIChat {
  return { id: d.id, title: d.title, filters: d.filters || {}, createdAt: d.created_at, updatedAt: d.updated_at };
}

function toAIMessage(d: any): AIMessage {
  return { id: d.id, chatId: d.chat_id, role: d.role, content: d.content, references: d.doc_references || [], createdAt: d.created_at };
}
