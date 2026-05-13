// OpenRouter client for the sidebar. Talks to a Cloudflare Worker that holds
// the OpenRouter API key. After deploying the Worker (see worker/README.md),
// paste its URL into WORKER_URL below.
//
// In-memory caches keyed by the normalised query string. No persistence —
// they reset when the sidebar reloads. No abort: stale in-flight requests
// resolve into the cache, the UI just ignores them (see sidebar.js).

const WORKER_URL = "https://REPLACE-ME.workers.dev/";

function isConfigured() {
  return typeof WORKER_URL === "string" && !WORKER_URL.includes("REPLACE-ME");
}

function normKey(q) {
  return String(q || "").trim().toLowerCase();
}

const suggestionsCache = new Map(); // key -> Promise<string[]>
const summaryCache = new Map();     // key -> Promise<string>

async function callWorker(kind, query) {
  if (!isConfigured()) throw new Error("worker URL not configured");
  const r = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, query }),
  });
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.json()).error || ""; } catch {}
    throw new Error(`worker ${r.status}${detail ? ": " + detail : ""}`);
  }
  return r.json();
}

function fetchSuggestions(query) {
  const key = normKey(query);
  if (!key) return Promise.resolve([]);
  if (suggestionsCache.has(key)) return suggestionsCache.get(key);
  const p = callWorker("suggestions", query)
    .then((j) => Array.isArray(j.suggestions) ? j.suggestions : [])
    .catch((err) => {
      suggestionsCache.delete(key); // don't cache failures
      throw err;
    });
  suggestionsCache.set(key, p);
  return p;
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
  summaryCache,
  suggestionsCache,
};
