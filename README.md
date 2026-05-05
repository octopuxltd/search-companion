# Search companion

A Firefox sidebar that opens alongside Google search results.

**Install:** https://octopuxltd.github.io/search-companion/

## Develop

```bash
npx web-ext run --source-dir=.       # launch a Firefox dev profile with the extension
npx web-ext lint --source-dir=.      # validate manifest
npx web-ext build --source-dir=. --overwrite-dest   # build .zip for AMO
```

## Release

1. Bump `version` in [`manifest.json`](manifest.json).
2. `npx web-ext build --source-dir=. --overwrite-dest`
3. Upload the zip to AMO (unlisted) for signing: https://addons.mozilla.org/developers/addon/submit/distribution
4. Download the signed `.xpi`, drop it in `docs/` as `search-companion-<version>.xpi`.
5. Update the install link/version in [`docs/index.html`](docs/index.html).
6. Add a new entry at the **top** of the `updates` array in [`docs/update.json`](docs/update.json):
   ```json
   { "version": "<new>", "update_link": "https://octopuxltd.github.io/search-companion/search-companion-<new>.xpi" }
   ```
7. Commit and push — GitHub Pages serves it; existing installs auto-update within ~24h (or via Firefox's "Check for Updates" menu).
