// Chord sites searched via DuckDuckGo "site:" queries and read with the generic extractor.
// Both go through the Google Apps Script proxy, since the sites block direct browser requests.
import type { SearchHit, Settings, SourceId } from './types';
import { fetchText } from './fetcher';
import { duckDuckGo } from './web';
import { extractChordSheet, toChordProFile, splitTitle } from './extract';

interface Site {
  id: SourceId;
  query: (q: string) => string;
  /** Keeps only links to song pages. */
  isSong: (url: URL) => boolean;
  /** Title/artist from the URL when the search result title isn't useful. */
  fromUrl: (url: URL) => { title?: string; artist?: string };
}

const words = (s: string) => decodeURIComponent(s).replace(/[-_+]+/g, ' ').replace(/\.html?$/, '').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

export const SITES: Record<'chordie' | 'echords', Site> = {
  chordie: {
    id: 'chordie',
    query: (q) => `site:chordie.com ${q}`,
    isSong: (u) => /chordie\.com$/.test(u.hostname) && /^\/(chord\.pere|song\.php\/songartist\/[^/]+\/songtitle)\//.test(u.pathname),
    fromUrl: (u) => {
      const m = /songartist\/([^/]+)\/songtitle\/([^/]+)/.exec(u.pathname);
      return m ? { artist: words(m[1]), title: words(m[2]) } : {};
    },
  },
  echords: {
    id: 'echords',
    query: (q) => `site:e-chords.com/chords ${q}`,
    isSong: (u) => /e-chords\.com$/.test(u.hostname) && /^\/chords\/[^/]+\/[^/]+/.test(u.pathname),
    fromUrl: (u) => {
      const m = /^\/chords\/([^/]+)\/([^/]+)/.exec(u.pathname);
      return m ? { artist: words(m[1]), title: words(m[2]) } : {};
    },
  },
};

export async function searchSite(site: Site, query: string, settings: Settings): Promise<SearchHit[]> {
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const r of await duckDuckGo(site.query(query), settings)) {
    let url: URL;
    try { url = new URL(r.href); } catch { continue; }
    if (!site.isSong(url) || seen.has(url.href)) continue;
    seen.add(url.href);
    const fromTitle = splitTitle(r.title);
    const fromUrl = site.fromUrl(url);
    const title = fromUrl.title ?? fromTitle.title ?? r.title;
    const artist = fromUrl.artist ?? fromTitle.artist;
    hits.push({
      id: `${site.id}:${url.href}`,
      source: site.id,
      title,
      artist,
      pageUrl: url.href,
      detail: url.hostname.replace(/^www\./, ''),
      load: async () => {
        const html = await fetchText(url.href, settings, { viaProxy: true });
        const sheet = extractChordSheet(html);
        if (!sheet) throw new Error('Hittade inga ackord på sidan.');
        const text = toChordProFile({ ...sheet, title: sheet.title || title, artist: sheet.artist || artist });
        return { text, fileName: `${title}.pro`, sourceUrl: url.href };
      },
    });
  }
  return hits;
}
