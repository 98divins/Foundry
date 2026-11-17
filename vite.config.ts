import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

import { readFileSync } from 'node:fs';

/** The Supabase project the build talks to: same rule as src/cloud/config.ts. */
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? /DEFAULT_URL = '([^']+)'/.exec(readFileSync('./src/cloud/config.ts', 'utf8'))![1];
const SUPABASE = new URL(SUPABASE_URL);

/**
 * Content Security Policy, as a meta tag (GitHub Pages cannot send headers; move it to a real header
 * when the app changes host). Only the services the app really uses are allowed.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // Inline style attributes are used by React components (sizes, colours, progress bars).
  "style-src 'self' 'unsafe-inline'",
  // data:/blob: = profile pictures, share images, generated sounds; the others = exercise photos.
  "img-src 'self' data: blob: https://cdn.jsdelivr.net https://raw.githubusercontent.com",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE.origin} wss://${SUPABASE.host} https://world.openfoodfacts.org https://fr.openfoodfacts.org`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** One id per build: the app compares it with version.json to notice a newer deploy. */
const BUILD_ID = `${pkg.version}-${Date.now().toString(36)}`;

// Relative base so the build works from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'csp',
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
      },
    },
    {
      name: 'version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_ID__: JSON.stringify(BUILD_ID) },
});
