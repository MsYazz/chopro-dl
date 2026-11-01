import { transposeChord, isChord, accidentalsForKey, type Accidentals } from './chords';

export type AccidentalMode = 'auto' | Accidentals;

export function findKey(text: string): string | null {
  const m = /\{\s*key\s*:\s*([^}]+?)\s*\}/i.exec(text);
  return m ? m[1] : null;
}

function guessAccidentals(text: string, semis: number): Accidentals {
  const key = findKey(text);
  if (key && isChord(key)) return accidentalsForKey(transposeChord(key, semis, 'sharp').replace(/#/, '#'));
  const flats = (text.match(/\[[A-G]b/g) || []).length;
  const sharps = (text.match(/\[[A-G]#/g) || []).length;
  return flats > sharps ? 'flat' : 'sharp';
}

/** Transposes every [chord] and the {key:} directive. Tab blocks are left alone. */
export function transposeText(text: string, semis: number, mode: AccidentalMode = 'auto'): string {
  if (semis % 12 === 0 && mode === 'auto') return text;
  let acc: Accidentals = mode === 'auto' ? guessAccidentals(text, semis) : mode;
  if (mode === 'auto') {
    // Re-check with the real target key so e.g. F -> Bb uses flats.
    const key = findKey(text);
    if (key && isChord(key)) {
      const sharpTarget = transposeChord(key, semis, 'sharp');
      const flatTarget = transposeChord(key, semis, 'flat');
      acc = accidentalsForKey(flatTarget) === 'flat' ? 'flat' : accidentalsForKey(sharpTarget);
    }
  }
  let inTab = false;
  return text.split('\n').map((line) => {
    const t = line.trim();
    if (/^\{\s*(sot|start_of_tab)\b/i.test(t)) inTab = true;
    if (/^\{\s*(eot|end_of_tab)\b/i.test(t)) { inTab = false; return line; }
    if (inTab) return line;
    let l = line.replace(/\[([^[\]]+)\]/g, (m, c) => (isChord(c) ? `[${transposeChord(c, semis, acc)}]` : m));
    l = l.replace(/(\{\s*key\s*:\s*)([^}]+?)(\s*\})/i, (m, a, k, b) => (isChord(k) ? a + transposeChord(k, semis, acc) + b : m));
    return l;
  }).join('\n');
}
