import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// Keep the process alive when a stray error escapes a request handler. Without
// this, a single unhandled rejection / uncaught exception (e.g. an aborted SSR
// stream, a flaky upstream fetch, or a third-party lib throwing) takes down the
// whole Node process — which under pm2 looks like the site "crashing" and
// restarting in a loop. We log loudly but never exit; per-request failures are
// already converted into a clean 500 error page in `fetch` below.
const nodeProcess = (globalThis as { process?: { on?: (event: string, cb: (arg: unknown) => void) => void } }).process;
if (
  typeof nodeProcess?.on === "function" &&
  !(globalThis as Record<string, unknown>).__kyroxProcessGuards
) {
  (globalThis as Record<string, unknown>).__kyroxProcessGuards = true;
  nodeProcess.on("unhandledRejection", (reason: unknown) => {
    console.error("[kyrox] Unhandled promise rejection (kept alive):", reason);
  });
  nodeProcess.on("uncaughtException", (err: unknown) => {
    console.error("[kyrox] Uncaught exception (kept alive):", err);
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// Module-level promise — safe in Cloudflare Workers (one isolate per deploy).
// In Node.js dev mode this persists across hot-reloads; that's a minor annoyance
// (you get the old entry until the process restarts) but not a correctness bug.
let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // Non-JSON 500 — consume any lingering captured error so it doesn't bleed
    // into the next request's error context.
    consumeLastCapturedError();
    return response;
  }

  // Clone before reading — we must keep the original body intact in case we
  // return `response` unchanged below.
  const body = await response.clone().text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Unparseable JSON 500 — consume captured error to prevent bleed.
    consumeLastCapturedError();
    return response;
  }

  const isH3SwallowedError =
    typeof parsed === "object" &&
    parsed !== null &&
    "unhandled" in parsed &&
    "message" in parsed &&
    (parsed as Record<string, unknown>).unhandled === true &&
    (parsed as Record<string, unknown>).message === "HTTPError";

  if (!isH3SwallowedError) {
    // Non-h3 JSON 500 (e.g. a different framework error shape) — consume
    // captured error to prevent it bleeding into the next request.
    consumeLastCapturedError();
    return response;
  }

  // h3-swallowed error: log whatever we captured (or synthesise a fallback)
  // and return a proper error page.
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
