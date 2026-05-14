// OpenRouter client for the sidebar. Talks to a Cloudflare Worker that holds
// the OpenRouter API key. After deploying the Worker (see worker/README.md),
// paste its URL into WORKER_URL below.
//
// In-memory caches keyed by the normalised query string. No persistence —
// they reset when the sidebar reloads. No abort: stale in-flight requests
// resolve into the cache, the UI just ignores them (see sidebar.js).

const WORKER_URL = "https://search-sidebar-ai.cloudflare-ktncw.workers.dev/";

function isConfigured() {
  return typeof WORKER_URL === "string" && !WORKER_URL.includes("REPLACE-ME");
}

function normKey(q) {
  return String(q || "").trim().toLowerCase();
}

const suggestionsCache = new Map();         // key -> Promise<{suggestions:string[], topics:string[]}>
const summaryCache = new Map();             // key -> Promise<string>
const resolvedSuggestions = new Map();      // key -> string[]  (sync-readable mirror, suggestions only)

function _ailog() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, "0");
  const ts = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
  const args = Array.from(arguments).map((a) =>
    typeof a === "string" ? a : JSON.stringify(a).slice(0, 200)
  ).join(" ");
  console.log(`[${ts}] [ai] ${args}`);
}

async function callWorker(payload) {
  if (!isConfigured()) throw new Error("worker URL not configured");
  // Truncate payload preview so the log stays readable even for big page extracts.
  const preview = { kind: payload.kind };
  if (payload.query) preview.query = String(payload.query).slice(0, 80);
  if (payload.pageTitle) preview.pageTitle = String(payload.pageTitle).slice(0, 60);
  if (payload.pageText) preview.pageTextLen = String(payload.pageText).length;
  _ailog("→ worker", preview);
  const r = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  _ailog("← worker", { kind: payload.kind, status: r.status, ok: r.ok });
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.clone().json()).error || ""; } catch {}
    if (!detail) { try { detail = (await r.clone().text()).slice(0, 200); } catch {} }
    _ailog("worker error body:", detail);
    throw new Error(`worker ${r.status}${detail ? ": " + detail : ""}`);
  }
  const j = await r.json();
  _ailog("← parsed", { kind: payload.kind, suggestions: Array.isArray(j.suggestions) ? j.suggestions.length : null, summary: typeof j.summary === "string" ? j.summary.length : null });
  return j;
}

function lowercaseSuggestions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => {
    // Defensive: if the worker emitted objects (e.g. {text: "..."} or
    // {suggestion: "..."}) instead of bare strings, pull the text-bearing
    // field rather than letting String() emit "[object Object]".
    if (s && typeof s === "object") {
      s = s.text || s.suggestion || s.query || s.value || s.title || "";
    }
    return String(s).toLowerCase().trim();
  }).filter(Boolean);
}

function fetchSuggestions(query) {
  const key = normKey(query);
  if (!key) return Promise.resolve([]);
  if (suggestionsCache.has(key)) return suggestionsCache.get(key);
  const p = callWorker({ kind: "suggestions", query })
    .then((j) => {
      const suggestions = lowercaseSuggestions(j.suggestions);
      const topics = Array.isArray(j.topics)
        ? j.topics.slice(0, 2).map((t) => String(t).toLowerCase().trim()).filter(Boolean)
        : [];
      // Mirror suggestions to the sync-readable cache for Dig Deeper.
      resolvedSuggestions.set(key, suggestions);
      return { suggestions, topics };
    })
    .catch((err) => {
      suggestionsCache.delete(key); // don't cache failures
      throw err;
    });
  suggestionsCache.set(key, p);
  return p;
}

// Page-suggestion cache is separate (keyed by URL, not query string) so it
// doesn't collide with SERP suggestions and so that revisiting a page hits
// the cache instantly.
const pageSuggestionsCache = new Map();

function pageKeyFor(url) {
  // Strip fragment so foo.com#section and foo.com#other share the cache.
  return String(url || "").trim().split("#")[0].toLowerCase();
}

function fetchPageSuggestions(url, pageTitle, pageText) {
  const key = pageKeyFor(url);
  if (!key) return Promise.resolve({ suggestions: [], topics: [] });
  if (pageSuggestionsCache.has(key)) return pageSuggestionsCache.get(key);
  const p = callWorker({ kind: "page-suggestions", pageTitle: pageTitle || "", pageText: pageText || "" })
    .then((j) => {
      const suggestions = lowercaseSuggestions(j.suggestions);
      const topics = Array.isArray(j.topics)
        ? j.topics.slice(0, 2).map((t) => String(t).toLowerCase().trim()).filter(Boolean)
        : [];
      return { suggestions, topics };
    })
    .catch((err) => {
      pageSuggestionsCache.delete(key);
      throw err;
    });
  pageSuggestionsCache.set(key, p);
  return p;
}

// Returns the cached suggestions array for a query if and only if the
// fetch has already resolved — used by code paths that want to render
// instantly when the data is in hand, without flashing a skeleton.
function getCachedSuggestions(query) {
  const key = normKey(query);
  return resolvedSuggestions.get(key) || null;
}

const relatedHistoryCache = new Map(); // key -> Promise<{topics:string[], history:string[]}>

function relatedHistoryKey(ctx) {
  if (ctx.query) return "q:" + normKey(ctx.query);
  return "p:" + (ctx.pageTitle || "").trim().toLowerCase().slice(0, 100);
}

const relatedPagesCache = new Map(); // key -> Promise<{topics:string[], pages:string[]}>

function relatedPagesKey(ctx) {
  if (ctx.query) return "q:" + normKey(ctx.query);
  return "p:" + (ctx.pageTitle || "").trim().toLowerCase().slice(0, 100);
}

function fetchRelatedPages(ctx) {
  const key = relatedPagesKey(ctx);
  if (!key || key === "q:" || key === "p:") return Promise.resolve({ topics: [], pages: [] });
  if (relatedPagesCache.has(key)) return relatedPagesCache.get(key);
  const payload = { kind: "related-pages" };
  if (ctx.query) payload.query = ctx.query;
  else { payload.pageTitle = ctx.pageTitle || ""; payload.pageText = ctx.pageText || ""; }
  const p = callWorker(payload)
    .then((j) => ({
      topics: Array.isArray(j.topics) ? j.topics.slice(0, 2).map((t) => String(t).toLowerCase().trim()).filter(Boolean) : [],
      pages: Array.isArray(j.pages) ? j.pages.slice(0, 3).map((s) => String(s).trim()).filter(Boolean) : [],
    }))
    .catch((err) => { relatedPagesCache.delete(key); throw err; });
  relatedPagesCache.set(key, p);
  return p;
}

function fetchRelatedHistory(ctx) {
  const key = relatedHistoryKey(ctx);
  if (!key || key === "q:" || key === "p:") return Promise.resolve([]);
  if (relatedHistoryCache.has(key)) return relatedHistoryCache.get(key);
  const payload = { kind: "related-history" };
  if (ctx.query) payload.query = ctx.query;
  else { payload.pageTitle = ctx.pageTitle || ""; payload.pageText = ctx.pageText || ""; }
  const p = callWorker(payload)
    .then((j) => ({
      topics: Array.isArray(j.topics) ? j.topics.slice(0, 2).map((t) => String(t).toLowerCase().trim()).filter(Boolean) : [],
      history: Array.isArray(j.history) ? j.history.slice(0, 3).map((s) => String(s).toLowerCase().trim()).filter(Boolean) : [],
    }))
    .catch((err) => { relatedHistoryCache.delete(key); throw err; });
  relatedHistoryCache.set(key, p);
  return p;
}

function fetchSummary(query) {
  const key = normKey(query);
  if (!key) return Promise.resolve("");
  if (summaryCache.has(key)) return summaryCache.get(key);
  const p = callWorker({ kind: "summary", query })
    .then((j) => typeof j.summary === "string" ? j.summary : "")
    .catch((err) => {
      summaryCache.delete(key);
      throw err;
    });
  summaryCache.set(key, p);
  return p;
}

function prefetchSummaries(queries) {
  if (!Array.isArray(queries)) return;
  queries.forEach((q) => {
    // Fire-and-forget; swallow rejections so they don't surface as unhandled.
    fetchSummary(q).catch(() => {});
  });
}

window.SC_AI = {
  isConfigured,
  fetchSuggestions,
  fetchPageSuggestions,
  fetchRelatedHistory,
  fetchRelatedPages,
  fetchSummary,
  prefetchSummaries,
  getCachedSuggestions,
  summaryCache,
  suggestionsCache,
  pageSuggestionsCache,
  relatedHistoryCache,
  relatedPagesCache,
};
