// Pulls the chord sheet out of an arbitrary song page, without depending on exact markup.
import { isChord } from '../chords';
import { isBareChordLine } from '../corrector';

/** Scores text by how much it looks like a chord sheet. */
function score(text: string): number {
  let n = 0;
  for (const m of text.matchAll(/\[([^\]\n]{1,12})\]/g)) if (isChord(m[1])) n += 1;
  for (const line of text.split('\n')) if (isBareChordLine(line, true)) n += 2;
  if (/\{\s*(t|title)\s*:/i.test(text)) n += 5;
  return n;
}

/** Text of an element with <br> turned into newlines and markup (e.g. <u>Am</u>) dropped. */
function textOf(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  clone.querySelectorAll('script, style').forEach((x) => x.remove());
  return (clone.textContent ?? '').replace(/ /g, ' ').replace(/\r\n?/g, '\n');
}

/** A ChordPro block embedded in the page text, starting at {t:...} or {title:...}. */
function embeddedChordPro(text: string): string | null {
  const start = text.search(/\{\s*(t|title)\s*:/i);
  if (start < 0) return null;
  const lines = text.slice(start).split('\n');
  const out: string[] = [];
  let blank = 0;
  for (const l of lines) {
    if (!l.trim()) { if (++blank > 3) break; } else blank = 0;
    out.push(l.replace(/\s+$/, ''));
  }
  const block = out.join('\n').trim();
  return score(block) >= 3 ? block : null;
}

export interface Extracted { text: string; title?: string; artist?: string }

export function extractChordSheet(html: string): Extracted | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const candidates = [...doc.querySelectorAll('pre, textarea, #core, .chordpro, .song, .chords, article, main, td, div')];
  let best: { text: string; score: number } | null = null;
  for (const el of candidates) {
    const text = el.tagName === 'TEXTAREA' ? (el as HTMLTextAreaElement).value || el.textContent || '' : textOf(el);
    if (text.length > 60000) continue;
    const embedded = embeddedChordPro(text);
    const t = embedded ?? text;
    const s = score(t) * (embedded ? 2 : 1) - text.length / 4000; // prefer the smallest element holding the sheet
    if (s > 3 && (!best || s > best.score)) best = { text: t, score: s };
  }
  if (!best) return null;
  const pageTitle = doc.querySelector('h1')?.textContent?.trim() || doc.title || '';
  const { title, artist } = splitTitle(pageTitle);
  return { text: best.text.replace(/^\n+|\s+$/g, ''), title, artist };
}

/** "Wonderwall Chords - Oasis | E-Chords" → { title: Wonderwall, artist: Oasis } */
export function splitTitle(raw: string): { title?: string; artist?: string } {
  const clean = raw.replace(/\s*[|–—]\s*(E-Chords|Chordie|chordie\.com|e-chords\.com).*$/i, '').replace(/\b(chords?|tabs?|lyrics|ackord|cifra|acordes)\b/gi, '').replace(/\s+/g, ' ').trim();
  const m = /^(.+?)\s+(?:-|by|av)\s+(.+)$/i.exec(clean);
  if (!m) return { title: clean || undefined };
  return { title: m[1].trim(), artist: m[2].trim() };
}

/** Builds a ChordPro file from an extracted sheet, adding title/artist when missing. */
export function toChordProFile(x: Extracted): string {
  if (/\{\s*(t|title)\s*:/i.test(x.text)) return x.text;
  const head = [x.title && `{title: ${x.title}}`, x.artist && `{artist: ${x.artist}}`].filter(Boolean);
  return [...head, '', x.text].join('\n');
}
