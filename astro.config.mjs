// @ts-check
import { defineConfig } from "astro/config";
import serviceWorker from "./src/lib/sw-integration.mjs";

// Static site; deployed to Cloudflare Pages (see .github/workflows/deploy.yml).
export default defineConfig({
  output: "static",
  site: "https://panduan-pengakuan-dosa.pages.dev",
  trailingSlash: "always",
  integrations: [serviceWorker()],
});
