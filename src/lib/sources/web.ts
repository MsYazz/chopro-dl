// Generic web search for ChordPro files via DuckDuckGo, through the proxy.
import type { SearchHit, Settings } from './types';
import { fetchText, fetchAny } from './fetcher';
import { githubBlobToRaw, titleFromFileName } from './github';

const FILE_RE = /\.(cho|chopro|chordpro|crd|pro)(?:$|\?)/i;

/** Runs a DuckDuckGo search through the proxy and returns result links with their titles. */
export async function duckDuckGo(q: string, settings: Settings): Promise<{ href: string; title: string }[]> {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, settings, { viaProxy: true });
  return parseDuckDuckGo(html);
}

export function parseDuckDuckGo(html: string): { href: string; title: string }[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: { href: string; title: string }[] = [];
  for (const a of doc.querySelectorAll('a.result__a, a.result-link')) {
    let href = a.getAttribute('href') ?? '';
    const uddg = /[?&]uddg=([^&]+)/.exec(href);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (/^https?:/.test(href)) out.push({ href, title: (a.textContent ?? '').trim() });
  }
  return out;
}

export async function searchWeb(query: string, settings: Settings): Promise<SearchHit[]> {
  const q = `${query} (filetype:cho OR filetype:chopro OR filetype:pro OR filetype:chordpro)`;
  const hits: SearchHit[] = [];
  for (const { href } of await duckDuckGo(q, settings)) {
    if (!FILE_RE.test(href)) continue;
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
