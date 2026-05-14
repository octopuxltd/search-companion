// Runs on every web page. Stays quiet until the background asks for a
// readable extract of the current page (title + body text), at which point
// it does its best to isolate the main content (article body, not nav /
// footer / sidebars) and returns the first portion as plain text.
//
// The data only leaves the user's browser if the page-suggestions feature
// is enabled in settings; background.js gates the request behind that.

// Max characters to return. The AI only needs the first portion of an
// article to identify the topic — sending the whole thing is wasteful.
const MAX_TEXT_LENGTH = 3000;

// Heuristics for finding the main content area, in priority order. The
// first match wins, so list the most reliable indicators first.
const CONTENT_SELECTORS = [
  "article",
  "main",
  "[role='main']",
  "#content",
  "#main-content",
  ".article-body",
  ".post-content",
  ".entry-content",
  ".article__body",
  ".story-body",
  ".content",
  ".post",
  ".entry",
];

// Elements to strip from any selected region before extracting text.
const NOISE_SELECTOR =
  "script, style, noscript, template, svg, iframe, nav, header, footer, aside, form, button, [aria-hidden='true'], [role='navigation'], [role='banner'], [role='contentinfo'], [role='complementary']";

function cleanText(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  clone.querySelectorAll(NOISE_SELECTOR).forEach((n) => n.remove());
  const text = (clone.innerText || "").trim();
  return text
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, MAX_TEXT_LENGTH);
}

function extractPageText() {
  // Try each content-region heuristic in turn.
  for (const sel of CONTENT_SELECTORS) {
    let el;
    try { el = document.querySelector(sel); } catch (e) { continue; }
    if (el && (el.innerText || "").trim().length >= 200) {
      // Require some minimum body text so we don't pick an empty wrapper.
      return cleanText(el);
    }
  }
  // Fall back to <body> with chrome elements stripped.
  return cleanText(document.body);
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "extract-page-context") {
    return Promise.resolve({
      title: document.title || "",
      url: location.href,
      text: extractPageText(),
    });
  }
});
