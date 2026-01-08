import { promises as fs } from 'fs';
import { test } from '@playwright/test';

const screenshotPath = 'artifacts/ui-preview.png';

test('capture UI preview screenshot', async ({ page }) => {
  await fs.mkdir('artifacts', { recursive: true });
  await page.goto('/preview/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.shogi-kif');
  await page.screenshot({ path: screenshotPath, fullPage: true });
});
