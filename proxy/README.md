# Proxy med Google Apps Script

GitHub Pages kan bara visa statiska filer, och många sajter (t.ex. Ultimate Guitar och DuckDuckGo) tillåter inte att en webbsida hämtar deras innehåll direkt från webbläsaren. Den här lilla proxyn körs gratis på ditt Google-konto och hämtar sidorna åt appen.

Proxyn släpper bara igenom Ultimate Guitar, DuckDuckGo och länkar som slutar på `.pro`, `.cho`, `.chopro`, `.chordpro`, `.crd` eller `.txt`, så den kan inte användas som en öppen proxy.

## Så gör du

1. Gå till [script.google.com](https://script.google.com) och välj **Nytt projekt**.
2. Ta bort det som står i `Code.gs` och klistra in innehållet i [`Code.gs`](./Code.gs).
3. Klicka **Driftsätt → Ny driftsättning**.
4. Välj typ **Webbapp**. Sätt *Kör som* till **Jag** och *Vem har åtkomst* till **Alla**.
5. Klicka **Driftsätt** och godkänn behörigheterna (Google varnar för att appen inte är verifierad, välj *Avancerat → Gå till projektet*).
6. Kopiera webbappens URL (slutar på `/exec`) och lägg in den som repository-variabeln `PROXY_URL` (*Settings → Secrets and variables → Actions → Variables*). Kör sedan deploy-workflowet igen. Du kan också klistra in den under **⚙ Inställningar → Proxy-URL** i appen.

Om du ändrar skriptet senare måste du göra en ny driftsättning (eller *Hantera driftsättningar → Redigera → Ny version*) för att ändringen ska gälla.

## Begränsningar

- Ultimate Guitar kan blockera anrop från Googles servrar. Då visas ett felmeddelande i appen, och du kan i stället kopiera texten från sajten och klistra in den.
- Google har dagliga kvoter för `UrlFetchApp` (ca 20 000 anrop per dag på ett vanligt konto), vilket räcker gott för personligt bruk.
