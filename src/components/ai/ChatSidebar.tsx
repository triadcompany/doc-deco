import { AIChat } from '@/hooks/use-ai-chat';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, MessageSquare } from 'lucide-react';

interface ChatSidebarProps {
  chats: AIChat[];
  activeChat: AIChat | null;
  onCreateChat: () => void;
  onSelectChat: (chat: AIChat) => void;
  onDeleteChat: (id: string) => void;
}

export function ChatSidebar({ chats, activeChat, onCreateChat, onSelectChat, onDeleteChat }: ChatSidebarProps) {
  return (
    <div className="flex flex-col h-full border-r border-border/50">
      <div className="p-3 border-b border-border/50 shrink-0">
        <Button onClick={onCreateChat} size="sm" className="w-full gap-2">
          <Plus className="w-4 h-4" />
          Novo Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {chats.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 px-2">
              Nenhum chat ainda. Crie um novo!
            </p>
          )}
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-start gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                activeChat?.id === chat.id
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-secondary/60 text-foreground'
              }`}
              onClick={() => onSelectChat(chat)}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              <span className="flex-1 text-xs leading-snug line-clamp-2 min-w-0">{chat.title}</span>
              <button
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Excluir este chat?')) onDeleteChat(chat.id);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
