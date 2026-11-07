import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// The built app may load scripts, styles, fonts and data only from itself: no third-party script can
// run next to customer data, and nothing can be sent to another site (docs/SECURITY.md). Headers that
// a <meta> tag cannot set (frame-ancestors, HSTS) are sent by the server that hosts the app.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React style attributes
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'", // the API is served from the same address
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** Adds the policy to the built index.html only: the dev server needs inline scripts for hot reload. */
const contentSecurityPolicy = (): Plugin => ({
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: (html) => html.replace(/(<meta charset[^>]*>)/, `$1\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`),
});

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  resolve: { alias: { "@": "/src" } },
  server: { port: 5174 },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
