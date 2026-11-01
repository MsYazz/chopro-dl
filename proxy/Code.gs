/**
 * ChoPro DL – proxy for Google Apps Script.
 *
 * Lets the static site on GitHub Pages fetch pages that block direct browser requests.
 * Only allows a short list of sites plus ChordPro files, so it can't be used as an open proxy.
 *
 * Setup: script.google.com → New project → paste this file → Deploy → New deployment →
 * type "Web app", Execute as "Me", Who has access "Anyone" → copy the /exec URL into the app's settings.
 *
 * GitHub search: add a Script property named GITHUB_TOKEN (Project Settings → Script properties).
 * The token stays here on Google's side and is never sent to the browser.
 */
var ALLOWED_HOSTS = [
  'www.ultimate-guitar.com',
  'tabs.ultimate-guitar.com',
  'ultimate-guitar.com',
  'html.duckduckgo.com',
];
var FILE_RE = /\.(cho|chopro|chordpro|crd|pro|txt)(\?|$)/i;

// Only these GitHub API calls are forwarded with the token.
var GITHUB_PATHS = [/^\/search\/code\?/, /^\/repos\/[\w.-]+\/[\w.-]+$/];

function githubApi(path) {
  if (!GITHUB_PATHS.some(function (re) { return re.test(path); })) throw new Error('GitHub-anropet är inte tillåtet');
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN saknas i skriptets egenskaper');
  var res = UrlFetchApp.fetch('https://api.github.com' + path, {
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'chopro-dl-proxy' },
  });
  var code = res.getResponseCode();
  if (code === 401) throw new Error('GITHUB_TOKEN är ogiltig eller har gått ut');
  if (code >= 400) throw new Error('GitHub svarade ' + code);
  return res.getContentText();
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.gh) {
    var body;
    try { body = githubApi(params.gh); } catch (err) { body = 'PROXY_ERROR: ' + err.message; }
    return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.TEXT);
  }
  if (params.ping) {
    var hasToken = !!PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    return ContentService.createTextOutput(JSON.stringify({ ok: true, github: hasToken })).setMimeType(ContentService.MimeType.TEXT);
  }
  var url = params.url || '';
  var out;
  try {
    var m = /^https?:\/\/([^\/?#:]+)/i.exec(url);
    if (!m) throw new Error('Ogiltig URL');
    var host = m[1].toLowerCase();
    if (ALLOWED_HOSTS.indexOf(host) < 0 && !FILE_RE.test(url)) throw new Error('Värden är inte tillåten: ' + host);

    var cache = CacheService.getScriptCache();
    var key = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, url));
    var cached = cache.get(key);
    if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.TEXT);

    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
    });
    if (res.getResponseCode() >= 400) throw new Error('Källan svarade ' + res.getResponseCode());
    out = res.getContentText();
    try { cache.put(key, out, 21600); } catch (err) { /* too big for the cache – fine */ }
  } catch (err) {
    out = 'PROXY_ERROR: ' + err.message;
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.TEXT);
}
