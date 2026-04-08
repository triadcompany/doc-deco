/**
 * Standalone Bible verse fetcher — reuses the same GitHub raw data as use-bible.
 * Returns plain text verses for a given book/chapter/verse range.
 */

const GITHUB_BASE = 'https://raw.githubusercontent.com/maatheusgois/bible/main/versions/pt-br';

interface RawBook {
  id: string;
  name: string;
  chapters: string[][];
}

// Simple in-memory cache
const cache: Record<string, RawBook[]> = {};

// Map from app abbreviations to JSON IDs (where they differ)
const ABBREV_TO_JSON_ID: Record<string, string> = {
  'jz': 'jud',
  '1rs': '1kgs', '2rs': '2kgs',
  '1cr': '1ch', '2cr': '2ch',
  'ed': 'ezr',
  'jo_at': 'job',
  'sl': 'ps',
  'pv': 'prv',
  'ct': 'so',
  'os': 'ho',
  'mq': 'mi',
  'hc': 'hk',
  'sf': 'zp',
  'ag': 'hg',
  'mc': 'mk',
  'lc': 'lk',
  'at': 'act',
  'ef': 'eph',
  'fp': 'ph',
  'fm': 'phm',
  'tg': 'jm',
  'ap': 're',
};

async function loadBible(version: string): Promise<RawBook[]> {
  if (cache[version]) return cache[version];
  const res = await fetch(`${GITHUB_BASE}/${version}.json`);
  if (!res.ok) throw new Error(`Failed to load ${version}`);
  const data: RawBook[] = await res.json();
  cache[version] = data;
  return data;
}

export interface FetchedVerse {
  number: number;
  text: string;
}

/**
 * Fetch verses for a scripture reference.
 */
export async function fetchVerses(
  bookAbbrev: string,
  chapter: number,
  verseStart: number,
  verseEnd?: number,
  version = 'arc'
): Promise<{ bookName: string; verses: FetchedVerse[] }> {
  const data = await loadBible(version);
  
  // Map app abbreviation to JSON id
  const jsonId = ABBREV_TO_JSON_ID[bookAbbrev] || bookAbbrev;
  
  let book = data.find(b => b.id === jsonId);
  if (!book) {
    const lower = jsonId.toLowerCase();
    book = data.find(b => b.id.toLowerCase() === lower);
  }
  if (!book) throw new Error(`Livro "${bookAbbrev}" não encontrado`);

  const chapterIdx = chapter - 1;
  if (chapterIdx < 0 || chapterIdx >= book.chapters.length) {
    throw new Error(`Capítulo ${chapter} não encontrado`);
  }

  const chapterVerses = book.chapters[chapterIdx];
  const end = verseEnd ?? verseStart;
  const startIdx = verseStart - 1;
  const endIdx = Math.min(end, chapterVerses.length);

  const verses: FetchedVerse[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    verses.push({ number: i + 1, text: chapterVerses[i].trim() });
  }

  return { bookName: book.name, verses };
}

/**
 * Format fetched verses as HTML blockquote for insertion in the editor.
 */
export function formatVersesAsHtml(
  bookName: string,
  chapter: number,
  verses: FetchedVerse[]
): string {
  const lines = verses
    .map(v => `<span style="color:hsl(var(--muted-foreground));font-size:0.75em;vertical-align:super;margin-right:2px;">${v.number}</span>${v.text}`)
    .join('<br/>');

  return `<blockquote style="border-left:3px solid hsl(var(--primary));padding:8px 12px;margin:8px 0;background:hsl(var(--muted)/0.3);border-radius:4px;font-size:0.9em;"><h2 style="margin:0 0 4px 0;font-size:1.15em;font-weight:700;">${bookName} ${chapter}:${verses[0]?.number}${verses.length > 1 ? '-' + verses[verses.length - 1]?.number : ''}</h2>${lines}</blockquote><p><br/></p>`;
}
