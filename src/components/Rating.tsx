import type { SearchHit } from '../lib/sources/types';

export function Rating({ hit }: { hit: SearchHit }) {
  if (typeof hit.rating === 'number') {
    const pct = Math.max(0, Math.min(100, (hit.rating / 5) * 100));
    return (
      <span className="rating" title={`${hit.rating.toFixed(2)} av 5${hit.votes ? `, ${hit.votes} röster` : ''}`}>
        <span className="stars" aria-hidden="true">
          <span className="stars-bg">★★★★★</span>
          <span className="stars-fg" style={{ width: `${pct}%` }}>★★★★★</span>
        </span>
        <span className="rating-num">{hit.rating.toFixed(1)}{hit.votes ? ` (${hit.votes})` : ''}</span>
      </span>
    );
  }
  if (typeof hit.repoStars === 'number') {
    return <span className="rating" title="Stjärnor på GitHub-repot där filen ligger">★ {hit.repoStars} <small>repo</small></span>;
  }
  return <span className="rating muted">Inget betyg</span>;
}
