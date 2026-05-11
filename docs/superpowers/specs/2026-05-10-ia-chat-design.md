# Design: Aba IA — Chat com PDFs

**Data:** 2026-05-10
**Status:** Aprovado

---

## Visão Geral

Adiciona uma aba "IA" ao DocVault que permite ao usuário fazer perguntas em linguagem natural sobre o conteúdo dos PDFs da biblioteca. O sistema usa o texto já extraído dos PDFs (campo `content` no banco) como base de recuperação e o Gemini API para gerar respostas fundamentadas, com referências clicáveis aos documentos fonte.

Não há serviços novos: tudo roda sobre Supabase (banco + RLS) e chamada direta ao Gemini API do frontend.

---

## Arquitetura

### Fluxo de uma pergunta

1. Usuário digita a pergunta no chat
2. Frontend extrai termos de busca da pergunta
3. Chama `searchContent` (já existe em `use-documents.ts`) para recuperar trechos relevantes do banco, aplicando filtros ativos (autor, tags, documentos específicos)
4. Monta o prompt: histórico da conversa + trechos recuperados + pergunta
5. Chama Gemini API (`gemini-2.0-flash`) diretamente do frontend
6. Exibe a resposta com referências aos documentos usados
7. Salva pergunta + resposta + referências no banco

### Limitações conhecidas

- Chaves de API do Gemini ficam no frontend (aceito, app não é produção)
- Contexto limitado pelo token window do Gemini (~1M tokens — suficiente para muitos trechos)
- Qualidade da recuperação depende da busca textual existente (sem embeddings)

---

## Banco de Dados

### Tabela `ai_chats`

```sql
CREATE TABLE public.ai_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Novo Chat',
  filters JSONB DEFAULT '{}',  -- { author, tags, documentIds }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela `ai_messages`

```sql
CREATE TABLE public.ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  references JSONB DEFAULT '[]',  -- [{ documentId, title, author, snippet }]
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Ambas com RLS: usuário vê e gerencia apenas seus próprios chats/mensagens.

---

## Interface

### Layout da aba "IA"

```
┌─────────────────────────────────────────────────────┐
│  [+ Novo Chat]                                       │
│  ─────────────────                                   │
│  > O que Pr. Vin fala...    (chat ativo)            │
│    Armagedón e o fim...                             │
│    Resumo do livro...                               │
├──────────────┬──────────────────────────────────────┤
│ Lista chats  │  Área de conversa                    │
│ (sidebar)    │                                      │
│              │  [Filtros: Autor | Tags | Docs]      │
│              │  ─────────────────────────────       │
│              │  👤 O que Pr. Vin fala sobre...      │
│              │                                      │
│              │  🤖 Segundo o documento "X" (1979)   │
│              │     Pr. Vin afirma que...            │
│              │     📄 X · 📄 Y · 📄 Z              │
│              │                                      │
│              │  [Digite sua pergunta...] [Enviar]   │
└──────────────┴──────────────────────────────────────┘
```

### Componentes

- `AITab` — container da aba, gerencia chat ativo
- `ChatSidebar` — lista de chats + botão novo chat
- `ChatArea` — histórico de mensagens do chat ativo
- `MessageBubble` — balão de pergunta (user) ou resposta (assistant)
- `ReferencesBar` — lista clicável de documentos referenciados na resposta
- `ChatInput` — input + botão enviar + indicador de loading
- `ChatFilters` — filtros por autor, tags, documentos específicos
- `useAIChat` — hook: gerencia chats, mensagens, chamada ao Gemini

### Hooks

**`useAIChat()`**
- `chats`, `activeChat`, `messages`
- `createChat()`, `selectChat(id)`, `deleteChat(id)`
- `sendMessage(text)` — executa o fluxo completo (busca → Gemini → salva)
- `updateFilters(filters)`

---

## Prompt para o Gemini

```
Você é um assistente de estudo bíblico. Responda com base APENAS nos trechos
fornecidos abaixo. Se a resposta não estiver nos trechos, diga claramente.
Ao final, liste quais documentos usou no formato: [Título (Autor, Data)].

TRECHOS RELEVANTES:
{trechos recuperados com título e autor de cada um}

HISTÓRICO DA CONVERSA:
{últimas N mensagens}

PERGUNTA: {pergunta do usuário}
```

---

## Variáveis de Ambiente

Adicionar ao `.env` e ao Lovable secrets:
- `VITE_GEMINI_API_KEY` — chave da Google AI Studio

---

## Fora do Escopo

- Embeddings / busca semântica (pode ser adicionado no futuro)
- Geração automática de resumo no upload
- Compartilhar chats entre usuários
- Exportar conversa
