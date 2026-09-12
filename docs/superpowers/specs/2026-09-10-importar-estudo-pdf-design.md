# Importar estudo a partir de PDF — Design

## Problema

Hoje o app exporta um estudo como PDF (`src/lib/export-study-pdf.tsx` →
`StudyTextDocument.tsx`, texto vetorial com título, badges de mensagens
vinculadas, linha "Atualizado em ...", e blocos H1/H2/parágrafo/citação).

Não existe caminho de volta: não dá pra pegar um PDF exportado e recriar o
estudo dentro do app. O usuário quer isso — importar o PDF **como estudo**
(não como documento/mensagem).

## Decisões

- **Fidelidade:** reconstruir a estrutura de blocos pelo tamanho da fonte
  (H1/H2/parágrafo). Aceita-se perder: negrito/itálico inline, cor, e a borda
  colorida das caixas de citação (a referência bíblica volta como `<h2>` e os
  versículos como parágrafos, só sem a caixa).
- **Fluxo:** abrir o editor de estudo já preenchido (título + conteúdo) pra o
  usuário revisar e salvar. Não salva direto.
- **Quantidade:** um PDF por vez. Importar o `.zip` da exportação em lote fica
  fora de escopo.
- **Descartadas:** extrair só texto puro (sem estrutura); processar o PDF no
  servidor (o `pdfjs` já roda no cliente, usado em `src/lib/pdf-text-extract.ts`).

## Não-objetivos

- Revincular as mensagens (documentos) a partir dos badges do PDF. O usuário
  refaz o vínculo no editor se quiser.
- Recuperar negrito, itálico, cor, ou o estilo visual das caixas de citação.
- Importar `.zip` ou múltiplos PDFs de uma vez.
- OCR de PDFs digitalizados (sem camada de texto).

## Arquitetura

### Módulo novo: `src/lib/import-study-pdf.ts`

Isolado, testável, sem dependência de React ou do Supabase.

```ts
export async function importStudyFromPdf(file: File): Promise<{ title: string; html: string }>
```

**Passos:**

1. `pdfjs.getDocument({ data: await file.arrayBuffer() })`.
2. Pra cada página, `page.getTextContent()` → itens com `str`, posição
   (`transform[4]`, `transform[5]`) e tamanho de fonte (derivado de
   `transform[3]` / `item.height`).
3. **Agrupar itens em linhas** por posição vertical (y), com tolerância pequena
   (ex.: itens cujo y difere menos que ~metade da altura da linha são a mesma
   linha). Concatenar os `str` da linha na ordem de x. O tamanho de fonte da
   linha = o **maior** tamanho entre os itens dela. Lembrar que em PDF o eixo y
   cresce pra cima: uma linha mais abaixo na página tem `y` **menor**, então o
   gap entre duas linhas é `y_anterior - y_atual`.
4. **Percorrer as páginas em ordem.** Numa lista única de linhas
   `{ text, fontSize, y, page }`.
5. **Extrair o título e pular o cabeçalho:**
   - Título = texto da **primeira linha não-vazia**.
   - Se existir uma linha que casa `/^Atualizado em /i`, o conteúdo começa
     **depois** dela (tudo entre o título e essa linha é cabeçalho do PDF —
     título repetido + badges + data — e é descartado).
   - Se **não** existir essa linha (PDF de outra origem), o conteúdo começa na
     **segunda** linha não-vazia.
6. **Classificar cada linha de conteúdo pelo tamanho de fonte:**
   - `>= H1_MIN` (~16.5) → bloco `heading1`
   - `>= H2_MIN` (~12.5) e `< H1_MIN` → bloco `heading2`
   - `< H2_MIN` mas `>= PARA_MIN` (~9.5) → linha de parágrafo
   - `< PARA_MIN` → ignorar (resíduo de badge/meta que tenha escapado)

   As constantes são calibradas pelos tamanhos fixos do `StudyTextDocument`
   (título 20, h1 18, h2 14, parágrafo 10.5, meta 9, badge 8).
7. **Montar blocos:**
   - Cada linha `heading1`/`heading2` vira seu próprio bloco.
   - Linhas de parágrafo **consecutivas** com espaço vertical pequeno entre elas
     (gap `<= ~1.6 * fontSize`) juntam no **mesmo** parágrafo (o exportador
     quebra um parágrafo em várias linhas). Gap maior, ou troca de página, ou
     um heading no meio → fecha o parágrafo atual e começa outro.
   - Consequência aceita: um parágrafo do original que foi partido por uma
     quebra de página volta como dois parágrafos. É raro e o usuário junta no
     editor se quiser.
8. **Serializar para HTML:** `<h1>`, `<h2>`, `<p>` puros, sem estilo inline,
   com o texto escapado (`&`, `<`, `>`). Junta tudo numa string.
9. Retorna `{ title, html }`. Se não achou nenhuma linha de título, `title` é
   `''` (o chamador usa o nome do arquivo como fallback).

### Integração: `src/components/SummariesTab.tsx`

- Botão **"Importar"** no cabeçalho da lista de estudos, ao lado de
  "Novo Estudo" / "Pasta". Ícone de upload/importar.
- `<input type="file" accept="application/pdf,.pdf" hidden>` acionado pelo botão.
- Estado `importing: boolean` (spinner no botão enquanto processa).
- Ao selecionar arquivo:
  1. `setImporting(true)`.
  2. `try { const { title, html } = await importStudyFromPdf(file); }`.
  3. `resetForm()` (garante estudo novo, sem id — o autosave criará a linha).
  4. `setStudyTitle(title || file.name.replace(/\.pdf$/i, ''))`.
  5. `setSummaryText(html)`.
  6. Abre o editor: `embedded ? setInlineView('create') : setDialogOpen(true)`.
  7. `finally { setImporting(false); e.target.value = ''; }` (reset do input pra
     permitir reimportar o mesmo arquivo).
- A partir daí é o fluxo normal de criar estudo: revisar, ajustar, Salvar. O
  autosave de 30s já protege o estudo importado enquanto é editado.

## Erros

| Situação | Tratamento |
|---|---|
| PDF sem camada de texto (imagem/digitalização) | `toast.error('Não foi possível ler texto desse PDF.')` |
| Arquivo não é PDF / corrompido (`pdfjs` lança) | `toast.error('Arquivo inválido.')` |
| Título vazio (sem 1ª linha) | usa `file.name` sem `.pdf` como título |
| Conteúdo vazio após o cabeçalho | abre o editor mesmo assim, só com o título; usuário decide |

## Testes

### Unitário — `src/lib/import-study-pdf.test.ts`

Testar a lógica de **classificação e montagem de blocos** com entrada simulada
(lista de linhas `{ text, fontSize, y, page }`), extraindo essa lógica numa
função pura interna (ex.: `linesToStudyHtml(lines)`), sem precisar de PDF real:

- título + parágrafo simples
- H1 e H2 reconhecidos pelo tamanho de fonte
- parágrafo que ocupa várias linhas (gap pequeno) vira um `<p>` só
- duas linhas de parágrafo com gap grande viram dois `<p>`
- linha `"Atualizado em ..."` e o que vem antes dela são descartados
- modo fallback: sem `"Atualizado em"`, 2ª linha em diante é conteúdo
- caracteres `& < >` escapados no HTML

### End-to-end (manual, em produção após deploy)

Exportar um estudo conhecido → importar o PDF → conferir que o título e a
sequência de blocos (H1/H2/parágrafos) batem com o original.

## Arquivos afetados

- **novo** `src/lib/import-study-pdf.ts`
- **novo** `src/lib/import-study-pdf.test.ts`
- `src/components/SummariesTab.tsx` — botão "Importar", input escondido, estado
  `importing`, handler de importação
