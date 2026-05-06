# Search Sidebar

A Firefox sidebar that opens alongside Google search results.

## Project priority

The primary goal of the sidebar is to **get users to run further searches.**
When designing or ordering UI, features that directly drive new searches take
priority over features that summarise or save state.

Priority order, highest first:

1. Similar / suggested searches (one click → new query)
2. Cross-engine and multi-source searches (open the same query in many places)
3. Re-runs with different filters (time, region, file type)
4. Variant searches (images, news, video, scholar)
5. Save / comparison / research state (defers more searching to later)
6. Answer-style features (AI summaries) — these can satisfy intent and
   *reduce* further searching, so they sit lowest.

Apply this lens whenever ordering features, deciding visual prominence, or
choosing what to show first on a new page like Dig Deeper.

## Source layout

- `manifest.json` — Firefox extension manifest (MV2, unlisted).
- `sidebar/sidebar.html` — single-file UI: HTML, CSS, and JS all inlined so
  the file://-based preview and AMO-bundled extension share one source of
  truth.
- `background.js` — opens the sidebar on Google search pages (subject to
  Firefox's user-gesture limit) and syncs the active query to the sidebar.
- `images/search-icon.svg` — extension icon and toolbar/sidebar action icon.
- `index.html` + `update.json` + `*.xpi` at the repo root — GitHub Pages
  install page and unlisted auto-update feed.

## Tooling

- `npx web-ext run --source-dir=.` — launch a Firefox dev profile with the
  extension loaded.
- `npx web-ext lint --source-dir=. --ignore-files docs/** README.md
  web-ext-artifacts/**` — validate the manifest. The `MANIFEST_UPDATE_URL`
  error is expected for unlisted distribution.
- `npx web-ext build --source-dir=. --overwrite-dest --ignore-files docs/**
  README.md web-ext-artifacts/**` — produce the zip for AMO upload.
- `.claude/launch.json` defines a `Live-reload server` config that serves
  `sidebar/` at http://localhost:8081 with WebSocket auto-refresh.
