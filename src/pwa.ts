import { useEffect, useState } from 'react';

export function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
    });
  }
}

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** Install button support (Chrome/Edge/Android). iOS has no prompt and uses "Add to Home Screen". */
export function useInstallPrompt() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const install = async () => { if (!evt) return; await evt.prompt(); await evt.userChoice; setEvt(null); };
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return { canInstall: !!evt && !installed, install, installed, isIos };
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** Text or link shared to the app from another app (Android share sheet). Removed from the URL once read. */
export function takeSharedInput(): string | null {
  const p = new URLSearchParams(location.search);
  const parts = [p.get('share_url'), p.get('share_text')].filter((x): x is string => !!x && !!x.trim());
  if (!parts.length) return null;
  history.replaceState(null, '', location.pathname);
  // A shared link usually arrives in text; prefer a lone URL when there is one.
  const url = parts.map((x) => x.trim()).find((x) => /^https?:\/\/\S+$/.test(x));
  return url ?? parts.join('\n');
}
