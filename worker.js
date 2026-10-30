/**
 * RustikOP — basic Cloudflare Worker proxy
 *
 * Deploy:
 *  1. dash.cloudflare.com → Workers & Pages → Create
 *  2. Paste this file → Deploy
 *  3. Copy URL (https://NAME.ACCOUNT.workers.dev)
 *  4. Set it in RustikOP (proxy dropdown / localStorage key rustikop_cf)
 *
 * Or: npx wrangler deploy worker.js --name rustikop-proxy
 */

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response(
        "RustikOP Cloudflare proxy\nUsage: /?url=https//:supercool.unsamulige75.workers.dev\n",
        { status: 200, headers: { "content-type": "text/plain", ...cors } }
      );
    }

    let dest;
    try {
      dest = new URL(target);
    } catch {
      return new Response("Invalid url", { status: 400, headers: cors });
    }
    if (dest.protocol !== "http:" && dest.protocol !== "https:") {
      return new Response("Only http/https", { status: 400, headers: cors });
    }

    let upstream;
    try {
      upstream = await fetch(dest.href, {
        method: "GET",
        headers: {
          "user-agent": request.headers.get("user-agent") || "Mozilla/5.0",
          accept: request.headers.get("accept") || "*/*",
        },
        redirect: "follow",
      });
    } catch (e) {
      return new Response("Fetch failed: " + e.message, {
        status: 502,
        headers: { "content-type": "text/plain", ...cors },
      });
    }

    const ctype = (upstream.headers.get("content-type") || "").toLowerCase();
    const out = {
      ...cors,
      "cache-control": "no-store",
      "content-type": ctype || "application/octet-stream",
    };

    if (ctype.includes("text/html")) {
      let html = await upstream.text();
      const base = dest.href;
      const workerOrigin = url.origin;

      if (!/<base\s/i.test(html)) {
        html = html.replace(
          /<head([^>]*)>/i,
          (m) => m + "\n<base href=\"" + base.replace(/"/g, "&quot;") + "\">"
        );
      }

      html = html.replace(
        /\b(href|src|action)=(["'])([^"']+)\2/gi,
        (full, attr, q, val) => {
          if (!val || /^(data:|javascript:|mailto:|#|blob:)/i.test(val)) return full;
          try {
            const abs = new URL(val, base).href;
            if (!/^https?:/i.test(abs)) return full;
            return (
              attr +
              "=" +
              q +
              workerOrigin +
              "/?url=" +
              encodeURIComponent(abs) +
              q
            );
          } catch {
            return full;
          }
        }
      );

      out["content-type"] = "text/html; charset=utf-8";
      return new Response(html, { status: upstream.status, headers: out });
    }

    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
