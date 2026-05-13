// First-run AI-data disclaimer. Shown until the user clicks Agree; the
// agreement persists in browser.storage.local so they never see it again.
// Falls back to localStorage in the file:// preview where the extension
// `browser` API isn't around.
(async function setupDisclaimer() {
  const overlay = document.getElementById("disclaimerOverlay");
  const btn = document.getElementById("disclaimerAgreeBtn");
  if (!overlay || !btn) return;

  let agreed = false;
  try {
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      const data = await browser.storage.local.get("disclaimerAgreed");
      agreed = !!data.disclaimerAgreed;
    } else {
      agreed = localStorage.getItem("disclaimerAgreed") === "1";
    }
  } catch (e) { /* assume not agreed */ }

  if (agreed) return;

  overlay.hidden = false;
  btn.focus();
  btn.addEventListener("click", async () => {
    try {
      if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
        await browser.storage.local.set({ disclaimerAgreed: true });
      } else {
        localStorage.setItem("disclaimerAgreed", "1");
      }
    } catch (e) { /* swallow */ }
    overlay.hidden = true;
  });
})();

// "Prototype update available" badge. While reviewing, force it on; once
// happy, flip ALWAYS_SHOW_UPDATE_BADGE to false and the real version check
// (against update.json on GitHub Pages) decides visibility.
const ALWAYS_SHOW_UPDATE_BADGE = false;
const UPDATE_JSON_URL = "https://octopuxltd.github.io/search-companion/update.json";

async function checkUpdateBadge() {
  const badge = document.getElementById("updateBadge");
  if (!badge) return;
  if (ALWAYS_SHOW_UPDATE_BADGE) { badge.hidden = false; return; }

  let running;
  try {
    if (typeof browser !== "undefined" && browser.runtime && browser.runtime.getManifest) {
      running = browser.runtime.getManifest().version;
    }
  } catch (e) {}
  if (!running) { badge.hidden = true; return; }

  try {
    const r = await fetch(UPDATE_JSON_URL, { cache: "no-cache" });
    if (!r.ok) throw new Error("update.json " + r.status);
    const j = await r.json();
    // update.json shape: { addons: { "<id>": { updates: [{ version: "x.y.z", ... }, ...] } } }
    const addon = j.addons && Object.values(j.addons)[0];
    const updates = (addon && addon.updates) || [];
    const latest = updates
      .map((u) => u.version)
      .filter(Boolean)
      .sort(compareSemver)
      .pop();
    // Only mutate `hidden` if the truthy/falsy state actually changes — so a
    // currently-visible badge doesn't briefly flicker while a poll request is
    // in flight.
    const shouldShow = !!(latest && compareSemver(latest, running) > 0);
    if (badge.hidden === shouldShow) badge.hidden = !shouldShow;
  } catch (e) {
    // Network blip — leave the badge in whatever state it was, try again next tick.
  }
}

// Initial check on sidebar load, then poll every 60 seconds while the
// sidebar is open. setInterval is paused implicitly when the sidebar is
// closed (the document is destroyed), so there's no work to clean up.
checkUpdateBadge();
setInterval(checkUpdateBadge, 60 * 1000);

function compareSemver(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Stub the `browser.*` API when running outside a Firefox extension (e.g. file://
// preview, plain browser). Lets the rest of the script run for layout/UX work.
// Populate the settings page with the running extension's version. In the
// extension this reads from the manifest; in the preview we fall back to a
// hardcoded value kept in sync with manifest.json.
(function showVersion() {
  const el = document.getElementById("settingsVersion");
  if (!el) return;
  let v;
  try {
    if (typeof browser !== "undefined" && browser.runtime && browser.runtime.getManifest) {
      v = browser.runtime.getManifest().version;
    }
  } catch (e) {}
  el.textContent = v || "1.0.9";
})();

if (typeof browser === "undefined") {
  window.browser = {
    tabs: {
      // Navigate the preview window itself only for our own pages; leave
      // external searches as a no-op so we don't accidentally leave the demo.
      update: ({ url }) => {
        if (url && (url.startsWith("split-view") || url.startsWith("moz-extension"))) {
          window.location.href = url;
        }
      },
      create: ({ url }) => { window.open(url, "_blank"); return Promise.resolve({ id: -1 }); },
      query: () => Promise.resolve([]),
    },
    windows: { update: () => {} },
    runtime: {
      sendMessage: () => Promise.resolve(null),
      onMessage: { addListener: () => {} },
      getURL: (path) => path,
    },
  };
}

const input = document.getElementById("searchInput");
const form = document.getElementById("searchForm");
const panels = document.querySelectorAll(".sc-content");
const tabs = document.querySelectorAll(".sc-tab");
const searchClearBtn = document.getElementById("searchClearBtn");

// Show the clear button whenever the search field has content. Called both
// on user input events and after any programmatic write to input.value
// (syncFromActiveTab, search-context, suggestion click, etc.).
function updateClearBtnVisibility() {
  if (searchClearBtn) searchClearBtn.hidden = !(input && input.value);
}

if (input) {
  input.addEventListener("input", updateClearBtnVisibility);
}
if (searchClearBtn && input) {
  searchClearBtn.addEventListener("click", () => {
    input.value = "";
    updateClearBtnVisibility();
    input.focus();
  });
}
updateClearBtnVisibility();

function applyTab(target) {
  tabs.forEach((t) => {
    const active = t.dataset.tab === target;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });
  panels.forEach((p) => {
    p.hidden = p.id !== "tab-" + target;
  });
  document.body.classList.toggle("is-advanced", target === "advanced");
  document.body.classList.toggle("is-settings", target === "settings");
  if (target === "advanced") prefillAdvancedFromQuery(input && input.value);
}

// Parse a Google query string into the discrete fields the Advanced form has.
// Handles: "exact phrase", word OR word, -none, site:, filetype:,
// intitle:/inurl:/intext:/inanchor: prefixes; everything else falls into "all".
function parseQuery(q) {
  const result = { all: "", exact: "", any: "", none: "", site: "", filetype: "", where: "" };
  if (!q) return result;
  const tokens = [];
  let i = 0;
  while (i < q.length) {
    const c = q[i];
    if (c === '"') {
      const end = q.indexOf('"', i + 1);
      if (end === -1) { i++; continue; }
      tokens.push({ type: "quoted", value: q.slice(i + 1, end) });
      i = end + 1;
    } else if (/\s/.test(c)) {
      i++;
    } else {
      let end = i;
      while (end < q.length && !/\s/.test(q[end]) && q[end] !== '"') end++;
      tokens.push({ type: "word", value: q.slice(i, end) });
      i = end;
    }
  }
  const allWords = [];
  const noneWords = [];
  const exacts = [];
  let anyWords = [];
  let idx = 0;
  while (idx < tokens.length) {
    const t = tokens[idx];
    if (t.type === "quoted") {
      exacts.push(t.value);
      idx++;
      continue;
    }
    // Detect "x OR y OR z" sequence (with optional parens around the group).
    if (idx + 2 < tokens.length && tokens[idx + 1].type === "word" && tokens[idx + 1].value === "OR") {
      const group = [t.value.replace(/^\(+/, "").replace(/\)+$/, "")];
      let j = idx + 1;
      while (j + 1 < tokens.length && tokens[j].type === "word" && tokens[j].value === "OR") {
        group.push(tokens[j + 1].value.replace(/^\(+/, "").replace(/\)+$/, ""));
        j += 2;
      }
      anyWords = anyWords.concat(group);
      idx = j;
      continue;
    }
    let v = t.value.replace(/^\(+/, "").replace(/\)+$/, "");
    if (v.startsWith("-")) {
      noneWords.push(v.slice(1));
    } else if (v.startsWith("site:")) {
      result.site = v.slice(5);
    } else if (v.startsWith("filetype:")) {
      result.filetype = v.slice(9);
    } else {
      const m = v.match(/^(intitle|inurl|intext|inanchor):(.+)$/);
      if (m) {
        result.where = m[1];
        allWords.push(m[2]);
      } else {
        allWords.push(v);
      }
    }
    idx++;
  }
  result.all = allWords.join(" ");
  result.exact = exacts.join(" ");
  result.none = noneWords.join(" ");
  result.any = anyWords.join(" ");
  return result;
}

function prefillAdvancedFromQuery(q) {
  const form = document.getElementById("advancedForm");
  if (!form || !q) return;
  // Only pre-fill if the user hasn't already started typing in Advanced.
  const els = form.elements;
  const dirty = ["all", "exact", "any", "none", "site"].some((n) => els[n] && els[n].value);
  if (dirty) return;
  const parsed = parseQuery(q.trim());
  if (els.all) els.all.value = parsed.all;
  if (els.exact) els.exact.value = parsed.exact;
  if (els.any) els.any.value = parsed.any;
  if (els.none) els.none.value = parsed.none;
  if (els.site) els.site.value = parsed.site;
  if (els.filetype && Array.from(els.filetype.options).some((o) => o.value === parsed.filetype)) {
    els.filetype.value = parsed.filetype;
  }
  if (els.where && Array.from(els.where.options).some((o) => o.value === parsed.where)) {
    els.where.value = parsed.where;
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => applyTab(tab.dataset.tab));
});

const content = document.body;

// Search engines available in the switcher dropdown.
const ENGINES = [
  {
    id: "google",
    name: "Google",
    placeholder: "Search with Google",
    url: (q) => "https://www.google.com/search?client=firefox-b-d&q=" + encodeURIComponent(q),
    serpRe: /^https?:\/\/(www\.)?google\.[a-z.]+\/search\b/i,
    serpParam: "q",
    icon: `<svg viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A8.99 8.99 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.32z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 8.99 8.99 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>`,
  },
  {
    id: "bing",
    name: "Bing",
    placeholder: "Search with Bing",
    url: (q) => "https://www.bing.com/search?q=" + encodeURIComponent(q),
    serpRe: /^https?:\/\/(www\.)?bing\.com\/search\b/i,
    serpParam: "q",
    // Microsoft's current full-colour Fluent "b" mark, from Wikimedia Commons.
    icon: `<svg viewBox="0 0 678 1024" fill="none">
      <path fill="url(#bing-a)" d="M0 778.3c14.6 123.8 223.8 143 236.8 79.9-.3-.4-.5-678.1-.5-678.1-3.6-46-26.2-72-61.6-96.5-33-22.7-74.4-50.4-96.9-66.4C14.2-28 .1 31.4 0 33.2c0 0 .3 746.4 0 745.1z"/>
      <path fill="url(#bing-b)" d="M236.8 832.8c-96.2 72.5-217 42.7-234.4-44-.8-4.2-2.4-10.4-2.4-10.4s.9 8.5 2 16.6c1.2 8.5 3.7 20.8 6.3 31.3 30 117.8 132.1 186 230.4 196.6C373.3 1034.8 497.4 931 599 855.8c6.3-6.2 15.4-16.2 18.1-20.1 66.2-95-13.6-197-72.5-193a59154 59154 0 0 0-307.7 190.1Z"/>
      <path fill="url(#bing-c)" fill-rule="evenodd" d="M312.8 381c7.4 47 34.6 108.7 59.6 172.6 20.2 41.3 62 53.4 103 65.5 42.4 12.6 65.6 21 85.6 30.9 138.5 68.7 38.5 207.7 59.6 181.4 89-110.7 79.7-325.4-90-418.1-57.6-28.7-115.4-66.6-156.5-83.6-41-17-68.7 4.3-61.3 51.3z" clip-rule="evenodd"/>
      <defs>
        <linearGradient id="bing-a" x1="118.4" x2="118.4" y1="0" y2="884.4" gradientUnits="userSpaceOnUse"><stop stop-color="#00BBEC"/><stop offset="1" stop-color="#2756A9"/></linearGradient>
        <radialGradient id="bing-b" cx="0" cy="0" r="1" gradientTransform="matrix(526 -225.4 375.6 876.6 88.8 915.1)" gradientUnits="userSpaceOnUse"><stop stop-color="#00BBEC"/><stop offset="1" stop-color="#2756A9"/></radialGradient>
        <radialGradient id="bing-c" cx="0" cy="0" r="1" gradientTransform="matrix(-347 -399.3 287.3 -249.8 655 722)" gradientUnits="userSpaceOnUse"><stop stop-color="#00CACC"/><stop offset="1" stop-color="#048FCE"/></radialGradient>
      </defs>
    </svg>`,
  },
  {
    id: "ddg",
    name: "DuckDuckGo",
    placeholder: "Search with DuckDuckGo",
    url: (q) => "https://duckduckgo.com/?q=" + encodeURIComponent(q),
    serpRe: /^https?:\/\/(www\.)?duckduckgo\.com\/(?:\?|$)/i,
    serpParam: "q",
    // Full-colour DuckDuckGo mark (orange disc with duck silhouette in white,
    // blue eyes, yellow beak, green bow-tie) sourced from vectorlogo.zone.
    icon: `<svg viewBox="0 0 32 32"><g transform="matrix(.266667 0 0 .266667 -17.954934 -5.057333)"><circle cx="127.332" cy="78.966" r="51.15" fill="#de5833"/><defs><path id="ddg-A" d="M178.684 78.824c0 28.316-23.035 51.354-51.354 51.354-28.313 0-51.348-23.04-51.348-51.354s23.036-51.35 51.348-51.35c28.318 0 51.354 23.036 51.354 51.35z"/></defs><clipPath id="ddg-B"><use xlink:href="#ddg-A"/></clipPath><g clip-path="url(#ddg-B)"><path d="M148.293 155.158c-1.8-8.285-12.262-27.04-16.23-34.97s-7.938-19.1-6.13-26.322c.328-1.312-3.436-11.308-2.354-12.015 8.416-5.5 10.632.6 14.002-1.862 1.734-1.273 4.1 1.047 4.7-1.06 2.158-7.567-3.006-20.76-8.77-26.526-1.885-1.88-4.77-3.06-8.03-3.687-1.254-1.713-3.275-3.36-6.138-4.88-3.188-1.697-10.12-3.938-13.717-4.535-2.492-.4-3.055.287-4.12.46.992.088 5.7 2.414 6.615 2.55-.916.62-3.607-.028-5.324.742-.865.392-1.512 1.877-1.506 2.58 4.9-.496 12.574-.016 17.1 2-3.602.4-9.08.867-11.436 2.105-6.848 3.608-9.873 12.035-8.07 22.133 1.804 10.075 9.738 46.85 12.262 59.13 2.525 12.264-5.408 20.2-10.455 22.354l5.408.363-1.8 3.967c6.484.72 13.695-1.44 13.695-1.44-1.438 3.965-11.176 5.412-11.176 5.412s4.7 1.438 12.258-1.447l12.263-4.688 3.604 9.373 6.854-6.847 2.885 7.2c.014-.001 5.424-1.808 3.62-10.103z" fill="#d5d7d8"/><path d="M150.47 153.477c-1.795-8.3-12.256-27.043-16.228-34.98s-7.935-19.112-6.13-26.32c.335-1.3.34-6.668 1.43-7.38 8.4-5.494 7.812-.184 11.187-2.645 1.74-1.27 3.133-2.806 3.738-4.912 2.164-7.572-3.006-20.76-8.773-26.53-1.88-1.88-4.768-3.062-8.023-3.686-1.252-1.718-3.27-3.36-6.13-4.882-5.4-2.862-12.074-4.006-18.266-2.883 1 .1 3.256 2.138 4.168 2.273-1.38.936-5.053.815-5.03 2.896 4.916-.492 10.303.285 14.834 2.297-3.602.4-6.955 1.3-9.3 2.543-6.854 3.603-8.656 10.812-6.854 20.914 1.807 10.097 9.742 46.873 12.256 59.126 2.527 12.26-5.402 20.188-10.45 22.354l5.408.36-1.8 3.973c6.484.72 13.695-1.44 13.695-1.44-1.438 3.974-11.176 5.406-11.176 5.406s4.686 1.44 12.258-1.445l12.27-4.688 3.604 9.373 6.852-6.85 2.9 7.215c-.016.007 5.388-1.797 3.58-10.088z" fill="#fff"/><path d="M109.02 70.69c0-2.093 1.693-3.787 3.79-3.787 2.1 0 3.785 1.694 3.785 3.787s-1.695 3.786-3.785 3.786c-2.096.001-3.79-1.692-3.79-3.786z" fill="#2d4f8e"/><path d="M113.507 69.43a.98.98 0 0 1 .98-.983c.543 0 .984.438.984.983s-.44.984-.984.984c-.538.001-.98-.44-.98-.984z" fill="#fff"/><path d="M134.867 68.445c0-1.793 1.46-3.25 3.252-3.25 1.8 0 3.256 1.457 3.256 3.25 0 1.8-1.455 3.258-3.256 3.258a3.26 3.26 0 0 1-3.252-3.258z" fill="#2d4f8e"/><path d="M138.725 67.363c0-.463.38-.843.838-.843a.84.84 0 0 1 .846.843c0 .47-.367.842-.846.842a.84.84 0 0 1-.838-.842z" fill="#fff"/><linearGradient id="ddg-C" gradientUnits="userSpaceOnUse" x1="105.318" y1="60.979" x2="113.887" y2="60.979"><stop offset=".006" stop-color="#6176b9"/><stop offset=".691" stop-color="#394a9f"/></linearGradient><path d="M113.886 59.718s-2.854-1.3-5.63.453-2.668 3.523-2.668 3.523-1.473-3.283 2.453-4.892 5.844.916 5.844.916z" fill="url(#ddg-C)"/><linearGradient id="ddg-D" gradientUnits="userSpaceOnUse" x1="132.273" y1="58.371" x2="140.078" y2="58.371"><stop offset=".006" stop-color="#6176b9"/><stop offset=".691" stop-color="#394a9f"/></linearGradient><path d="M140.078 59.458s-2.05-1.172-3.643-1.152c-3.27.043-4.162 1.488-4.162 1.488s.55-3.445 4.732-2.754c2.268.377 3.073 2.418 3.073 2.418z" fill="url(#ddg-D)"/></g><path d="M124.4 85.295c.38-2.3 6.3-6.625 10.5-6.887 4.2-.265 5.5-.205 9-1.043s12.535-3.088 15.033-4.242c2.504-1.156 13.104.572 5.63 4.738-3.232 1.8-11.943 5.13-18.172 6.987-6.22 1.86-10-1.776-12.06 1.28-1.646 2.432-.334 5.762 7.1 6.453 10.037.93 19.66-4.52 20.72-1.625s-8.625 6.508-14.525 6.623c-5.893.1-17.77-3.896-19.555-5.137s-4.165-4.13-3.67-7.148z" fill="#fdd20a"/><path d="M128.943 115.592s-14.102-7.52-14.332-4.47c-.238 3.056 0 15.5 1.643 16.45s13.396-6.108 13.396-6.108zm5.403-.474s9.635-7.285 11.754-6.815c2.1.48 2.582 15.5.7 16.23-1.88.7-12.908-3.813-12.908-3.813z" fill="#65bc46"/><path d="M125.53 116.4c0 4.932-.7 7.05 1.4 7.52s6.104 0 7.518-.938.232-7.28-.232-8.465c-.477-1.174-8.696-.232-8.696 1.884z" fill="#43a244"/><path d="M126.426 115.292c0 4.933-.707 7.05 1.4 7.52 2.106.48 6.104 0 7.52-.938 1.4-.94.23-7.28-.236-8.466-.473-1.173-8.692-.227-8.692 1.885z" fill="#65bc46"/></g></svg>`,
  },
  {
    id: "amazon",
    name: "Amazon",
    placeholder: "Search Amazon",
    url: (q) => "https://www.amazon.com/s?k=" + encodeURIComponent(q),
    serpRe: /^https?:\/\/(www\.)?amazon\.[a-z.]+\/s\b/i,
    serpParam: "k",
    icon: `<svg viewBox="0 0 256 260"><path fill="#000" d="M150.74 108.13c0 13.14.34 24.1-6.31 35.77-5.36 9.49-13.85 15.32-23.34 15.32-12.95 0-20.5-9.87-20.5-24.43 0-28.75 25.76-33.97 50.15-33.97zm34.02 82.22c-2.23 1.99-5.46 2.13-7.97.8-11.2-9.3-13.19-13.61-19.36-22.49-18.5 18.88-31.6 24.53-55.6 24.53-28.37 0-50.48-17.5-50.48-52.57 0-27.37 14.85-46.02 35.96-55.13 18.31-8.06 43.88-9.49 63.43-11.72v-4.36c0-8.02.62-17.51-4.08-24.43-4.13-6.22-12-8.78-18.93-8.78-12.86 0-24.34 6.59-27.14 20.26-.57 3.04-2.8 6.03-5.83 6.17l-32.74-3.51c-2.75-.62-5.79-2.85-5.03-7.07C64.53 12.4 100.34.44 132.42.44c16.42 0 37.86 4.37 50.81 16.8 16.42 15.32 14.85 35.77 14.85 58.02v52.57c0 15.8 6.55 22.72 12.71 31.26 2.18 3.04 2.66 6.69-.09 8.97-6.88 5.74-19.12 16.42-25.86 22.4l-.09-.1"/><path fill="#f90" d="M221.5 210.32c-105.23 50.08-170.54 8.18-212.35-17.27-2.59-1.6-6.98.38-3.17 4.76 13.93 16.89 59.57 57.59 119.15 57.59 59.62 0 95.09-32.53 99.53-38.21 4.41-5.63 1.29-8.73-3.16-6.87zm29.56-16.32c-2.83-3.68-17.18-4.37-26.22-3.26-9.05 1.08-22.63 6.61-21.45 9.93.6 1.24 1.84.69 8.06.13 6.23-.62 23.7-2.83 27.34 1.93 3.66 4.79-5.57 27.61-7.26 31.29-1.63 3.68.62 4.63 3.68 2.18 3.02-2.45 8.48-8.8 12.14-17.78 3.64-9.03 5.86-21.62 3.71-24.42z"/></svg>`,
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    placeholder: "Search Wikipedia",
    url: (q) => "https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(q),
    serpRe: /^https?:\/\/(www\.)?[a-z-]+\.wikipedia\.org\/wiki\/Special:Search\b/i,
    serpParam: "search",
    icon: `<svg viewBox="0 0 24 24"><path fill="#202122" d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z"/></svg>`,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    placeholder: "Ask Perplexity",
    url: (q) => "https://www.perplexity.ai/?q=" + encodeURIComponent(q),
    serpRe: /^https?:\/\/(www\.)?perplexity\.ai\/(?:\?|search\b)/i,
    serpParam: "q",
    icon: `<svg viewBox="0 0 24 24"><path fill="#1FB8CD" d="M22.398 7.09h-2.31V.067l-7.51 6.355V.158h-1.155v6.196L4.49 0v7.09H1.602v10.397h2.888V24l6.932-6.359v6.2h1.156v-6.046l6.932 6.18v-6.488h2.888V7.09zm-3.466-4.531v4.531h-5.355l5.355-4.531zM5.646 2.626l4.87 4.464H5.646V2.626zM2.758 16.332V8.245h7.847l-6.114 6.115v1.972H2.758zm2.888 5.04v-3.885h.001v-2.649l5.776-5.776v7.011L5.646 21.37zm12.708.025-5.777-5.151V9.062l5.777 5.776v6.559zm2.888-5.065h-1.733v-1.972L13.395 8.245h7.847v8.087z"/></svg>`,
  },
];

let currentEngine = ENGINES[0];

const engineSwitcherBtn = document.getElementById("searchEngineSwitcherBtn");
const engineSwitcherCircle = engineSwitcherBtn.querySelector(".sc-search-engine-switcher-circle");
const enginePanel = document.getElementById("enginePanel");

enginePanel.innerHTML = ENGINES.map((e) => `
  <button type="button" class="sc-engine-item" data-engine="${e.id}" role="menuitem">
    <span class="sc-engine-mini" aria-hidden="true">${e.icon}</span>
    <span class="sc-engine-name">${e.name}</span>
  </button>
`).join("");

function setEngine(id) {
  const e = ENGINES.find((x) => x.id === id);
  if (!e) return;
  currentEngine = e;
  engineSwitcherCircle.innerHTML = e.icon;
  if (input) input.placeholder = e.placeholder;
  enginePanel.querySelectorAll(".sc-engine-item").forEach((b) => {
    b.classList.toggle("is-current", b.dataset.engine === id);
  });
  // Keep the Advanced page's "Search engine" dropdown in lock-step so it
  // always reflects the same engine the main page uses.
  const advancedSelect = document.getElementById("advancedEngineSelect");
  if (advancedSelect && advancedSelect.value !== id) advancedSelect.value = id;
}

function setPanelOpen(open) {
  enginePanel.hidden = !open;
  engineSwitcherBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

setEngine("google");

// Multi-search: render the list of engines as checkboxes, all on by default,
// and keep the primary button's label in sync with how many are selected.
const multiList = document.getElementById("multiList");
const multiBtn = document.getElementById("multiBtn");
const multiSplitBtn = document.getElementById("multiSplitBtn");
const multiSelected = new Set(ENGINES.map((e) => e.id));

multiList.innerHTML = ENGINES.map((e) => `
  <label class="sc-multi-item">
    <span class="sc-engine-mini" aria-hidden="true">${e.icon}</span>
    <span class="sc-multi-name">${e.name}</span>
    <input type="checkbox" data-engine="${e.id}" checked />
  </label>
`).join("");

function updateMultiBtn() {
  const n = multiSelected.size;
  multiBtn.textContent = `Open ${n} as tab group`;
  multiBtn.disabled = n === 0;
  if (multiSplitBtn) {
    // Split view fits at most two tabs; cap the displayed count, and only
    // enable the button when 1 or 2 engines are selected.
    multiSplitBtn.textContent = `Open ${Math.min(n, 2)} in split view`;
    multiSplitBtn.disabled = n === 0 || n > 2;
  }
}
updateMultiBtn();

multiList.addEventListener("change", (e) => {
  const cb = e.target.closest('input[type="checkbox"]');
  if (!cb) return;
  if (cb.checked) multiSelected.add(cb.dataset.engine);
  else multiSelected.delete(cb.dataset.engine);
  updateMultiBtn();
});

engineSwitcherBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setPanelOpen(enginePanel.hidden);
});

enginePanel.addEventListener("click", (e) => {
  const item = e.target.closest(".sc-engine-item");
  if (!item) return;
  setEngine(item.dataset.engine);
  setPanelOpen(false);
  if (input) input.focus();
});

document.addEventListener("click", (e) => {
  if (enginePanel.hidden) return;
  if (engineSwitcherBtn.contains(e.target) || enginePanel.contains(e.target)) return;
  setPanelOpen(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !enginePanel.hidden) setPanelOpen(false);
});

// Navigate to `url`. If a tab is already open at the exact same URL, switch
// to it instead of opening a new one. If the active tab is on an `about:`
// page, open in a new tab so the user doesn't lose what they were on.
async function navigate(url) {
  try {
    const allTabs = await browser.tabs.query({});
    const match = allTabs && allTabs.find((t) => t.url === url);
    if (match) {
      if (browser.windows && browser.windows.update && typeof match.windowId === "number") {
        try { await browser.windows.update(match.windowId, { focused: true }); } catch (e) {}
      }
      await browser.tabs.update(match.id, { active: true });
      return;
    }
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    if (active && typeof active.url === "string" && active.url.startsWith("about:")) {
      await browser.tabs.create({ url });
      return;
    }
  } catch (e) { /* fall through to update */ }
  browser.tabs.update({ url });
}

// If a tab is already showing a SERP for the given engine + query, focus it
// (switching window if needed). Returns true if such a tab was found.
// Matches fuzzily by engine SERP regex + the engine's query parameter, so
// tabs that include tracking params like `client=firefox-b-d` still match.
async function focusExistingSerpTab(engine, query) {
  if (!engine || !engine.serpRe || !engine.serpParam) return false;
  const want = String(query || "").trim().toLowerCase();
  if (!want) return false;
  try {
    const allTabs = await browser.tabs.query({});
    const match = (allTabs || []).find((t) => {
      if (!t.url || !engine.serpRe.test(t.url)) return false;
      try {
        const have = (new URL(t.url).searchParams.get(engine.serpParam) || "").trim().toLowerCase();
        return have === want;
      } catch { return false; }
    });
    if (!match) return false;
    if (browser.windows && browser.windows.update && typeof match.windowId === "number") {
      try { await browser.windows.update(match.windowId, { focused: true }); } catch (e) {}
    }
    await browser.tabs.update(match.id, { active: true });
    return true;
  } catch (e) {
    return false;
  }
}

async function runSearch(q) {
  const query = (q || "").trim();
  if (!query) return;
  // Show the section and kick the AI fan-out immediately so suggestions are
  // already loading by the time the results page renders and the background
  // re-syncs the query.
  setSuggestionsActive(query);
  // If this exact search is already open in a tab, just switch to it instead
  // of re-running it. Falls through to navigate() if no match.
  if (await focusExistingSerpTab(currentEngine, query)) return;
  navigate(currentEngine.url(query));
  // History is logged by background.js when the SERP loads, then the sidebar
  // picks it up via storage.onChanged and re-renders. No optimistic update
  // needed here — the round-trip is near-instant.
}

// --- Search history -------------------------------------------------------
//
// On sidebar load, seed the history list with a handful of plausible past
// queries on safe, varied topics so a fresh demo has something to look at.
// Real searches the user runs prepend to the top, pushing seeds down — they
// drop off the visible list once enough real searches have stacked above.

const HISTORY_POOL = [
  "how to make sourdough bread",
  "best hiking trails in the lake district",
  "easy yoga poses for beginners",
  "quick weeknight dinner recipes",
  "how to grow basil indoors",
  "learn french for travel",
  "how long to roast a whole chicken",
  "best non fiction books 2026",
  "weekend trips from london by train",
  "couch to 5k plan",
  "how to repot a houseplant",
  "tips for taking better phone photos",
  "how to make iced coffee at home",
  "best paint colours for a small bedroom",
  "easy origami for kids",
  "how to season a cast iron pan",
  "classic novels for book club",
  "how to start a vegetable garden",
  "stretching routines for desk workers",
  "how to make perfect risotto",
  "travel packing list for europe",
  "learn watercolour basics",
  "how to budget on a single income",
  "fun things to do in edinburgh",
  "how to make homemade pizza dough",
  "beginner knitting projects",
  "tips for sleeping better",
  "best podcasts for long drives",
  "how to clean grout naturally",
  "easy slow cooker recipes",
  "dog training basics for puppies",
  "how to remove a stripped screw",
  "simple breakfast meal prep ideas",
  "starting a journaling habit",
  "how to make perfect scrambled eggs",
  "best hill walks in scotland",
];

// Each entry: { q: "search query", ts: epoch_ms }. Most recent first.
// Real entries (the user's actual searches, written by background.js on every
// SERP) live in browser.storage.local under "userHistory". Synthetic seed
// entries fill out the list until the user has built up a real history.
let historyEntries = [];

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Format a timestamp as a relative-time string in the project's house style.
function relativeTime(ts) {
  if (!ts) return "";
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const m = 60 * 1000, h = 60 * m, d = 24 * h;
  if (diff < 2 * m) return "Just now";
  if (diff < h) return `${Math.max(2, Math.round(diff / m))} mins ago`;
  if (diff < d) {
    const hh = Math.round(diff / h);
    return hh <= 1 ? "1 hour ago" : `${hh} hours ago`;
  }
  const days = Math.floor(diff / d);
  if (days === 1) return "Yesterday";
  if (days < 7) {
    return new Date(ts).toLocaleDateString("en-GB", { weekday: "long" });
  }
  if (days < 14) return "Last week";
  if (days < 21) return "2 weeks ago";
  if (days < 30) return "3 weeks ago";
  const months = Math.floor(days / 30);
  if (months === 1) return "Last month";
  return `${months} months ago`;
}

async function loadStoredHistory() {
  try {
    if (typeof browser === "undefined" || !browser.storage || !browser.storage.local) return [];
    const data = await browser.storage.local.get("userHistory");
    return Array.isArray(data.userHistory) ? data.userHistory : [];
  } catch (e) { return []; }
}

// Build the display list: real entries on top, padded with seed entries
// given synthetic past timestamps so the list always looks lived-in.
async function initHistory() {
  const real = await loadStoredHistory();
  const usedQueries = new Set(real.map((e) => String(e.q || "").toLowerCase()));
  const oldestRealTs = real.length ? real[real.length - 1].ts : Date.now();
  const seedSlotsNeeded = Math.max(0, 12 - real.length);
  const seedQueries = shuffleArr(HISTORY_POOL).filter((q) => !usedQueries.has(q.toLowerCase()));
  const seeds = seedQueries.slice(0, seedSlotsNeeded).map((q, i) => ({
    q,
    // Step backwards from the oldest real entry (or now). Each subsequent
    // seed is ~3 days older than the previous, with a little jitter.
    ts: oldestRealTs - (i + 1) * (3 + Math.random()) * 24 * 60 * 60 * 1000,
  }));
  historyEntries = [...real.slice(0, 30), ...seeds];
  renderHistory();
}

function renderHistory() {
  const historyListEl = document.getElementById("historyList");
  if (!historyListEl) return;
  const moreList = historyListEl.parentElement.querySelector(".sc-more .sc-list");
  const item = (e) =>
    `<li><a href="#" data-q="${escapeAttr(e.q)}"><span class="sc-title">${escapeAttr(e.q)}</span><span class="sc-meta">${escapeAttr(relativeTime(e.ts))}</span></a></li>`;
  historyListEl.innerHTML = historyEntries.slice(0, 5).map(item).join("");
  if (moreList) moreList.innerHTML = historyEntries.slice(5, 12).map(item).join("");
  historyListEl.parentElement.querySelectorAll(".sc-list a > .sc-meta").forEach((meta) => {
    meta.parentElement.after(meta);
  });
  historyListEl.parentElement.querySelectorAll(".sc-list li").forEach(injectRowMenu);
  setupRovingTabindex();
}

// React to writes from the background script (real searches landing on disk).
if (typeof browser !== "undefined" && browser.storage && browser.storage.onChanged) {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.userHistory) initHistory();
  });
}

initHistory();

// --- From Firefox ---------------------------------------------------------
//
// Mock pool of pages the user might plausibly have bookmarked, opened, or
// recently visited. On sidebar load we shuffle and surface 12 of them: 5
// visible, 7 behind "Show more". Topics intentionally varied and safe.

const FIREFOX_POOL = [
  { url: "https://www.bbcgoodfood.com/recipes/sourdough-bread", title: "Sourdough bread recipe — BBC Good Food", meta: "bbcgoodfood.com · Bookmark" },
  { url: "https://www.nationaltrust.org.uk/lake-district", title: "Lake District walks and trails — National Trust", meta: "nationaltrust.org.uk · Recently visited" },
  { url: "https://www.yogajournal.com/poses/yoga-by-benefit/beginners/", title: "Yoga for beginners — Yoga Journal", meta: "yogajournal.com · History" },
  { url: "https://www.reddit.com/r/EatCheapAndHealthy/", title: "Quick weeknight dinners — r/EatCheapAndHealthy", meta: "reddit.com · Open tab" },
  { url: "https://www.rhs.org.uk/herbs/basil/grow-your-own", title: "Growing basil indoors — RHS", meta: "rhs.org.uk · Bookmark" },
  { url: "https://www.duolingo.com/learn", title: "French course — Duolingo", meta: "duolingo.com · Open tab" },
  { url: "https://www.seriouseats.com/the-best-roast-chicken-recipe", title: "The best roast chicken — Serious Eats", meta: "seriouseats.com · Bookmark" },
  { url: "https://www.goodreads.com/list/show/best-nonfiction-2026", title: "Best non-fiction of 2026 — Goodreads", meta: "goodreads.com · Recently visited" },
  { url: "https://www.thetrainline.com/destinations/london", title: "Weekend trips from London — Trainline", meta: "thetrainline.com · History" },
  { url: "https://www.nhs.uk/live-well/exercise/couch-to-5k-week-by-week/", title: "Couch to 5K plan — NHS", meta: "nhs.uk · Bookmark" },
  { url: "https://www.rhs.org.uk/houseplants/repotting", title: "Repotting houseplants — RHS", meta: "rhs.org.uk · History" },
  { url: "https://petapixel.com/category/mobile/", title: "Mobile photography tips — PetaPixel", meta: "petapixel.com · Recently visited" },
  { url: "https://www.tastingtable.com/iced-coffee-at-home", title: "Iced coffee at home — Tasting Table", meta: "tastingtable.com · History" },
  { url: "https://www.farrow-ball.com/inspiration/bedroom-colours", title: "Bedroom paint colours — Farrow & Ball", meta: "farrow-ball.com · Bookmark" },
  { url: "https://www.origamiway.com/easy-origami.shtml", title: "Easy origami for kids — Origami Way", meta: "origamiway.com · Open tab" },
  { url: "https://www.lodgecastiron.com/use-and-care", title: "Cast iron care — Lodge", meta: "lodgecastiron.com · Bookmark" },
  { url: "https://www.penguin.co.uk/articles/book-club-classics", title: "Classic novels for book club — Penguin", meta: "penguin.co.uk · Recently visited" },
  { url: "https://www.allotment-garden.org/vegetable/", title: "Starting a vegetable garden — Allotment Garden", meta: "allotment-garden.org · Bookmark" },
  { url: "https://www.webmd.com/fitness-exercise/desk-stretches", title: "Stretches for desk workers — WebMD", meta: "webmd.com · History" },
  { url: "https://www.bbcgoodfood.com/recipes/perfect-risotto", title: "Perfect risotto — BBC Good Food", meta: "bbcgoodfood.com · History" },
  { url: "https://www.lonelyplanet.com/articles/europe-packing-list", title: "Europe packing list — Lonely Planet", meta: "lonelyplanet.com · Bookmark" },
  { url: "https://www.skillshare.com/classes/watercolour-basics", title: "Watercolour basics — Skillshare", meta: "skillshare.com · Open tab" },
  { url: "https://www.moneysavingexpert.com/family/budget-planning/", title: "Budgeting on a single income — MSE", meta: "moneysavingexpert.com · Recently visited" },
  { url: "https://www.visitscotland.com/destinations/edinburgh/", title: "Things to do in Edinburgh — VisitScotland", meta: "visitscotland.com · Bookmark" },
  { url: "https://www.bbcgoodfood.com/recipes/best-pizza-dough", title: "Homemade pizza dough — BBC Good Food", meta: "bbcgoodfood.com · Bookmark" },
  { url: "https://www.woolandthegang.com/knit-kits-beginners", title: "Beginner knitting projects — Wool and the Gang", meta: "woolandthegang.com · Open tab" },
  { url: "https://www.sleepfoundation.org/sleep-hygiene", title: "Tips for sleeping better — Sleep Foundation", meta: "sleepfoundation.org · History" },
  { url: "https://www.theguardian.com/lifeandstyle/podcasts-for-long-drives", title: "Best podcasts for long drives — Guardian", meta: "theguardian.com · Recently visited" },
  { url: "https://www.familyhandyman.com/article/how-to-clean-grout/", title: "Cleaning grout naturally — Family Handyman", meta: "familyhandyman.com · History" },
  { url: "https://www.slowcookercentral.com/recipes/easy/", title: "Easy slow cooker recipes — Slow Cooker Central", meta: "slowcookercentral.com · Bookmark" },
];

function renderFirefoxList() {
  const listEl = document.getElementById("firefoxList");
  if (!listEl) return;
  const moreList = listEl.parentElement.querySelector(".sc-more .sc-list");
  const picks = shuffleArr(FIREFOX_POOL).slice(0, 12);
  const item = ({ url, title, meta }) =>
    `<li><a href="${escapeAttr(url)}"><span class="sc-title">${escapeAttr(title)}</span><span class="sc-meta">${escapeAttr(meta)}</span></a></li>`;
  listEl.innerHTML = picks.slice(0, 5).map(item).join("");
  if (moreList) moreList.innerHTML = picks.slice(5, 12).map(item).join("");
  listEl.parentElement.querySelectorAll(".sc-list a > .sc-meta").forEach((meta) => {
    meta.parentElement.after(meta);
  });
  listEl.parentElement.querySelectorAll(".sc-list li").forEach(injectRowMenu);
  setupRovingTabindex();
}

renderFirefoxList();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch(input.value);
});

content.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  // Let target="_blank" anchors (e.g. the update badge) follow normal browser
  // behaviour and open in a new tab.
  if (a.target === "_blank") return;
  e.preventDefault();
  if (a.dataset.q) {
    input.value = a.dataset.q;
    updateClearBtnVisibility();
    runSearch(a.dataset.q);
    return;
  }
  const href = a.getAttribute("href");
  if (href && href !== "#") navigate(href);
});

// Dig Deeper
const digPanel = document.getElementById("tab-dig");
const tabCurrentPanel = document.getElementById("tab-current");
const digQueryEl = document.getElementById("digQuery");
const digSimilarList = document.getElementById("digSimilarList");
const digCompareCount = document.getElementById("digCompareCount");
const digCompareItems = [];
let digCurrentQuery = "";


// AI summary placeholder — skeleton + typewriter animation.
const digSummaryBody = document.getElementById("digSummaryBody");
let summaryTypingTimer = null;

function summaryFor(query) {
  return `Most reviewers covering "${query}" agree on a small shortlist of standout picks. The current consensus favours models that balance comfort, battery life and active noise cancellation, while purists still recommend wired alternatives for critical listening. Recent 2026 comparisons lean towards the latest flagships, but mid-range options now offer most of the same features at noticeably lower prices.`;
}

function showSummarySkeleton() {
  if (summaryTypingTimer) { clearInterval(summaryTypingTimer); summaryTypingTimer = null; }
  digSummaryBody.innerHTML = `
    <div class="sc-skeleton" aria-label="Loading summary">
      <span class="sc-skel-line"></span>
      <span class="sc-skel-line"></span>
      <span class="sc-skel-line" style="width: 92%"></span>
      <span class="sc-skel-line" style="width: 78%"></span>
      <span class="sc-skel-line" style="width: 55%"></span>
    </div>
  `;
}

function typeSummary(text) {
  if (summaryTypingTimer) { clearInterval(summaryTypingTimer); summaryTypingTimer = null; }
  digSummaryBody.innerHTML = '<p class="sc-dig-summary-text"><span class="sc-summary-text"></span><span class="sc-typing-caret" aria-hidden="true">▍</span></p>';
  const target = digSummaryBody.querySelector(".sc-summary-text");
  let i = 0;
  summaryTypingTimer = setInterval(() => {
    if (i >= text.length) {
      clearInterval(summaryTypingTimer);
      summaryTypingTimer = null;
      const caret = digSummaryBody.querySelector(".sc-typing-caret");
      if (caret) caret.remove();
      return;
    }
    // Append a small chunk for fewer reflows; varies cadence slightly.
    const step = Math.random() < 0.04 ? 0 : 1 + Math.floor(Math.random() * 2);
    target.textContent += text.slice(i, i + step);
    i += step;
  }, 22);
}

// Track which query the Dig Deeper summary pane is currently showing, so
// stale in-flight responses (from a previous query) can be discarded.
let currentSummaryQuery = "";

async function loadSummary(query) {
  currentSummaryQuery = query;
  showSummarySkeleton();
  if (window.SC_AI && SC_AI.isConfigured()) {
    try {
      const text = await SC_AI.fetchSummary(query);
      if (currentSummaryQuery !== query) return;
      typeSummary((text && text.trim()) || summaryFor(query));
      return;
    } catch (e) {
      if (currentSummaryQuery !== query) return;
      // Fall through to the static placeholder.
    }
  }
  // Worker not configured (or failed) — keep the existing demo behaviour.
  setTimeout(() => {
    if (currentSummaryQuery !== query) return;
    typeSummary(summaryFor(query));
  }, 900);
}

// --- "Other searches to try" suggestions ---------------------------------
//
// When a new query becomes active (form submit, sync from active tab, or
// search-context message), fetch 6 related queries from the Worker, show
// shimmering skeleton rows in the meantime, and pre-fetch their summaries
// so Dig Deeper feels instant when clicked.

const suggestionsList = document.getElementById("suggestionsList");
const suggestionsSection = document.getElementById("suggestionsSection");
// Snapshot the static markup so we can restore it if AI is disabled or fails.
const suggestionsStaticHTML = suggestionsList ? suggestionsList.innerHTML : "";
let currentSuggQuery = "";

// Helper: after rendering a batch of .sc-reveal rows, kick the transition
// on a fresh frame so they fade from opacity 0 to 1 in their inline-delay
// order. Once the transition completes the element sits at opacity 1 with
// no animation attached, so hiding/showing the panel does nothing.
function kickRevealIn(container) {
  if (!container) return;
  const rows = container.querySelectorAll(".sc-reveal:not(.sc-reveal-on)");
  if (!rows.length) return;
  // Force a layout flush so the initial opacity:0 state is committed before
  // we toggle to opacity:1 — without this the browser may collapse the two
  // style writes and skip the transition.
  void container.offsetWidth;
  requestAnimationFrame(() => {
    rows.forEach((row) => row.classList.add("sc-reveal-on"));
  });
}

function aiSuggestEnabled() {
  const cb = document.getElementById("settingAiSuggest");
  return cb ? cb.checked : true;
}

// Show or hide the "Other searches to try" section. It only makes sense when
// there's an active query (i.e. user is on a Google SERP); otherwise the
// section is hidden entirely so we don't display stale suggestions.
function setSuggestionsActive(query) {
  if (!suggestionsSection) return;
  if (query && query.trim()) {
    suggestionsSection.hidden = false;
    // Dedupe: syncFromActiveTab and the search-context message can both fire
    // for the same query in quick succession when the sidebar first opens on
    // a SERP. Without this guard the skeleton + suggestions render twice and
    // visibly flicker.
    if (currentSuggQuery === query) return;
    loadSuggestions(query);
  } else {
    suggestionsSection.hidden = true;
    currentSuggQuery = "";
  }
}

function renderSuggestionSkeleton(n) {
  if (!suggestionsList) return;
  const widths = [78, 64, 86, 58, 72];
  let html = "";
  for (let i = 0; i < n; i++) {
    const w = widths[i % widths.length];
    // data-q="" keeps the magnifying-glass ::before icon in place.
    html += `<li class="sc-skel-row"><a href="#" data-q="" style="--skel-w:${w}%"><span class="sc-skel-line"></span></a></li>`;
  }
  suggestionsList.innerHTML = html;
  // Clear any leftover Show-more content while skeletons are up.
  const moreList = suggestionsSection && suggestionsSection.querySelector(".sc-more .sc-list");
  if (moreList) moreList.innerHTML = "";
  const moreBtn = suggestionsSection && suggestionsSection.querySelector(".sc-show-more");
  if (moreBtn) moreBtn.hidden = true;
}

function renderSuggestions(list) {
  if (!suggestionsList) return;
  const visible = list.slice(0, 5);
  const hidden = list.slice(5);
  const renderItem = (q, i) => `<li class="sc-reveal" style="transition-delay:${i * 60}ms"><a href="#" data-q="${escapeAttr(plainSuggestion(q))}">${suggestionInnerHTML(q)}</a></li>`;
  suggestionsList.innerHTML = visible.map((q, i) => renderItem(q, i)).join("");
  const moreList = suggestionsSection && suggestionsSection.querySelector(".sc-more .sc-list");
  if (moreList) moreList.innerHTML = hidden.map((q, i) => renderItem(q, i + visible.length)).join("");
  const moreBtn = suggestionsSection && suggestionsSection.querySelector(".sc-show-more");
  if (moreBtn) {
    moreBtn.hidden = hidden.length === 0;
    moreBtn.textContent = "Show more";
    moreBtn.setAttribute("aria-expanded", "false");
  }
  // Collapse the more-section if it was left open from a previous query.
  const moreWrap = suggestionsSection && suggestionsSection.querySelector(".sc-more");
  if (moreWrap) { moreWrap.classList.remove("is-open"); moreWrap.inert = true; }
  suggestionsSection.querySelectorAll(".sc-list li").forEach(injectRowMenu);
  setupRovingTabindex();
  kickRevealIn(suggestionsSection);
}

function restoreSuggestionsStatic() {
  if (!suggestionsList) return;
  suggestionsList.innerHTML = suggestionsStaticHTML;
  suggestionsList.querySelectorAll("li").forEach(injectRowMenu);
  setupRovingTabindex();
}

async function loadSuggestions(query) {
  if (!query || !query.trim()) return;
  if (!aiSuggestEnabled()) return;
  if (!window.SC_AI || !SC_AI.isConfigured()) return;

  currentSuggQuery = query;
  renderSuggestionSkeleton(5);
  try {
    const list = await SC_AI.fetchSuggestions(query);
    if (currentSuggQuery !== query) return;
    if (list && list.length) {
      renderSuggestions(list);
      SC_AI.prefetchSummaries(list);
    } else {
      restoreSuggestionsStatic();
    }
  } catch (e) {
    if (currentSuggQuery !== query) return;
    restoreSuggestionsStatic();
  }
}

function similarFor(query) {
  // Placeholder: realistic-feeling expansions of the headphones-shopping demo query.
  return [
    "best wireless headphones under £100",
    "best wireless headphones under £300",
    "best noise-cancelling headphones 2026",
    "headphones with best battery life",
    "open-back vs closed-back headphones",
    "wireless headphones with best mic for calls",
  ];
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The AI marks the most distinctive part of each suggestion with **double
// asterisks** so we can render that span in bold. This helper:
//   • plainSuggestion(): strips the markers — used wherever the raw search
//     query is needed (data-q, history, fetching the actual SERP).
//   • suggestionInnerHTML(): escapes for HTML, then converts the ** spans
//     into <strong> tags — used for the visible text inside the link.
function plainSuggestion(s) {
  return String(s || "").replace(/\*\*/g, "");
}
function suggestionInnerHTML(s) {
  const escaped = escapeAttr(s);
  // Non-greedy match between ** pairs, no asterisks inside. \s* on either
  // side of the captured group absorbs any stray whitespace the model put
  // immediately inside the markers. Wrapped in a single <span> so the
  // parent <a> (which is display: flex with gap: 10px) treats the whole
  // suggestion — strong-tagged words and all — as one flex item, rather
  // than splitting on the <strong> and inserting gaps between fragments.
  const body = escaped.replace(/\*\*\s*([^*]+?)\s*\*\*/g, "<strong>$1</strong>");
  return `<span>${body}</span>`;
}

function injectRowMenu(li) {
  if (li.querySelector(".sc-row-menu")) return;
  const dig = document.createElement("button");
  dig.type = "button";
  dig.className = "sc-row-dig";
  dig.tabIndex = -1;
  dig.textContent = "Dig deeper";
  li.appendChild(dig);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sc-row-menu";
  btn.tabIndex = -1;
  btn.setAttribute("aria-label", "More actions");
  btn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="3" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="13" r="1.4" fill="currentColor"/></svg>';
  li.appendChild(btn);
}

const digSimilarMore = document.getElementById("digSimilarMore");
const digSimilarMoreList = document.getElementById("digSimilarMoreList");
const digSimilarShowMore = document.getElementById("digSimilarShowMore");
// The generic .sc-show-more click handler (further down) handles toggling for
// every Show more button on the page, including this one. Don't bind a second
// listener here — it would double-toggle and cancel itself out.

// Track which query the "Similar searches" pane is currently rendering, so
// late responses for a previous query are ignored.
let currentDigSimilarQuery = "";

function renderSimilarItems(all) {
  const visible = all.slice(0, 3);
  const hidden = all.slice(3);
  const renderItem = (q, i) => `<li class="sc-reveal" style="transition-delay:${i * 60}ms"><a href="#" data-q="${escapeAttr(plainSuggestion(q))}">${suggestionInnerHTML(q)}</a></li>`;
  digSimilarList.innerHTML = visible.map((q, i) => renderItem(q, i)).join("");
  // Continue the stagger past the visible ones so when "Show more" is opened
  // the hidden items keep the same cadence.
  digSimilarMoreList.innerHTML = hidden.map((q, i) => renderItem(q, i + visible.length)).join("");
  digSimilarMore.classList.remove("is-open");
  digSimilarMore.inert = true;
  digSimilarShowMore.hidden = hidden.length === 0;
  digSimilarShowMore.textContent = "Show more";
  digSimilarShowMore.setAttribute("aria-expanded", "false");
  digSimilarList.querySelectorAll("li").forEach(injectRowMenu);
  digSimilarMoreList.querySelectorAll("li").forEach(injectRowMenu);
  setupRovingTabindex();
  kickRevealIn(digPanel);
}

function renderSimilarSkeleton() {
  const widths = [78, 64, 86];
  digSimilarList.innerHTML = widths
    .map((w) => `<li class="sc-skel-row"><a href="#" data-q="" style="--skel-w:${w}%"><span class="sc-skel-line"></span></a></li>`)
    .join("");
  digSimilarMoreList.innerHTML = "";
  digSimilarMore.classList.remove("is-open");
  digSimilarMore.inert = true;
  digSimilarShowMore.hidden = true;
}

async function loadSimilarSearches(query) {
  currentDigSimilarQuery = query;
  const aiOn = aiSuggestEnabled() && window.SC_AI && SC_AI.isConfigured();
  if (!aiOn) {
    renderSimilarItems(similarFor(query));
    return;
  }
  // The home page's "Other searches to try" almost always has these queued
  // up already — when Dig deeper opens, just render straight from cache and
  // skip the skeleton entirely. Only fall back to skeleton + await if the
  // query is genuinely cold (e.g. the user navigated to a SERP and clicked
  // Dig deeper before the suggestions roundtrip finished).
  const cached = SC_AI.getCachedSuggestions && SC_AI.getCachedSuggestions(query);
  if (cached && cached.length) {
    renderSimilarItems(cached);
    return;
  }
  renderSimilarSkeleton();
  try {
    const list = await SC_AI.fetchSuggestions(query);
    if (currentDigSimilarQuery !== query) return; // stale
    if (list && list.length) renderSimilarItems(list);
    else renderSimilarItems(similarFor(query));
  } catch (e) {
    if (currentDigSimilarQuery !== query) return;
    renderSimilarItems(similarFor(query));
  }
}

function openDigDeeper(query) {
  digCurrentQuery = query;
  digQueryEl.textContent = query;
  digPanel.querySelectorAll(".dig-q-inline").forEach((el) => { el.textContent = query; });
  tabCurrentPanel.hidden = true;
  digPanel.hidden = false;
  digPanel.scrollTop = 0;
  loadSimilarSearches(query);
  loadSummary(query);
  setupRovingTabindex();
}

function closeDigDeeper() {
  digPanel.hidden = true;
  tabCurrentPanel.hidden = false;
  setupRovingTabindex();
}

document.getElementById("digBackBtn").addEventListener("click", closeDigDeeper);

digPanel.addEventListener("click", async (e) => {
  const action = e.target.closest("[data-action]");
  if (action) {
    const q = encodeURIComponent(digCurrentQuery);
    if (action.dataset.action === "open-images") {
      navigate("https://www.google.com/search?tbm=isch&q=" + q);
    } else if (action.dataset.action === "multi-search") {
      // Open one tab per selected engine, then group them under the query name.
      const tabIds = [];
      for (const eng of ENGINES) {
        if (!multiSelected.has(eng.id)) continue;
        const url = eng.url(digCurrentQuery);
        if (browser.tabs.create) {
          try {
            const tab = await browser.tabs.create({ url, active: false });
            if (tab && typeof tab.id === "number") tabIds.push(tab.id);
          } catch (err) { /* preview stub or denied */ }
        } else {
          window.open(url, "_blank");
        }
      }
      if (browser.tabs.group && tabIds.length > 0) {
        try {
          const groupId = await browser.tabs.group({ tabIds });
          if (browser.tabGroups && browser.tabGroups.update) {
            await browser.tabGroups.update(groupId, { title: digCurrentQuery });
          }
        } catch (err) { /* tab groups unsupported on this Firefox */ }
      }
    } else if (action.dataset.action === "multi-search-split") {
      // No WebExtension split-view API yet — navigate to our own simulated
      // split-view page that renders two iframes side by side.
      const picked = ENGINES.filter((e) => multiSelected.has(e.id)).slice(0, 2);
      if (!picked.length) return;
      const base = (browser.runtime && browser.runtime.getURL)
        ? browser.runtime.getURL("sidebar/split-view.html")
        : "split-view.html";
      const p = new URLSearchParams({ q: digCurrentQuery, left: picked[0].id });
      if (picked[1]) p.set("right", picked[1].id);
      navigate(base + "?" + p.toString());
    } else if (action.dataset.action === "regenerate-summary") {
      loadSummary(digCurrentQuery);
    } else if (action.dataset.action === "add-compare") {
      digCompareItems.push(digCurrentQuery);
      digCompareCount.textContent = digCompareItems.length;
    }
    return;
  }
  const timeBtn = e.target.closest("[data-time]");
  if (timeBtn) {
    const url = "https://www.google.com/search?client=firefox-b-d&q=" + encodeURIComponent(digCurrentQuery) + "&tbs=qdr:" + timeBtn.dataset.time;
    navigate(url);
  }
});

async function syncFromActiveTab() {
  try {
    const res = await browser.runtime.sendMessage({ type: "get-current-query" });
    if (res && res.query) {
      input.value = res.query;
      updateClearBtnVisibility();
      // If the active tab is a SERP for a known engine, switch the sidebar's
      // engine selector to match so further sidebar searches go to the same
      // engine the user is currently using.
      if (res.engineId) setEngine(res.engineId);
      setSuggestionsActive(res.query);
    } else {
      // Not on a SERP — hide the section so we're not showing stale
      // suggestions for whatever the user last searched.
      setSuggestionsActive("");
    }
  } catch (e) { /* background not ready — leave section hidden */ }
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "search-context" && typeof msg.query === "string") {
    input.value = msg.query;
    updateClearBtnVisibility();
    if (msg.query && msg.engineId) setEngine(msg.engineId);
    setSuggestionsActive(msg.query);
  }
});

// Move any .sc-meta from inside the link to be a sibling of it inside the li,
// so the row's hover state can hide the meta and reveal the menu in its place.
document.querySelectorAll(".sc-list a > .sc-meta").forEach((meta) => {
  const a = meta.parentElement;
  a.after(meta);
});

// Inject the row's hover actions (Dig deeper pill and 3-dot menu) on every
// list item. Both stay hidden until the row is hovered/focused.
document.querySelectorAll(".sc-list li").forEach(injectRowMenu);

// Tooltip pointing up at the submit arrow, shown after "Refine this search".
const refineTip = document.getElementById("refineTip");
const submitBtn = document.querySelector(".sc-submit");

function positionRefineTip() {
  if (!refineTip || refineTip.hidden || !submitBtn) return;
  const r = submitBtn.getBoundingClientRect();
  // Bubble sits 10px below the button, right-aligned so its caret points at
  // the button. Caret offset matches the button's centre.
  refineTip.style.visibility = "hidden";
  refineTip.style.left = "0";
  refineTip.style.top = "0";
  const tipWidth = refineTip.offsetWidth;
  const tipRight = Math.max(8, window.innerWidth - r.right - (r.width / 2 - 6));
  refineTip.style.left = "auto";
  refineTip.style.right = tipRight + "px";
  refineTip.style.top = (r.bottom + 10) + "px";
  // Caret position inside the tip — line it up with the button's horizontal centre.
  const caretFromRight = (r.left + r.width / 2) - (window.innerWidth - tipRight - tipWidth);
  // Express as offset from the tip's right edge so the ::before's `right` works.
  const caretRightOffset = tipWidth - caretFromRight - 6;
  refineTip.style.setProperty("--tip-caret-right", Math.max(8, caretRightOffset) + "px");
  refineTip.style.visibility = "visible";
}

function showRefineTip() {
  if (!refineTip) return;
  refineTip.hidden = false;
  positionRefineTip();
  // Restart the one-shot glow animation each time the tip is shown by
  // removing and re-adding the class on a fresh frame.
  refineTip.classList.remove("is-fresh");
  void refineTip.offsetWidth;
  refineTip.classList.add("is-fresh");
}

function hideRefineTip() {
  if (!refineTip) return;
  refineTip.hidden = true;
}

window.addEventListener("resize", positionRefineTip);
window.addEventListener("scroll", positionRefineTip, true);
// Dismiss when the user actually runs a search, presses Escape, or clicks
// somewhere outside the search input.
form.addEventListener("submit", hideRefineTip);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && refineTip && !refineTip.hidden) hideRefineTip();
});
// Any click anywhere (including the input itself) dismisses the tip.
document.addEventListener("mousedown", () => {
  if (refineTip && !refineTip.hidden) hideRefineTip();
});

// Row 3-dot menu: opens a small popup anchored under the clicked button.
const rowMenuPopup = document.getElementById("rowMenuPopup");
let activeRowMenuLi = null;

function showRowMenu(trigger, li) {
  activeRowMenuLi = li;
  rowMenuPopup.hidden = false;
  // Contextualise the "Remove" label: history rows are removed from the
  // prototype's saved history list, every other section just hides a
  // suggested row.
  const removeBtn = rowMenuPopup.querySelector('[data-row-action="remove"]');
  if (removeBtn) {
    // Both the visible history list and its "Show more" overflow sit inside
    // the section labelled "Search history", so a single closest() picks
    // either up regardless of which sublist the row is in.
    const inHistory = !!(li && li.closest('section[aria-label="Search history"]'));
    removeBtn.textContent = inHistory ? "Remove from prototype history" : "Remove suggestion";
  }
  const rect = trigger.getBoundingClientRect();
  rowMenuPopup.style.top = (rect.bottom + 4) + "px";
  rowMenuPopup.style.right = (window.innerWidth - rect.right) + "px";
  rowMenuPopup.style.left = "auto";
}

function hideRowMenu() {
  rowMenuPopup.hidden = true;
  activeRowMenuLi = null;
}

document.addEventListener("click", (e) => {
  const simulate = e.target.closest("[data-action='simulate-dnf']");
  if (simulate) {
    e.preventDefault();
    const base = (browser.runtime && browser.runtime.getURL)
      ? browser.runtime.getURL("sidebar/split-view.html")
      : "split-view.html";
    const p = new URLSearchParams({
      q: "taarget",
      left: "firefox-dnf",
      right: "google-didyoumean",
      domain: "taarget.com",
    });
    const url = base + "?" + p.toString();
    // Hand the navigation off to the background script so it can `await`
    // tabs.query and dodge replacing about:* pages (about:debugging in
    // particular) — closing the sidebar would otherwise kill its own JS
    // context mid-await. sidebarAction.close() still needs a live user
    // gesture, so it fires synchronously here.
    try { browser.runtime.sendMessage({ type: "navigate", url }); } catch (e) {}
    try { if (browser.sidebarAction && browser.sidebarAction.close) browser.sidebarAction.close(); } catch (e) {}
    return;
  }
  const dig = e.target.closest(".sc-row-dig");
  if (dig) {
    e.stopPropagation();
    e.preventDefault();
    const li = dig.closest("li");
    const a = li && li.querySelector("a");
    const q = a && a.dataset.q;
    if (q) {
      input.value = q;
      updateClearBtnVisibility();
      runSearch(q);
      openDigDeeper(q);
    }
    return;
  }
  const trigger = e.target.closest(".sc-row-menu");
  if (trigger) {
    e.stopPropagation();
    e.preventDefault();
    const li = trigger.closest("li");
    if (activeRowMenuLi === li && !rowMenuPopup.hidden) hideRowMenu();
    else showRowMenu(trigger, li);
    return;
  }
  if (!rowMenuPopup.hidden && !rowMenuPopup.contains(e.target)) hideRowMenu();
});

rowMenuPopup.addEventListener("click", (e) => {
  const action = e.target.closest("[data-row-action]");
  if (!action) return;
  const li = activeRowMenuLi;
  hideRowMenu();
  if (!li) return;
  const a = li.querySelector("a");
  const query = a && a.dataset.q;
  if (action.dataset.rowAction === "refine" && query) {
    input.value = query;
    updateClearBtnVisibility();
    input.focus();
    // Place caret at the end so the user can immediately tweak the query.
    const len = input.value.length;
    try { input.setSelectionRange(len, len); } catch (e) {}
    showRefineTip();
  } else if (action.dataset.rowAction === "remove") {
    li.remove();
    setupRovingTabindex();
  } else if (action.dataset.rowAction === "dig" && query) {
    openDigDeeper(query);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !rowMenuPopup.hidden) hideRowMenu();
});

window.addEventListener("scroll", hideRowMenu, true);

document.querySelectorAll(".sc-more").forEach((more) => { more.inert = true; });

document.querySelectorAll(".sc-show-more").forEach((btn) => {
  btn.addEventListener("click", () => {
    const more = btn.previousElementSibling;
    if (!more || !more.classList.contains("sc-more")) return;
    const open = more.classList.toggle("is-open");
    more.inert = !open;
    btn.textContent = open ? "Show less" : "Show more";
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
});

const stickyHead = document.querySelector(".sc-stickyhead");
function updateStickyOffset() {
  document.documentElement.style.setProperty("--sticky-header", stickyHead.offsetHeight + "px");
}
updateStickyOffset();
new ResizeObserver(updateStickyOffset).observe(stickyHead);

// Measure the Dig deeper sticky head (back button + query) so the section
// headings inside the dig panel can stack below it instead of colliding.
const digHead = document.querySelector("#tab-dig .sc-dig-page-head");
function updateDigHeadOffset() {
  if (!digHead) return;
  document.documentElement.style.setProperty("--dig-head-height", digHead.offsetHeight + "px");
}
if (digHead) {
  updateDigHeadOffset();
  new ResizeObserver(updateDigHeadOffset).observe(digHead);
}

function updateSuggestionRadius() {
  const sample = document.querySelector("#suggestionsList a") || document.querySelector(".sc-list a");
  if (!sample) return;
  const ul = sample.closest("ul");
  if (!ul) return;
  const li = document.createElement("li");
  const probe = sample.cloneNode(false);
  probe.textContent = "x";
  probe.style.whiteSpace = "nowrap";
  probe.style.visibility = "hidden";
  li.style.visibility = "hidden";
  li.appendChild(probe);
  ul.appendChild(li);
  const rowH = probe.getBoundingClientRect().height;
  ul.removeChild(li);
  if (rowH > 0) {
    document.documentElement.style.setProperty("--suggestion-radius", (rowH / 2) + "px");
    // Apply the same height to the skeleton row's link so a row of skeletons
    // is row-for-row identical with a row of real text suggestions.
    document.documentElement.style.setProperty("--skel-row-h", rowH + "px");
  }
}
updateSuggestionRadius();
new ResizeObserver(updateSuggestionRadius).observe(document.body);

// Roving tabindex per section: Tab moves between sections (one stop each),
// Up/Down cycles within the current section, skipping hidden (inert) items.
function sectionItems(section) {
  const items = [];
  section.querySelectorAll("a, .sc-show-more").forEach((el) => {
    let p = el.parentElement;
    while (p && p !== section) {
      if (p.inert) return;
      p = p.parentElement;
    }
    items.push(el);
  });
  return items;
}

function setupRovingTabindex() {
  document.querySelectorAll(".sc-content a, .sc-show-more").forEach((el) => {
    el.tabIndex = -1;
  });
  document.querySelectorAll(".sc-content:not([hidden]) .sc-section").forEach((section) => {
    const items = sectionItems(section);
    const first = items.find((el) => el.tagName === "A");
    if (first && first.tabIndex !== 0) first.tabIndex = 0;
  });
}

// Advanced search form: build a Google query from the structured fields and
// navigate the active tab. Mirrors what google.com/advanced_search does.
const advancedForm = document.getElementById("advancedForm");
const advancedEngineSelect = document.getElementById("advancedEngineSelect");

if (advancedEngineSelect) {
  // Populate from the same ENGINES list the main switcher uses; no icons.
  advancedEngineSelect.innerHTML = ENGINES
    .map((e) => `<option value="${escapeAttr(e.id)}">${escapeAttr(e.name)}</option>`)
    .join("");
  advancedEngineSelect.value = currentEngine.id;
  advancedEngineSelect.addEventListener("change", (e) => {
    // Routes through setEngine so the main switcher's pill, placeholder, and
    // currentEngine global all stay in sync.
    setEngine(e.target.value);
  });
}

if (advancedForm) {
  advancedForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(advancedForm);
    const all = (fd.get("all") || "").trim();
    const exact = (fd.get("exact") || "").trim();
    const any = (fd.get("any") || "").trim();
    const none = (fd.get("none") || "").trim();
    const site = (fd.get("site") || "").trim();
    const where = fd.get("where") || "";
    const filetype = fd.get("filetype") || "";
    const time = fd.get("time") || "";
    const region = fd.get("region") || "";
    const lang = fd.get("lang") || "";
    const safe = fd.get("safe");

    const parts = [];
    let mainTerms = all;
    if (where && mainTerms) {
      mainTerms = mainTerms.split(/\s+/).filter(Boolean).map((w) => `${where}:${w}`).join(" ");
    }
    if (mainTerms) parts.push(mainTerms);
    if (exact) parts.push(`"${exact}"`);
    if (any) {
      const words = any.split(/\s+/).filter(Boolean);
      if (words.length) parts.push("(" + words.join(" OR ") + ")");
    }
    if (none) {
      none.split(/\s+/).filter(Boolean).forEach((w) => parts.push(`-${w}`));
    }
    if (site) parts.push(`site:${site}`);
    if (filetype) parts.push(`filetype:${filetype}`);

    const q = parts.join(" ").trim();
    if (!q) return;

    if (currentEngine.id === "google") {
      // Keep the Google-specific richer params (region, language, recency,
      // safe-search) since those only round-trip through Google.
      const params = new URLSearchParams({ client: "firefox-b-d", q });
      if (time) params.set("tbs", `qdr:${time}`);
      if (region) params.set("cr", region);
      if (lang) params.set("lr", lang);
      if (safe) params.set("safe", "active");
      navigate("https://www.google.com/search?" + params.toString());
    } else {
      // Other engines don't accept Google's filter params — pass the built
      // query string through whichever engine the user selected.
      navigate(currentEngine.url(q));
    }
  });
}

setupRovingTabindex();

tabs.forEach((tab) => tab.addEventListener("click", () => setTimeout(setupRovingTabindex, 0)));
document.querySelectorAll(".sc-show-more").forEach((btn) => {
  btn.addEventListener("click", () => setTimeout(setupRovingTabindex, 0));
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const focused = document.activeElement;
  if (!focused) return;
  const section = focused.closest(".sc-section");
  if (!section || !section.closest(".sc-content")) return;
  const items = sectionItems(section);
  const i = items.indexOf(focused);
  if (i === -1) return;
  e.preventDefault();
  const len = items.length;
  const next = e.key === "ArrowDown" ? (i + 1) % len : (i - 1 + len) % len;
  items.forEach((el) => { el.tabIndex = -1; });
  items[next].tabIndex = 0;
  items[next].focus();
});

syncFromActiveTab();
