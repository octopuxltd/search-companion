const UPDATE_JSON_URL = "https://octopuxltd.github.io/search-companion/update.json";
const INSTALL_PAGE_URL = "https://octopuxltd.github.io/search-companion/";
const UPDATE_NOTIFICATION_ID = "search-sidebar-update-available";

const HISTORY_STORAGE_KEY = "userHistory";
const HISTORY_MAX = 50;

// Supported search engines. Each entry is { id, re, param }: a regex that
// matches the engine's SERP URL, and the query-string parameter that holds
// the user's search term. Order matters only insofar as more specific
// patterns should come before more general ones.
const ENGINES = [
  { id: "google",     re: /^https?:\/\/(www\.)?google\.[a-z.]+\/search\b/i,                          param: "q" },
  { id: "bing",       re: /^https?:\/\/(www\.)?bing\.com\/search\b/i,                                 param: "q" },
  { id: "ddg",        re: /^https?:\/\/(www\.)?duckduckgo\.com\/(?:\?|$)/i,                           param: "q" },
  { id: "amazon",     re: /^https?:\/\/(www\.)?amazon\.[a-z.]+\/s\b/i,                                param: "k" },
  { id: "wikipedia",  re: /^https?:\/\/(www\.)?[a-z-]+\.wikipedia\.org\/wiki\/Special:Search\b/i,    param: "search" },
  { id: "perplexity", re: /^https?:\/\/(www\.)?perplexity\.ai\/(?:\?|search\b)/i,                    param: "q" },
  { id: "target",     re: /^https?:\/\/(www\.)?target\.com\/s\b/i,                                    param: "searchTerm" },
  { id: "bestbuy",    re: /^https?:\/\/(www\.)?bestbuy\.com\/site\/searchpage\.jsp\b/i,               param: "st" },
  { id: "walmart",    re: /^https?:\/\/(www\.)?walmart\.com\/search\b/i,                              param: "q" },
];

// Returns { engineId, query } if the URL is a recognised SERP with a
// non-empty query, else null.
function detectSerp(url) {
  if (typeof url !== "string") return null;
  for (const e of ENGINES) {
    if (!e.re.test(url)) continue;
    try {
      const q = (new URL(url).searchParams.get(e.param) || "").trim();
      if (q) return { engineId: e.id, query: q };
    } catch { /* unparseable URL */ }
  }
  return null;
}

// Persist a user's real Google searches to storage.local so they survive
// sidebar reloads and Firefox restarts. Called whenever handleTab spots a
// SERP — the sidebar reads from this store and re-renders when it changes.
async function logSearchToHistory(query, engineId) {
  const q = String(query || "").trim();
  if (!q) return;
  try {
    const data = await browser.storage.local.get(HISTORY_STORAGE_KEY);
    const list = Array.isArray(data[HISTORY_STORAGE_KEY]) ? data[HISTORY_STORAGE_KEY] : [];
    // De-dupe case-insensitively: re-running a query bumps the existing
    // entry to the top with a fresh timestamp rather than duplicating.
    const filtered = list.filter((e) => String((e && e.q) || "").toLowerCase() !== q.toLowerCase());
    filtered.unshift({ q, ts: Date.now(), engineId: engineId || "google" });
    await browser.storage.local.set({ [HISTORY_STORAGE_KEY]: filtered.slice(0, HISTORY_MAX) });
  } catch (e) { /* storage unavailable */ }
}

function compareSemver(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Check the self-hosted update feed; if a newer version is available and we
// haven't notified the user about this specific version yet, fire a desktop
// notification. The visible sidebar badge handles "the user has the sidebar
// open" — this covers everyone else.
async function checkForUpdateAndNotify() {
  try {
    const running = browser.runtime.getManifest().version;
    const r = await fetch(UPDATE_JSON_URL, { cache: "no-cache" });
    if (!r.ok) return;
    const j = await r.json();
    const addon = j.addons && Object.values(j.addons)[0];
    const updates = (addon && addon.updates) || [];
    const latest = updates
      .map((u) => u.version)
      .filter(Boolean)
      .sort(compareSemver)
      .pop();
    if (!latest || compareSemver(latest, running) <= 0) return;

    const { lastNotifiedVersion } = await browser.storage.local.get("lastNotifiedVersion");
    if (lastNotifiedVersion === latest) return; // already nagged about this one

    await browser.notifications.create(UPDATE_NOTIFICATION_ID, {
      type: "basic",
      iconUrl: browser.runtime.getURL("icon.png"),
      title: "Search Sidebar update available",
      message: `Version ${latest} is ready. You’re on ${running}. Click to install.`,
    });
    await browser.storage.local.set({ lastNotifiedVersion: latest });
  } catch (e) {
    // Network blip, malformed feed — swallow silently and try again next tick.
  }
}

browser.runtime.onInstalled.addListener(() => checkForUpdateAndNotify());
browser.runtime.onStartup.addListener(() => checkForUpdateAndNotify());

// Re-check every 6 hours so long-running browser sessions still catch updates.
browser.alarms.create("update-check", { periodInMinutes: 60 * 6 });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "update-check") checkForUpdateAndNotify();
});

browser.notifications.onClicked.addListener((id) => {
  if (id !== UPDATE_NOTIFICATION_ID) return;
  browser.tabs.create({ url: INSTALL_PAGE_URL });
  browser.notifications.clear(id);
});

// --- Theme-coloured chrome icons ------------------------------------------
//
// `theme_icons` and `sidebarAction.setIcon({ path })` can only switch
// between pre-baked variants — they can't pick up the theme's actual
// accent colour (only Mozilla-signed system add-ons get `context-fill`,
// per Bugzilla 1377302). Workaround: load the silhouette SVG, rasterise
// it onto a canvas, recolour the pixels to the theme's icon colour, and
// hand the result to setIcon as ImageData. Re-runs on theme change.

const SILHOUETTE_URL = browser.runtime.getURL("images/search-icon-silhouette-v1.svg");
const ICON_SIZES = [16, 32, 48, 64, 96, 128];
let silhouetteImagePromise = null;

function loadSilhouette() {
  if (silhouetteImagePromise) return silhouetteImagePromise;
  silhouetteImagePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = SILHOUETTE_URL;
  });
  return silhouetteImagePromise;
}

function rasteriseTinted(img, size, color) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, size, size);
  // source-in keeps only the pixels already painted, then paints with the
  // theme colour — turns the black silhouette into a flat-coloured icon.
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

function pickIconColour(theme, kind) {
  const c = (theme && theme.colors) || {};
  // `kind` is "toolbar" or "sidebar". Prefer surface-specific colours, fall
  // back to the toolbar palette, then to tab text.
  const order = kind === "sidebar"
    ? [c.sidebar_text, c.icons, c.toolbar_text, c.tab_background_text]
    : [c.icons, c.toolbar_text, c.tab_background_text];
  for (const cand of order) {
    if (typeof cand === "string" && cand.trim()) return cand.trim();
    // Firefox sometimes returns rgba as an array of four numbers.
    if (Array.isArray(cand) && cand.length >= 3) {
      const [r, g, b, a = 1] = cand;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }
  // No theme data — use OS preference as a last resort.
  try {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "#ffffff" : "#181822";
  } catch (e) {
    return "#181822";
  }
}

async function applyThemedIcons() {
  let img;
  try { img = await loadSilhouette(); } catch (e) { return; }

  let theme = {};
  try { theme = (await browser.theme.getCurrent()) || {}; } catch (e) {}

  const toolbarColour = pickIconColour(theme, "toolbar");
  const sidebarColour = pickIconColour(theme, "sidebar");

  const toolbarData = {};
  const sidebarData = {};
  for (const size of ICON_SIZES) {
    toolbarData[size] = rasteriseTinted(img, size, toolbarColour);
    // Only re-rasterise the sidebar set if its colour differs — avoid
    // duplicate work for themes that don't define a separate sidebar text.
    sidebarData[size] = sidebarColour === toolbarColour
      ? toolbarData[size]
      : rasteriseTinted(img, size, sidebarColour);
  }

  try { await browser.browserAction.setIcon({ imageData: toolbarData }); } catch (e) {}
  try { await browser.sidebarAction.setIcon({ imageData: sidebarData }); } catch (e) {}
}

if (browser.theme && browser.theme.onUpdated) {
  browser.theme.onUpdated.addListener(applyThemedIcons);
}
applyThemedIcons();

// True for ordinary http/https pages the content script can run on. Excludes
// about:, moz-extension:, file:, ftp:, view-source: — none of which produce
// useful "page topic" suggestions.
function isContentPage(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

// Mirror the user's allow-list from storage.local into the in-memory list
// that isBlockedForAI() reads. On first run (key absent) the list is seeded
// with DEFAULT_ALLOWED_DOMAINS so the prototype works out of the box on the
// major shopping sites. Runs on startup and on every change so edits in
// Settings take effect immediately for the next navigation.
async function refreshUserAllowedDomains() {
  try {
    const data = await browser.storage.local.get("userAllowedDomains");
    if (!Array.isArray(data.userAllowedDomains)) {
      // Never seeded — write the defaults so they show as editable entries.
      await browser.storage.local.set({ userAllowedDomains: DEFAULT_ALLOWED_DOMAINS.slice() });
      setUserAllowedDomains(DEFAULT_ALLOWED_DOMAINS);
      return;
    }
    setUserAllowedDomains(data.userAllowedDomains);
  } catch (e) { /* storage unavailable */ }
}
refreshUserAllowedDomains();
if (browser.storage && browser.storage.onChanged) {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.userAllowedDomains) refreshUserAllowedDomains();
  });
}

async function pageSuggestionsEnabled() {
  try {
    const data = await browser.storage.local.get("settingPageSuggestions");
    return data.settingPageSuggestions === true;
  } catch (e) { return false; }
}

// DNF auto-search preference. When true, a future "Server not found" skips
// our standalone DNF page and instead runs the search automatically —
// either as a real SERP with our injected popup, or as the simulated
// split-view, per settingDnfAutoSearchMode ("popup" | "split").
const DNF_AUTOSEARCH_KEY = "settingDnfAutoSearch";
const DNF_AUTOSEARCH_MODE_KEY = "settingDnfAutoSearchMode";
async function dnfAutoSearchPref() {
  try {
    const data = await browser.storage.local.get([DNF_AUTOSEARCH_KEY, DNF_AUTOSEARCH_MODE_KEY]);
    return {
      on: data[DNF_AUTOSEARCH_KEY] === true,
      mode: data[DNF_AUTOSEARCH_MODE_KEY] === "split" ? "split" : "popup",
    };
  } catch (e) { return { on: false, mode: "popup" }; }
}

// Turn a failed URL into a search query. MUST stay in lock-step with the
// copy of this logic in sidebar/sim.js (failedUrlToQuery) — they're kept
// separate because background and the sim page can't share a module in MV2.
const DNF_SEARCH_PARAM_NAMES = new Set(["q", "query", "search", "k", "s", "term"]);
const DNF_NOISE_SUBDOMAINS = ["www", "www2", "m", "mobile", "shop", "store"];
const DNF_STRIPPABLE_EXTS = [".html", ".htm", ".php", ".aspx", ".asp", ".jsp"];
function dnfLetterDigitTransitions(t) {
  let n = 0;
  const isLetter = (c) => c >= "a" && c <= "z" || c >= "A" && c <= "Z";
  const isDigit = (c) => c >= "0" && c <= "9";
  for (let i = 1; i < t.length; i++) {
    const pl = isLetter(t[i - 1]), pd = isDigit(t[i - 1]);
    const cl = isLetter(t[i]), cd = isDigit(t[i]);
    if ((pl && cd) || (pd && cl)) n++;
  }
  return n;
}
function dnfIsJunkToken(t) {
  if (!t) return true;
  if (!/\d/.test(t)) return false;
  if (!/[a-z]/i.test(t)) return false;
  if (t.length > 15) return true;
  return dnfLetterDigitTransitions(t) > 3;
}
function dnfIsJunkSegment(seg) {
  if (!seg) return true;
  const stripped = String(seg).replace(/[^a-z0-9]+/gi, "");
  if (!stripped) return true;
  if (!/[a-z]/i.test(stripped)) return stripped.length > 3;
  const longestDigitRun = (String(seg).match(/\d+/g) || []).reduce((m, r) => Math.max(m, r.length), 0);
  if (longestDigitRun > 4) return true;
  return false;
}
function failedUrlToQuery(failedUrl, fallbackHost) {
  let host = fallbackHost || "";
  let pathSegs = [];
  let queryParts = [];
  let searchParamValue = "";
  try {
    const u = new URL(failedUrl);
    host = u.hostname;
    pathSegs = (u.pathname || "").split("/").filter(Boolean);
    if (pathSegs.length) {
      const last = pathSegs[pathSegs.length - 1].toLowerCase();
      for (const ext of DNF_STRIPPABLE_EXTS) {
        if (last.endsWith(ext)) { pathSegs[pathSegs.length - 1] = last.slice(0, -ext.length); break; }
      }
    }
    for (const [key, raw] of u.searchParams) {
      const v = String(raw || "").trim();
      if (!v) continue;
      if (DNF_SEARCH_PARAM_NAMES.has(key.toLowerCase()) && !searchParamValue) { searchParamValue = v; continue; }
      queryParts.push(v);
    }
  } catch {}
  host = String(host || "").toLowerCase();
  let parts = host.split(".").filter(Boolean);
  while (parts.length > 1 && DNF_NOISE_SUBDOMAINS.includes(parts[0])) parts.shift();
  host = parts.join(".");
  const multi = [".co.uk", ".org.uk", ".ac.uk", ".gov.uk", ".com.au", ".com.br", ".co.jp", ".co.nz", ".co.in"];
  let matched = false;
  for (const m of multi) {
    if (host.endsWith(m)) { host = host.slice(0, -m.length); matched = true; break; }
  }
  if (!matched) {
    const lastDot = host.lastIndexOf(".");
    if (lastDot > 0) host = host.slice(0, lastDot);
  }
  const segments = searchParamValue ? [host, searchParamValue] : [host, ...pathSegs, ...queryParts];
  const seen = new Set();
  const out = [];
  for (const seg of segments) {
    if (dnfIsJunkSegment(seg)) continue;
    for (const t of String(seg).replace(/[^a-z0-9]+/gi, " ").toLowerCase().split(" ")) {
      if (!t || dnfIsJunkToken(t) || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out.join(" ");
}

// TEMP — diagnostic logging for the page-suggestions flow. One line each
// with a wall-clock timestamp so it's copy-pasteable. Remove once the
// flow is confirmed working end-to-end.
function _ts() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
function _bglog() {
  const args = Array.from(arguments).map((a) =>
    typeof a === "string" ? a : JSON.stringify(a).slice(0, 200)
  ).join(" ");
  console.log(`[${_ts()}] [bg] ${args}`);
}

async function handleTab(tabId, url) {
  _bglog("handleTab tabId=" + tabId + " url=" + (url || "").slice(0, 120));
  const serp = detectSerp(url);
  if (serp) {
    _bglog("→ SERP detected", { engine: serp.engineId, q: serp.query });
    try {
      await browser.sidebarAction.open();
    } catch (e) {
      // Firefox requires a user gesture to open the sidebar programmatically.
      // The sidebar is still available via the toolbar; its content updates on navigation.
    }
    logSearchToHistory(serp.query, serp.engineId); // fire-and-forget; persists for next sidebar load
    try {
      await browser.runtime.sendMessage({ type: "search-context", query: serp.query, engineId: serp.engineId, url, tabId });
    } catch (e) {
      // No sidebar listener yet — it will pick up state on open via getCurrentQuery.
    }
    return;
  }

  const isCP = isContentPage(url);
  const blockedReason = isBlockedForAI(url);
  const enabled = await pageSuggestionsEnabled();
  _bglog("non-SERP checks", { isContentPage: isCP, blocked: blockedReason || null, settingOn: enabled });

  // Blocked content page with the setting on: surface a "URL blocked for
  // privacy" placeholder rather than silently hiding. Only do this when
  // the user opted in to page analysis — otherwise the section just stays
  // hidden as before.
  if (isCP && enabled && blockedReason) {
    _bglog("→ blocked page; sending blocked-context");
    try {
      await browser.runtime.sendMessage({ type: "blocked-context", url, tabId, reason: blockedReason });
    } catch (e) { /* sidebar not open */ }
    return;
  }

  // Not a SERP. If page-suggestions is enabled in settings AND this is a
  // content page the content script can introspect AND it isn't on the
  // blocked list (auth flows, admin dashboards, mail, billing, etc.),
  // ask the content script for an extract and forward to the sidebar.
  // Otherwise tell the sidebar to clear the suggestions section.
  if (isCP && !blockedReason && enabled) {
    _bglog("→ requesting page context from content script");
    try {
      const ctx = await browser.tabs.sendMessage(tabId, { type: "extract-page-context" });
      _bglog("← got context", { title: (ctx && ctx.title || "").slice(0, 80), textLen: (ctx && ctx.text || "").length, urlOk: !!(ctx && ctx.url) });
      if (ctx && (ctx.title || ctx.text)) {
        try {
          await browser.runtime.sendMessage({
            type: "page-context",
            url: ctx.url || url,
            tabId,
            title: ctx.title || "",
            text: ctx.text || "",
          });
          _bglog("→ forwarded page-context to sidebar");
        } catch (e) { _bglog("page-context message failed:", String(e && e.message || e)); }
        return;
      } else {
        _bglog("context empty, falling through");
      }
    } catch (e) {
      _bglog("tabs.sendMessage threw:", String(e && e.message || e), "— retrying in 600ms");
      // "complete" fired but content script not registered yet (common on first
      // navigation to a page). Wait and retry once before giving up.
      await new Promise((r) => setTimeout(r, 600));
      try {
        const ctx2 = await browser.tabs.sendMessage(tabId, { type: "extract-page-context" });
        _bglog("← retry got context", { title: (ctx2 && ctx2.title || "").slice(0, 80), textLen: (ctx2 && ctx2.text || "").length });
        if (ctx2 && (ctx2.title || ctx2.text)) {
          try {
            await browser.runtime.sendMessage({ type: "page-context", url: ctx2.url || url, tabId, title: ctx2.title || "", text: ctx2.text || "" });
            _bglog("→ forwarded page-context to sidebar (retry)");
          } catch (e2) { _bglog("retry page-context forward failed:", String(e2 && e2.message || e2)); }
          return;
        }
      } catch (e2) {
        _bglog("retry also threw:", String(e2 && e2.message || e2));
      }
      // Both attempts failed — fall through to the "no context" path.
    }
  } else {
    _bglog("→ skipping page extraction (gate failed)");
  }

  // Default: clear the suggestions section.
  _bglog("→ sending empty search-context (clear)");
  try {
    await browser.runtime.sendMessage({ type: "search-context", query: "", url: url || "", tabId });
  } catch (e) { /* sidebar not open */ }
}

// Per-tab base-URL cache (fragment stripped). Used to detect hash-only
// navigations so we don't re-render suggestions when only the anchor changes.
const tabBaseUrls = new Map();

function baseUrl(url) {
  return typeof url === "string" ? url.split("#")[0] : "";
}

browser.tabs.onRemoved.addListener((tabId) => tabBaseUrls.delete(tabId));

// When Firefox can't reach a server (DNS / connection / timeout), replace the
// built-in "Server not found" page with our DNF flow. We hook the *network*
// layer via webRequest.onErrorOccurred (type main_frame) rather than
// webNavigation.onErrorOccurred: a genuine failure produces a network error
// with no successful HTTP response, whereas a page that actually loads fires
// webRequest.onCompleted instead. webNavigation fired false positives for
// pages that loaded fine (and even fired onCompleted for the native error
// page, so it couldn't be used to cancel), which webRequest avoids. Bonus:
// the network error fires before the native error page renders, cutting the
// flash. webRequest reports symbolic error names (NS_ERROR_*).
const NETERROR_CODES_REPLACED = new Set([
  "NS_ERROR_UNKNOWN_HOST",
  "NS_ERROR_CONNECTION_REFUSED",
  "NS_ERROR_NET_TIMEOUT",
  "NS_ERROR_NET_RESET",
  "NS_ERROR_NET_INTERRUPT",
  "NS_ERROR_UNKNOWN_PROXY_HOST",
  "NS_ERROR_PROXY_CONNECTION_REFUSED",
]);
// Tabs we've already redirected this navigation — webRequest may fire once
// for the http attempt and again for the HTTPS-upgrade retry.
const recentlyRedirectedTabs = new Set();

async function handleNetError(tabId, failedUrl, errorName) {
  if (recentlyRedirectedTabs.has(tabId)) {
    _bglog("[neterror] tab already redirected this nav, skipping");
    return;
  }
  let host = "";
  try { host = new URL(failedUrl).hostname; } catch {}
  if (!host) {
    _bglog("[neterror] no host extracted, skipping", { url: failedUrl });
    return;
  }
  recentlyRedirectedTabs.add(tabId);
  setTimeout(() => recentlyRedirectedTabs.delete(tabId), 2000);

  const pref = await dnfAutoSearchPref();
  let target;
  if (!pref.on) {
    target = browser.runtime.getURL("sidebar/sim.html?" + new URLSearchParams({
      kind: "firefox-dnf", domain: host, url: failedUrl,
    }).toString());
  } else if (pref.mode === "split") {
    const q = failedUrlToQuery(failedUrl, host);
    target = browser.runtime.getURL("sidebar/split-view.html?" + new URLSearchParams({
      q, left: "firefox-dnf", right: "google-didyoumean", domain: host, consent: "given",
    }).toString());
  } else {
    // Real Google results with our injected popup. The #sc-dnf marker tells
    // the SERP content script to show the "Server not found" overlay; d / u
    // carry the failed host + URL.
    const q = failedUrlToQuery(failedUrl, host);
    target = "https://www.google.com/search?" + new URLSearchParams({ q }).toString()
      + "#sc-dnf=1&d=" + encodeURIComponent(host) + "&u=" + encodeURIComponent(failedUrl);
  }
  _bglog("[neterror] redirecting", { error: errorName, host, on: pref.on, mode: pref.mode, target: target.slice(0, 120) });
  browser.tabs.update(tabId, { url: target }).then(
    () => _bglog("[neterror] tabs.update OK"),
    (e) => _bglog("[neterror] tabs.update FAILED", { error: String(e) })
  );
}

_bglog("[neterror] webRequest available?", { has: !!(browser.webRequest && browser.webRequest.onErrorOccurred) });
if (browser.webRequest && browser.webRequest.onErrorOccurred) {
  browser.webRequest.onErrorOccurred.addListener(
    (details) => {
      _bglog("[neterror] onErrorOccurred", {
        type: details.type, error: details.error,
        url: (details.url || "").slice(0, 120), tabId: details.tabId,
      });
      if (details.type !== "main_frame") return;
      if (details.tabId < 0) return; // not a real tab (e.g. prefetch)
      if (!NETERROR_CODES_REPLACED.has(details.error)) {
        _bglog("[neterror] error not in replace list — skipping", { error: details.error });
        return;
      }
      // Don't replace SERP pages — a momentarily-unreachable Google search
      // should keep native handling rather than being swapped for our DNF.
      if (detectSerp(details.url)) {
        _bglog("[neterror] URL is a SERP — leaving native handling alone", { url: details.url.slice(0, 120) });
        return;
      }
      handleNetError(details.tabId, details.url, details.error);
    },
    { urls: ["<all_urls>"], types: ["main_frame"] }
  );
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const evtSummary = {};
  if (changeInfo.url) evtSummary.url = changeInfo.url.slice(0, 100);
  if (changeInfo.status) evtSummary.status = changeInfo.status;
  _bglog("[onUpdated] tabId=" + tabId, evtSummary);

  if (changeInfo.status === "complete") {
    // Page fully loaded — content script is injected. Always handle this so
    // page-context extraction runs when the content script is actually ready,
    // even on fast/cached loads where url+complete arrive in the same event.
    const newBase = baseUrl(tab.url);
    const prevBase = tabBaseUrls.get(tabId);
    if (newBase && newBase === prevBase) {
      _bglog("[onUpdated] → complete but hash-only → skipped");
      return;
    }
    tabBaseUrls.set(tabId, newBase);
    _bglog("[onUpdated] → complete → handleTab", { tabUrl: (tab.url || "").slice(0, 100) });
    handleTab(tabId, tab.url);
    return;
  }
  if (changeInfo.url) {
    // Early URL change before the page loads. Content script isn't injected
    // yet, so skip page extraction. Only handle SERPs here so the sidebar
    // input updates immediately without waiting for the page to finish loading.
    //
    // Don't update tabBaseUrls here. Hash-only navigations fire changeInfo.url
    // but never fire status=complete, so the cache stays at the last fully-
    // loaded URL. Real navigations fire changeInfo.url then status=complete;
    // the complete handler does the cache update and the duplicate-skip check.
    const newBase = baseUrl(changeInfo.url);
    const prevBase = tabBaseUrls.get(tabId);
    if (newBase && newBase === prevBase) {
      _bglog("[onUpdated] → url+hash-only → skipped");
      return;
    }
    if (detectSerp(changeInfo.url)) {
      _bglog("[onUpdated] → url+SERP → handleTab");
      handleTab(tabId, changeInfo.url);
    } else {
      _bglog("[onUpdated] → url+non-SERP → skipped (waiting for complete)");
    }
  }
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await browser.tabs.get(tabId);
  // about:blank is a transient placeholder when a new tab opens and is about
  // to navigate. Skip it — onUpdated will fire with the real URL shortly after.
  // Without this, opening a link in a new tab causes a flash to frozen-SERP
  // suggestions before the real page-context arrives.
  if (!tab.url || tab.url === "about:blank") return;
  handleTab(tabId, tab.url);
});

browser.browserAction.onClicked.addListener(async () => {
  try {
    await browser.sidebarAction.toggle();
  } catch (e) {
    await browser.sidebarAction.open();
  }
});

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg && msg.type === "get-current-query") {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const serp = tab && detectSerp(tab.url);
    if (serp) {
      return { query: serp.query, engineId: serp.engineId, url: tab.url };
    }
    // Non-SERP: if page-suggestions is on AND this is a content page, hand
    // back either the page context (for analysable pages) or a blocked
    // marker (for pages on the block list). Sidebar uses the marker to
    // render its "URL blocked for privacy" placeholder.
    if (tab && isContentPage(tab.url) && (await pageSuggestionsEnabled())) {
      const blockedReason = isBlockedForAI(tab.url);
      if (blockedReason) {
        return { kind: "blocked", url: tab.url, reason: blockedReason };
      }
      try {
        const ctx = await browser.tabs.sendMessage(tab.id, { type: "extract-page-context" });
        if (ctx && (ctx.title || ctx.text)) {
          return {
            kind: "page",
            url: ctx.url || tab.url,
            title: ctx.title || "",
            text: ctx.text || "",
          };
        }
      } catch (e) { /* content script not ready */ }
    }
    return { query: "", url: tab ? tab.url : "" };
  }
  if (msg && msg.type === "navigate" && typeof msg.url === "string") {
    // Smart-navigate from a sidebar action where the sidebar may close
    // mid-operation (which would kill its own context). Run from the
    // background instead so the awaits complete safely.
    // If the active tab is an `about:` page (about:debugging in particular —
    // that's where the extension was loaded in dev mode), open a new tab so
    // we don't replace it.
    try {
      const [active] = await browser.tabs.query({ active: true, currentWindow: true });
      if (active && typeof active.url === "string" && active.url.startsWith("about:")) {
        await browser.tabs.create({ url: msg.url });
        return;
      }
      await browser.tabs.update({ url: msg.url });
    } catch (e) { /* swallow — best effort */ }
  }
});
