export type SourceId = 'github' | 'ug' | 'chordie' | 'echords' | 'web';

export interface SearchHit {
  id: string;
  source: SourceId;
  title: string;
  artist?: string;
  /** Page to open for the original. */
  pageUrl: string;
  /** Rating on a 0–5 scale, when the source has one. */
  rating?: number;
  votes?: number;
  /** GitHub stars for the repository the file lives in. */
  repoStars?: number;
  detail?: string;
  load: () => Promise<LoadedSong>;
}

export interface LoadedSong {
  text: string;
  fileName: string;
  sourceUrl: string;
}

export interface Settings {
  githubToken: string;
  proxyUrl: string;
}
