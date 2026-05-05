const input = document.getElementById("searchInput");
const form = document.getElementById("searchForm");
const panels = document.querySelectorAll(".sc-content");
const tabs = document.querySelectorAll(".sc-tab");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach((t) => {
      const active = t.dataset.tab === target;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((p) => {
      p.hidden = p.id !== "tab-" + target;
    });
  });
});

const content = document.body;

function runSearch(q) {
  const query = (q || "").trim();
  if (!query) return;
  const url = "https://www.google.com/search?q=" + encodeURIComponent(query);
  browser.tabs.update({ url });
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
  if (href && href !== "#") browser.tabs.update({ url: href });
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

syncFromActiveTab();
input.focus();
