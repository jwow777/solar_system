import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { sceneBounds, waitForCamera } from './helpers';

async function earthBrightness(page: Page) {
  const bounds = await sceneBounds(page);
  const image = await page.screenshot({ clip: {
    x: Math.floor(bounds.x + (bounds.width - 96) / 2),
    y: Math.floor(bounds.y + (bounds.height - 96) / 2),
    width: 96, height: 96,
  } });
  const { channels } = await sharp(image).stats();
  return channels[0].mean * 0.2126 + channels[1].mean * 0.7152 + channels[2].mean * 0.0722;
}

test('atmospheric planets render without shader errors in day and unlit views', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('earth-and-moon.settings.v1', JSON.stringify({
      version: 1, settings: { showOrbits: false, bloomStrength: 0 }, timeScale: 0,
    }));
  });
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  const date = page.getByLabel('Дата симуляции (UTC)');
  await date.fill('2000-01-01');
  await date.dispatchEvent('change');
  for (const id of ['earth', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
    await page.locator('[data-body="' + id + '"]').click();
    await expect(page.locator('.loading-status')).toBeHidden({ timeout: 30_000 });
    await waitForCamera(page);
    await page.screenshot({ path: 'test-results/atmosphere-' + id + '.png' });
  }
  await page.locator('[data-body="earth"]').click();
  await expect(page.locator('.loading-status')).toBeHidden({ timeout: 30_000 });
  await waitForCamera(page);
  const daylightBrightness = await earthBrightness(page);
  expect(daylightBrightness).toBeGreaterThan(15);
  await page.locator('.scene-settings > summary').click();
  await page.getByText('Источник света', { exact: true }).click();
  const sunlight = page.getByRole('spinbutton', { name: 'Мощность Солнца', exact: true });
  await sunlight.fill('0');
  await sunlight.press('Enter');
  const ambient = page.getByRole('spinbutton', { name: 'Фоновый свет', exact: true });
  await ambient.fill('0');
  await ambient.press('Enter');
  await page.locator('.scene-settings > summary').click();
  await expect.poll(() => earthBrightness(page)).toBeLessThan(Math.max(3, daylightBrightness * 0.2));
  await page.screenshot({ path: 'test-results/atmosphere-earth-unlit.png' });

  await page.locator('.scene-settings > summary').click();
  await sunlight.fill('1.2');
  await sunlight.press('Enter');
  await ambient.fill('0.12');
  await ambient.press('Enter');
  await page.locator('.scene-settings > summary').click();
  const bounds = await sceneBounds(page);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + Math.min(bounds.width / 2 - 8, page.viewportSize()!.height / 2), centerY, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/atmosphere-earth-night-side.png' });
  expect(errors).toEqual([]);
});
