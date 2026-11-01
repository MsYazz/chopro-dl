// Ultimate Guitar, via the Google Apps Script proxy (the site blocks direct browser requests).
import type { SearchHit, Settings, LoadedSong } from './types';
import { fetchText } from './fetcher';
import { stripUgMarkup, chordsOverLyricsToChordPro } from '../convert';

function readStore(html: string): unknown {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector('.js-store, [data-content]');
  const raw = el?.getAttribute('data-content');
  if (!raw) throw new Error('Kunde inte läsa sidan från Ultimate Guitar (formatet kan ha ändrats eller anropet blockerats).');
  return JSON.parse(raw);
}

/** Depth-first search for the first value matching a predicate. */
function find(obj: unknown, pred: (v: unknown) => boolean, depth = 0): unknown {
  if (depth > 12 || obj === null || typeof obj !== 'object') return undefined;
  if (pred(obj)) return obj;
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const r = find(v, pred, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

interface UgResult { song_name: string; artist_name: string; type: string; rating?: number; votes?: number; tab_url: string; version?: number; tonality_name?: string }

export async function searchUg(query: string, settings: Settings): Promise<SearchHit[]> {
  const url = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;
  const store = readStore(await fetchText(url, settings, { viaProxy: true }));
  const results = find(store, (v) => Array.isArray(v) && v.some((x) => x && typeof x === 'object' && 'tab_url' in x && 'song_name' in x)) as UgResult[] | undefined;
  return (results ?? [])
    .filter((r) => r.tab_url && /chords/i.test(r.type ?? ''))
    .map((r) => ({
      id: `ug:${r.tab_url}`,
      source: 'ug' as const,
      title: r.song_name,
      artist: r.artist_name,
      pageUrl: r.tab_url,
      rating: typeof r.rating === 'number' ? r.rating : undefined,
      votes: r.votes,
      detail: [r.type, r.version ? `version ${r.version}` : '', r.tonality_name ? `tonart ${r.tonality_name}` : ''].filter(Boolean).join(' · '),
      load: () => loadUgTab(r.tab_url, settings),
    }));
}

export async function loadUgTab(url: string, settings: Settings): Promise<LoadedSong> {
  const store = readStore(await fetchText(url, settings, { viaProxy: true }));
  const wiki = find(store, (v) => typeof (v as { content?: unknown }).content === 'string' && String((v as { content: string }).content).includes('[ch]')) as { content: string } | undefined;
  if (!wiki) throw new Error('Hittade inga ackord på sidan.');
  const meta = find(store, (v) => typeof (v as { song_name?: unknown }).song_name === 'string' && 'artist_name' in (v as object)) as UgResult | undefined;
  const capo = find(store, (v) => typeof (v as { capo?: unknown }).capo === 'number') as { capo: number } | undefined;
  return { text: ugToChordPro(wiki.content, meta?.song_name, meta?.artist_name, meta?.tonality_name, capo?.capo), fileName: `${meta?.song_name ?? 'song'}.pro`, sourceUrl: url };
}

export function ugToChordPro(content: string, title?: string, artist?: string, key?: string, capo?: number): string {
  const head = [title && `{title: ${title}}`, artist && `{artist: ${artist}}`, key && `{key: ${key}}`, capo ? `{capo: ${capo}}` : ''].filter(Boolean);
  const body = chordsOverLyricsToChordPro(stripUgMarkup(content));
  return [...head, '', body.trim()].join('\n');
}
