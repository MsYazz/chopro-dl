// Converts "chords over lyrics" text (e.g. from Ultimate Guitar) into ChordPro.
import { isChord } from './chords';
import { isBareChordLine } from './corrector';

/** Removes Ultimate Guitar markup like [ch]Am[/ch] and [tab]...[/tab]. */
export function stripUgMarkup(s: string): string {
  return s.replace(/\[ch\]/g, '').replace(/\[\/ch\]/g, '').replace(/\[\/?tab\]/g, '').replace(/\r\n/g, '\n');
}

/** Heuristic: text has chord-only lines and no inline [chords]. */
export function looksLikeChordsOverLyrics(text: string): boolean {
  const lines = text.split('\n');
  const inline = lines.some((l) => [...l.matchAll(/\[([^\]]+)\]/g)].some((m) => isChord(m[1])));
  if (inline) return false;
  return lines.filter((l) => isBareChordLine(l, true)).length >= 2;
}

function mergeChordLine(chords: string, lyric: string): string {
  const positions: { col: number; chord: string }[] = [];
  for (const m of chords.matchAll(/\S+/g)) positions.push({ col: m.index ?? 0, chord: m[0] });
  let out = lyric;
  for (const { col, chord } of positions.reverse()) {
    if (out.length < col) out = out.padEnd(col, ' ');
    out = out.slice(0, col) + `[${chord}]` + out.slice(col);
  }
  return out.replace(/\s+$/, '');
}

export function chordsOverLyricsToChordPro(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (isBareChordLine(line, true)) {
      const nextIsLyric = next !== undefined && next.trim() !== '' && !isBareChordLine(next, true)
        && !next.trim().startsWith('{') && !/^\s*\[[^\]]+\]\s*$/.test(next) && !/^\s*[eBGDAE]\|/.test(next);
      if (nextIsLyric) {
        out.push(mergeChordLine(line, next));
        i++;
        continue;
      }
      out.push(line.replace(/\S+/g, (t) => `[${t}]`).trimEnd());
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}
