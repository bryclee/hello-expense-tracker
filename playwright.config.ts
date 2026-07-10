import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  timeout: 15000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false, // Run sequentially to prevent localStorage conflicts between tests
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker avoids database/localStorage cross-talk
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
  },
});
