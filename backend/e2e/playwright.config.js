const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: ['*.spec.js'],
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    viewport: { width: 375, height: 812 },
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: null,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
