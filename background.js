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

async function handleTab(tabId, url) {
  const serp = detectSerp(url);
  if (serp) {
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
  // Active tab is not a SERP — tell the sidebar to clear its suggestions
  // section so we don't leave stale "other searches" hanging around.
  try {
    await browser.runtime.sendMessage({ type: "search-context", query: "", url: url || "", tabId });
  } catch (e) { /* sidebar not open */ }
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    handleTab(tabId, changeInfo.url || tab.url);
  }
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await browser.tabs.get(tabId);
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
