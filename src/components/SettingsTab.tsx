import { useState } from 'react';
import { useTheme } from 'next-themes';
import { SettingsEntry } from '@/hooks/use-settings';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Users, Languages, Settings2, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsTabProps {
  authors: SettingsEntry[];
  translators: SettingsEntry[];
  addAuthor: (name: string) => void;
  removeAuthor: (id: string) => void;
  addTranslator: (name: string) => void;
  removeTranslator: (id: string) => void;
}

function EntryManager({
  title,
  description,
  entries,
  onAdd,
  onRemove,
  placeholder,
}: {
  title: string;
  description: string;
  entries: SettingsEntry[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  placeholder: string;
}) {
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) {
      toast.error('Digite um nome');
      return;
    }
    if (entries.some((e) => e.name.toLowerCase() === name.trim().toLowerCase())) {
      toast.error('Já existe um registro com esse nome');
      return;
    }
    onAdd(name);
    setName('');
    toast.success('Adicionado com sucesso!');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('pt-BR');
  };

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 h-10 bg-secondary/50"
        />
        <Button onClick={handleAdd} className="shrink-0 gap-2">
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      </div>

      {entries.length > 0 && (
        <div>
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_180px_80px] gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b border-border">
            <span>Nome</span>
            <span>Data de Cadastro</span>
            <span className="text-right">Ações</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[1fr_180px_80px] gap-4 px-4 py-3 items-center text-sm"
              >
                <span className="font-medium">{entry.name}</span>
                <span className="text-muted-foreground">{formatDate(entry.createdAt)}</span>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      onRemove(entry.id);
                      toast.success('Removido com sucesso!');
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum registro cadastrado
        </p>
      )}
    </div>
  );
}

function AppSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold">Aplicativo</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configurações gerais do aplicativo
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Tema</Label>
        <div className="flex gap-3">
          <Button
            variant={theme === 'light' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => setTheme('light')}
          >
            <Sun className="w-4 h-4" />
            Claro
          </Button>
          <Button
            variant={theme === 'dark' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => setTheme('dark')}
          >
            <Moon className="w-4 h-4" />
            Escuro
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsTab({
  authors,
  translators,
  addAuthor,
  removeAuthor,
  addTranslator,
  removeTranslator,
}: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie autores e tradutores
        </p>
      </div>

      <Tabs defaultValue="autores" className="space-y-6">
        <TabsList className="bg-secondary/50 w-full justify-start">
          <TabsTrigger value="autores" className="gap-1.5 flex-1">
            <Users className="w-3.5 h-3.5" />
            Autores
          </TabsTrigger>
          <TabsTrigger value="tradutores" className="gap-1.5 flex-1">
            <Languages className="w-3.5 h-3.5" />
            Tradutores
          </TabsTrigger>
          <TabsTrigger value="aplicativo" className="gap-1.5 flex-1">
            <Settings2 className="w-3.5 h-3.5" />
            Aplicativo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="autores">
          <EntryManager
            title="Autores"
            description="Cadastre e gerencie os autores dos documentos"
            entries={authors}
            onAdd={addAuthor}
            onRemove={removeAuthor}
            placeholder="Nome do autor"
          />
        </TabsContent>

        <TabsContent value="tradutores">
          <EntryManager
            title="Tradutores"
            description="Cadastre e gerencie os tradutores dos documentos"
            entries={translators}
            onAdd={addTranslator}
            onRemove={removeTranslator}
            placeholder="Nome do tradutor"
          />
        </TabsContent>

        <TabsContent value="aplicativo">
          <AppSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
