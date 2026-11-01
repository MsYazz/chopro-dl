import type { Settings } from './lib/sources/types';

const KEY = 'chopro-dl-settings';
// Set at build time from the repository variable PROXY_URL (see README).
export const BUILT_IN_PROXY = (import.meta.env.VITE_PROXY_URL ?? '').trim();
// Set at build time from the Actions secret GHUB_TOKEN. Note: it is readable by anyone who opens the site.
export const BUILT_IN_GITHUB_TOKEN = (import.meta.env.VITE_GITHUB_TOKEN ?? '').trim();
const EMPTY: Settings = { githubToken: '', proxyUrl: '' };

/** The proxy to use: the one typed in settings, otherwise the built-in one. */
export function effectiveProxy(s: Settings): string {
  return s.proxyUrl || BUILT_IN_PROXY;
}

export function loadSettings(): Settings {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return EMPTY;
  }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
