import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";
import * as cheerio from "cheerio";
import { ProxyAgent } from "undici";

// ─── Built-in proxy browser backend ──────────────────────────────────────────
// Fetches a target URL server-side through the configured residential proxy,
// rewrites links/assets so they keep flowing through this endpoint, and strips
// framing/CSP headers so the result renders inside our <iframe>.

let pool: ProxyAgent[] | undefined;
let cursor = 0;
let uaCursor = 0;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function nextUA(): string {
  const ua = USER_AGENTS[uaCursor % USER_AGENTS.length];
  uaCursor++;
  return ua;
}

function buildPool(): ProxyAgent[] {
  if (pool) return pool;
  const raw = process.env.PROXY_LIST || "";
  const agents: ProxyAgent[] = [];
  for (const entry of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [host, port, user, pass] = entry.split(":");
    if (!host || !port) continue;
    const auth = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : "";
    try {
      agents.push(new ProxyAgent(`http://${auth}${host}:${port}`));
    } catch { /* skip */ }
  }
  if (agents.length === 0 && process.env.PROXY_URL) {
    try { agents.push(new ProxyAgent(process.env.PROXY_URL)); } catch { /* ignore */ }
  }
  pool = agents;
  return pool;
}

function pickAgents(max = 3): ProxyAgent[] {
  const p = buildPool();
  if (p.length === 0) return [];
  const out: ProxyAgent[] = [];
  for (let i = 0; i < Math.min(max, p.length); i++) {
    out.push(p[(cursor + i) % p.length]);
  }
  cursor = (cursor + 1) % p.length;
  return out;
}

const SELF = "/api/proxy?url=";

function proxied(target: string): string {
  return SELF + encodeURIComponent(target);
}

function absolute(value: string, base: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("data:") || v.startsWith("blob:") || v.startsWith("javascript:") || v.startsWith("mailto:") || v.startsWith("tel:") || v.startsWith("#")) return null;
  try { return new URL(v, base).toString(); } catch { return null; }
}

function rewriteCss(css: string, base: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, raw) => {
    const abs = absolute(raw, base);
    return abs ? `url(${q}${proxied(abs)}${q})` : m;
  });
}

function rewriteSrcset(value: string, base: string): string {
  return value.split(",").map((part) => {
    const seg = part.trim();
    if (!seg) return seg;
    const [u, ...desc] = seg.split(/\s+/);
    const abs = absolute(u, base);
    return abs ? [proxied(abs), ...desc].join(" ") : seg;
  }).join(", ");
}

function rewriteHtml(html: string, base: string): string {
  const $ = cheerio.load(html);
  $("base").remove();
  $('meta[http-equiv="Content-Security-Policy"]').remove();
  $('meta[http-equiv="content-security-policy"]').remove();
  $("[integrity]").removeAttr("integrity");

  const attrTargets: [string, string][] = [
    ["a", "href"], ["link", "href"], ["img", "src"], ["script", "src"],
    ["iframe", "src"], ["source", "src"], ["video", "src"], ["audio", "src"],
    ["embed", "src"], ["track", "src"], ["form", "action"], ["video", "poster"],
  ];

  for (const [sel, attr] of attrTargets) {
    $(sel).each((_, el) => {
      const value = $(el).attr(attr);
      if (!value) return;
      const abs = absolute(value, base);
      if (abs) $(el).attr(attr, proxied(abs));
    });
  }

  $("[srcset]").each((_, el) => {
    const value = $(el).attr("srcset");
    if (value) $(el).attr("srcset", rewriteSrcset(value, base));
  });

  $("[style]").each((_, el) => {
    const value = $(el).attr("style");
    if (value && value.includes("url(")) $(el).attr("style", rewriteCss(value, base));
  });

  $("style").each((_, el) => {
    const css = $(el).html();
    if (css && css.includes("url(")) $(el).html(rewriteCss(css, base));
  });

  $('a[target="_blank"]').removeAttr("target");
  return $.html();
}

// Hosts known to block proxies with Cloudflare/anti-bot — give a helpful message early.
const KNOWN_BLOCKED = [
  "cloudflare.com", "discord.com", "reddit.com", "twitter.com", "x.com",
  "instagram.com", "facebook.com", "tiktok.com", "youtube.com",
];

function isProbablyBlocked(hostname: string): boolean {
  return KNOWN_BLOCKED.some((b) => hostname.includes(b));
}

export const Route = createFileRoute("/api/proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const target = reqUrl.searchParams.get("url");
        if (!target) {
          return new Response(JSON.stringify({ error: "Missing ?url=" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        let targetUrl: URL;
        try {
          targetUrl = new URL(target);
          if (!/^https?:$/.test(targetUrl.protocol)) throw new Error("bad protocol");
        } catch {
          return new Response(JSON.stringify({ error: "Invalid URL" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        // Warn about known blocked sites early.
        if (isProbablyBlocked(targetUrl.hostname)) {
          const html = `<!doctype html><html><body style="font-family:system-ui;background:#0a0a0f;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:2rem"><div><h2>⚠️ This site may not load</h2><p style="color:#94a3b8;max-width:400px;line-height:1.5">${targetUrl.hostname} uses strong anti-bot protection that blocks proxy browsers. Try opening it directly.</p><p style="color:#64748b;font-size:13px;margin-top:1rem">Attempting anyway...</p></div></body></html>`;
          // Don't return yet — try anyway in case we're wrong.
        }

        try {
          const agents = pickAgents(3);
          const candidates: (ProxyAgent | undefined)[] = agents.length ? agents : [undefined];
          let upstream: Response | undefined;
          let lastErr: unknown;

          for (const ag of candidates) {
            try {
              const timeout = isProbablyBlocked(targetUrl.hostname) ? 15000 : 20000;
              upstream = await fetch(targetUrl.toString(), {
                dispatcher: ag,
                redirect: "follow",
                headers: {
                  "User-Agent": nextUA(),
                  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                  "Accept-Language": "en-US,en;q=0.9",
                  "Cache-Control": "no-cache",
                },
                signal: AbortSignal.timeout(timeout),
              } as RequestInit & { dispatcher?: ProxyAgent });
              break;
            } catch (err) {
              lastErr = err;
            }
          }
          if (!upstream) throw lastErr ?? new Error("All proxies failed");

          const contentType = upstream.headers.get("content-type") || "";
          const baseUrl = upstream.url || targetUrl.toString();
          const outHeaders: Record<string, string> = { "Access-Control-Allow-Origin": "*" };

          if (contentType.includes("text/html")) {
            const html = await upstream.text();
            if (html.includes("cf-browser-verification") || html.includes("__cf_challenge") || html.includes("just a moment")) {
              return new Response(
                `<!doctype html><html><body style="font-family:system-ui;background:#0a0a0f;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:2rem"><div><h2>🛡️ Blocked by Cloudflare</h2><p style="color:#94a3b8;max-width:400px;line-height:1.5">${targetUrl.hostname} requires a browser challenge that this proxy cannot complete. Try visiting the site directly.</p><p style="color:#64748b;font-size:13px;margin-top:0.5rem">${targetUrl.toString()}</p></div></body></html>`,
                { status: 403, headers: { ...outHeaders, "Content-Type": "text/html; charset=utf-8" } },
              );
            }
            const rewritten = rewriteHtml(html, baseUrl);
            return new Response(rewritten, {
              status: upstream.status,
              headers: { ...outHeaders, "Content-Type": "text/html; charset=utf-8" },
            });
          }

          if (contentType.includes("text/css")) {
            const css = await upstream.text();
            return new Response(rewriteCss(css, baseUrl), {
              status: upstream.status,
              headers: { ...outHeaders, "Content-Type": "text/css; charset=utf-8" },
            });
          }

          if (contentType.startsWith("image/")) {
            const buf = await upstream.arrayBuffer();
            return new Response(buf, {
              status: upstream.status,
              headers: { ...outHeaders, "Content-Type": contentType, "Cache-Control": "public, max-age=86400" },
            });
          }

          const buf = await upstream.arrayBuffer();
          return new Response(buf, {
            status: upstream.status,
            headers: { ...outHeaders, "Content-Type": contentType || "application/octet-stream", "Cache-Control": "public, max-age=300" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const isTimeout = msg.includes("timed out") || msg.includes("aborted") || msg.includes("Timeout");
          const title = isTimeout ? "⏱️ Request timed out" : "Couldn't load this page";
          return new Response(
            `<!doctype html><html><body style="font-family:system-ui;background:#0a0a0f;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:2rem"><div><h2>${title}</h2><p style="color:#94a3b8;max-width:500px;line-height:1.5">${isTimeout ? "The site took too long to respond. It may be blocked, slow, or requires a browser." : msg}</p><p style="color:#64748b;font-size:13px;word-break:break-all;margin-top:0.5rem">${targetUrl.toString()}</p><p style="margin-top:1.5rem"><a href="${targetUrl.toString()}" target="_blank" style="color:#818cf8;text-decoration:underline;font-size:14px">Open directly →</a></p></div></body></html>`,
            { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      },
    },
  },
});
