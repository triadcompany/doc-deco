/**
 * Detect MSG: references in text and extract paragraphs from documents.
 * Format: MSG: document_name §paragraphs (translator) (date)
 * Examples:
 *   MSG: Desesperos §45-46
 *   MSG: A Fé Vem Pelo Ouvir §3-5 (Crentes da Bíblia) (1954-03-20)
 *   MSG: Desesperos §45
 *   MSG: Desesperos §10, 28-29
 */

import { supabase } from '@/integrations/supabase/client';

export interface MsgRef {
  docName: string;
  /** All individual paragraph numbers to fetch */
  paragraphs: number[];
  translator?: string;
  date?: string;
  raw: string;
}

export interface MsgMatch {
  id: string;
  title: string;
  translator: string;
  date: string;
  paragraphs: { number: number; text: string }[];
}

// Regex: MSG: name §<paragraph_spec> optional (translator) (date)
// paragraph_spec can be: 10 | 10-15 | 10, 28-29 | 10, 15, 20-25
const MSG_REGEX = /MSG:\s*(.+?)\s*§([\d\s,\-]+?)(?:\s*\(([^)]+)\))?(?:\s*\(([^)]+)\))?\s*$/i;

/**
 * Parse a paragraph spec like "10, 28-29" into an array of numbers [10, 28, 29]
 */
function parseParagraphSpec(spec: string): number[] {
  const nums = new Set<number>();
  const parts = spec.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end; i++) nums.add(i);
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) nums.add(n);
    }
  }
  return Array.from(nums).sort((a, b) => a - b);
}

/**
 * Detect a MSG: reference near the end of a text string.
 */
export function detectMsgReference(text: string): MsgRef | null {
  const match = text.match(MSG_REGEX);
  if (!match) return null;

  const docName = match[1].trim();
  const paragraphs = parseParagraphSpec(match[2]);
  if (paragraphs.length === 0) return null;

  // Determine which optional groups are translator vs date
  let translator: string | undefined;
  let date: string | undefined;

  const opt1 = match[3]?.trim();
  const opt2 = match[4]?.trim();

  const datePattern = /^\d{2,4}[-/]\d{2}[-/]\d{2,4}$/;

  for (const opt of [opt1, opt2]) {
    if (!opt) continue;
    if (datePattern.test(opt)) {
      date = opt;
    } else {
      translator = opt;
    }
  }

  return {
    docName,
    paragraphs,
    translator,
    date,
    raw: match[0],
  };
}

/**
 * Extract numbered paragraphs from document content.
 * Paragraphs in WMB documents use inline numbering like:
 * "...text.  45   Text of paragraph... 46   Next paragraph..."
 * or "45 - Text..." format.
 * Numbers appear after double spaces or at line starts.
 */
function extractParagraphs(
  content: string,
  requestedNums: number[]
): { number: number; text: string }[] {
  // Find all paragraph boundaries using regex
  // Pattern: paragraph number followed by optional " - " or whitespace, then text
  // Numbers appear either at start of line, or after 2+ spaces in the middle of text
  const paraRegex = /(?:^|\s{2,})(\d{1,4})\s{1,}(?:-\s)?/g;

  const boundaries: { num: number; textStart: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = paraRegex.exec(content)) !== null) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 9999) {
      boundaries.push({
        num,
        textStart: match.index + match[0].length,
      });
    }
  }

  if (boundaries.length === 0) return [];

  // Build paragraph map: number -> text (from textStart to next boundary)
  const paragraphMap = new Map<number, string>();
  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i];
    const nextStart = i + 1 < boundaries.length
      ? boundaries[i + 1].textStart - (content.substring(boundaries[i + 1].textStart - 20, boundaries[i + 1].textStart).match(/\s{2,}\d{1,4}\s+(?:-\s)?$/)?.[0]?.length ?? 0)
      : content.length;

    // Get text from this boundary to the position just before the next number marker
    let textEnd = content.length;
    if (i + 1 < boundaries.length) {
      // Find where the next boundary's match starts (before the spaces + number)
      const searchBack = content.lastIndexOf(String(boundaries[i + 1].num), boundaries[i + 1].textStart);
      if (searchBack > b.textStart) {
        // Go back to find the double-space before the number
        let j = searchBack - 1;
        while (j > b.textStart && content[j] === ' ') j--;
        textEnd = j + 1;
      }
    }

    const text = content.substring(b.textStart, textEnd).replace(/\s+/g, ' ').trim();
    if (text) {
      paragraphMap.set(b.num, text);
    }
  }

  // Extract requested paragraphs
  const results: { number: number; text: string }[] = [];
  for (const num of requestedNums) {
    const text = paragraphMap.get(num);
    if (text) {
      results.push({ number: num, text });
    }
  }

  return results;
}

/**
 * Search documents by William Branham matching a name, then extract paragraphs.
 */
export async function searchMsgDocuments(ref: MsgRef): Promise<MsgMatch[]> {
  const normalizeSearch = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  const searchName = normalizeSearch(ref.docName);

  // Query documents by William Branham
  let query = supabase
    .from('documents')
    .select('id, title, translator, date, content')
    .eq('author', 'William Branham');

  if (ref.translator) {
    query = query.eq('translator', ref.translator);
  }
  if (ref.date) {
    query = query.eq('date', ref.date);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // Filter by name match (fuzzy - title contains the search term)
  const matches = (data as any[]).filter((doc) => {
    const titleNorm = normalizeSearch(doc.title);
    return titleNorm.includes(searchName) || searchName.includes(titleNorm);
  });

  if (matches.length === 0) return [];

  return matches.map((doc) => ({
    id: doc.id,
    title: doc.title,
    translator: doc.translator || '',
    date: doc.date || '',
    paragraphs: doc.content ? extractParagraphs(doc.content, ref.paragraphs) : [],
  }));
}

/**
 * Format MSG paragraphs as HTML for insertion in the editor.
 */
export function formatMsgAsHtml(match: MsgMatch): string {
  if (match.paragraphs.length === 0) return '';

  const paraRange = match.paragraphs.length === 1
    ? `§${match.paragraphs[0].number}`
    : `§${match.paragraphs[0].number}-${match.paragraphs[match.paragraphs.length - 1].number}`;

  const header = `${match.title} ${paraRange}`;
  const meta = [match.translator, match.date].filter(Boolean).join(' — ');

  const lines = match.paragraphs
    .map(p => `<span style="color:hsl(var(--muted-foreground));font-size:0.75em;vertical-align:super;margin-right:2px;">${p.number}</span>${p.text}`)
    .join('<br/><br/>');

  return `<blockquote style="border-left:3px solid hsl(var(--accent));padding:8px 12px;margin:8px 0;background:hsl(var(--muted)/0.3);border-radius:4px;font-size:0.9em;"><strong>${header}</strong>${meta ? `<br/><span style="font-size:0.8em;color:hsl(var(--muted-foreground));">${meta}</span>` : ''}<br/><br/>${lines}</blockquote><p><br/></p>`;
}
