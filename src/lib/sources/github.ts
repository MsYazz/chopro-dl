import type { SearchHit, Settings } from './types';

const EXTENSIONS = ['cho', 'chopro', 'chordpro', 'crd', 'pro'];

export function githubBlobToRaw(url: string): string {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(url);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : url;
}

export function titleFromFileName(name: string): string {
  return decodeURIComponent(name).replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

interface CodeItem { name: string; path: string; html_url: string; repository: { full_name: string; html_url: string } }

export async function searchGithub(query: string, settings: Settings): Promise<SearchHit[]> {
  if (!settings.githubToken) throw new Error('GitHub-sökning kräver en token. Lägg in den under Inställningar.');
  const headers = { Authorization: `Bearer ${settings.githubToken}`, Accept: 'application/vnd.github+json' };
  const responses = await Promise.all(EXTENSIONS.map(async (ext) => {
    const res = await fetch(`https://api.github.com/search/code?per_page=30&q=${encodeURIComponent(`${query} extension:${ext}`)}`, { headers });
    if (res.status === 401) throw new Error('GitHub-token är ogiltig.');
    if (!res.ok) return [] as CodeItem[];
    return ((await res.json()).items ?? []) as CodeItem[];
  }));
  const items = responses.flat();
  const seen = new Set<string>();
  const unique = items.filter((it) => {
    const key = `${it.repository.full_name}/${it.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const repos = [...new Set(unique.map((i) => i.repository.full_name))].slice(0, 25);
  const stars = new Map<string, number>();
  await Promise.all(repos.map(async (r) => {
    try {
      const res = await fetch(`https://api.github.com/repos/${r}`, { headers });
      if (res.ok) stars.set(r, (await res.json()).stargazers_count ?? 0);
    } catch { /* stars are optional */ }
  }));

  return unique.map((it) => {
    const raw = githubBlobToRaw(it.html_url);
    const parts = it.path.split('/');
    const folder = parts.length > 1 ? parts[parts.length - 2] : '';
    return {
      id: `gh:${it.repository.full_name}/${it.path}`,
      source: 'github' as const,
      title: titleFromFileName(it.name),
      artist: folder && !/^(songs?|chordpro|src|data|[a-z0-9])$/i.test(folder) ? titleFromFileName(folder) : undefined,
      pageUrl: it.html_url,
      repoStars: stars.get(it.repository.full_name),
      detail: it.repository.full_name,
      load: async () => {
        const res = await fetch(raw);
        if (!res.ok) throw new Error(`Kunde inte hämta filen (${res.status})`);
        return { text: await res.text(), fileName: decodeURIComponent(it.name), sourceUrl: it.html_url };
      },
    };
  });
}
