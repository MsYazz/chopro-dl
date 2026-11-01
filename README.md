# ChoPro DL

Hitta ChordPro-filer på nätet, se betyg, rätta syntaxen automatiskt, förhandsvisa, transponera och kopiera eller ladda ned resultatet med ett tryck, redo för MobileSheets, OnSong, SongbookPro eller valfri app.

Appen är helt statisk (Vite + React) och körs på GitHub Pages. Den har ingen databas: inställningar sparas bara i din webbläsare.

## Funktioner

- **Sök** i flera källor samtidigt:
  - **GitHub**: `.cho`, `.chopro`, `.chordpro`, `.crd` och `.pro`-filer i publika repon. Betyget är antalet stjärnor på repot. Kräver en GitHub-token (se Inställningar).
  - **Ultimate Guitar**: ackord med stjärnbetyg och antal röster. Konverteras från ackord-över-text till ChordPro. Kräver proxyn.
  - **Webben**: söker efter ChordPro-filer via DuckDuckGo. Kräver proxyn.
- **Klistra in** text, en länk eller välj en fil om du redan har en.
- **Automatisk rättning** enligt korrigeringsspecifikationen (se nedan), med logg över varje ändring och en lista över rader att granska manuellt.
- **Förhandsvisning** med ackord ovanför texten, och **transponering** i halvtonssteg med val av ♯/♭.
- **Kopiera** eller **ladda ned** den rättade och transponerade filen.
- **Installerbar PWA**: lägg appen på hemskärmen eller skrivbordet. Appskalet fungerar offline, och de 25 senast öppnade låtarna sparas i webbläsaren så du kan öppna, transponera och kopiera dem utan nät. På Android kan du dela text eller en länk från en annan app direkt till ChoPro DL.

## Rättningsregler

Följer *Specifikation för korrigering av ChordPro-bibliotek v1.1*:

| Före | Efter |
|---|---|
| `{st: Deep Purple}` | `{artist: Deep Purple}` (tas bort om samma artist redan finns) |
| `{c: Chorus}` | `{comment: Chorus}` |
| `[Intro]`, `Intro]`, `[Verse 1]`, `Chorus]`, `[Guitar solo]` … | `{comment: …}` |
| `[Intro] [Am] [G]` | `{comment: Intro}` + `[Am] [G]` på nästa rad |
| `A:01`, `W:41/W:42`, `T:11 T:12` (fristående) | `{comment: …}` |
| `G]` i ackordsammanhang | `[G]` |
| `[D` (oavslutat) | `[D]` |
| `[[F]`, `[A]]` | `[F]`, `[A]` |
| `{key:A}]}` | `{key:A}` |
| `Am   G   C` (ackordrad utan klamrar) | `[Am]   [G]   [C]` |

`Intro]` blir aldrig `[Intro]`. Rader som inte kan tolkas säkert ändras inte utan visas under **Granska**: tabulatur, okänt innehåll i hakparenteser, ovanliga direktiv, ensamma klamrar och okända rubriker.

## Kom igång

```bash
npm install
npm run dev     # utvecklingsserver
npm test        # tester för rättning, transponering och konvertering
npm run build   # statisk build i dist/
```

### Publicera på GitHub Pages

Workflowet i `.github/workflows/deploy.yml` bygger och publicerar automatiskt vid varje push till `main`. Under **Settings → Pages** i repot ska *Source* vara **GitHub Actions**.

### Proxy

Se [proxy/README.md](proxy/README.md) för hur du sätter upp den kostnadsfria Google Apps Script-proxyn.

För att bygga in proxyn i appen: lägg dess URL som repository-variabel **`PROXY_URL`** under *Settings → Secrets and variables → Actions → Variables* och kör deploy-workflowet igen. URL:en hamnar i den publika koden, vilket är okej eftersom proxyn bara släpper igenom tillåtna sajter. GitHub-sökningen kan få en inbyggd token från Actions-secret **`GHUB_TOKEN`** (*Settings → Secrets and variables → Actions → Secrets*). Observera att den byggs in i den publika koden och kan läsas av alla som öppnar sidan. Använd därför en fine-grained token med bara **Public repositories** och inga behörigheter, med kort giltighetstid. GitHub kan återkalla den automatiskt om den upptäcks publikt. Ett säkrare alternativ är att lägga token som `GITHUB_TOKEN` i Google-proxyn (se proxy/README.md).
