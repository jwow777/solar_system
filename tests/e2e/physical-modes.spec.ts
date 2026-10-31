import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { openCatalog, sceneBounds, waitForCamera } from './helpers';

const sizes = (page: Page) => page.getByRole('switch', { name: 'Реальные размеры и расстояния', exact: true });
const realTime = (page: Page) => page.getByRole('switch', { name: 'Реальные скорости — время 1:1', exact: true });
const settings = (page: Page) => page.locator('.scene-settings > summary');

test('physical sizes preserve visibility, focus and picking for a tiny distant moon', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await page.locator('[data-body="earth"]').click();
  await waitForCamera(page);
  await settings(page).click();
  await sizes(page).check();
  await expect(realTime(page)).not.toBeChecked();
  await settings(page).click();
  await waitForCamera(page);
  await expect(page.locator('.model-scale-real')).toBeVisible();
  await page.getByRole('tab', { name: 'Спутники', exact: true }).click();
  await page.locator('[data-body="miranda"]').click();
  await expect(page.locator('.loading-status')).toBeHidden({ timeout: 30_000 });
  await waitForCamera(page);
  const bounds = await sceneBounds(page);
  const image = await page.screenshot({ clip: {
    x: Math.floor(bounds.x + bounds.width / 2 - 48), y: Math.floor(bounds.y + bounds.height / 2 - 48), width: 96, height: 96,
  } });
  const stats = await sharp(image).stats();
  expect(stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean).toBeGreaterThan(10);
  await page.screenshot({ path: 'test-results/physical-miranda.png' });
  await page.getByRole('button', { name: 'Закрыть карточку объекта' }).click();
  await waitForCamera(page);
  const scene = await sceneBounds(page);
  await page.mouse.click(scene.x + scene.width / 2, scene.y + scene.height / 2);
  await expect(page.locator('#planet-panel-title')).toHaveText('Миранда');
  await settings(page).click();
  await sizes(page).uncheck();
  await settings(page).click();
  await waitForCamera(page);
  await expect(page.locator('.model-scale-illustrative')).toBeVisible();
  expect(errors).toEqual([]);
});

test('real-time mode runs 1:1 and restores the previous accelerated speed', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await page.getByRole('button', { name: 'Скорость 10 дн/сек', exact: true }).click();
  await settings(page).click();
  await realTime(page).check();
  await expect(sizes(page)).not.toBeChecked();
  await settings(page).click();
  const date = page.getByLabel('Дата симуляции (UTC)');
  await date.fill('2026-10-29'); await date.dispatchEvent('change');
  const clock = page.getByRole('timer', { name: 'Время симуляции (UTC)' });
  await expect(clock).toHaveText('12:00:00');
  await expect(page.locator('.simulation-speed')).toHaveText('1 СЕК = 1 СЕК');
  await expect(page.locator('.speed-presets')).toBeHidden();
  await page.getByRole('button', { name: 'Продолжить симуляцию' }).click();
  await page.waitForTimeout(2100);
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  const seconds = Number((await clock.textContent())!.split(':').at(-1));
  expect(seconds).toBeGreaterThanOrEqual(1);
  expect(seconds).toBeLessThan(8);
  await expect(date).toHaveValue('2026-10-29');
  await page.reload();
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await settings(page).click();
  await expect(realTime(page)).toBeChecked();
  await realTime(page).uncheck();
  await settings(page).click();
  await expect(page.getByRole('button', { name: 'Скорость 10 дн/сек', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(clock).toBeHidden();
});

test('physical modes persist on mobile and reset with the scene settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await settings(page).click();
  await sizes(page).check(); await realTime(page).check();
  await page.reload();
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await settings(page).click();
  await expect(sizes(page)).toBeChecked(); await expect(realTime(page)).toBeChecked();
  await settings(page).click();
  await openCatalog(page);
  await page.locator('[data-body="earth"]').click();
  await waitForCamera(page);
  await page.screenshot({ path: 'test-results/physical-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await settings(page).click();
  await page.getByRole('button', { name: 'Вернуть исходные настройки' }).click();
  await expect(sizes(page)).not.toBeChecked(); await expect(realTime(page)).not.toBeChecked();
  await expect(page.locator('body')).not.toHaveClass(/realistic-sizes/);
});
