import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test } from "@playwright/test";

test("capture UI preview screenshot", async ({ page }) => {
  const artifactsDir = path.resolve("artifacts");
  await mkdir(artifactsDir, { recursive: true });

  await page.goto("http://localhost:4173/index.html", {
    waitUntil: "networkidle",
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForSelector("#shogi-preview-root");

  const screenshotPath = path.join(artifactsDir, "ui-preview.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
});
