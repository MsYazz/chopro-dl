// Corrects ChordPro syntax according to ChordPro_korrigeringsspecifikation.md (v1.1).
// Principle: fix only what is unambiguous, and flag the rest for manual review.
import { isChord, isBracketContent } from './chords';
import { isSectionName } from './sections';

export interface Change { line: number; before: string; after: string; rule: string }
export interface Flag { line: number; text: string; reason: string }
export interface CorrectionResult { text: string; changes: Change[]; flags: Flag[] }

const KNOWN_DIRECTIVES = new Set([
  'title', 't', 'subtitle', 'artist', 'composer', 'lyricist', 'album', 'year', 'key', 'time', 'tempo',
  'duration', 'capo', 'copyright', 'arranger', 'sorttitle', 'meta', 'comment', 'c', 'comment_italic', 'ci',
  'comment_box', 'cb', 'highlight', 'image', 'chorus', 'define', 'chord', 'new_page', 'np',
  'new_physical_page', 'npp', 'column_break', 'colb', 'columns', 'col', 'new_song', 'ns', 'pagetype',
  'titles', 'grid', 'g', 'no_grid', 'ng', 'transpose', 'textfont', 'textsize', 'textcolour', 'chordfont',
  'chordsize', 'chordcolour', 'tabfont', 'tabsize', 'tabcolour', 'soc', 'eoc', 'sov', 'eov', 'sob', 'eob',
  'sot', 'eot', 'sog', 'eog', 'st', 'tag', 'keywords', 'language', 'midi', 'pdf', 'diagrams', 'x_',
]);

const PATCH = /^[A-Z]:\d{1,3}$/;
const TAB_LINE = /^\s*[eBGDAEbgda]\s*[|:-]+.*[-|].*$|^\s*[-|0-9hpbr/\\~x()]{8,}\s*$/;

function isPatchLine(t: string): boolean {
  const parts = t.split(/[\s/,]+/).filter(Boolean);
  return parts.length > 0 && parts.every((p) => PATCH.test(p));
}

/** A line made up only of chord names, e.g. "Am  G  C". */
export function isBareChordLine(t: string, lenient = false): boolean {
  const tokens = t.trim().split(/\s+/).filter((x) => x && !/^\|+$/.test(x));
  if (tokens.length === 0) return false;
  if (!tokens.every(isChord)) return false;
  return lenient || tokens.length >= 2 || tokens[0].length >= 2;
}

export function bracketBareChords(line: string): string {
  return line.replace(/\S+/g, (tok) => (isChord(tok) ? `[${tok}]` : tok));
}

interface Fixed { text: string; rules: string[]; issues: string[] }

/** Fixes broken chord brackets inside a lyric line. */
export function fixChordBrackets(line: string): Fixed {
  const rules: string[] = [];
  const issues: string[] = [];
  let s = line;

  // [[F] -> [F] and [A]] -> [A] when it is clearly one chord.
  s = s.replace(/\[\[([^[\]]+)\](?!\])/g, (m, inner) => {
    if (isChord(inner)) { rules.push('Dubbel [ runt ackord'); return `[${inner}]`; }
    return m;
  });
  s = s.replace(/(?<!\[)\[([^[\]]+)\]\]/g, (m, inner) => {
    if (isChord(inner)) { rules.push('Dubbel ] runt ackord'); return `[${inner}]`; }
    return m;
  });

  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '[') {
      const close = s.indexOf(']', i + 1);
      const nextOpen = s.indexOf('[', i + 1);
      if (close >= 0 && (nextOpen < 0 || close < nextOpen)) {
        out += s.slice(i, close + 1);
        i = close + 1;
        continue;
      }
      const m = /^[^\s[\]]+/.exec(s.slice(i + 1));
      if (m && isChord(m[0])) {
        out += `[${m[0]}]`;
        i += 1 + m[0].length;
        rules.push(`Oavslutat ackord [${m[0]} kompletterades`);
        continue;
      }
      issues.push('Ensam [ som inte kunde tolkas säkert');
      out += c;
      i++;
      continue;
    }
    if (c === ']') {
      const m = /[^\s[\]]+$/.exec(out);
      if (m && isChord(m[0])) {
        out = out.slice(0, out.length - m[0].length) + `[${m[0]}]`;
        rules.push(`${m[0]}] rättades till [${m[0]}]`);
        i++;
        continue;
      }
      issues.push(m ? `Ensam ] efter "${m[0]}" som inte är ett ackord` : 'Ensam ] som inte kunde tolkas säkert');
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }

  for (const m of out.matchAll(/\[([^[\]]*)\]/g)) {
    if (!isBracketContent(m[1])) issues.push(`Okänt innehåll i hakparentes: [${m[1]}]`);
  }
  return { text: out, rules, issues };
}

/** Fixes stray brackets around a directive, e.g. {key:A}]} -> {key:A}. */
function fixDirective(t: string): { text: string; rule?: string; issue?: string } {
  let m = /^\{\{([^{}]*)\}\}?$/.exec(t);
  if (m) return { text: `{${m[1]}}`, rule: 'Dubbla klamrar i direktiv' };
  m = /^\{([^{}]*)\}(.*)$/.exec(t);
  if (m) {
    const trailing = m[2];
    if (!trailing.trim()) return { text: t };
    if (/^[\]}\s]+$/.test(trailing)) return { text: `{${m[1]}}`, rule: 'Felaktiga klamrar efter direktiv' };
    return { text: t, issue: 'Text efter direktiv' };
  }
  m = /^\{([^{}\]]*)\]?\s*$/.exec(t);
  if (m && /^[A-Za-z_]+\s*:/.test(m[1])) return { text: `{${m[1].trimEnd()}}`, rule: 'Avslutande } saknades i direktiv' };
  return { text: t, issue: 'Direktivet har obalanserade klamrar' };
}

/** Matches "[Intro]", "Intro]", "[Intro" with optional trailing content. */
function matchHeader(t: string): { title: string; rest: string } | null {
  const forms = [/^\[([^[\]]+)\](.*)$/, /^([^[\]{}]+)\](.*)$/, /^\[([^[\]]+)$/];
  for (const re of forms) {
    const m = re.exec(t);
    if (m && isSectionName(m[1])) return { title: m[1].trim().replace(/:$/, ''), rest: (m[2] || '').trim() };
  }
  return null;
}

export function correct(input: string): CorrectionResult {
  const lines = input.replace(/^﻿/, '').split(/\r?\n/);
  const changes: Change[] = [];
  const flags: Flag[] = [];
  const out: string[] = [];

  const artists = new Set<string>();
  for (const l of lines) {
    const m = /^\s*\{\s*artist\s*:\s*(.*?)\s*\}\s*$/i.exec(l);
    if (m) artists.add(m[1].toLowerCase());
  }

  let inTab = false;
  let prevWasTab = false;

  lines.forEach((line, idx) => {
    const n = idx + 1;
    const t = line.trim();
    const emit = (after: string[], rule: string) => {
      changes.push({ line: n, before: line, after: after.join('\n'), rule });
      out.push(...after);
    };
    const flag = (reason: string) => flags.push({ line: n, text: line, reason });

    if (!t) { out.push(line); prevWasTab = false; return; }

    if (inTab) {
      if (/^\{\s*(eot|end_of_tab)\s*\}$/i.test(t)) inTab = false;
      out.push(line);
      return;
    }

    // Directives
    if (t.startsWith('{')) {
      const fixed = fixDirective(t);
      let text = fixed.text;
      const rules: string[] = fixed.rule ? [fixed.rule] : [];
      if (fixed.issue) flag(fixed.issue);
      const dm = /^\{\s*([A-Za-z_][\w-]*)\s*(?::\s*([\s\S]*?))?\s*\}$/.exec(text);
      if (dm) {
        const name = dm[1].toLowerCase();
        const value = dm[2] ?? '';
        if (name === 'st') {
          if (artists.has(value.toLowerCase())) {
            changes.push({ line: n, before: line, after: '', rule: '{st:} togs bort – samma artist fanns redan' });
            return;
          }
          artists.add(value.toLowerCase());
          text = `{artist: ${value}}`;
          rules.push('{st:} blev {artist:}');
        } else if (name === 'c') {
          text = `{comment: ${value}}`;
          rules.push('{c:} blev {comment:}');
        } else if (name === 'sot' || name === 'start_of_tab') {
          inTab = true;
        } else if (!KNOWN_DIRECTIVES.has(name) && !/^(start|end)_of_\w+$/.test(name) && !name.startsWith('x_')) {
          flag(`Ovanligt direktiv: {${dm[1]}}`);
        }
      } else if (!fixed.issue) {
        flag('Direktivet kunde inte tolkas');
      }
      if (text !== line) emit([text], rules.join('; ') || 'Direktiv städades');
      else out.push(line);
      return;
    }

    // Tablature outside {start_of_tab}: never rewritten automatically.
    if (TAB_LINE.test(line)) {
      if (!prevWasTab) flag('Ser ut som tabulatur – granska manuellt (ändras inte)');
      prevWasTab = true;
      out.push(line);
      return;
    }
    prevWasTab = false;

    // Keyboard patches, e.g. "W:41/W:42".
    if (isPatchLine(t)) {
      emit([`{comment: ${t}}`], 'Keyboardpatch blev kommentar');
      return;
    }

    // Section headers: [Intro], Intro], [Verse 1] ...
    const h = matchHeader(t);
    if (h) {
      if (!h.rest) {
        emit([`{comment: ${h.title}}`], 'Rubrik blev {comment:}');
        return;
      }
      const restHasChords = /\[[^\]]+\]/.test(h.rest) || isBareChordLine(h.rest) || /[A-H][^\s]*\]/.test(h.rest);
      if (restHasChords) {
        let rest = fixChordBrackets(h.rest);
        let restText = rest.text;
        if (isBareChordLine(restText)) restText = bracketBareChords(restText);
        rest.issues.forEach(flag);
        emit([`{comment: ${h.title}}`, restText], 'Rubrik blev {comment:}, ackorden behölls på egen rad');
      } else {
        emit([`{comment: ${h.title} ${h.rest}}`], 'Rubrik blev {comment:}');
      }
      return;
    }

    // A lone bracketed word that is neither chord nor known header: flag, don't guess.
    const lone = /^\[([^[\]]+)\]$|^([^[\]\s{}]+)\]$/.exec(t);
    if (lone && !isChord(lone[1] ?? lone[2] ?? '')) {
      flag('Möjlig rubrik som inte känns igen – granska manuellt');
      out.push(line);
      return;
    }

    // Chord-only line without brackets, e.g. "Am  G  C".
    if (isBareChordLine(t)) {
      emit([bracketBareChords(line)], 'Ackordrad fick hakparenteser');
      return;
    }

    const fixed = fixChordBrackets(line);
    fixed.issues.forEach(flag);
    if (fixed.text !== line) emit([fixed.text], fixed.rules.join('; '));
    else out.push(line);
  });

  // Final validation of the whole result.
  const text = out.join('\n');
  return { text, changes, flags };
}
