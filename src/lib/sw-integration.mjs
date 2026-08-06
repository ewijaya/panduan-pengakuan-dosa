// Astro integration: after build, emit dist/sw.js with a complete precache
// manifest of every built file, so the app works fully offline once loaded
// (README: "Offline-first — churches have poor signal").
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

function walk(dir, base) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, base));
    else out.push("/" + path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

export default function serviceWorker() {
  return {
    name: "sw-precache",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        // Never precache the worker itself, nor Pages Function sources — CI
        // stages functions/ into dist/ for direct upload (.github/workflows).
        const files = walk(dist, dist).filter(
          (f) => f !== "/sw.js" && !f.startsWith("/functions/")
        );
        // Serve pretty URLs for HTML: /a/index.html → /a/
        const urls = files.map((f) => f.replace(/index\.html$/, ""));
        const version = crypto
          .createHash("sha256")
          .update(files.map((f) => f + ":" + fs.statSync(path.join(dist, f)).size).join("|"))
          .digest("hex")
          .slice(0, 12);
        const sw = `// generated at build time — do not edit
const CACHE = "pdp-${version}";
const PRECACHE = ${JSON.stringify(urls)};
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  // dynamic routes (Pages Functions) — never cache, never serve stale
  if (u.pathname === "/admin" || u.pathname.startsWith("/admin/") || u.pathname.startsWith("/api/")) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
    )
  );
});
`;
        fs.writeFileSync(path.join(dist, "sw.js"), sw);
        logger.info(`sw.js generated: ${urls.length} precached files (cache pdp-${version})`);
      },
    },
  };
}
