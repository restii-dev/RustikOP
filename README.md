# RustikOP

Hub + **basic Cloudflare Worker** proxy.

## Live
https://restii-dev.github.io/RustikOP/

## Proxy setup (Cloudflare)

1. Open [Cloudflare Dashboard → Workers](https://dash.cloudflare.com/)
2. **Create Worker**
3. Paste `worker.js` from this repo
4. **Deploy**
5. Copy the URL, e.g. `https://rustikop-proxy.yourname.workers.dev`
6. Open RustikOP → paste that URL under the search bar → leave proxy on **Cloudflare Worker**

CLI:

```bash
npx wrangler deploy worker.js --name rustikop-proxy
```

## How it works

```
RustikOP → https://YOUR_WORKER/?url=https://example.com → site
```

Worker fetches the page, rewrites `href`/`src`/`action` so clicks stay on the worker.

## Notes

- RustikViewing is no longer used.
- Free Workers tier is enough for light use.
- Heavy sites (Discord, full YouTube app) may still break — this is a basic HTML proxy.
