/**
 * RustikOP proxy — real fetch + HTML rewrite + iframe-friendly headers
 * Deploy to: supercool.unsamulige75.workers.dev
 *
 * Cloudflare Dashboard → Workers → supercool → Edit code → paste → Save & Deploy
 * Or: npx wrangler deploy
 */
export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
      "Access-Control-Allow-Headers": "*",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response(
        "RustikOP Cloudflare Proxy\n\nUsage: /?url=https://example.com\n",
        { status: 200, headers: { "content-type": "text/plain; charset=utf-8", ...cors } }
      );
    }

    let dest;
    try {
      dest = new URL(target);
    } catch {
      return new Response("Invalid url", { status: 400, headers: cors });
    }
    if (dest.protocol !== "http:" && dest.protocol !== "https:") {
      return new Response("Only http/https allowed", { status: 400, headers: cors });
    }

    let upstream;
    try {
      upstream = await fetch(dest.href, {
        method: "GET",
        headers: {
          "user-agent":
            request.headers.get("user-agent") ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept:
            request.headers.get("accept") ||
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
    } catch (e) {
      return new Response("Upstream fetch failed: " + e.message, {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8", ...cors },
      });
    }

    const ctype = (upstream.headers.get("content-type") || "").toLowerCase();
    const out = {
      ...cors,
      "cache-control": "no-store",
      "content-security-policy": "frame-ancestors *",
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

    if (ctype) out["content-type"] = ctype;
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
