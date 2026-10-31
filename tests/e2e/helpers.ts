import { expect, type Page } from '@playwright/test';

export async function waitForCamera(page: Page) {
  await expect(page.locator('canvas')).toHaveAttribute('aria-busy', 'false', { timeout: 20_000 });
}

export async function openCatalog(page: Page) {
  if (!await page.locator('.catalog-panel').isVisible()) {
    await page.getByRole('button', { name: 'Открыть каталог', exact: true }).click();
  }
}

export async function sceneBounds(page: Page) {
  const bounds = await page.locator('.scene-viewport').boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}
