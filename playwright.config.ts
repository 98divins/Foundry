// End-to-end journeys (e2e/), run against a production build that talks to a fake Supabase
// (e2e/fake.ts answers every request inside the browser). Run with `npm run e2e`.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4175',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    locale: 'en-US',
    trace: 'off',
  },
  webServer: {
    command: 'npx vite build --outDir dist-e2e --mode e2e && npx vite preview --outDir dist-e2e --port 4175 --strictPort',
    env: { VITE_SUPABASE_URL: 'https://fake.supabase.test', VITE_SUPABASE_KEY: 'e2e' },
    url: 'http://localhost:4175',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
