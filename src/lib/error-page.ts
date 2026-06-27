// Most SSR 500s here are *transient* — a dev module-fetch timeout or a brief
// upstream hiccup — so a single reload usually fixes them. Rather than forcing
// the user to click "Try again" every time, the page auto-retries a few times
// (with a short backoff) and only falls back to manual controls if the error
// persists. A sessionStorage counter prevents an infinite reload loop.
export function renderErrorPage(): string {
  const MAX_RETRIES = 3;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Reconnecting…</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: dark; }
      body { font: 15px/1.6 system-ui, -apple-system, sans-serif; background: #0a0a0f; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #fff; font-weight: 700; }
      p { color: #94a3b8; margin: 0 0 1.5rem; }
      .actions { display: none; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      .actions.show { display: flex; }
      a, button { padding: 0.6rem 1.1rem; border-radius: 0.6rem; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #6366f1; color: #fff; }
      .secondary { background: transparent; color: #e2e8f0; border-color: rgba(255,255,255,0.15); }
      .spinner { width: 34px; height: 34px; margin: 0 auto 1rem; border-radius: 50%; border: 3px solid rgba(99,102,241,0.25); border-top-color: #6366f1; animation: spin 0.8s linear infinite; }
      .hidden { display: none; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner" id="spinner"></div>
      <h1 id="title">Reconnecting…</h1>
      <p id="msg">This is taking a moment. Retrying automatically…</p>
      <div class="actions" id="actions">
        <button class="primary" onclick="reloadNow()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
    <script>
      (function () {
        var MAX = ${MAX_RETRIES};
        var KEY = "kyrox-ssr-retry:" + location.pathname + location.search;
        function reloadNow() {
          try { sessionStorage.setItem(KEY, "0"); } catch (e) {}
          location.reload();
        }
        window.reloadNow = reloadNow;
        var n = 0;
        try { n = parseInt(sessionStorage.getItem(KEY) || "0", 10) || 0; } catch (e) {}
        if (n < MAX) {
          try { sessionStorage.setItem(KEY, String(n + 1)); } catch (e) {}
          // Small backoff so we don't hammer a still-warming server.
          setTimeout(function () { location.reload(); }, 600 + n * 900);
        } else {
          // Persistent failure — clear the counter and show manual controls.
          try { sessionStorage.removeItem(KEY); } catch (e) {}
          document.getElementById("spinner").className = "hidden";
          document.getElementById("title").textContent = "This page didn't load";
          document.getElementById("msg").textContent =
            "We tried a few times but couldn't load it. Try again or head home.";
          document.getElementById("actions").className = "actions show";
        }
      })();
    </script>
  </body>
</html>`;
}
