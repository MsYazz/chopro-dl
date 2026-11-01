// Recognising section headers such as "Intro", "Verse 1", "Refräng" or "Guitar solo".
import { isChord } from './chords';

const KEYWORDS = new Set([
  'intro', 'verse', 'vers', 'chorus', 'refräng', 'refrang', 'refrain', 'ref', 'bridge', 'stick',
  'solo', 'outro', 'mellanspel', 'interlude', 'instrumental', 'ending', 'coda', 'break', 'breakdown',
  'riff', 'hook', 'tag', 'turnaround', 'pre-chorus', 'prechorus', 'post-chorus', 'postchorus',
  'slut', 'avslutning', 'final', 'fill', 'vamp', 'middle', 'outtro', 'förspel', 'efterspel',
  'mellanspel', 'brygga', 'del', 'part', 'theme', 'tema', 'refräng:', 'chorus:',
]);

/** True when the text clearly names a song section. */
export function isSectionName(raw: string): boolean {
  const text = raw.trim().replace(/[:.]+$/, '');
  if (!text || isChord(text)) return false;
  const words = text.toLowerCase().split(/\s+/);
  const first = words[0].replace(/\d+$/, '').replace(/[:.]$/, '');
  if (KEYWORDS.has(first)) return true;
  if (first.endsWith('solo')) return true; // gitarrsolo, pianosolo
  if (words.length >= 2) {
    const second = words[1].replace(/[:.]$/, '');
    if (second === 'solo' || second === 'chorus' || second === 'riff' || second === '8' || second === 'break') return true;
    if (first === 'pre' || first === 'post') return true;
  }
  return false;
}
