import { describe, it, expect } from 'vitest';
import { transposeText } from '../src/lib/transpose';
import { transposeChord, isChord } from '../src/lib/chords';
import { chordsOverLyricsToChordPro, looksLikeChordsOverLyrics } from '../src/lib/convert';
import { parseSong } from '../src/lib/parse';

describe('chords', () => {
  it('recognises chords and rejects words', () => {
    for (const c of ['A', 'Am', 'F#m7', 'Bbmaj7', 'Dsus4', 'G/B', 'C#m7b5', 'Eadd9', 'A7(b9)', 'H7']) expect(isChord(c), c).toBe(true);
    for (const w of ['Chorus', 'Amazing', 'Bridge', 'And', 'Intro', 'Dad', 'Ebb']) expect(isChord(w), w).toBe(false);
  });
  it('transposes root and bass', () => {
    expect(transposeChord('G/B', 2, 'sharp')).toBe('A/C#');
    expect(transposeChord('F#m7', -1, 'flat')).toBe('Fm7');
    expect(transposeChord('Bb', 2, 'sharp')).toBe('C');
  });
});

describe('transposeText', () => {
  it('transposes chords and key, using flats for flat keys', () => {
    const s = '{key: C}\n[C]Hello [F]there [G7]friend';
    expect(transposeText(s, 5)).toBe('{key: F}\n[F]Hello [Bb]there [C7]friend');
  });
  it('leaves non-chords and tabs alone', () => {
    const s = '[N.C.]x [*Rit.]\n{sot}\n[A] e|--\n{eot}';
    expect(transposeText(s, 2)).toBe(s);
  });
});

describe('convert', () => {
  it('merges chord lines into lyrics', () => {
    const s = 'Am      G\nHello there world\nC\nBye';
    expect(looksLikeChordsOverLyrics(s)).toBe(true);
    expect(chordsOverLyricsToChordPro(s)).toBe('[Am]Hello th[G]ere world\n[C]Bye');
  });
});

describe('parse', () => {
  it('parses meta and segments', () => {
    const song = parseSong('{title: X}\n{artist: Y}\n[Am]Hel[G]lo');
    expect(song.meta).toEqual({ title: 'X', artist: 'Y' });
    expect(song.items[0]).toMatchObject({ type: 'lyric', segments: [{ chord: 'Am', text: 'Hel' }, { chord: 'G', text: 'lo' }] });
  });
});

import { ugToChordPro } from '../src/lib/sources/ug';
import { prepare } from '../src/lib/pipeline';

describe('ultimate guitar', () => {
  it('turns UG markup into corrected ChordPro', () => {
    const ug = '[Intro]\n[ch]Em7[/ch]  [ch]G[/ch]\n\n[Verse 1]\n[tab][ch]Em7[/ch]          [ch]G[/ch]\nToday is gonna be the day[/tab]';
    const out = prepare(ugToChordPro(ug, 'Wonderwall', 'Oasis', 'F#m', 2)).text;
    expect(out).toBe('{title: Wonderwall}\n{artist: Oasis}\n{key: F#m}\n{capo: 2}\n\n{comment: Intro}\n[Em7]  [G]\n\n{comment: Verse 1}\n[Em7]Today is gonn[G]a be the day');
  });
});

describe('directive syntax in preview and transpose', () => {
  it('handles {key G} and labels on verses', () => {
    expect(transposeText('{key G}\n[G]x', 2)).toBe('{key A}\n[A]x');
    const song = parseSong('{t: X}\n{start_of_verse label="Vers 1"}\n[G]la\n{end_of_verse}\n{start_of_grid}\n| G . |\n{end_of_grid}');
    expect(song.meta.title).toBe('X');
    expect(song.items[0]).toMatchObject({ type: 'comment', text: 'Vers 1' });
    expect(song.items[1]).toMatchObject({ type: 'lyric', env: 'verse' });
    expect(song.items[2]).toMatchObject({ type: 'tab', text: '| G . |' });
  });
});
