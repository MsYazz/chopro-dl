// Recently opened songs, kept in this browser only so they can be opened again offline.
import type { LoadedSong } from './lib/sources/types';

const KEY = 'chopro-dl-recent';
const MAX = 25;

export interface RecentSong extends LoadedSong { title: string; artist?: string; openedAt: number }

export function loadRecent(): RecentSong[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function addRecent(song: RecentSong): RecentSong[] {
  const list = [song, ...loadRecent().filter((s) => !(s.sourceUrl && s.sourceUrl === song.sourceUrl) && !(s.title === song.title && s.text === song.text))].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
  return list;
}

export function removeRecent(openedAt: number): RecentSong[] {
  const list = loadRecent().filter((s) => s.openedAt !== openedAt);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}
