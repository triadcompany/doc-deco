# Design: Migração para Postgres na VPS — Fase 1 (Fundação: backend + autenticação)

**Data:** 2026-08-07
**Status:** Aprovado

---

## Contexto: a migração completa

O doc-deco vai sair do Supabase (banco + Auth) e passar a rodar em cima de um Postgres self-hosted na VPS do usuário (Hostinger, EasyPanel — mesma VPS de `gestor-trafego-triad` e `acervo-igreja-postgres`). O Cloudflare R2 (armazenamento dos PDFs, via `r2-worker/`) **não muda** — fica fora de qualquer uma das fases.

Hoje o doc-deco é uma SPA pura (Vite+React+TypeScript) **sem nenhum backend próprio** — o navegador fala direto com o Supabase via `@supabase/supabase-js`. Migrar significa criar essa camada de servidor do zero, portar 62 políticas de RLS (23 migrations, 11 tabelas), reescrever 12 arquivos do frontend que usam o SDK do Supabase, e migrar os dados de produção.

Dado o tamanho, o trabalho foi fatiado em 5 fases, cada uma com seu próprio ciclo spec → plano → implementação:

1. **Fundação: backend + autenticação** (este documento)
2. Documentos (`documents`)
3. Estudos, pastas, anotações, metas de leitura (`document_summaries`, `study_folders`, `document_annotations`, `reading_goals`, `reading_progress`)
4. Bíblia (`bible_bookmarks`, `bible_highlights`, `bible_notes`, `bible_cross_references`)
5. Limpeza (porta a Edge Function de PDFs órfãos), migração final dos dados de produção e corte

**Requisito inegociável, válido para todas as fases que tocam dados**: os dados de `documents` e `document_summaries` (e tudo ligado a eles) não podem ser perdidos em nenhuma etapa.

**Estratégia de corte**: tudo é construído e validado numa branch separada (`migrate-vps-backend`), sem tocar o app em produção (que continua no Supabase, intocado). Só na Fase 5, depois de tudo validado, acontece um corte único — o Supabase antigo fica de fallback (mesmo padrão usado no Gestor de Tráfego), decide-se depois quando desligar.

---

## Escopo desta fase

Deixar rodando, na VPS, a infraestrutura e a autenticação — sem ainda migrar dado nenhum de `documents`/`document_summaries`/etc (isso é fase 2+). No final desta fase: dá pra logar no doc-deco contra a infraestrutura nova, rodando a branch `migrate-vps-backend` localmente, sem afetar produção.

---

## Arquitetura

Três serviços novos no EasyPanel, mesmo projeto da VPS:

### 1. Postgres — `estudo-biblico-postgress`
Banco dedicado, vazio inicialmente. Acessível internamente via hostname interno do EasyPanel (padrão `<projeto>-estudo-biblico-postgress:5432`, confirmar nome exato ao criar o serviço).

### 2. PostgREST
Imagem oficial `postgrest/postgrest`, apontada pro banco acima. Gera automaticamente uma API REST a partir do schema do Postgres — o mesmo "dialeto" de consultas que `@supabase/supabase-js` já fala (porque o Supabase é construído em cima do PostgREST), então os 11 arquivos do frontend que fazem `.from(tabela).select()/.insert()/.eq()...` não precisam ser reescritos na lógica, só apontados pra outro cliente.

### 3. Serviço de login (Node, pequeno)
Não lida com dados de negócio nenhum — só:
- `POST /login` — recebe usuário/senha, confere o hash bcrypt, emite um JWT e seta como cookie httpOnly/Secure
- `POST /logout` — limpa o cookie
- `GET /session` — confirma se a sessão é válida (usado pelo frontend pra saber se está logado)

Como o app é de uso pessoal (um usuário só), não existe fluxo de signup — a conta é criada por um script de setup, não pela interface.

---

## Autenticação e RLS: reaproveitando as 62 políticas existentes

As políticas de RLS atuais checam `auth.uid()`, uma função do Supabase que lê o usuário logado a partir do JWT da requisição. O PostgREST tem o mesmo mecanismo (expõe as claims do JWT como configuração de sessão do Postgres, `request.jwt.claims`). A ideia é recriar, no Postgres novo, uma função `auth.uid()` equivalente:

```sql
create schema if not exists auth;
create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$ language sql stable;
```

Com isso, as 62 políticas de RLS das 23 migrations continuam funcionando **sem reescrever a lógica de segurança de nenhuma delas** — só reaplicadas como estão no banco novo. O JWT emitido pelo serviço de login precisa carregar `sub` (o id do usuário) e `role: authenticated`, no mesmo formato que o PostgREST espera.

## Migração da senha

O Supabase guarda a senha do usuário como hash bcrypt (acessível via acesso direto ao Postgres do projeto Supabase, no schema `auth`). Plano:
1. Tentar extrair o hash bcrypt real do `auth.users` do Supabase e reaproveitar diretamente — o usuário continua logando com a mesma senha de sempre.
2. Se não for possível (permissão/formato incompatível), plano B: pedir pro usuário definir uma senha nova nesse serviço de login. Não é bloqueante pra fase.

---

## Schema

As 23 migrations em `supabase/migrations/` são reaplicadas no `estudo-biblico-postgress`, removendo as partes específicas de infraestrutura do Supabase (schemas internos `auth`/`storage`/`realtime` que não fazem parte do app) e adicionando o shim de `auth.uid()` acima. Tabelas, colunas, tipos e as 62 políticas de RLS continuam idênticas ao que existe hoje.

Nesta fase, o schema é recriado **vazio** (sem os dados de produção — isso é migrado fase a fase, culminando na Fase 5).

---

## Frontend (branch `migrate-vps-backend`)

- `src/integrations/supabase/client.ts`: único ponto que hoje aponta pro Supabase. Passa a instanciar um cliente PostgREST (biblioteca com API equivalente ao `.from()` do supabase-js) apontado pro endpoint novo.
- `src/hooks/use-auth.tsx`: reescrito para chamar `POST /login`, `POST /logout`, `GET /session` do serviço de login novo, em vez de `supabase.auth.*`. Gerencia sessão via o cookie httpOnly (não precisa guardar token manualmente no frontend).
- Os outros 10 arquivos que usam `supabase.from(...)` **não são tocados nesta fase** — eles dependem de tabelas que só ganham dados reais nas fases 2-4. Compilam contra o cliente novo, mas as tabelas que consultam ainda não existem/estão vazias no banco novo até as fases seguintes.

---

## Critério de conclusão da fase

- Os 3 serviços (`estudo-biblico-postgress`, PostgREST, login) sobem no EasyPanel e respondem
- Rodando a branch `migrate-vps-backend` localmente (apontada pros serviços da VPS), dá pra logar com o usuário real e ver a sessão persistir (cookie), sem tocar no Supabase nem no app em produção
- As políticas de RLS reaplicadas bloqueiam acesso sem token válido (teste manual: requisição sem cookie deve falhar)

## Fora do escopo desta fase

- Qualquer dado de `documents`, `document_summaries` ou as demais tabelas (fases 2-4)
- Deploy em produção / corte do domínio real (fase 5)
- Edge Function de limpeza de PDFs órfãos (fase 5)
- Desligar o projeto Supabase antigo (decisão adiada, fase 5)
