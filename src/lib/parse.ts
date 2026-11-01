// Minimal ChordPro parser used for the preview.
export interface Segment { chord?: string; text: string }
export type Item =
  | { type: 'lyric'; segments: Segment[]; env: string | null; line: number }
  | { type: 'comment'; text: string; style: 'normal' | 'italic' | 'box'; line: number }
  | { type: 'tab'; text: string; line: number }
  | { type: 'empty'; line: number };

export interface Song { meta: Record<string, string>; items: Item[] }

import { parseDirective, environmentOf, RAW_ENVIRONMENTS } from './directives';

const META = new Set(['title', 'subtitle', 'artist', 'composer', 'album', 'year', 'key', 'capo', 'tempo', 'time', 'duration', 'lyricist', 'copyright']);

export function parseSong(text: string): Song {
  const meta: Record<string, string> = {};
  const items: Item[] = [];
  let env: string | null = null;
  text.split('\n').forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    const d = t.startsWith('{') ? parseDirective(t) : null;
    const isEnd = !!d && environmentOf(d.name)?.kind === 'end';
    if (env && RAW_ENVIRONMENTS.has(env) && !isEnd) { items.push({ type: 'tab', text: raw, line }); return; }
    if (d) {
      const name = d.name;
      const label = /label\s*=\s*["']([^"']*)["']/.exec(d.value)?.[1];
      const value = d.attributes ? (label ?? '') : d.value;
      if (META.has(name)) { if (!(name in meta)) meta[name] = value; return; }
      if (name === 'comment' || name === 'comment_italic' || name === 'comment_box' || name === 'highlight') {
        items.push({ type: 'comment', text: value, style: name === 'comment_italic' ? 'italic' : name === 'comment_box' ? 'box' : 'normal', line });
        return;
      }
      const env_ = /^start_of_(\w+)$/.exec(name);
      if (env_) { env = env_[1]; if (value) items.push({ type: 'comment', text: value, style: 'normal', line }); return; }
      if (/^end_of_\w+$/.test(name)) { env = null; return; }
      if (name === 'chorus') { items.push({ type: 'comment', text: value || 'Chorus', style: 'box', line }); return; }
      return; // other directives are not shown
    }
    if (t.startsWith('#')) return; // ChordPro comment line
    if (!t) { items.push({ type: 'empty', line }); return; }
    const segments: Segment[] = [];
    const re = /\[([^[\]]*)\]/g;
    let last = 0;
    let pending: string | undefined;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const txt = raw.slice(last, m.index);
      if (pending !== undefined || txt) segments.push({ chord: pending, text: txt });
      pending = m[1];
      last = m.index + m[0].length;
    }
    segments.push({ chord: pending, text: raw.slice(last) });
    items.push({ type: 'lyric', segments, env, line });
  });
  return { meta, items };
}
