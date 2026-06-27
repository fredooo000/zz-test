// pm2 config for running Kyrox in PRODUCTION (not the dev server).
//
//   Build once, then start:
//     npm install
//     npm run build
//     pm2 start ecosystem.config.cjs
//
//   Redeploy after pulling changes:
//     npm run build && pm2 reload haven
//
// Why: the dev server (`vite dev`) does per-request SSR streaming, which is what
// produced "SSR stream transform exceeded maximum lifetime (120000ms)" and the
// crash/restart loop. The production build ships a static SPA shell (SSR is
// disabled in vite.config.ts + the root route), so there is no per-request SSR
// to time out.
module.exports = {
  apps: [
    {
      name: "haven",
      // Serves the built output produced by `vite build`.
      script: ".output/server/index.mjs",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOST: "0.0.0.0",
      },
      // Don't hammer-restart on a crash loop; back off and cap restarts.
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: "600M",
    },
  ],
};
