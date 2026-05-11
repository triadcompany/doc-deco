import { useState, useEffect, useCallback } from 'react';
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

export function useAIChat(searchContent: SearchFn) {
  const { user } = useAuth();
  const [chats, setChats] = useState<AIChat[]>([]);
  const [activeChat, setActiveChat] = useState<AIChat | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [filters, setFilters] = useState<AIChatFilters>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

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

  const createChat = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('ai_chats' as any)
      .insert({ user_id: user.id, title: 'Novo Chat', filters: {} })
      .select()
      .single();
    if (error || !data) return;
    const chat = toAIChat(data as any);
    setChats((prev) => [chat, ...prev]);
    setActiveChat(chat);
    setMessages([]);
    setFilters({});
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

  const sendMessage = async (text: string) => {
    if (!activeChat || !text.trim()) return;
    setSending(true);

    const tempId = crypto.randomUUID();
    const tempUserMsg: AIMessage = {
      id: tempId,
      chatId: activeChat.id,
      role: 'user',
      content: text,
      references: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // 1. Retrieve relevant chunks
      const searchFilters: any = {};
      if (filters.author) searchFilters.author = filters.author;
      if (filters.tags?.length) searchFilters.tags = filters.tags;

      const results = await searchContent(text, 'proximity', searchFilters);

      let filtered = results;
      if (filters.documentIds?.length) {
        filtered = results.filter((r) => filters.documentIds!.includes(r.id));
      }

      const chunks = filtered.slice(0, 10).map((r) => ({
        documentId: r.id,
        title: r.title,
        author: r.author,
        date: r.date,
        snippet: r.snippet || '',
      }));

      // 2. Build conversation history for Gemini
      const history: GeminiMessage[] = messages
        .slice(-10)
        .map((m) => ({ role: m.role === 'user' ? 'user' : ('model' as const), content: m.content }));

      // 3. Call Gemini
      const answer = await askGemini(text, chunks, history);

      // 4. Extract references mentioned in the answer
      const references: AIReference[] = chunks.filter(
        (c) => answer.includes(c.title) || answer.includes(c.author)
      );

      // 5. Persist messages
      await supabase.from('ai_messages' as any).insert({
        chat_id: activeChat.id,
        role: 'user',
        content: text,
        references: [],
      });

      const { data: assistantData } = await supabase
        .from('ai_messages' as any)
        .insert({ chat_id: activeChat.id, role: 'assistant', content: answer, references })
        .select()
        .single();

      // 6. Update chat title on first message
      const isFirstMessage = messages.length === 0;
      if (isFirstMessage) {
        const title = text.length > 60 ? text.slice(0, 60) + '...' : text;
        await supabase.from('ai_chats' as any).update({ title, updated_at: new Date().toISOString() }).eq('id', activeChat.id);
        setActiveChat((c) => (c ? { ...c, title } : c));
        setChats((prev) => prev.map((c) => (c.id === activeChat.id ? { ...c, title } : c)));
      } else {
        await supabase.from('ai_chats' as any).update({ updated_at: new Date().toISOString() }).eq('id', activeChat.id);
      }

      const assistantMsg: AIMessage = assistantData
        ? toAIMessage(assistantData as any)
        : { id: crypto.randomUUID(), chatId: activeChat.id, role: 'assistant', content: answer, references, createdAt: new Date().toISOString() };

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const confirmedUserMsg: AIMessage = { ...tempUserMsg, id: crypto.randomUUID() };
        return [...withoutTemp, confirmedUserMsg, assistantMsg];
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    } finally {
      setSending(false);
    }
  };

  return { chats, activeChat, messages, filters, loading, sending, createChat, selectChat, deleteChat, updateFilters, sendMessage };
}

function toAIChat(d: any): AIChat {
  return { id: d.id, title: d.title, filters: d.filters || {}, createdAt: d.created_at, updatedAt: d.updated_at };
}

function toAIMessage(d: any): AIMessage {
  return { id: d.id, chatId: d.chat_id, role: d.role, content: d.content, references: d.references || [], createdAt: d.created_at };
}
