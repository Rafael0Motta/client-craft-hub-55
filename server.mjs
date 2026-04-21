// Production Node server for TanStack Start (Node SSR adapter).
// Serves static assets from dist/client and delegates SSR to dist/server/server.js.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import handler from "./dist/server/server.js";

const app = new Hono();

// Static assets (built JS/CSS, favicons, manifest, etc.)
app.use(
  "/*",
  serveStatic({
    root: "./dist/client",
    // Skip directory index so SSR handles "/" and other routes.
    rewriteRequestPath: (p) => p,
  }),
);

// SSR fallback — anything not served by static handler
app.all("*", (c) => handler.fetch(c.req.raw));

const port = Number(process.env.PORT) || 80;
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`> Server listening on http://0.0.0.0:${info.port}`);
});
