# Design: Exportar Estudos em PDF

**Data:** 2026-08-07
**Status:** Aprovado

---

## Visão Geral

Adiciona a capacidade de exportar os "Estudos" (aba Resumos, `TabContentRenderer.tsx` case `'resumos'`) em PDF, tanto individualmente quanto em lote. Estudos em modo Texto viram PDF com texto vetorial real (selecionável/pesquisável), preservando fielmente a estrutura de formatação existente (H1, H2, negrito, itálico, citações). Estudos em modo Mapa Mental viram PDF com o diagrama capturado como imagem.

Não há mudança de backend/banco — tudo roda no cliente.

---

## Novas Dependências

| Pacote | Uso |
|---|---|
| `@react-pdf/renderer` | Monta o PDF com texto vetorial real a partir de uma árvore de componentes declarativos (`Document`/`Page`/`View`/`Text`) |
| `html-to-image` | Captura o mapa mental renderizado (`MindMapViewer`, React Flow) como PNG para embutir no PDF |
| `jszip` | Empacota múltiplos PDFs num único `.zip` na exportação em lote |

Download do arquivo (PDF único ou zip) via `URL.createObjectURL` + `<a download>` nativo — sem dependência extra.

---

## Arquitetura

### Conversão HTML → PDF vetorial (estudos em modo Texto)

O conteúdo de um estudo texto é HTML gerado via `document.execCommand` do navegador (`RichTextEditor.tsx`), incluindo blocos especiais de citação (versículo bíblico / referência de mensagem) inseridos por `formatVersesAsHtml`/`formatMsgAsHtml` (`bible-fetch.ts`, `msg-reference.ts`), que usam `style` inline com cores via CSS custom properties (`hsl(var(--primary))`, `hsl(var(--muted-foreground))`, `hsl(var(--accent))`).

**`src/lib/html-to-pdf-nodes.ts`** — parser/mapper dedicado:

1. Faz parse do HTML salvo (`DOMParser`) e percorre a árvore.
2. Mapeia o subconjunto de tags realmente produzido pelo editor para nós intermediários tipados:
   - `h1`, `h2` → título grande/negrito e título médio/semi-negrito, replicando exatamente a hierarquia visual usada na tela (`[&_h1]:text-2xl [&_h1]:font-bold`, `[&_h2]:text-xl [&_h2]:font-semibold` em `SummariesTab.tsx`)
   - `b`/`strong`, `i`/`em` → negrito/itálico inline, preservando aninhamento
   - `p`, `div`, `br` → quebras de parágrafo/linha
   - `blockquote` → bloco de citação com borda lateral e fundo sutil (mesmo padrão visual das citações de versículo/mensagem)
   - `span[style]`, `font[size][face]` → cor e tamanho de fonte quando presentes
3. Cores expressas como `hsl(var(--x))` são resolvidas por uma tabela fixa com os valores do **tema claro** (`src/index.css`, bloco `:root`) — o PDF sempre imprime no tema claro, independente do tema ativo na tela (não existe "PDF escuro" para impressão/leitura).
4. Fontes: `font-family` do editor (sans-serif/serif/monospace/Georgia/Arial/Times) mapeia para uma das três famílias embutíveis nativamente pelo `@react-pdf/renderer` (Helvetica/Times/Courier); `font size="1".."7"` mapeia para a mesma escala em px já usada no toolbar (`fontSizes` em `RichTextEditor.tsx`).
5. **Fallback de segurança:** qualquer tag não reconhecida ainda tem seu `textContent` emitido como parágrafo padrão — nunca é descartada silenciosamente, e um erro de parse em um nó nunca aborta a exportação inteira.

### Templates de PDF (`@react-pdf/renderer`)

- **`src/lib/pdf/StudyTextDocument.tsx`** — `Document`/`Page` para estudo em modo Texto: cabeçalho (título do estudo, documentos vinculados, data de atualização) + conteúdo mapeado por `html-to-pdf-nodes.ts`. Paginação automática (nativa do `@react-pdf/renderer` quando o texto excede uma página).
- **`src/lib/pdf/StudyImageDocument.tsx`** — `Document`/`Page` para estudo em modo Mapa Mental: mesmo cabeçalho + imagem PNG capturada, escalada para caber na página (múltiplas páginas se o diagrama for muito grande).

### Orquestração (`src/lib/export-study-pdf.ts`)

- `exportStudyToPdf(summary: DocSummary): Promise<void>` — decide o template (`isMindMap(summary.summary)`), gera o blob (`pdf(<Doc/>).toBlob()`) e dispara o download via `<a download>`. Para mapas mentais de estudos não abertos na tela, monta o `MindMapViewer` fora da viewport (invisível) só para captura via `html-to-image`, depois desmonta.
- `exportStudiesToZip(summaries: DocSummary[]): Promise<void>` — gera o PDF de cada estudo (reaproveitando a função acima sem disparar download individual), adiciona cada um ao `JSZip` com nome de arquivo sanitizado a partir do título, gera o zip e dispara um único download (`estudos-DD-MM-AAAA.zip`).
- Falha isolada: se a captura de imagem de um mapa mental falhar (ex.: diagrama vazio), o PDF daquele estudo ainda é gerado — só sem a imagem, com a nota "Mapa mental vazio" no lugar — sem interromper o restante do lote.

---

## Interface

### Exportação individual

- Item **"Exportar PDF"** no menu "⋯" de cada card de estudo em `SummariesTab.tsx` (perto de "Mover para pasta" / "Excluir").
- Botão **"Exportar PDF"** também na tela de visualização do estudo (ao lado de "Editar"), tanto na view inline (embedded) quanto no Dialog de visualização (não-embedded).

### Exportação em lote

- Botão **"Selecionar"** no cabeçalho da lista (`SummariesTab.tsx`, ao lado de "Pasta"/"Novo Estudo") ativa um modo de seleção: cada card passa a exibir um checkbox.
- Seleção funciona através de pastas e da busca (não é restrita à pasta atual).
- Barra de ação fixa aparece quando há itens selecionados: "N selecionados" + botão **"Exportar selecionados"** (baixa um `.zip` com um PDF por estudo) + botão **"Cancelar"** (sai do modo seleção).
- Indicador de carregamento durante a geração ("Gerando PDFs...") — pode levar alguns segundos por causa da captura de imagem dos mapas mentais.

---

## Fora do Escopo

- Exportar múltiplos estudos como um único PDF combinado (decidido: sempre um `.zip` com PDFs separados)
- Exportar pasta inteira automaticamente sem seleção manual (fica só o modo seleção com checkboxes)
- Texto selecionável para o conteúdo do mapa mental (mapas sempre exportam como imagem)
- Customização de template/branding do PDF (papel timbrado, logo, etc.)
- Exportação server-side / geração em lote agendada
