// Production Node server for TanStack Start (Node SSR adapter).
// Serves static assets from dist/client and delegates SSR to dist/server/server.js.
// Also injects runtime env vars (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY) into
// window.__ENV so the client bundle does not depend on Vite build-time replacement.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import handler from "./dist/server/server.js";

const app = new Hono();

const RUNTIME_ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  SUPABASE_PUBLISHABLE_KEY:
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
};

if (!RUNTIME_ENV.SUPABASE_URL || !RUNTIME_ENV.SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    "[server] WARNING: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set. " +
      "The Supabase client will fail to initialize on the client.",
  );
}

const ENV_SCRIPT = `<script>window.__ENV=${JSON.stringify(RUNTIME_ENV)};</script>`;

// Static assets (built JS/CSS, favicons, manifest, etc.)
app.use(
  "/*",
  serveStatic({
    root: "./dist/client",
    rewriteRequestPath: (p) => p,
  }),
);

// SSR fallback — anything not served by static handler.
// We intercept HTML responses to inject window.__ENV before any script runs.
app.all("*", async (c) => {
  // Make runtime env available to SSR code via globalThis.__ENV
  globalThis.__ENV = RUNTIME_ENV;

  const res = await handler.fetch(c.req.raw);
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return res;

  const html = await res.text();
  const injected = html.replace("<head>", `<head>${ENV_SCRIPT}`);
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(injected, { status: res.status, headers });
});

const port = Number(process.env.PORT) || 80;
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`> Server listening on http://0.0.0.0:${info.port}`);
});
