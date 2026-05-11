import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, X } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onCancel, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 items-end p-3 border-t border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Digite sua pergunta... (Enter para enviar, Shift+Enter para nova linha)"
        className="resize-none min-h-[44px] max-h-32 text-sm"
        rows={1}
        disabled={disabled}
      />
      {disabled ? (
        <Button
          onClick={onCancel}
          variant="outline"
          size="icon"
          className="shrink-0 h-11 w-11 border-destructive/50 text-destructive hover:bg-destructive/10"
          title="Cancelar"
        >
          <X className="w-4 h-4" />
        </Button>
      ) : (
        <Button onClick={handleSend} disabled={!text.trim()} size="icon" className="shrink-0 h-11 w-11">
          <Send className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
