import { AIMessage, AIReference } from '@/hooks/use-ai-chat';
import { FileText } from 'lucide-react';

interface MessageBubbleProps {
  message: AIMessage;
  onOpenDoc?: (ref: AIReference) => void;
}

export function MessageBubble({ message, onOpenDoc }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-secondary text-foreground rounded-bl-sm'
        }`}
      >
        {message.content}
      </div>

      {!isUser && message.references.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-[85%]">
          {message.references.map((ref, i) => (
            <button
              key={i}
              onClick={() => onOpenDoc?.(ref)}
              className="flex items-center gap-1 text-[10px] bg-accent/60 hover:bg-accent text-accent-foreground rounded-full px-2.5 py-1 transition-colors"
              title={`${ref.title} — ${ref.author}`}
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span className="max-w-[140px] truncate">{ref.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
