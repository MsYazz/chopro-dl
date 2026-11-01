// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { extractChordSheet, splitTitle, toChordProFile } from '../src/lib/sources/extract';
import { parseDuckDuckGo } from '../src/lib/sources/web';
import { SITES } from '../src/lib/sources/sites';
import { prepare } from '../src/lib/pipeline';

describe('extractChordSheet', () => {
  it('finds an embedded ChordPro block (Chordie style)', () => {
    const html = `<html><head><title>Guitar Tabs, Chords and Lyrics</title></head><body>
      <div id="nav">Home Search Browse</div>
      <div class="song"><p>Rate #1 of 1 versions</p>
      <pre>{t:Wonderwall}
{st:The Mike Flowers Pops}
Intro:
[Em7]Today is [G]gonna be the day
That they're [Dsus4]gonna throw it back to [A7sus4]you</pre></div></body></html>`;
    const x = extractChordSheet(html)!;
    expect(x.text.startsWith('{t:Wonderwall}')).toBe(true);
    const fixed = prepare(toChordProFile(x)).text;
    expect(fixed).toContain('{artist: The Mike Flowers Pops}');
    expect(fixed).toContain('[Em7]Today is [G]gonna be the day');
  });

  it('reads chords over lyrics with <u> chord markup (E-Chords style)', () => {
    const html = `<html><head><title>Wonderwall Chords - Oasis | E-Chords</title></head><body>
      <h1>Wonderwall - Oasis</h1><div class="ads">Buy now</div>
      <pre id="core"><u>Em7</u>          <u>G</u>
Today is gonna be the day
<u>Dsus4</u>              <u>A7sus4</u>
That they're gonna throw it back to you</pre></body></html>`;
    const x = extractChordSheet(html)!;
    expect(x.title).toBe('Wonderwall');
    expect(x.artist).toBe('Oasis');
    const fixed = prepare(toChordProFile(x)).text;
    expect(fixed).toBe('{title: Wonderwall}\n{artist: Oasis}\n\n[Em7]Today is gonn[G]a be the day\n[Dsus4]That they\'re gonna [A7sus4]throw it back to you');
  });

  it('returns null for pages without chords', () => {
    expect(extractChordSheet('<html><body><p>Hello world, nothing here.</p></body></html>')).toBeNull();
  });
});

describe('helpers', () => {
  it('splits page titles', () => {
    expect(splitTitle('Wonderwall Chords - Oasis | E-Chords')).toEqual({ title: 'Wonderwall', artist: 'Oasis' });
  });
  it('parses DuckDuckGo result links', () => {
    const html = '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.e-chords.com%2Fchords%2Foasis%2Fwonderwall&rut=x">Wonderwall Chords</a>';
    expect(parseDuckDuckGo(html)).toEqual([{ href: 'https://www.e-chords.com/chords/oasis/wonderwall', title: 'Wonderwall Chords' }]);
  });
  it('recognises song URLs', () => {
    expect(SITES.echords.isSong(new URL('https://www.e-chords.com/chords/oasis/wonderwall'))).toBe(true);
    expect(SITES.echords.isSong(new URL('https://www.e-chords.com/drums/oasis/wonderwall'))).toBe(false);
    expect(SITES.chordie.isSong(new URL('https://www.chordie.com/chord.pere/www.azchords.com/t/x/y.html'))).toBe(true);
    expect(SITES.echords.fromUrl(new URL('https://www.e-chords.com/chords/oasis/dont-look-back-in-anger'))).toEqual({ artist: 'Oasis', title: 'Dont Look Back In Anger' });
  });
});
