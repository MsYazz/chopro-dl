import type { Settings } from './lib/sources/types';

const KEY = 'chopro-dl-settings';
const EMPTY: Settings = { githubToken: '', proxyUrl: '' };

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
