import { useState, useEffect, useRef } from 'react';
import { useAIChat, AIReference } from '@/hooks/use-ai-chat';
import { PDFDocument, SearchContext } from '@/lib/types';
import { ChatSidebar } from '@/components/ai/ChatSidebar';
import { ChatArea } from '@/components/ai/ChatArea';
import { ChatInput } from '@/components/ai/ChatInput';
import { ChatFilters } from '@/components/ai/ChatFilters';
import { toast } from 'sonner';
import { Bot, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AITabProps {
  documents: PDFDocument[];
  authors: string[];
  searchContent: (term: string, searchType: 'exact' | 'proximity', filters?: any) => Promise<(PDFDocument & { snippet?: string })[]>;
  onViewDoc: (doc: PDFDocument, ctx?: SearchContext) => void;
  embedded?: boolean;
  pendingSummarizeDoc?: PDFDocument | null;
  onSummarizeHandled?: () => void;
}

export function AITab({ documents, authors, searchContent, onViewDoc, embedded, pendingSummarizeDoc, onSummarizeHandled }: AITabProps) {
  const { chats, activeChat, messages, filters, loading, sending, createChat, selectChat, deleteChat, updateFilters, sendMessage, cancelMessage, startDocumentSummary } =
    useAIChat(searchContent);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const handledDocIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingSummarizeDoc || handledDocIdRef.current === pendingSummarizeDoc.id) return;
    handledDocIdRef.current = pendingSummarizeDoc.id;
    startDocumentSummary(pendingSummarizeDoc)
      .catch((err) => {
        console.error('[AITab] startDocumentSummary error:', err);
        toast.error('Erro ao gerar resumo com IA.');
      })
      .finally(() => onSummarizeHandled?.());
  }, [pendingSummarizeDoc]);

  const handleSend = async (text: string) => {
    let chat = activeChat;
    if (!chat) {
      chat = await createChat();
      if (!chat) return;
    }
    try {
      await sendMessage(text, chat);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error('[AITab] sendMessage error:', err);
      toast.error(`Erro: ${msg}`);
    }
  };

  const handleOpenDoc = (ref: AIReference) => {
    const doc = documents.find((d) => d.id === ref.documentId);
    if (doc) onViewDoc(doc, { searchTerm: '', snippet: ref.snippet });
  };

  return (
    <div className={`flex ${embedded ? 'h-full' : 'h-[calc(100vh-140px)]'} min-h-[500px] rounded-xl border border-border/50 overflow-hidden bg-card`}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-56 shrink-0 flex flex-col bg-secondary/10">
          <ChatSidebar
            chats={chats}
            activeChat={activeChat}
            onCreateChat={createChat}
            onSelectChat={selectChat}
            onDeleteChat={deleteChat}
          />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-secondary/20 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSidebarOpen((v) => !v)}>
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </Button>
          <Bot className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">
            {activeChat ? activeChat.title : 'Assistente IA'}
          </span>
        </div>

        {/* Filters */}
        <ChatFilters
          filters={filters}
          documents={documents}
          authors={authors}
          onChange={updateFilters}
        />

        {/* Messages */}
        {activeChat ? (
          <>
            <ChatArea
              messages={messages}
              loading={loading}
              sending={sending}
              onOpenDoc={handleOpenDoc}
            />
            <ChatInput onSend={handleSend} onCancel={cancelMessage} disabled={sending} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <Bot className="w-14 h-14 text-primary/30" />
            <div>
              <p className="text-base font-semibold">Pergunte sobre seus PDFs</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Crie um novo chat ou selecione um existente para começar a conversar sobre os documentos da sua biblioteca.
              </p>
            </div>
            <Button onClick={createChat} className="gap-2">
              <Bot className="w-4 h-4" />
              Iniciar conversa
            </Button>
          </div>
        )}

        {/* Input when no active chat but user types */}
        {!activeChat && (
          <ChatInput onSend={handleSend} disabled={sending} />
        )}
      </div>
    </div>
  );
}
