import { useMemo, useState, useRef, useEffect } from 'react';
import type { SearchHit, Settings, SourceId, LoadedSong } from './lib/sources/types';
import { searchGithub, githubBlobToRaw } from './lib/sources/github';
import { searchUg, loadUgTab } from './lib/sources/ug';
import { searchWeb } from './lib/sources/web';
import { SITES, searchSite } from './lib/sources/sites';
import { extractChordSheet, toChordProFile } from './lib/sources/extract';
import { fetchAny } from './lib/sources/fetcher';
import { prepare, suggestFileName, type Prepared } from './lib/pipeline';
import { correct } from './lib/corrector';
import { transposeText, findKey, type AccidentalMode } from './lib/transpose';
import { isChord } from './lib/chords';
import { parseSong } from './lib/parse';
import { loadSettings, saveSettings, effectiveProxy, BUILT_IN_PROXY, BUILT_IN_GITHUB_TOKEN } from './settings';
import { Rating } from './components/Rating';
import { Preview } from './components/Preview';
import { useInstallPrompt, useOnline, takeSharedInput } from './pwa';
import { loadRecent, addRecent, removeRecent, type RecentSong } from './recent';

const SOURCE_LABEL: Record<SourceId, string> = { github: 'GitHub', ug: 'Ultimate Guitar', chordie: 'Chordie', echords: 'E-Chords', web: 'Webben' };

interface Opened { song: LoadedSong; prepared: Prepared }

export default function App() {
  const [stored, setStored] = useState<Settings>(loadSettings);
  const settings: Settings = { ...stored, githubToken: stored.githubToken || BUILT_IN_GITHUB_TOKEN, proxyUrl: effectiveProxy(stored) };
  const [showSettings, setShowSettings] = useState(false);
  const [query, setQuery] = useState('');
  const [sources, setSources] = useState<Record<SourceId, boolean>>({ github: true, ug: true, chordie: true, echords: true, web: true });
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [errors, setErrors] = useState<Partial<Record<SourceId, string>>>({});
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  const [opened, setOpened] = useState<Opened | null>(null);
  const [edited, setEdited] = useState('');
  const [semis, setSemis] = useState(0);
  const [acc, setAcc] = useState<AccidentalMode>('auto');
  const [tab, setTab] = useState<'preview' | 'text' | 'changes' | 'review'>('preview');
  const [fontSize, setFontSize] = useState(17);
  const [toast, setToast] = useState('');
  const [importText, setImportText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<RecentSong[]>(loadRecent);
  const { canInstall, install, installed, isIos } = useInstallPrompt();
  const online = useOnline();

  // Text or a link shared to the installed app from another app.
  useEffect(() => {
    const shared = takeSharedInput();
    if (shared) { setImportText(shared); void importFrom(shared); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = (s: Settings) => { setStored(s); saveSettings(s); };
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setBusy(true); setHits([]); setErrors({}); setSearched(true);
    const jobs: [SourceId, (q: string, s: Settings) => Promise<SearchHit[]>][] = [
      ['github', searchGithub], ['ug', searchUg],
      ['chordie', (q, s) => searchSite(SITES.chordie, q, s)], ['echords', (q, s) => searchSite(SITES.echords, q, s)],
      ['web', searchWeb],
    ];
    await Promise.all(jobs.filter(([id]) => sources[id]).map(async ([id, fn]) => {
      try {
        const r = await fn(q, settings);
        setHits((prev) => [...prev, ...r]);
      } catch (err) {
        setErrors((prev) => ({ ...prev, [id]: (err as Error).message }));
      }
    }));
    setBusy(false);
  }

  function open(song: LoadedSong) {
    const prepared = prepare(song.text);
    setOpened({ song, prepared });
    setEdited(prepared.text);
    const meta = parseSong(prepared.text).meta;
    setRecent(addRecent({ ...song, title: meta.title || song.fileName.replace(/\.[^.]+$/, ''), artist: meta.artist, openedAt: Date.now() }));
    setSemis(0);
    setAcc('auto');
    setTab('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function openHit(hit: SearchHit) {
    setLoadingId(hit.id); setLoadError('');
    try { open(await hit.load()); } catch (err) { setLoadError(`${hit.title}: ${(err as Error).message}`); }
    setLoadingId(null);
  }

  const importFromInput = () => importFrom(importText);

  async function importFrom(input: string) {
    const v = input.trim();
    if (!v) return;
    setLoadError('');
    if (/^https?:\/\/\S+$/.test(v)) {
      setLoadingId('import');
      try {
        if (/ultimate-guitar\.com/.test(v)) { open(await loadUgTab(v, settings)); } else {
          const name = decodeURIComponent(v.split('/').pop()!.split('?')[0]) || 'song.pro';
          const body = await fetchAny(githubBlobToRaw(v), settings);
          if (/^\s*(<!doctype|<html)/i.test(body)) {
            // A web page (e.g. Chordie or E-Chords): pull out the chord sheet.
            const sheet = extractChordSheet(body);
            if (!sheet) throw new Error('Hittade inga ackord på sidan.');
            open({ text: toChordProFile(sheet), fileName: `${sheet.title || name}.pro`, sourceUrl: v });
          } else {
            open({ text: body, fileName: name, sourceUrl: v });
          }
        }
      } catch (err) { setLoadError((err as Error).message); }
      setLoadingId(null);
    } else {
      open({ text: v, fileName: 'inklistrad.pro', sourceUrl: '' });
    }
  }

  async function importFile(f: File) {
    open({ text: await f.text(), fileName: f.name, sourceUrl: '' });
  }

  const sortedHits = useMemo(() => [...hits].sort((a, b) => score(b) - score(a)), [hits]);
  const output = useMemo(() => transposeText(edited, semis, acc), [edited, semis, acc]);
  const liveFlags = useMemo(() => correct(edited).flags, [edited]);
  const meta = useMemo(() => parseSong(output).meta, [output]);
  const origKey = findKey(edited);
  const fileName = opened ? suggestFileName(meta, opened.song.fileName) : 'song.pro';

  async function copy() {
    try { await navigator.clipboard.writeText(output); flash('Kopierat!'); }
    catch {
      const ta = document.createElement('textarea'); ta.value = output; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); flash('Kopierat!');
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="logo" onClick={() => setOpened(null)}>ChoPro <span>DL</span></h1>
        <div className="topbar-actions">
          {canInstall && <button onClick={install}>Installera app</button>}
          <button className="ghost" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>⚙ Inställningar</button>
        </div>
      </header>

      {!online && <p className="notice">Du är offline. Sökning och hämtning fungerar inte, men du kan öppna senaste låtar, klistra in text och transponera.</p>}

      {showSettings && (
        <section className="panel settings">
          <label>GitHub-token
            <input type="password" value={stored.githubToken} placeholder="github_pat_…" onChange={(e) => updateSettings({ ...stored, githubToken: e.target.value.trim() })} />
            <small>{BUILT_IN_GITHUB_TOKEN ? 'En token är redan inbyggd i appen. Fyll bara i här om du vill använda en egen. ' : ''}Behövs inte om appen har en inbyggd token eller proxyn har GITHUB_TOKEN. Vill du använda en egen: skapa en <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained token</a> utan några behörigheter (bara läsning av publika repon). Sparas bara i din webbläsare.</small>
          </label>
          <label>Proxy-URL (Google Apps Script)
            <input type="url" value={stored.proxyUrl} placeholder={BUILT_IN_PROXY || 'https://script.google.com/macros/s/…/exec'} onChange={(e) => updateSettings({ ...stored, proxyUrl: e.target.value.trim() })} />
            <small>{BUILT_IN_PROXY ? 'En proxy är redan inbyggd i appen. Fyll bara i här om du vill använda en annan. ' : ''}Behövs för Ultimate Guitar och webbsökning. Se <a href="https://github.com/MsYazz/chopro-dl/blob/main/proxy/README.md" target="_blank" rel="noreferrer">instruktionen</a>.</small>
          </label>
          {!installed && isIos && <p className="muted">Installera på iPhone/iPad: tryck på Dela-knappen i Safari och välj <strong>Lägg till på hemskärmen</strong>.</p>}
        </section>
      )}

      {!opened && (
        <main>
          <form className="search" onSubmit={runSearch}>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök låt eller artist, t.ex. Smoke on the water" autoFocus />
            <button type="submit" disabled={busy}>{busy ? 'Söker…' : 'Sök'}</button>
          </form>
          <div className="sources">
            {(Object.keys(SOURCE_LABEL) as SourceId[]).map((id) => (
              <label key={id} className="chip">
                <input type="checkbox" checked={sources[id]} onChange={(e) => setSources({ ...sources, [id]: e.target.checked })} />
                {SOURCE_LABEL[id]}
              </label>
            ))}
          </div>

          {Object.entries(errors).map(([id, msg]) => (
            <p key={id} className="notice">{SOURCE_LABEL[id as SourceId]}: {msg}</p>
          ))}
          {loadError && <p className="notice error">{loadError}</p>}

          {sortedHits.length > 0 && (
            <ul className="results">
              {sortedHits.map((h) => (
                <li key={h.id}>
                  <button className="result" onClick={() => openHit(h)} disabled={loadingId !== null}>
                    <span className="result-main">
                      <strong>{h.title}</strong>
                      {h.artist && <span className="artist">{h.artist}</span>}
                      <span className="detail"><span className={`badge badge-${h.source}`}>{SOURCE_LABEL[h.source]}</span> {h.detail}</span>
                    </span>
                    <Rating hit={h} />
                    <span className="open">{loadingId === h.id ? 'Hämtar…' : 'Öppna'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searched && !busy && sortedHits.length === 0 && Object.keys(errors).length === 0 && <p className="muted">Inga träffar.</p>}

          {recent.length > 0 && !searched && (
            <section className="recent">
              <h3>Senast öppnade</h3>
              <ul className="results">
                {recent.map((r) => (
                  <li key={r.openedAt} className="recent-row">
                    <button className="result" onClick={() => open(r)}>
                      <span className="result-main">
                        <strong>{r.title}</strong>
                        {r.artist && <span className="artist">{r.artist}</span>}
                      </span>
                      <span className="open">Öppna</span>
                    </button>
                    <button className="ghost small remove" aria-label={`Ta bort ${r.title} från listan`} onClick={() => setRecent(removeRecent(r.openedAt))}>✕</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel import">
            <h3>Har du redan en fil eller länk?</h3>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Klistra in ChordPro-text, ackord-över-text, eller en länk (GitHub, Ultimate Guitar, direktlänk till .pro/.cho)" rows={5} />
            <div className="row">
              <button onClick={importFromInput} disabled={!importText.trim() || loadingId !== null}>{loadingId === 'import' ? 'Hämtar…' : 'Öppna'}</button>
              <button className="ghost" onClick={() => fileRef.current?.click()}>Välj fil…</button>
              <input ref={fileRef} type="file" accept=".pro,.cho,.chopro,.chordpro,.crd,.txt" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            </div>
          </section>
        </main>
      )}

      {opened && (
        <main className="editor">
          <div className="toolbar">
            <button className="ghost" onClick={() => setOpened(null)}>← Tillbaka</button>
            <div className="transpose" role="group" aria-label="Transponera">
              <button onClick={() => setSemis((s) => s - 1)} aria-label="Ett halvt tonsteg ned">−</button>
              <span className="semis">
                {semis > 0 ? `+${semis}` : semis}
                {origKey && isChord(origKey) && <small> {semis === 0 ? origKey : `${origKey} → ${meta.key}`}</small>}
              </span>
              <button onClick={() => setSemis((s) => s + 1)} aria-label="Ett halvt tonsteg upp">+</button>
              <select value={acc} onChange={(e) => setAcc(e.target.value as AccidentalMode)} aria-label="Förtecken">
                <option value="auto">auto</option><option value="sharp">♯</option><option value="flat">♭</option>
              </select>
              {semis !== 0 && <button className="ghost small" onClick={() => setSemis(0)}>Återställ</button>}
            </div>
            <div className="actions">
              <button onClick={copy}>Kopiera</button>
              <button onClick={download}>Ladda ned</button>
            </div>
          </div>

          <div className="summary">
            {opened.prepared.converted && <span className="pill">Konverterad från ackord-över-text</span>}
            <span className="pill">{opened.prepared.changes.length} rättningar</span>
            <span className={`pill${liveFlags.length ? ' warn' : ''}`}>{liveFlags.length} att granska</span>
            {opened.song.sourceUrl && <a href={opened.song.sourceUrl} target="_blank" rel="noreferrer">Källa ↗</a>}
          </div>

          <nav className="tabs">
            <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Förhandsvisning</button>
            <button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>Redigera</button>
            <button className={tab === 'changes' ? 'active' : ''} onClick={() => setTab('changes')}>Ändringar ({opened.prepared.changes.length})</button>
            <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>Granska ({liveFlags.length})</button>
          </nav>

          {tab === 'preview' && (
            <>
              <div className="zoom">
                <button className="ghost small" onClick={() => setFontSize((f) => Math.max(12, f - 1))}>A−</button>
                <button className="ghost small" onClick={() => setFontSize((f) => Math.min(28, f + 1))}>A+</button>
              </div>
              <Preview text={output} flags={semis === 0 ? liveFlags : []} fontSize={fontSize} />
            </>
          )}
          {tab === 'text' && (
            <div>
              <p className="muted">Här redigerar du den rättade filen (utan transponering). Förhandsvisningen uppdateras direkt.</p>
              <textarea className="code" value={edited} onChange={(e) => setEdited(e.target.value)} spellCheck={false} rows={30} />
              <div className="row"><button className="ghost" onClick={() => setEdited(opened.prepared.text)}>Återställ till automatiskt rättad</button></div>
            </div>
          )}
          {tab === 'changes' && (
            <div className="log">
              {opened.prepared.changes.length === 0 && <p className="muted">Inga ändringar behövdes.</p>}
              {opened.prepared.changes.map((c, i) => (
                <div key={i} className="log-row">
                  <div className="log-head">Rad {c.line} · {c.rule}</div>
                  <code className="before">{c.before || '(tom)'}</code>
                  <code className="after">{c.after || '(borttagen)'}</code>
                </div>
              ))}
            </div>
          )}
          {tab === 'review' && (
            <div className="log">
              {liveFlags.length === 0 && <p className="muted">Inget att granska. Kontrollen är ändå ingen fullständig ChordPro-parser, så titta gärna igenom förhandsvisningen.</p>}
              {liveFlags.map((f, i) => (
                <div key={i} className="log-row">
                  <div className="log-head">Rad {f.line} · {f.reason}</div>
                  <code>{f.text}</code>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
      <footer className="foot">Filerna tillhör sina upphovspersoner. ChoPro DL hämtar och rättar dem bara i din webbläsare.</footer>
    </div>
  );
}

function score(h: SearchHit): number {
  if (typeof h.rating === 'number') return h.rating * 20 + Math.log10((h.votes ?? 0) + 1) * 10;
  if (typeof h.repoStars === 'number') return Math.min(80, Math.log10(h.repoStars + 1) * 30);
  return 0;
}
