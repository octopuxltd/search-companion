const GOOGLE_SEARCH_RE = /^https?:\/\/(www\.)?google\.[a-z.]+\/search\b/i;

function isGoogleSearch(url) {
  return typeof url === "string" && GOOGLE_SEARCH_RE.test(url);
}

async function handleTab(tabId, url) {
  if (!isGoogleSearch(url)) return;
  try {
    await browser.sidebarAction.open();
  } catch (e) {
    // Firefox requires a user gesture to open the sidebar programmatically.
    // The sidebar is still available via the toolbar; its content updates on navigation.
  }
  try {
    const query = new URL(url).searchParams.get("q") || "";
    await browser.runtime.sendMessage({ type: "search-context", query, url, tabId });
  } catch (e) {
    // No sidebar listener yet — it will pick up state on open via getCurrentQuery.
  }
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
    if (tab && isGoogleSearch(tab.url)) {
      return { query: new URL(tab.url).searchParams.get("q") || "", url: tab.url };
    }
    return { query: "", url: tab ? tab.url : "" };
  }
});
