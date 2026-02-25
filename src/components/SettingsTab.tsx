import { useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { SettingsEntry } from '@/hooks/use-settings';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Trash2, Users, Languages, Settings2, Sun, Moon, UserCircle, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
          <div className="grid grid-cols-[1fr_180px_80px] gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b border-border">
            <span>Nome</span>
            <span>Data de Cadastro</span>
            <span className="text-right">Ações</span>
          </div>
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

function ProfileSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const updateName = useMutation({
    mutationFn: async (newName: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: newName.trim() })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      setEditingName(false);
      toast.success('Nome atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar nome'),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl + '?t=' + Date.now() })
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const initials = (profile?.display_name || user?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="glass rounded-xl p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold">Meu Perfil</h3>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas informações pessoais</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Avatar */}
        <div className="relative group">
          <Avatar className="w-24 h-24 border-2 border-primary/20">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {uploadingAvatar ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : (
              <Camera className="w-6 h-6 text-primary" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4 w-full">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && nameValue.trim() && updateName.mutate(nameValue)}
                  className="h-9 bg-secondary/50"
                  autoFocus
                />
                <Button size="sm" onClick={() => nameValue.trim() && updateName.mutate(nameValue)} disabled={updateName.isPending}>
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-medium">{profile?.display_name || 'Sem nome'}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    setNameValue(profile?.display_name || '');
                    setEditingName(true);
                  }}
                >
                  Editar
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="font-medium text-sm">{user?.email || '—'}</p>
          </div>
        </div>
      </div>
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
          Gerencie seu perfil, autores e tradutores
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="bg-secondary/50 w-full justify-start">
          <TabsTrigger value="perfil" className="gap-1.5 flex-1">
            <UserCircle className="w-3.5 h-3.5" />
            Perfil
          </TabsTrigger>
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

        <TabsContent value="perfil">
          <ProfileSection />
        </TabsContent>

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
