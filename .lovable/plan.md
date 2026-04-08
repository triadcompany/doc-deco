

## Plano: Inserir versículos bíblicos no editor de estudos

### O que será feito
Quando o usuário digitar uma referência bíblica no editor de texto (ex: "Josué 2:10-21"), o sistema detectará automaticamente e mostrará um pequeno botão/popup oferecendo a opção de inserir os versículos diretamente no texto do estudo.

### Etapas

**1. Expandir o parser de escrituras para suportar intervalos de versículos**

Arquivo: `src/lib/scripture-parser.ts`

- Atualizar a regex para capturar formatos como "Josué 2:10-21" (capítulo:versículo_inicial-versículo_final), além do formato atual "Jo 3:16"
- Adicionar campos `verseEnd` ao `ScriptureRef` para representar intervalos
- Suportar também nomes completos como "Josué", "Romanos" etc.

**2. Criar lógica de busca de versículos reutilizável**

Arquivo: `src/lib/bible-fetch.ts` (novo)

- Extrair a lógica de fetch de capítulo do `use-bible.ts` em uma função pura que retorna os versículos de um intervalo (ex: Josué cap 2, vers 10 a 21)
- Retornar texto formatado pronto para inserir no editor

**3. Adicionar detecção e popup no RichTextEditor**

Arquivo: `src/components/RichTextEditor.tsx`

- No evento `onInput` ou `onKeyUp`, analisar o texto ao redor do cursor
- Quando uma referência bíblica válida for detectada, exibir um pequeno popup posicionado próximo ao texto com um botão "Inserir versículos"
- Ao clicar, buscar os versículos via API e inserir como bloco formatado (blockquote ou similar) logo abaixo da referência
- O popup desaparece após inserir ou ao mover o cursor para outro lugar

**4. Formato da inserção**

Os versículos serão inseridos como um bloco visual distinto:
```
Josué 2:10-21
┌──────────────────────────────────┐
│ 10 Porque ouvimos que o SENHOR...│
│ 11 O que ouvindo, desfaleceu...  │
│ ...                              │
│ 21 E ela disse: Conforme as...   │
└──────────────────────────────────┘
```

Usando um `<blockquote>` estilizado com versículos numerados, inserido diretamente no HTML do contentEditable.

### Detalhes técnicos

- A detecção usa debounce (500ms) para não processar a cada tecla
- O popup é um elemento absoluto posicionado via `getBoundingClientRect()` do texto detectado
- A busca de versículos reutiliza o mesmo sistema de cache do `use-bible` (GitHub raw para ARC/KJA)
- Versão padrão: ARC (Almeida Revista e Corrigida)

### Arquivos modificados
- `src/lib/scripture-parser.ts` — suporte a intervalos de versículos
- `src/lib/bible-fetch.ts` — novo, função de busca de versículos
- `src/components/RichTextEditor.tsx` — detecção + popup + inserção

