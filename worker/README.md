# Search Sidebar AI Worker

Cloudflare Worker that proxies the extension to OpenRouter so the API key
stays server-side.

## One-time deploy

From this folder (`worker/`):

```
cd /Users/paul.annett/schemes/github/search-companion/worker
npm install -g wrangler
wrangler login
wrangler secret put OPENROUTER_API_KEY
# (paste your OpenRouter key when prompted, then Enter)
wrangler deploy
```

The final `wrangler deploy` prints a URL like
`https://search-sidebar-ai.<your-subdomain>.workers.dev`. Copy it and paste it
into `sidebar/ai.js` as `WORKER_URL`, then reload the extension.

## Updating later

After editing `worker.js`:

```
cd /Users/paul.annett/schemes/github/search-companion/worker
wrangler deploy
```

## Changing the OpenRouter key

```
cd /Users/paul.annett/schemes/github/search-companion/worker
wrangler secret put OPENROUTER_API_KEY
```
