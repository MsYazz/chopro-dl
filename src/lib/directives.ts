// Directives from the official ChordPro reference: https://www.chordpro.org/chordpro/chordpro-directives/

/** Short forms and their full names. The reference recommends full names. */
export const ALIASES: Record<string, string> = {
  ns: 'new_song', t: 'title', st: 'subtitle', c: 'comment', ci: 'comment_italic', cb: 'comment_box',
  soc: 'start_of_chorus', eoc: 'end_of_chorus', sov: 'start_of_verse', eov: 'end_of_verse',
  sob: 'start_of_bridge', eob: 'end_of_bridge', sot: 'start_of_tab', eot: 'end_of_tab',
  sog: 'start_of_grid', eog: 'end_of_grid', cf: 'chordfont', cs: 'chordsize', tf: 'textfont', ts: 'textsize',
  np: 'new_page', npp: 'new_physical_page', colb: 'column_break', g: 'grid', ng: 'no_grid', col: 'columns',
};

const STYLE_TARGETS = ['chord', 'chorus', 'footer', 'grid', 'tab', 'label', 'toc', 'text', 'title'];

export const DIRECTIVES = new Set<string>([
  'new_song',
  'title', 'sorttitle', 'subtitle', 'artist', 'sortartist', 'composer', 'lyricist', 'copyright', 'album',
  'year', 'key', 'time', 'tempo', 'duration', 'capo', 'tag', 'meta',
  'comment', 'highlight', 'comment_italic', 'comment_box', 'image',
  'start_of_chorus', 'end_of_chorus', 'chorus', 'start_of_verse', 'end_of_verse', 'start_of_bridge',
  'end_of_bridge', 'start_of_tab', 'end_of_tab', 'start_of_grid', 'end_of_grid',
  'start_of_abc', 'end_of_abc', 'start_of_ly', 'end_of_ly', 'start_of_svg', 'end_of_svg',
  'start_of_textblock', 'end_of_textblock',
  'define', 'chord', 'transpose',
  ...STYLE_TARGETS.flatMap((s) => [`${s}font`, `${s}size`, `${s}colour`]),
  'new_page', 'new_physical_page', 'column_break', 'pagetype', 'diagrams', 'grid', 'no_grid', 'titles', 'columns',
]);

/** Environments whose content is passed through untouched (tab, grid and delegated ones). */
export const RAW_ENVIRONMENTS = new Set(['tab', 'grid', 'abc', 'ly', 'svg', 'textblock']);

export interface ParsedDirective {
  /** Name as written, lower-cased, without selector. */
  raw: string;
  /** Full name, with short forms expanded. */
  name: string;
  /** Conditional selector including the dash, e.g. "-guitar" or "-piano!". */
  selector: string;
  value: string;
  /** True when the value uses attributes, e.g. label="Verse 1". */
  attributes: boolean;
}

/** Parses "{name: value}", "{name value}", "{name-selector: value}" and "{name attr="x"}". */
export function parseDirective(text: string): ParsedDirective | null {
  const m = /^\{\s*([A-Za-z_]\w*)(-[\w!]+)?(?:\s*:\s*|\s+|(?=\s*\}))([\s\S]*?)\s*\}$/.exec(text.trim());
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const value = m[3] ?? '';
  return { raw, name: ALIASES[raw] ?? raw, selector: m[2] ?? '', value, attributes: /^\w+\s*=\s*["']/.test(value) };
}

export function formatDirective(d: { name: string; selector: string; value: string; attributes: boolean }): string {
  if (!d.value) return `{${d.name}${d.selector}}`;
  return d.attributes ? `{${d.name}${d.selector} ${d.value}}` : `{${d.name}${d.selector}: ${d.value}}`;
}

export function isKnownDirective(name: string): boolean {
  return DIRECTIVES.has(name) || name.startsWith('x_');
}

/** "start_of_verse" → { kind: 'start', env: 'verse' } */
export function environmentOf(name: string): { kind: 'start' | 'end'; env: string } | null {
  const m = /^(start|end)_of_(\w+)$/.exec(name);
  return m ? { kind: m[1] as 'start' | 'end', env: m[2] } : null;
}
