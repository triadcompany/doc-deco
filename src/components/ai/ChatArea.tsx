import { useEffect, useRef } from 'react';
import { AIMessage, AIReference } from '@/hooks/use-ai-chat';
import { MessageBubble } from '@/components/ai/MessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot } from 'lucide-react';

interface ChatAreaProps {
  messages: AIMessage[];
  loading: boolean;
  sending: boolean;
  onOpenDoc?: (ref: AIReference) => void;
}

export function ChatArea({ messages, loading, sending, onOpenDoc }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 text-muted-foreground">
        <Bot className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">Faça uma pergunta sobre seus documentos</p>
        <p className="text-xs max-w-xs">
          Ex: "O que o Pr. Vin fala sobre Armagedão?" ou "Resuma o tema principal deste livro."
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onOpenDoc={onOpenDoc} />
        ))}
        {sending && (
          <div className="flex items-start gap-2">
            <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Pesquisando e gerando resposta...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
