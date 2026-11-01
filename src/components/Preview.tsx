import { parseSong } from '../lib/parse';
import type { Flag } from '../lib/corrector';

export function Preview({ text, flags, fontSize }: { text: string; flags: Flag[]; fontSize: number }) {
  const song = parseSong(text);
  const flagged = new Map<number, string>();
  flags.forEach((f) => flagged.set(f.line, [flagged.get(f.line), f.reason].filter(Boolean).join(' · ')));
  const sub = [song.meta.artist ?? song.meta.subtitle, song.meta.album, song.meta.year].filter(Boolean).join(' · ');
  const facts = [song.meta.key && `Tonart ${song.meta.key}`, song.meta.capo && `Capo ${song.meta.capo}`, song.meta.tempo && `${song.meta.tempo} bpm`, song.meta.time].filter(Boolean);

  return (
    <article className="song" style={{ fontSize: `${fontSize}px` }}>
      {song.meta.title && <h2 className="song-title">{song.meta.title}</h2>}
      {sub && <p className="song-sub">{sub}</p>}
      {facts.length > 0 && <p className="song-facts">{facts.join(' · ')}</p>}
      <div className="song-body">
        {song.items.map((it, i) => {
          const why = flagged.get(it.line);
          const cls = why ? ' flagged' : '';
          if (it.type === 'empty') return <div key={i} className="gap" />;
          if (it.type === 'comment') return <div key={i} className={`comment comment-${it.style}${cls}`} title={why}>{it.text}</div>;
          if (it.type === 'tab') return <pre key={i} className={`tab${cls}`} title={why}>{it.text}</pre>;
          const hasChords = it.segments.some((s) => s.chord !== undefined);
          return (
            <div key={i} className={`line${it.env ? ` env-${it.env}` : ''}${hasChords ? ' has-chords' : ''}${cls}`} title={why}>
              {it.segments.map((s, j) => (
                <span key={j} className="seg">
                  {hasChords && <span className="chord">{s.chord ?? ' '}</span>}
                  <span className="lyric">{s.text || (s.chord ? ' ' : '')}</span>
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </article>
  );
}
