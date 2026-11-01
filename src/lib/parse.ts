// Minimal ChordPro parser used for the preview.
export interface Segment { chord?: string; text: string }
export type Item =
  | { type: 'lyric'; segments: Segment[]; env: string | null; line: number }
  | { type: 'comment'; text: string; style: 'normal' | 'italic' | 'box'; line: number }
  | { type: 'tab'; text: string; line: number }
  | { type: 'empty'; line: number };

export interface Song { meta: Record<string, string>; items: Item[] }

const META = new Set(['title', 't', 'subtitle', 'artist', 'composer', 'album', 'year', 'key', 'capo', 'tempo', 'time', 'duration', 'lyricist', 'copyright']);
const ALIAS: Record<string, string> = { t: 'title', soc: 'start_of_chorus', eoc: 'end_of_chorus', sov: 'start_of_verse', eov: 'end_of_verse', sob: 'start_of_bridge', eob: 'end_of_bridge', sot: 'start_of_tab', eot: 'end_of_tab', c: 'comment', ci: 'comment_italic', cb: 'comment_box' };

export function parseSong(text: string): Song {
  const meta: Record<string, string> = {};
  const items: Item[] = [];
  let env: string | null = null;
  text.split('\n').forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    if (env === 'tab' && !/^\{\s*(eot|end_of_tab)\s*\}$/i.test(t)) { items.push({ type: 'tab', text: raw, line }); return; }
    const d = /^\{\s*([A-Za-z_]\w*)\s*(?::\s*(.*?))?\s*\}$/.exec(t);
    if (d) {
      const name = ALIAS[d[1].toLowerCase()] ?? d[1].toLowerCase();
      const value = d[2] ?? '';
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
