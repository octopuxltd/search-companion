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

const suggestionsCache = new Map();         // key -> Promise<string[]>
const summaryCache = new Map();             // key -> Promise<string>
const resolvedSuggestions = new Map();      // key -> string[]  (sync-readable mirror)

async function callWorker(kind, query) {
  if (!isConfigured()) throw new Error("worker URL not configured");
  const r = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, query }),
  });
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.clone().json()).error || ""; } catch {}
    if (!detail) { try { detail = (await r.clone().text()).slice(0, 200); } catch {} }
    throw new Error(`worker ${r.status}${detail ? ": " + detail : ""}`);
  }
  return r.json();
}

function fetchSuggestions(query) {
  const key = normKey(query);
  if (!key) return Promise.resolve([]);
  if (suggestionsCache.has(key)) return suggestionsCache.get(key);
  const p = callWorker("suggestions", query)
    .then((j) => {
      // Normalise to lowercase — the model sometimes title-cases or
      // sentence-cases items, but the sidebar's visual convention is all
      // lowercase to match the surrounding suggestion lists.
      const arr = Array.isArray(j.suggestions)
        ? j.suggestions.map((s) => String(s).toLowerCase().trim()).filter(Boolean)
        : [];
      // Mirror to the sync-readable cache so other parts of the UI (Dig
      // deeper) can check synchronously whether suggestions are ready.
      resolvedSuggestions.set(key, arr);
      return arr;
    })
    .catch((err) => {
      suggestionsCache.delete(key); // don't cache failures
      throw err;
    });
  suggestionsCache.set(key, p);
  return p;
}

// Returns the cached suggestions array for a query if and only if the
// fetch has already resolved — used by code paths that want to render
// instantly when the data is in hand, without flashing a skeleton.
function getCachedSuggestions(query) {
  const key = normKey(query);
  return resolvedSuggestions.get(key) || null;
}

function fetchSummary(query) {
  const key = normKey(query);
  if (!key) return Promise.resolve("");
  if (summaryCache.has(key)) return summaryCache.get(key);
  const p = callWorker("summary", query)
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
  fetchSummary,
  prefetchSummaries,
  getCachedSuggestions,
  summaryCache,
  suggestionsCache,
};
