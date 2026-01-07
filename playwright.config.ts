import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  timeout: 30_000,
  retries: 0,
  reporter: "list",
  use: {
    viewport: { width: 1440, height: 900 },
    screenshot: "off",
  },
});
