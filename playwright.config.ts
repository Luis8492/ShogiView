import { defineConfig } from '@playwright/test';

const port = Number(process.env.UI_PREVIEW_PORT ?? 4173);

export default defineConfig({
  testDir: './tests',
  reporter: 'line',
  outputDir: 'artifacts/playwright',
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1365, height: 768 },
  },
  webServer: {
    command: `npm run ui:serve -- --port=${port}`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
