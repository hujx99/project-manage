import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = process.env.PLAYWRIGHT_BACKEND_PORT ?? '18000';
const FRONTEND_PORT = process.env.PLAYWRIGHT_FRONTEND_PORT ?? '4174';
const BACKEND_BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_BASE_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const useManagedServers = process.env.PLAYWRIGHT_USE_EXISTING_SERVERS !== '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: FRONTEND_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: useManagedServers
    ? [
        {
          command: 'sh ./scripts/run-backend-e2e.sh',
          cwd: '..',
          url: `${BACKEND_BASE_URL}/`,
          timeout: 120 * 1000,
          reuseExistingServer: !process.env.CI,
          env: {
            ...process.env,
            BACKEND_PORT,
            SQLITE_DB_PATH: process.env.SQLITE_DB_PATH ?? '.local/playwright-e2e.db',
          },
        },
        {
          command: `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
          cwd: '.',
          url: FRONTEND_BASE_URL,
          timeout: 120 * 1000,
          reuseExistingServer: !process.env.CI,
          env: {
            ...process.env,
            VITE_API_BASE_URL: `${BACKEND_BASE_URL}/api`,
          },
        },
      ]
    : undefined,
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
});
