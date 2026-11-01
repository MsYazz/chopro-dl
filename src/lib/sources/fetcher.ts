import type { Settings } from './types';

/** Fetches a URL directly, or through the Google Apps Script proxy when one is set. */
export async function fetchText(url: string, settings: Settings, opts: { viaProxy?: boolean } = {}): Promise<string> {
  const useProxy = opts.viaProxy ?? false;
  if (useProxy) {
    if (!settings.proxyUrl) throw new Error('Den här källan kräver en proxy. Lägg in din Google Apps Script-URL under Inställningar.');
    const res = await fetch(`${settings.proxyUrl}${settings.proxyUrl.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Proxyn svarade ${res.status}`);
    const body = await res.text();
    if (body.startsWith('PROXY_ERROR:')) throw new Error(body.slice(12).trim());
    return body;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hämtningen misslyckades (${res.status})`);
  return res.text();
}

/** Tries a direct fetch first, then the proxy. */
export async function fetchAny(url: string, settings: Settings): Promise<string> {
  try {
    return await fetchText(url, settings);
  } catch (e) {
    if (!settings.proxyUrl) throw new Error('Sidan tillåter inte hämtning direkt från webbläsaren. Lägg in en proxy under Inställningar eller klistra in texten.');
    return fetchText(url, settings, { viaProxy: true });
  }
}
