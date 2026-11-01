import { describe, it, expect } from 'vitest';
import { correct } from '../src/lib/corrector';

const fix = (s: string) => correct(s).text;

describe('metadata', () => {
  it('turns {st:} into {artist:}', () => {
    expect(fix('{st: Deep Purple}')).toBe('{artist: Deep Purple}');
  });
  it('does not duplicate an existing artist', () => {
    expect(fix('{artist: Deep Purple}\n{st: Deep Purple}')).toBe('{artist: Deep Purple}');
  });
  it('leaves title/key/tempo alone', () => {
    const s = '{title: Smoke}\n{key: G}\n{tempo: 120}';
    expect(fix(s)).toBe(s);
  });
  it('fixes stray brackets in directives', () => {
    expect(fix('{key:A}]}')).toBe('{key:A}');
  });
  it('{c:} becomes {comment:}', () => {
    expect(fix('{c: Chorus}')).toBe('{comment: Chorus}');
  });
});

describe('headers', () => {
  for (const [a, b] of [
    ['[Intro]', '{comment: Intro}'],
    ['Intro]', '{comment: Intro}'],
    ['[Verse 1]', '{comment: Verse 1}'],
    ['Verse 1]', '{comment: Verse 1}'],
    ['[Chorus]', '{comment: Chorus}'],
    ['Chorus]', '{comment: Chorus}'],
    ['[Guitar solo]', '{comment: Guitar solo}'],
    ['[Refräng]', '{comment: Refräng}'],
    ['Mellanspel]', '{comment: Mellanspel}'],
  ]) {
    it(`${a} -> ${b}`, () => expect(fix(a)).toBe(b));
  }
  it('never turns Intro] into [Intro]', () => {
    expect(fix('Intro]')).not.toContain('[Intro]');
  });
  it('keeps chords after a header in the same order', () => {
    expect(fix('[Intro] [Am] [G]')).toBe('{comment: Intro}\n[Am] [G]');
    expect(fix('Intro] Am G')).toBe('{comment: Intro}\n[Am] [G]');
  });
  it('keeps extra info in the comment', () => {
    expect(fix('[Chorus] x2')).toBe('{comment: Chorus x2}');
  });
  it('flags an unknown bracketed word instead of guessing', () => {
    const r = correct('[Whatever]');
    expect(r.text).toBe('[Whatever]');
    expect(r.flags.length).toBe(1);
  });
});

describe('keyboard patches', () => {
  for (const p of ['A:01', 'W:21', 'W:41/W:42', 'T:11 T:12', 'T:31']) {
    it(p, () => expect(fix(p)).toBe(`{comment: ${p}}`));
  }
  it('does not touch patch-like text inside lyrics', () => {
    expect(fix('I said A:01 to you')).toBe('I said A:01 to you');
  });
});

describe('chords', () => {
  it('G] in chord context becomes [G]', () => {
    expect(fix('I G]said hello')).toBe('I [G]said hello');
  });
  it('closes an unclosed chord', () => {
    expect(fix('[D And so it [G]goes')).toBe('[D] And so it [G]goes');
  });
  it('fixes double brackets', () => {
    expect(fix('[[F]Hello [A]]world')).toBe('[F]Hello [A]world');
  });
  it('keeps valid lines untouched', () => {
    const s = 'Some[Am]where over the [F#m7/C#]rainbow';
    const r = correct(s);
    expect(r.text).toBe(s);
    expect(r.changes).toHaveLength(0);
    expect(r.flags).toHaveLength(0);
  });
  it('brackets bare chord lines', () => {
    expect(fix('Am   G   C')).toBe('[Am]   [G]   [C]');
  });
  it('flags non-chord bracket content', () => {
    expect(correct('Hello [foo] there').flags).toHaveLength(1);
  });
  it('does not rewrite tablature', () => {
    const s = 'e|---0---2---|';
    const r = correct(s);
    expect(r.text).toBe(s);
    expect(r.flags[0].reason).toMatch(/tabulatur/);
  });
  it('preserves text inside {start_of_tab}', () => {
    const s = '{start_of_tab}\n[Intro]\nG] x\n{end_of_tab}';
    expect(fix(s)).toBe(s);
  });
});

describe('log', () => {
  it('records line, before and after', () => {
    const r = correct('{title: X}\nIntro]\n');
    expect(r.changes).toEqual([{ line: 2, before: 'Intro]', after: '{comment: Intro}', rule: 'Rubrik blev {comment:}' }]);
  });
});

describe('official ChordPro directives', () => {
  it('expands short forms to full names', () => {
    expect(fix('{t: Smoke}\n{soc}\n[G]Smoke\n{eoc}')).toBe('{title: Smoke}\n{start_of_chorus}\n[G]Smoke\n{end_of_chorus}');
    expect(fix('{ci: soft}')).toBe('{comment_italic: soft}');
  });
  it('accepts {name value}, attributes and selectors without flags', () => {
    const s = '{title Smoke}\n{start_of_verse label="Verse 1"}\nHi\n{end_of_verse}\n{define-guitar: Am base-fret 1 frets 0 2 2 1 0 0}\n{x_mspro_pedal: 1}';
    const r = correct(s);
    expect(r.text).toBe(s);
    expect(r.flags).toEqual([]);
  });
  it('removes a selector from an end directive', () => {
    expect(fix('{start_of_verse-soprano}\nla\n{end_of_verse-soprano}')).toBe('{start_of_verse-soprano}\nla\n{end_of_verse}');
  });
  it('flags unknown directives and unbalanced environments', () => {
    const r = correct('{foo: bar}\n{start_of_chorus}\nla\n{end_of_verse}');
    const reasons = r.flags.map((f) => f.reason).join(' | ');
    expect(reasons).toMatch(/Okänt direktiv.*foo/);
    expect(reasons).toMatch(/matchar inte/);
    expect(reasons).toMatch(/avslutas aldrig/);
  });
  it('passes grid and delegated environments through untouched', () => {
    const s = '{start_of_grid}\n| Am . . . | C . . . |\n{end_of_grid}\n{start_of_abc}\nX:1\n[K:G]\n{end_of_abc}';
    expect(correct(s)).toMatchObject({ text: s, flags: [] });
  });
  it('still turns {st:} into {artist:} per the project spec', () => {
    expect(fix('{st: Deep Purple}')).toBe('{artist: Deep Purple}');
  });
});
