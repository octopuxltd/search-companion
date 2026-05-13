// Cloudflare Worker that proxies the Search Sidebar extension to OpenRouter.
// Keeps the OpenRouter API key server-side. Deployed as a Cloudflare Worker;
// see worker/README.md for the deploy steps.
//
// Request shape (POST JSON):
//   { kind: "suggestions" | "summary", query: "string" }
//
// Response shape:
//   suggestions -> { suggestions: string[] }
//   summary     -> { summary: string }
//   on error    -> { error: string }, with non-200 status

const MODEL = "google/gemini-2.5-flash";

const SUGGEST_SYS =
  "You generate related Google search queries that other people commonly run on the same topic. " +
  "Return ONLY a JSON object of the form {\"suggestions\":[...]} with exactly 6 short strings (2-6 words each). " +
  "No prose, no commentary, no markdown fences. " +
  "Each item should be a complete search query, not a question with punctuation. " +
  "Vary the angles: comparisons, alternatives, deeper specifics, how-to, common follow-ups. " +
  "Use the same language as the input query.";

const SUMMARY_SYS =
  "You write a brief, factual informational summary about a search topic. " +
  "Plain prose, no markdown, no headings, no preface ('Here is...', etc.). " +
  "Two short paragraphs, around 80-120 words total. " +
  "Use the same language as the input query.";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }
    if (request.method !== "POST") {
      return cors(json({ error: "POST only" }, 405));
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return cors(json({ error: "invalid JSON body" }, 400));
    }

    const { kind, query } = body || {};
    if (typeof query !== "string" || !query.trim()) {
      return cors(json({ error: "missing query" }, 400));
    }
    if (query.length > 500) {
      return cors(json({ error: "query too long" }, 400));
    }

    try {
      if (kind === "suggestions") {
        const suggestions = await getSuggestions(env, query.trim());
        return cors(json({ suggestions }));
      }
      if (kind === "summary") {
        const summary = await getSummary(env, query.trim());
        return cors(json({ summary }));
      }
      return cors(json({ error: "unknown kind" }, 400));
    } catch (err) {
      return cors(json({ error: String((err && err.message) || err) }, 502));
    }
  },
};

async function callOpenRouter(env, messages) {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not set on the Worker");
  }
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://octopuxltd.github.io/search-companion/",
      "X-Title": "Search Sidebar",
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`OpenRouter ${r.status}: ${text.slice(0, 300)}`);
  }
  const j = await r.json();
  return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
}

async function getSuggestions(env, query) {
  const content = await callOpenRouter(env, [
    { role: "system", content: SUGGEST_SYS },
    { role: "user", content: `Search query: ${query}` },
  ]);
  return parseSuggestions(content);
}

function parseSuggestions(content) {
  const tryArray = (val) => Array.isArray(val) ? val.slice(0, 6).map((s) => String(s).trim()).filter(Boolean) : null;

  // Strip ``` fences the model might add despite being told not to.
  const cleaned = content.replace(/```(?:json)?/gi, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return tryArray(parsed) || tryArray(parsed && parsed.suggestions) || [];
  } catch { /* fall through */ }

  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return tryArray(JSON.parse(arrMatch[0])) || []; } catch {}
  }
  return [];
}

async function getSummary(env, query) {
  const content = await callOpenRouter(env, [
    { role: "system", content: SUMMARY_SYS },
    { role: "user", content: `Topic: ${query}` },
  ]);
  return content.trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function cors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-headers", "content-type");
  h.set("access-control-allow-methods", "POST, OPTIONS");
  h.set("access-control-max-age", "86400");
  return new Response(res.body, { status: res.status, headers: h });
}
