// Stub the `browser.*` API when running outside a Firefox extension (e.g. file://
// preview, plain browser). Lets the rest of the script run for layout/UX work.
if (typeof browser === "undefined") {
  window.browser = {
    tabs: {
      update: () => {},
      create: ({ url }) => { window.open(url, "_blank"); return Promise.resolve({ id: -1 }); },
      query: () => Promise.resolve([]),
    },
    windows: { update: () => {} },
    runtime: {
      sendMessage: () => Promise.resolve(null),
      onMessage: { addListener: () => {} },
    },
  };
}

const input = document.getElementById("searchInput");
const form = document.getElementById("searchForm");
const panels = document.querySelectorAll(".sc-content");
const tabs = document.querySelectorAll(".sc-tab");

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
    icon: `<svg viewBox="0 0 35 50"><path fill="#0078D4" d="M0 0v44.4L10 50l25-14.38V24.25l-22.18-7.76 4.34 10.82 6.92 3.22L10 38.64V3.5z"/></svg>`,
  },
  {
    id: "ddg",
    name: "DuckDuckGo",
    placeholder: "Search with DuckDuckGo",
    url: (q) => "https://duckduckgo.com/?q=" + encodeURIComponent(q),
    icon: `<svg viewBox="0 0 24 24"><path fill="#DE5833" d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 1.92c5.566 0 10.078 4.512 10.078 10.078 0 4.783-3.333 8.788-7.803 9.82-.19-.416-.421-.938-.613-1.388-.32.099-.777.146-1.103.158-.248 0-.448-.013-.553-.158-.636.542-1.919 1.264-2.176 1.095-.489-.315-.949-2.74-.582-3.248.082-.116.233-.174.42-.191-.175.718.232 2.489.459 2.67.222.174 1.81-.769 1.74-.99-.14-.467-.14-.887-.123-1.149.064-.088.263-.223.397-.281a.857.857 0 0 0-.012.216c0 .275.033.746.103.95.094.25.194.414.637.408.449-.006 1.172-.104 1.284-.303.11-.197-.037-1.003-.13-1.26l-.052-.12c-.006-.012-.012-.024-.018-.03h.156c.234.052.434.15.493 1.225 0 .215 1.51.628 1.783.511.023-.011.036-.023.04-.035.13-.658.053-2.296-.53-2.99-.117-.14-1.313.618-2.03 1.154-.151-.163-.42-.257-.926-.175-.047.006-.093.016-.134.025l-.088.016c-.251-.816-.396-1.534-.338-2-.56-.298-.934-.642-1.004-.776-.122-.222.083-.326.188-.267.012.005.024.011.035.017.589.321 1.533.67 2.816.735.152.005.31.011.467.011 2.07-.017 3.276-.822 3.066-1.224-.099-.187-.529-.139-1.172-.069-.72.081-1.708.191-2.798.034-1.528-.222-1.679-.922-1.487-1.22.294-.449.844-.425 1.633-.39.416.018.899.038 1.445-.006 1.581-.127 2.478-.57 2.974-1.137.262-.297.38-.617.28-.81-.093-.169-.355-.233-1.101.053a9.607 9.607 0 0 1-2.346.576c.181-1.16-.36-5.363-3.328-5.998-.012-.006-.024-.012-.035-.023-.904-1.156-2.741-1.681-4.49-1.448-.012 0-.018.006-.024.012-.053.024-.053.122.006.144.21.07.392.166.607.336-.25.132-.617.353-.822.639-.011.012-.011.024-.011.035 0 .035.029.063.07.058.851-.169 1.719-.087 2.234.38.034.029.017.082-.03.093-4.444 1.207-3.564 5.072-2.38 9.813.825 3.299 1.364 5.231 1.6 6.052-3.982-1.345-6.85-5.113-6.85-9.55C1.922 6.434 6.434 1.922 12 1.922zm1.79 5.646c.328.001.66.058.987.144.029.006.04-.029.011-.046-.408-.227-1.39-.267-1.838.052-.046.029-.046.105.012.099.21-.06.482-.116.795-.116l.034-.133zm.6.526c-.595.004-1.11.182-1.318.461-.046.058-.011.105.046.064.245-.181.689-.286 1.155-.298.467-.012 1.04.105 1.488.351.082.052.146.012.064-.058-.397-.345-.864-.524-1.435-.52zm.169.93c.245-.006.47.046.66.151.012.018.024.018.035.012.041-.018.07-.064.046-.11-.122-.234-.594-.379-1.108-.292-.484.082-.84.351-.875.53-.005.04.018.063.04.04.21-.146.502-.262.892-.297a.69.69 0 0 1 .31-.034zm-1.732.012c-.526.018-.957.272-1.011.52-.012.04.029.064.058.029.21-.181.589-.31 1.014-.345.308-.029.566 0 .735.046.029.012.046-.018.034-.04-.121-.117-.45-.222-.83-.21z"/></svg>`,
  },
  {
    id: "amazon",
    name: "Amazon",
    placeholder: "Search Amazon",
    url: (q) => "https://www.amazon.com/s?k=" + encodeURIComponent(q),
    icon: `<svg viewBox="0 0 256 260"><path fill="#000" d="M150.74 108.13c0 13.14.34 24.1-6.31 35.77-5.36 9.49-13.85 15.32-23.34 15.32-12.95 0-20.5-9.87-20.5-24.43 0-28.75 25.76-33.97 50.15-33.97zm34.02 82.22c-2.23 1.99-5.46 2.13-7.97.8-11.2-9.3-13.19-13.61-19.36-22.49-18.5 18.88-31.6 24.53-55.6 24.53-28.37 0-50.48-17.5-50.48-52.57 0-27.37 14.85-46.02 35.96-55.13 18.31-8.06 43.88-9.49 63.43-11.72v-4.36c0-8.02.62-17.51-4.08-24.43-4.13-6.22-12-8.78-18.93-8.78-12.86 0-24.34 6.59-27.14 20.26-.57 3.04-2.8 6.03-5.83 6.17l-32.74-3.51c-2.75-.62-5.79-2.85-5.03-7.07C64.53 12.4 100.34.44 132.42.44c16.42 0 37.86 4.37 50.81 16.8 16.42 15.32 14.85 35.77 14.85 58.02v52.57c0 15.8 6.55 22.72 12.71 31.26 2.18 3.04 2.66 6.69-.09 8.97-6.88 5.74-19.12 16.42-25.86 22.4l-.09-.1"/><path fill="#f90" d="M221.5 210.32c-105.23 50.08-170.54 8.18-212.35-17.27-2.59-1.6-6.98.38-3.17 4.76 13.93 16.89 59.57 57.59 119.15 57.59 59.62 0 95.09-32.53 99.53-38.21 4.41-5.63 1.29-8.73-3.16-6.87zm29.56-16.32c-2.83-3.68-17.18-4.37-26.22-3.26-9.05 1.08-22.63 6.61-21.45 9.93.6 1.24 1.84.69 8.06.13 6.23-.62 23.7-2.83 27.34 1.93 3.66 4.79-5.57 27.61-7.26 31.29-1.63 3.68.62 4.63 3.68 2.18 3.02-2.45 8.48-8.8 12.14-17.78 3.64-9.03 5.86-21.62 3.71-24.42z"/></svg>`,
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    placeholder: "Search Wikipedia",
    url: (q) => "https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(q),
    icon: `<svg viewBox="0 0 24 24"><path fill="#202122" d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z"/></svg>`,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    placeholder: "Ask Perplexity",
    url: (q) => "https://www.perplexity.ai/?q=" + encodeURIComponent(q),
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
  multiBtn.textContent = `Run ${n} ${n === 1 ? "search" : "searches"}`;
  multiBtn.disabled = n === 0;
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

function runSearch(q) {
  const query = (q || "").trim();
  if (!query) return;
  navigate(currentEngine.url(query));
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch(input.value);
});

content.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  e.preventDefault();
  if (a.dataset.q) {
    input.value = a.dataset.q;
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

function loadSummary(query) {
  showSummarySkeleton();
  setTimeout(() => typeSummary(summaryFor(query)), 900);
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

function openDigDeeper(query) {
  digCurrentQuery = query;
  digQueryEl.textContent = query;
  digPanel.querySelectorAll(".dig-q-inline").forEach((el) => { el.textContent = query; });
  const all = similarFor(query);
  const visible = all.slice(0, 3);
  const hidden = all.slice(3);
  const renderItem = (q) => `<li><a href="#" data-q="${escapeAttr(q)}">${escapeAttr(q)}</a></li>`;
  digSimilarList.innerHTML = visible.map(renderItem).join("");
  digSimilarMoreList.innerHTML = hidden.map(renderItem).join("");
  digSimilarMore.classList.remove("is-open");
  digSimilarMore.inert = true;
  digSimilarShowMore.hidden = hidden.length === 0;
  digSimilarShowMore.textContent = "Show more";
  digSimilarShowMore.setAttribute("aria-expanded", "false");
  digSimilarList.querySelectorAll("li").forEach(injectRowMenu);
  digSimilarMoreList.querySelectorAll("li").forEach(injectRowMenu);
  tabCurrentPanel.hidden = true;
  digPanel.hidden = false;
  digPanel.scrollTop = 0;
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
    if (res && res.query) input.value = res.query;
  } catch (e) { /* background not ready */ }
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "search-context" && typeof msg.query === "string") {
    input.value = msg.query;
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

// Row 3-dot menu: opens a small popup anchored under the clicked button.
const rowMenuPopup = document.getElementById("rowMenuPopup");
let activeRowMenuLi = null;

function showRowMenu(trigger, li) {
  activeRowMenuLi = li;
  rowMenuPopup.hidden = false;
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
  const dig = e.target.closest(".sc-row-dig");
  if (dig) {
    e.stopPropagation();
    e.preventDefault();
    const li = dig.closest("li");
    const a = li && li.querySelector("a");
    const q = a && a.dataset.q;
    if (q) {
      input.value = q;
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
  if (action.dataset.rowAction === "remove") {
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

function updateSuggestionRadius() {
  const sample = document.querySelector("#suggestionsList a");
  if (!sample) return;
  const ul = sample.parentNode.parentNode;
  const li = document.createElement("li");
  const probe = sample.cloneNode(false);
  probe.textContent = "x";
  probe.style.whiteSpace = "nowrap";
  probe.style.visibility = "hidden";
  li.style.visibility = "hidden";
  li.appendChild(probe);
  ul.appendChild(li);
  const h = probe.getBoundingClientRect().height;
  ul.removeChild(li);
  if (h > 0) {
    document.documentElement.style.setProperty("--suggestion-radius", (h / 2) + "px");
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

    const params = new URLSearchParams({ client: "firefox-b-d", q });
    if (time) params.set("tbs", `qdr:${time}`);
    if (region) params.set("cr", region);
    if (lang) params.set("lr", lang);
    if (safe) params.set("safe", "active");

    navigate("https://www.google.com/search?" + params.toString());
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
