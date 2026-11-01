import { correct, type CorrectionResult } from './corrector';
import { looksLikeChordsOverLyrics, chordsOverLyricsToChordPro, stripUgMarkup } from './convert';

export interface Prepared extends CorrectionResult { converted: boolean }

/** Raw downloaded text → corrected ChordPro, with a change log and lines to review. */
export function prepare(raw: string): Prepared {
  let text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let converted = false;
  if (text.includes('[ch]')) { text = stripUgMarkup(text); }
  if (looksLikeChordsOverLyrics(text)) {
    text = chordsOverLyricsToChordPro(text);
    converted = true;
  }
  return { ...correct(text), converted };
}

export function suggestFileName(meta: Record<string, string>, fallback: string): string {
  const base = meta.title ? (meta.artist ? `${meta.title} - ${meta.artist}` : meta.title) : fallback.replace(/\.[^.]+$/, '');
  return `${base.replace(/[\\/:*?"<>|]+/g, '').trim() || 'song'}.pro`;
}
