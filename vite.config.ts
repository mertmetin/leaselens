import { defineConfig, type Plugin } from "vitest/config";

// The production page may not make any network request (connect-src 'none'):
// that's what guarantees a pasted lease never leaves the browser. Added only
// to the build, because the dev server needs a websocket for live reload.
const CSP =
  "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'";

const csp = (): Plugin => ({
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// Served from https://<user>.github.io/leaselens/ on GitHub Pages.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/leaselens/" : "/",
  plugins: [csp()],
  test: { globals: true },
});
