// Chord recognition and transposition helpers.

const ROOT = '[A-H](?:#|b|♯|♭)?';
// Suffix is built from known chord tokens only, so words like "Chorus" or "Amazing" never match.
const SUFFIX_TOKEN = '(?:maj|Maj|min|dim|aug|sus|add|omit|no|alt|m|M|[b#♯♭+-]\\d{1,2}|\\+|-|°|ø|Δ|\\d{1,2}|\\(|\\)|,)';
const CHORD_SRC = `${ROOT}${SUFFIX_TOKEN}*(?:/${ROOT})?`;
const CHORD_RE = new RegExp(`^${CHORD_SRC}$`);

/** Bracket contents that are valid but are not chords. */
const ANNOTATION_RE = /^(?:N\.?C\.?|x\s?\d+|\d+x|\*+|\|+|%|-+|\/+|\.+|:?\|\|?:?)$/i;

export function isChord(token: string): boolean {
  const t = token.trim();
  if (!t || t.length > 16) return false;
  if (!CHORD_RE.test(t)) return false;
  // Unbalanced parentheses are suspicious.
  return (t.match(/\(/g) || []).length === (t.match(/\)/g) || []).length;
}

export function isAnnotation(token: string): boolean {
  return ANNOTATION_RE.test(token.trim());
}

/** True when the text is a valid thing to have inside [ ] in ChordPro. */
export function isBracketContent(token: string): boolean {
  const t = token.trim();
  if (t.startsWith('*')) return true; // ChordPro annotation like [*Rit.]
  return isChord(t) || isAnnotation(t);
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function noteIndex(note: string): number {
  const n = note.replace('♯', '#').replace('♭', 'b');
  const letter = n[0] === 'H' ? 'B' : n[0];
  let i = SHARPS.indexOf(letter);
  if (i < 0) return -1;
  if (n[1] === '#') i += 1;
  if (n[1] === 'b') i -= 1;
  return (i + 12) % 12;
}

export type Accidentals = 'sharp' | 'flat';

function shiftNote(note: string, semis: number, acc: Accidentals): string {
  const i = noteIndex(note);
  if (i < 0) return note;
  const j = (((i + semis) % 12) + 12) % 12;
  return (acc === 'flat' ? FLATS : SHARPS)[j];
}

const ROOT_SPLIT = /^([A-H](?:#|b|♯|♭)?)(.*?)(?:\/([A-H](?:#|b|♯|♭)?))?$/;

export function transposeChord(chord: string, semis: number, acc: Accidentals): string {
  if (!isChord(chord)) return chord;
  const m = chord.trim().match(ROOT_SPLIT);
  if (!m) return chord;
  const [, root, suffix, bass] = m;
  let out = shiftNote(root, semis, acc) + suffix;
  if (bass) out += '/' + shiftNote(bass, semis, acc);
  return out;
}

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

/** Pick sharps or flats for a key (e.g. "Bb" or "Gm"). */
export function accidentalsForKey(key: string): Accidentals {
  return FLAT_KEYS.has(key.trim().replace('♭', 'b')) ? 'flat' : 'sharp';
}

/** Semitone distance from one key to another, in the range -5..6. */
export function semitonesBetween(from: string, to: string): number {
  const a = noteIndex(from);
  const b = noteIndex(to);
  if (a < 0 || b < 0) return 0;
  let d = (b - a + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}

export function rootOf(chord: string): string | null {
  const m = chord.trim().match(ROOT_SPLIT);
  return m ? m[1] : null;
}

export { CHORD_SRC };
