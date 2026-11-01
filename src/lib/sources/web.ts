// Generic web search for ChordPro files via DuckDuckGo, through the proxy.
import type { SearchHit, Settings } from './types';
import { fetchText, fetchAny } from './fetcher';
import { githubBlobToRaw, titleFromFileName } from './github';

const FILE_RE = /\.(cho|chopro|chordpro|crd|pro)(?:$|\?)/i;

export async function searchWeb(query: string, settings: Settings): Promise<SearchHit[]> {
  const q = `${query} (filetype:cho OR filetype:chopro OR filetype:pro OR filetype:chordpro)`;
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, settings, { viaProxy: true });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const links = [...doc.querySelectorAll('a.result__a, a.result-link')] as HTMLAnchorElement[];
  const hits: SearchHit[] = [];
  for (const a of links) {
    let href = a.getAttribute('href') ?? '';
    const uddg = /[?&]uddg=([^&]+)/.exec(href);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (!/^https?:/.test(href) || !FILE_RE.test(href)) continue;
    const name = href.split('/').pop()!.split('?')[0];
    const target = githubBlobToRaw(href);
    hits.push({
      id: `web:${href}`,
      source: 'web',
      title: titleFromFileName(name),
      pageUrl: href,
      detail: new URL(href).hostname,
      load: async () => ({ text: await fetchAny(target, settings), fileName: decodeURIComponent(name), sourceUrl: href }),
    });
  }
  return hits;
}
