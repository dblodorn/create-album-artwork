import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the production build on its own port, so they
// never touch the dev server's data on :3000 (and :3001 is taken locally).
// CI builds once in its own step and sets E2E_SKIP_BUILD.
const PORT = 3100
const CI = !!process.env.CI
const start = `npx next start -p ${PORT}`

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    // Reshaped's overlays (modals, menus) wait for their fade-out's
    // transitionend before unmounting, which headless Chromium sometimes never
    // fires, leaving an invisible overlay over the page. With reduced motion,
    // Reshaped skips the transition and closes at once.
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? start : `npm run build && ${start}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    // Blank the app's keys so a local run matches CI: no Google sign-in script,
    // and the server never calls the real dmbk API or fal (process env wins
    // over .env.local). Gated features are tested through network mocks.
    env: {
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: '',
      DMBK_GRAPHQL_API_KEY: '',
      DMBK_GRAPHQL_API_URL: 'http://127.0.0.1:9/graphql',
      FAL_AI_API_KEY: '',
      FAL_ALLOWED_EMAILS: '',
    },
  },
})
