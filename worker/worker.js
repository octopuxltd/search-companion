// Cloudflare Worker that proxies the Search Sidebar extension to OpenRouter.
// Keeps the OpenRouter API key server-side. Deployed as a Cloudflare Worker;
// see worker/README.md for the deploy steps.
//
// Request shape (POST JSON):
//   { kind: "suggestions", query: "string" }
//   { kind: "summary",     query: "string" }
//   { kind: "page-suggestions", pageTitle: "string", pageText: "string" }
//   { kind: "related-history", query: "string" }
//   { kind: "related-history", pageTitle: "string", pageText: "string" }
//
// Response shape:
//   suggestions       -> { suggestions: string[] }
//   page-suggestions  -> { suggestions: string[] }
//   related-history   -> { history: string[] }
//   summary           -> { summary: string }
//   on error          -> { error: string }, with non-200 status

const MODEL = "google/gemini-2.5-flash";

const SUGGEST_SYS =
  "You generate related searches that someone who ran the input query would plausibly run next or alongside it. " +
  "Each suggestion should branch into a different facet of the topic — a sub-question, a comparison, an adjacent concept, a deeper specific, a common follow-up, a related task — NOT a paraphrase of the original query with synonyms or reordered words. " +
  "If the original query already contains a noun phrase, a good suggestion explores AROUND that noun phrase (its parts, alternatives, comparisons, history, how-to use it), it doesn't just restate the same noun phrase with different filler. " +
  "Each suggestion MUST be a complete, self-contained search query that someone with no knowledge of the original input would understand. Suggestions may omit words from the original query when the result still reads as a coherent standalone search on its own. They must NOT omit words from the original query when the result would only make sense to someone who already knew the original context — in those cases, keep enough of the original term in the suggestion to make the relationship explicit. Test each suggestion by asking: 'if a stranger saw this phrase as a typed-in search box query, would they know what it's about?' If not, restore the missing context. " +
  "Also identify two single-word topic labels for the query: one specific (e.g. 'zelda', 'beatles') and one broader category (e.g. 'videogame', 'music'). Both lowercase, one word each. " +
  "Return ONLY a JSON object of the form {\"topics\":[\"specific\",\"broad\"],\"suggestions\":[...]} with exactly 12 short strings (2-6 words each). " +
  "Each array element MUST be a bare JSON string. Do NOT wrap items in objects like {\"text\":\"...\"} or {\"query\":\"...\"} — just the string itself, with the ** emphasis markers inline. " +
  "In each suggestion, wrap the meaningful, distinctive part(s) — the words that carry the search intent — in **double asterisks**. " +
  "The emphasised span must be content-bearing: the core subject, a key qualifier (best, cheap, free, beginner), a format/source (youtube, reddit, pdf), a year, a comparison target, or a question word that genuinely distinguishes the query (e.g. 'how many', 'why does'). " +
  "Never emphasise filler/connectors that follow the topic, such as 'are there', 'is it', 'do they', 'can you', 'for me' — those are not the distinctive part of a query. " +
  "Prefer one emphasised span per suggestion; use two only when there are genuinely two separate distinctive parts (e.g. a qualifier at the start and a format at the end). Never use more than two. Each emphasised span should be 1-3 words. " +
  "Place the asterisks tightly around the word(s), with no space inside the markers. " +
  "No prose, no commentary, no markdown fences (other than the ** for emphasis). " +
  "Each item should be a complete search query, not a question with punctuation. " +
  "Vary the angles widely: comparisons, alternatives, deeper specifics, how-to, common follow-ups, mistakes to avoid, beginner questions, advanced techniques. " +
  "Use the same language as the input query.";

const PAGE_SUGGEST_SYS =
  "You are given the title and a text excerpt of a web page that someone is currently viewing. " +
  "Identify the primary topic the page is about and generate 12 search queries the user might run to deepen their understanding, fact-check claims on the page, compare with alternatives, explore subtopics, or follow up on people / places / concepts mentioned. " +
  "These should be searches a real person would plausibly type after reading this page — not paraphrases of the page's title, and not generic queries that ignore the page's actual subject. " +
  "Each suggestion MUST be a complete, self-contained search query that someone with no knowledge of this page would understand. Include any noun phrases (proper names, products, events) needed to make the search make sense on its own. Test each suggestion by asking: 'if a stranger saw this phrase as a typed-in search box query, would they know what it's about?' If not, restore the missing context. " +
  "Also identify two single-word topic labels for the page: one specific (e.g. 'zelda', 'beatles') and one broader category (e.g. 'videogame', 'music'). Both lowercase, one word each. " +
  "Return ONLY a JSON object of the form {\"topics\":[\"specific\",\"broad\"],\"suggestions\":[...]} with exactly 12 short strings (2-6 words each). " +
  "Each array element MUST be a bare JSON string. Do NOT wrap items in objects like {\"text\":\"...\"} or {\"query\":\"...\"} — just the string itself, with the ** emphasis markers inline. " +
  "In each suggestion, wrap the meaningful, distinctive part(s) — the words that carry the search intent — in **double asterisks**. " +
  "The emphasised span must be content-bearing: the core subject, a key qualifier (best, cheap, free, beginner), a format/source (youtube, reddit, pdf), a year, a comparison target, or a question word that genuinely distinguishes the query (e.g. 'how many', 'why does'). " +
  "Never emphasise filler/connectors that follow the topic. " +
  "Prefer one emphasised span per suggestion; use two only when there are genuinely two separate distinctive parts. Never more than two. Each span 1-3 words. " +
  "Place the asterisks tightly around the word(s), no space inside. " +
  "No prose, no commentary, no markdown fences (other than the ** for emphasis). " +
  "Each item should be a complete search query, not a question with punctuation. " +
  "Use the same language as the page.";

const RELATED_HISTORY_SYS =
  "You simulate an individual user's browser search history. Given a search topic or web page, generate exactly 2 or 3 plausible past search queries that person might have typed at some point — things that feel like they belong to the same person's interests, even if they don't closely match the current page. " +
  "The items should be specific and niche rather than broad and general — the kind of thing a real person researches, not the obvious top-level category. Exact relevance to the current page is not required; a loose thematic connection is enough. " +
  "Rules for history items: 1–3 words each; 4 words maximum. No punctuation, no question marks, no capitalisation beyond proper nouns, no emphasis markers. " +
  "Feel like natural typed searches, not formal titles — 'sony xm6 review' not 'Sony WH-1000XM6 Wireless Headphones Review'. " +
  "Also identify two single-word topic labels for the page: one specific (e.g. 'zelda', 'beatles', 'sourdough') and one broader category (e.g. 'videogame', 'music', 'baking'). Both lowercase, one word each. " +
  "Return ONLY a JSON object of the form {\"topics\":[\"specific\",\"broad\"],\"history\":[...]} with exactly 2 or 3 bare strings in history. No prose, no markdown. " +
  "Use the same language as the input.";

const RELATED_PAGES_SYS =
  "You simulate a web browser's visited pages history. Given a search query or web page, generate 2 or 3 realistic web page titles that a person with this interest might have visited previously. " +
  "Each title should look exactly like a real browser tab title — specific, from a named website, in the format typical for that site. Good examples: 'Blink (Doctor Who) — Wikipedia', 'Doctor Who Series 4 — BBC One', 'The 10 best Doctor Who episodes | The Guardian'. " +
  "Choose pages that feel plausible for a real person's browsing history: review pages, Wikipedia articles, forum threads, news articles, official sites, YouTube videos. Not homepages or search-results pages. " +
  "The items should reflect the specific topic, not just the broad category — use named subjects, titles, products, or people from the topic area. " +
  "Also identify two single-word topic labels: one specific (e.g. 'zelda', 'beatles', 'sourdough') and one broader category (e.g. 'videogame', 'music', 'baking'). Both lowercase, one word each. " +
  "Return ONLY a JSON object: {\"topics\":[\"specific\",\"broad\"],\"pages\":[...]} with exactly 2 or 3 bare strings in pages. No prose, no markdown. " +
  "Use the same language as the input.";

const SUMMARY_SYS =
  "You write a brief, factual informational summary about a search topic. " +
  "Plain prose, no markdown, no headings, no preface ('Here is...', etc.). " +
  "Hard limit: 450 characters total, including spaces and punctuation. Aim for one tight paragraph; stop before 450 even if you have more to say. " +
  "Use the same language as the input query.";

const SUMMARY_HARD_CAP = 450;

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

    const { kind } = body || {};

    try {
      if (kind === "suggestions" || kind === "summary") {
        const query = (body && body.query) || "";
        if (typeof query !== "string" || !query.trim()) {
          return cors(json({ error: "missing query" }, 400));
        }
        if (query.length > 500) {
          return cors(json({ error: "query too long" }, 400));
        }
        if (kind === "suggestions") {
          const { suggestions, topics } = await getSuggestions(env, query.trim());
          return cors(json({ suggestions, topics }));
        }
        const summary = await getSummary(env, query.trim());
        return cors(json({ summary }));
      }
      if (kind === "related-history") {
        const query = body && body.query;
        const pageTitle = String((body && body.pageTitle) || "").slice(0, 500);
        const pageText = String((body && body.pageText) || "").slice(0, 3500);
        let userMsg;
        if (typeof query === "string" && query.trim()) {
          userMsg = `Search query: ${query.trim()}`;
        } else if (pageTitle || pageText) {
          userMsg = `Page title: ${pageTitle}\n\nPage content (excerpt):\n${pageText.trim().slice(0, 3000)}`;
        } else {
          return cors(json({ error: "missing context" }, 400));
        }
        const content = await callOpenRouter(env, [
          { role: "system", content: RELATED_HISTORY_SYS },
          { role: "user", content: userMsg },
        ]);
        const cleaned = content.replace(/```(?:json)?/gi, "").trim();
        let topics = [];
        let history = [];
        try {
          const parsed = JSON.parse(cleaned);
          const rawTopics = Array.isArray(parsed && parsed.topics) ? parsed.topics : [];
          topics = rawTopics.slice(0, 2).map((t) => String(t || "").trim().toLowerCase()).filter(Boolean);
          history = Array.isArray(parsed) ? parsed : (Array.isArray(parsed && parsed.history) ? parsed.history : []);
        } catch {
          const arrMatch = cleaned.match(/\[[\s\S]*\]/);
          if (arrMatch) { try { history = JSON.parse(arrMatch[0]); } catch {} }
        }
        history = history.slice(0, 3).map((s) => String(s || "").trim().toLowerCase()).filter(Boolean);
        return cors(json({ topics, history }));
      }
      if (kind === "related-pages") {
        const query = body && body.query;
        const pageTitle = String((body && body.pageTitle) || "").slice(0, 500);
        const pageText = String((body && body.pageText) || "").slice(0, 3500);
        let userMsg;
        if (typeof query === "string" && query.trim()) {
          userMsg = `Search query: ${query.trim()}`;
        } else if (pageTitle || pageText) {
          userMsg = `Page title: ${pageTitle}\n\nPage content (excerpt):\n${pageText.trim().slice(0, 3000)}`;
        } else {
          return cors(json({ error: "missing context" }, 400));
        }
        const content = await callOpenRouter(env, [
          { role: "system", content: RELATED_PAGES_SYS },
          { role: "user", content: userMsg },
        ]);
        const cleaned = content.replace(/```(?:json)?/gi, "").trim();
        let topics = [];
        let pages = [];
        try {
          const parsed = JSON.parse(cleaned);
          const rawTopics = Array.isArray(parsed && parsed.topics) ? parsed.topics : [];
          topics = rawTopics.slice(0, 2).map((t) => String(t || "").trim().toLowerCase()).filter(Boolean);
          pages = Array.isArray(parsed && parsed.pages) ? parsed.pages : (Array.isArray(parsed) ? parsed : []);
        } catch {
          const arrMatch = cleaned.match(/\[[\s\S]*\]/);
          if (arrMatch) { try { pages = JSON.parse(arrMatch[0]); } catch {} }
        }
        pages = pages.slice(0, 3).map((s) => String(s || "").trim()).filter(Boolean);
        return cors(json({ topics, pages }));
      }
      if (kind === "page-suggestions") {
        const pageTitle = String((body && body.pageTitle) || "").slice(0, 500);
        // Content-script already caps at ~3000 chars; allow a touch more
        // headroom in case the request is from a different client.
        const pageText = String((body && body.pageText) || "").slice(0, 3500);
        if (!pageTitle.trim() && !pageText.trim()) {
          return cors(json({ error: "missing page content" }, 400));
        }
        const { suggestions, topics } = await getPageSuggestions(env, pageTitle, pageText);
        return cors(json({ suggestions, topics }));
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

async function getPageSuggestions(env, pageTitle, pageText) {
  // The page's lead is usually enough to identify the topic; the
  // content-script already trimmed at the client end, this is a safety net.
  const trimmedText = String(pageText || "").trim().slice(0, 3000);
  const userMsg = `Page title: ${pageTitle}\n\nPage content (excerpt):\n${trimmedText}`;
  const content = await callOpenRouter(env, [
    { role: "system", content: PAGE_SUGGEST_SYS },
    { role: "user", content: userMsg },
  ]);
  return parseSuggestions(content);
}

function parseSuggestions(content) {
  // Defensive coercion: the model sometimes wraps each suggestion in an
  // object like {text: "..."} or {suggestion: "..."} despite the prompt
  // asking for bare strings. Pull out the most likely string-bearing key,
  // and as a last resort just String() it (which would still produce
  // "[object Object]" — but at least we logged the attempt).
  const itemToString = (item) => {
    if (typeof item === "string") return item.trim();
    if (item == null) return "";
    if (Array.isArray(item)) return item.map(itemToString).filter(Boolean).join(" ");
    if (typeof item === "object") {
      const cand = item.text || item.suggestion || item.query || item.value || item.title || "";
      return String(cand).trim();
    }
    return String(item).trim();
  };
  const tryArray = (val) => Array.isArray(val) ? val.slice(0, 12).map(itemToString).filter(Boolean) : null;

  // Strip ``` fences the model might add despite being told not to.
  const cleaned = content.replace(/```(?:json)?/gi, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    const suggestions = tryArray(parsed) || tryArray(parsed && parsed.suggestions) || [];
    const topics = Array.isArray(parsed && parsed.topics)
      ? parsed.topics.slice(0, 2).map((t) => String(t || "").trim().toLowerCase()).filter(Boolean)
      : [];
    return { suggestions, topics };
  } catch { /* fall through */ }

  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return { suggestions: tryArray(JSON.parse(arrMatch[0])) || [], topics: [] }; } catch {}
  }
  return { suggestions: [], topics: [] };
}

async function getSummary(env, query) {
  const content = await callOpenRouter(env, [
    { role: "system", content: SUMMARY_SYS },
    { role: "user", content: `Topic: ${query}` },
  ]);
  let trimmed = content.trim();
  // Belt-and-braces: enforce the cap server-side even if the model overshoots.
  // Trim back to the last sentence boundary inside the cap so it doesn't end
  // mid-word.
  if (trimmed.length > SUMMARY_HARD_CAP) {
    const slice = trimmed.slice(0, SUMMARY_HARD_CAP);
    const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
    trimmed = lastStop > SUMMARY_HARD_CAP * 0.6
      ? slice.slice(0, lastStop + 1)
      : slice.replace(/\s+\S*$/, "") + "…";
  }
  return trimmed;
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
