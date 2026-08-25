/**
 * Parse scripture references like "Jo 3:16", "Gn 1:1-3", "Rm 8:28" in text
 * and return segments (text or reference) for rendering clickable links.
 */

// Common Portuguese Bible book abbreviations mapped to their full names and standard abbrevs
const BOOK_MAP: Record<string, { name: string; abbrev: string }> = {
  // Old Testament
  'gn': { name: 'Gênesis', abbrev: 'gn' },
  'gênesis': { name: 'Gênesis', abbrev: 'gn' },
  'genesis': { name: 'Gênesis', abbrev: 'gn' },
  'ex': { name: 'Êxodo', abbrev: 'ex' },
  'êxodo': { name: 'Êxodo', abbrev: 'ex' },
  'exodo': { name: 'Êxodo', abbrev: 'ex' },
  'lv': { name: 'Levítico', abbrev: 'lv' },
  'levítico': { name: 'Levítico', abbrev: 'lv' },
  'levitico': { name: 'Levítico', abbrev: 'lv' },
  'nm': { name: 'Números', abbrev: 'nm' },
  'números': { name: 'Números', abbrev: 'nm' },
  'numeros': { name: 'Números', abbrev: 'nm' },
  'dt': { name: 'Deuteronômio', abbrev: 'dt' },
  'deuteronômio': { name: 'Deuteronômio', abbrev: 'dt' },
  'deuteronomio': { name: 'Deuteronômio', abbrev: 'dt' },
  'js': { name: 'Josué', abbrev: 'js' },
  'josué': { name: 'Josué', abbrev: 'js' },
  'josue': { name: 'Josué', abbrev: 'js' },
  'jz': { name: 'Juízes', abbrev: 'jz' },
  'juízes': { name: 'Juízes', abbrev: 'jz' },
  'juizes': { name: 'Juízes', abbrev: 'jz' },
  'rt': { name: 'Rute', abbrev: 'rt' },
  'rute': { name: 'Rute', abbrev: 'rt' },
  '1sm': { name: '1 Samuel', abbrev: '1sm' },
  '1samuel': { name: '1 Samuel', abbrev: '1sm' },
  'isamuel': { name: '1 Samuel', abbrev: '1sm' },
  '2sm': { name: '2 Samuel', abbrev: '2sm' },
  '2samuel': { name: '2 Samuel', abbrev: '2sm' },
  'iisamuel': { name: '2 Samuel', abbrev: '2sm' },
  '1rs': { name: '1 Reis', abbrev: '1rs' },
  '1reis': { name: '1 Reis', abbrev: '1rs' },
  'ireis': { name: '1 Reis', abbrev: '1rs' },
  '2rs': { name: '2 Reis', abbrev: '2rs' },
  '2reis': { name: '2 Reis', abbrev: '2rs' },
  'iireis': { name: '2 Reis', abbrev: '2rs' },
  '1cr': { name: '1 Crônicas', abbrev: '1cr' },
  '1crônicas': { name: '1 Crônicas', abbrev: '1cr' },
  '1cronicas': { name: '1 Crônicas', abbrev: '1cr' },
  'icrônicas': { name: '1 Crônicas', abbrev: '1cr' },
  'icronicas': { name: '1 Crônicas', abbrev: '1cr' },
  '2cr': { name: '2 Crônicas', abbrev: '2cr' },
  '2crônicas': { name: '2 Crônicas', abbrev: '2cr' },
  '2cronicas': { name: '2 Crônicas', abbrev: '2cr' },
  'iicrônicas': { name: '2 Crônicas', abbrev: '2cr' },
  'iicronicas': { name: '2 Crônicas', abbrev: '2cr' },
  'ed': { name: 'Esdras', abbrev: 'ed' },
  'esdras': { name: 'Esdras', abbrev: 'ed' },
  'ne': { name: 'Neemias', abbrev: 'ne' },
  'neemias': { name: 'Neemias', abbrev: 'ne' },
  'et': { name: 'Ester', abbrev: 'et' },
  'ester': { name: 'Ester', abbrev: 'et' },
  'jó': { name: 'Jó', abbrev: 'jo_at' },
  'job': { name: 'Jó', abbrev: 'jo_at' },
  'sl': { name: 'Salmos', abbrev: 'sl' },
  'salmos': { name: 'Salmos', abbrev: 'sl' },
  'pv': { name: 'Provérbios', abbrev: 'pv' },
  'provérbios': { name: 'Provérbios', abbrev: 'pv' },
  'proverbios': { name: 'Provérbios', abbrev: 'pv' },
  'ec': { name: 'Eclesiastes', abbrev: 'ec' },
  'eclesiastes': { name: 'Eclesiastes', abbrev: 'ec' },
  'ct': { name: 'Cantares', abbrev: 'ct' },
  'cantares': { name: 'Cantares', abbrev: 'ct' },
  'is': { name: 'Isaías', abbrev: 'is' },
  'isaías': { name: 'Isaías', abbrev: 'is' },
  'isaias': { name: 'Isaías', abbrev: 'is' },
  'jr': { name: 'Jeremias', abbrev: 'jr' },
  'jeremias': { name: 'Jeremias', abbrev: 'jr' },
  'lm': { name: 'Lamentações', abbrev: 'lm' },
  'lamentações': { name: 'Lamentações', abbrev: 'lm' },
  'lamentacoes': { name: 'Lamentações', abbrev: 'lm' },
  'ez': { name: 'Ezequiel', abbrev: 'ez' },
  'ezequiel': { name: 'Ezequiel', abbrev: 'ez' },
  'dn': { name: 'Daniel', abbrev: 'dn' },
  'daniel': { name: 'Daniel', abbrev: 'dn' },
  'os': { name: 'Oséias', abbrev: 'os' },
  'oséias': { name: 'Oséias', abbrev: 'os' },
  'oseias': { name: 'Oséias', abbrev: 'os' },
  'jl': { name: 'Joel', abbrev: 'jl' },
  'joel': { name: 'Joel', abbrev: 'jl' },
  'am': { name: 'Amós', abbrev: 'am' },
  'amós': { name: 'Amós', abbrev: 'am' },
  'amos': { name: 'Amós', abbrev: 'am' },
  'ob': { name: 'Obadias', abbrev: 'ob' },
  'obadias': { name: 'Obadias', abbrev: 'ob' },
  'jn': { name: 'Jonas', abbrev: 'jn' },
  'jonas': { name: 'Jonas', abbrev: 'jn' },
  'mq': { name: 'Miquéias', abbrev: 'mq' },
  'miquéias': { name: 'Miquéias', abbrev: 'mq' },
  'miqueias': { name: 'Miquéias', abbrev: 'mq' },
  'na': { name: 'Naum', abbrev: 'na' },
  'naum': { name: 'Naum', abbrev: 'na' },
  'hc': { name: 'Habacuque', abbrev: 'hc' },
  'habacuque': { name: 'Habacuque', abbrev: 'hc' },
  'sf': { name: 'Sofonias', abbrev: 'sf' },
  'sofonias': { name: 'Sofonias', abbrev: 'sf' },
  'ag': { name: 'Ageu', abbrev: 'ag' },
  'ageu': { name: 'Ageu', abbrev: 'ag' },
  'zc': { name: 'Zacarias', abbrev: 'zc' },
  'zacarias': { name: 'Zacarias', abbrev: 'zc' },
  'ml': { name: 'Malaquias', abbrev: 'ml' },
  'malaquias': { name: 'Malaquias', abbrev: 'ml' },
  // New Testament
  'mt': { name: 'Mateus', abbrev: 'mt' },
  'mateus': { name: 'Mateus', abbrev: 'mt' },
  'mc': { name: 'Marcos', abbrev: 'mc' },
  'marcos': { name: 'Marcos', abbrev: 'mc' },
  'lc': { name: 'Lucas', abbrev: 'lc' },
  'lucas': { name: 'Lucas', abbrev: 'lc' },
  'jo': { name: 'João', abbrev: 'jo' },
  'joão': { name: 'João', abbrev: 'jo' },
  'joao': { name: 'João', abbrev: 'jo' },
  'at': { name: 'Atos', abbrev: 'at' },
  'atos': { name: 'Atos', abbrev: 'at' },
  'rm': { name: 'Romanos', abbrev: 'rm' },
  'romanos': { name: 'Romanos', abbrev: 'rm' },
  '1co': { name: '1 Coríntios', abbrev: '1co' },
  '1coríntios': { name: '1 Coríntios', abbrev: '1co' },
  '1corintios': { name: '1 Coríntios', abbrev: '1co' },
  'icoríntios': { name: '1 Coríntios', abbrev: '1co' },
  'icorintios': { name: '1 Coríntios', abbrev: '1co' },
  '2co': { name: '2 Coríntios', abbrev: '2co' },
  '2coríntios': { name: '2 Coríntios', abbrev: '2co' },
  '2corintios': { name: '2 Coríntios', abbrev: '2co' },
  'iicoríntios': { name: '2 Coríntios', abbrev: '2co' },
  'iicorintios': { name: '2 Coríntios', abbrev: '2co' },
  'gl': { name: 'Gálatas', abbrev: 'gl' },
  'gálatas': { name: 'Gálatas', abbrev: 'gl' },
  'galatas': { name: 'Gálatas', abbrev: 'gl' },
  'ef': { name: 'Efésios', abbrev: 'ef' },
  'efésios': { name: 'Efésios', abbrev: 'ef' },
  'efesios': { name: 'Efésios', abbrev: 'ef' },
  'fp': { name: 'Filipenses', abbrev: 'fp' },
  'filipenses': { name: 'Filipenses', abbrev: 'fp' },
  'cl': { name: 'Colossenses', abbrev: 'cl' },
  'colossenses': { name: 'Colossenses', abbrev: 'cl' },
  '1ts': { name: '1 Tessalonicenses', abbrev: '1ts' },
  '1tessalonicenses': { name: '1 Tessalonicenses', abbrev: '1ts' },
  'itessalonicenses': { name: '1 Tessalonicenses', abbrev: '1ts' },
  '2ts': { name: '2 Tessalonicenses', abbrev: '2ts' },
  '2tessalonicenses': { name: '2 Tessalonicenses', abbrev: '2ts' },
  'iitessalonicenses': { name: '2 Tessalonicenses', abbrev: '2ts' },
  '1tm': { name: '1 Timóteo', abbrev: '1tm' },
  '1timóteo': { name: '1 Timóteo', abbrev: '1tm' },
  '1timoteo': { name: '1 Timóteo', abbrev: '1tm' },
  'itimóteo': { name: '1 Timóteo', abbrev: '1tm' },
  'itimoteo': { name: '1 Timóteo', abbrev: '1tm' },
  '2tm': { name: '2 Timóteo', abbrev: '2tm' },
  '2timóteo': { name: '2 Timóteo', abbrev: '2tm' },
  '2timoteo': { name: '2 Timóteo', abbrev: '2tm' },
  'iitimóteo': { name: '2 Timóteo', abbrev: '2tm' },
  'iitimoteo': { name: '2 Timóteo', abbrev: '2tm' },
  'tt': { name: 'Tito', abbrev: 'tt' },
  'tito': { name: 'Tito', abbrev: 'tt' },
  'fm': { name: 'Filemom', abbrev: 'fm' },
  'filemom': { name: 'Filemom', abbrev: 'fm' },
  'hb': { name: 'Hebreus', abbrev: 'hb' },
  'hebreus': { name: 'Hebreus', abbrev: 'hb' },
  'tg': { name: 'Tiago', abbrev: 'tg' },
  'tiago': { name: 'Tiago', abbrev: 'tg' },
  '1pe': { name: '1 Pedro', abbrev: '1pe' },
  '1pedro': { name: '1 Pedro', abbrev: '1pe' },
  'ipedro': { name: '1 Pedro', abbrev: '1pe' },
  '2pe': { name: '2 Pedro', abbrev: '2pe' },
  '2pedro': { name: '2 Pedro', abbrev: '2pe' },
  'iipedro': { name: '2 Pedro', abbrev: '2pe' },
  '1jo': { name: '1 João', abbrev: '1jo' },
  '1joão': { name: '1 João', abbrev: '1jo' },
  '1joao': { name: '1 João', abbrev: '1jo' },
  'ijoão': { name: '1 João', abbrev: '1jo' },
  'ijoao': { name: '1 João', abbrev: '1jo' },
  '2jo': { name: '2 João', abbrev: '2jo' },
  '2joão': { name: '2 João', abbrev: '2jo' },
  '2joao': { name: '2 João', abbrev: '2jo' },
  'iijoão': { name: '2 João', abbrev: '2jo' },
  'iijoao': { name: '2 João', abbrev: '2jo' },
  '3jo': { name: '3 João', abbrev: '3jo' },
  '3joão': { name: '3 João', abbrev: '3jo' },
  '3joao': { name: '3 João', abbrev: '3jo' },
  'iiijoão': { name: '3 João', abbrev: '3jo' },
  'iiijoao': { name: '3 João', abbrev: '3jo' },
  'jd': { name: 'Judas', abbrev: 'jd' },
  'judas': { name: 'Judas', abbrev: 'jd' },
  'ap': { name: 'Apocalipse', abbrev: 'ap' },
  'apocalipse': { name: 'Apocalipse', abbrev: 'ap' },
};

export interface ScriptureRef {
  bookAbbrev: string;
  bookName: string;
  chapter: number;
  verse: number; // first verse number — kept for callers that only care about one verse (e.g. navigation)
  verseNumbers: number[]; // every individual verse to fetch, expanded from ranges (e.g. "6-8,20" -> [6,7,8,20])
  verseLabel: string; // display label preserving the user's own grouping (e.g. "6, 20", "6-8")
  raw: string;
}

export interface TextSegment {
  type: 'text' | 'reference';
  content: string;
  ref?: ScriptureRef;
}

// Regex to match scripture references like "Jo 3:16", "1Co 13:4-7", "Êxodo 12:11",
// "Gênesis 10:6, 20" (a comma-separated list of individual verses and/or ranges).
// Using (?:^|[\s,;.!?()]) instead of \b because \b doesn't work with accented chars
const SCRIPTURE_REGEX = /(?:^|[\s,;.!?()"'])((?:(?:[123]|[IiÍí]{1,3})\s?)?(?:[A-ZÀ-ÚÃÕÇa-zà-úãõç]{2,15}))\s+(\d{1,3}):(\d{1,3}(?:-\d{1,3})?(?:\s*,\s*\d{1,3}(?:-\d{1,3})?)*)(?=[\s,;.!?()"']|$)/g;

// Parses a verse spec like "6", "6-8" or "6, 8-10, 20" into the flat list of
// individual verse numbers to fetch, plus a display label that preserves the
// user's own grouping instead of re-deriving it from a sorted/deduped list.
function parseVerseSpec(spec: string): { first: number; numbers: number[]; label: string } {
  const numbers: number[] = [];
  const labelParts: string[] = [];
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const rangeMatch = part.match(/^(\d{1,3})-(\d{1,3})$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let n = start; n <= end; n++) numbers.push(n);
      labelParts.push(`${start}-${end}`);
    } else {
      const n = parseInt(part, 10);
      if (!Number.isNaN(n)) {
        numbers.push(n);
        labelParts.push(`${n}`);
      }
    }
  }
  return { first: numbers[0], numbers, label: labelParts.join(', ') };
}

export function parseScriptureReferences(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SCRIPTURE_REGEX)) {
    const bookRaw = match[1].toLowerCase().replace(/\s+/g, '');
    const chapter = parseInt(match[2], 10);
    const { first: verse, numbers: verseNumbers, label: verseLabel } = parseVerseSpec(match[3]);
    const bookInfo = BOOK_MAP[bookRaw];

    if (!bookInfo || verseNumbers.length === 0) continue;

    // The full match may include a leading delimiter; calculate the actual reference start
    const fullMatch = match[0];
    const refText = fullMatch.trimStart();
    const refStart = match.index! + (fullMatch.length - refText.length);

    if (refStart > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, refStart) });
    }

    segments.push({
      type: 'reference',
      content: refText,
      ref: {
        bookAbbrev: bookInfo.abbrev,
        bookName: bookInfo.name,
        chapter,
        verse,
        verseNumbers,
        verseLabel,
        raw: refText,
      },
    });

    lastIndex = match.index! + fullMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

/**
 * Detect a scripture reference near the end of a text string (for editor auto-detect).
 * Returns the last match found, if any.
 */
export function detectLastScriptureReference(text: string): ScriptureRef | null {
  let last: ScriptureRef | null = null;
  for (const match of text.matchAll(SCRIPTURE_REGEX)) {
    const bookRaw = match[1].toLowerCase().replace(/\s+/g, '');
    const bookInfo = BOOK_MAP[bookRaw];
    if (!bookInfo) continue;
    const { first: verse, numbers: verseNumbers, label: verseLabel } = parseVerseSpec(match[3]);
    if (verseNumbers.length === 0) continue;
    const refText = match[0].trimStart();
    last = {
      bookAbbrev: bookInfo.abbrev,
      bookName: bookInfo.name,
      chapter: parseInt(match[2], 10),
      verse,
      verseNumbers,
      verseLabel,
      raw: refText,
    };
  }
  return last;
}
