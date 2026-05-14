# SPA navigation: notes for whoever picks this up next

The symptom: on YouTube (and other SPA sites that use `history.pushState`),
clicking from one video to another leaves the sidebar's three panels (page
suggestions, search-history Related, From-Firefox Related) showing content
about the *previous* video for 1–10 seconds, then catching up.

A week's worth of attempts on top of 9bbe106 — commits 0151350, d2b4ddf,
433ffbf, afeaea5, 4aee521, 15f843d, 55d00ff — all failed. They live in git
history if you want to read the dead ends, but **don't start there.** They
were band-aids stacked on a wrong mental model.

## Why the previous approach was wrong

I tried to detect SPA navigation by watching `document.title` in a
`MutationObserver` inside the content script, sending a `page-context`
message whenever the title changed AND `location.href` differed from a
remembered `lastUrl`.

The problem: YouTube updates `document.title` for **multiple reasons**, not
just navigation. The autoplay countdown changes the title to the next
video's title while the user is still watching the current one. The
MutationObserver fires, but it isn't a navigation event — the URL hasn't
actually changed yet. I spent days trying to distinguish "real" title
changes from spurious ones by guessing at title/URL ordering, popstate
behaviour, and `tabId`-vs-no-`tabId` message provenance. None of it stuck
because the signal source was fundamentally noisy.

## The right starting point

**Use `browser.webNavigation.onHistoryStateUpdated`.** This is the Firefox
API designed for exactly this case — it fires in the background script the
moment a frame calls `history.pushState()` or `replaceState()`, with the
new URL. No title-watching, no race with content scripts, no JS-world
isolation issues.

Sketch:

```js
// background.js
browser.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;            // top frame only
  if (!isContentPage(details.url)) return;
  // Wait briefly for YouTube to finish swapping DOM/title, then ask the
  // content script for the new context.
  setTimeout(() => handleTab(details.tabId, details.url), 250);
});
```

Add `"webNavigation"` to `manifest.json` permissions. That's the whole
new permission cost.

The settle delay (250–400ms) matters: `onHistoryStateUpdated` fires *as*
pushState runs, but YouTube updates `document.title` and the page body
asynchronously a few hundred ms later. Pick the delay empirically.

## Before writing code: instrument first

The single biggest mistake last time was patching the sidebar before I had
a reliable trace of what YouTube actually does. Before any fix, add these
logs:

1. In **background.js**, log every `tabs.onUpdated` event with the full
   `changeInfo` object (not just `url`/`status`), plus every
   `webNavigation.onHistoryStateUpdated` and `onCommitted` event with full
   `details`.
2. In **page-context.js**, intercept `history.pushState`/`replaceState` by
   injecting a script into the **page's** JS world (content scripts can't
   patch `history.*` directly because of world isolation — but you can
   inject a `<script>` tag whose code runs in the page world and posts
   `window.postMessage` back to the content script). Log every call.
3. Log every `popstate` event and every `document.title` mutation with
   timestamps so the sequence is visible.

Then click through 3–4 YouTube videos and read the trace. You'll see:
* `pushState` fires immediately on click.
* `document.title` changes 1–3 times over the next ~500ms.
* `tabs.onUpdated` with `status: "complete"` may take 1–10s depending on
  network/cache.

Once that's grounded, the fix path above should be obvious — and you'll be
able to verify it works without guessing.

## What NOT to do

* Don't keep adding dedup logic to `setSuggestionsActive` in the sidebar.
  The sidebar is downstream; if the wrong message arrives, you've already
  lost. Fix the message source.
* Don't try to distinguish authoritative vs speculative messages by
  message-shape tricks (`tabId` present, etc.). That's a symptom of a
  bad data source.
* Don't trust `document.title` as a navigation signal. It's a render
  artefact, not a navigation event.
* Don't ship a "fix" until you've validated it with the instrumented
  trace described above. Last time, every attempted fix *looked* right in
  the logs because I wasn't logging the right things.

## Scope

This affects any SPA, not just YouTube — Twitter/X, Reddit's new UI,
GitHub's PR-tab switcher, Notion, etc. all use pushState. `webNavigation`
catches them all uniformly.
