import { test, expect } from '@playwright/test';
import { openCatalog, sceneBounds, waitForCamera } from './helpers';

test('production subpath loads, exposes all bodies and keeps 4K textures lazy', async ({ page }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  const details: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  page.on('request', request => { if (request.url().includes('/textures/4k/')) details.push(request.url()); });
  await page.goto('');
  await expect(page.locator('[data-body]')).toHaveCount(32);
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await expect(page.locator('.loading-status')).toBeHidden({ timeout: 30_000 });
  expect(details).toHaveLength(0);
  await page.locator('[data-body="earth"]').click();
  await expect(page.locator('#planet-panel-title')).toHaveText('Земля');
  await expect.poll(() => details.some(url => url.includes('earthMap.webp'))).toBe(true);
  await expect(page.locator('.loading-status')).toBeHidden({ timeout: 30_000 });
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
  await waitForCamera(page);
  await page.screenshot({ path: 'test-results/desktop.png' });
});

test('all 32 bodies, search and overview are usable', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  const ids = await page.locator('[data-body]').evaluateAll(elements => elements.map(element => ({ id: (element as HTMLElement).dataset.body!, category: (element as HTMLElement).dataset.category! })));
  const categories: Record<string, string> = { major: 'Планеты', dwarf: 'Карликовые', moon: 'Спутники' };
  for (const { id, category } of ids) {
    await page.getByRole('tab', { name: categories[category], exact: true }).click();
    const button = page.locator('[data-body="' + id + '"]');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.planet-panel')).toHaveAttribute('aria-hidden', 'false');
  }
  await page.getByRole('searchbox', { name: 'Поиск объектов' }).fill('Эрида');
  await expect(page.locator('[data-body]:visible')).toHaveCount(1);
  await expect(page.locator('[data-body="eris"]')).toBeVisible();
  await page.getByRole('button', { name: 'Общий обзор' }).click();
  await expect(page.locator('.planet-panel')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[data-body]:visible')).toHaveCount(9);
});

test('pause, backward/forward steps and a selected UTC date stay synchronized', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  const date = page.getByLabel('Дата симуляции (UTC)');
  await date.fill('2000-01-01');
  await date.dispatchEvent('change');
  await page.getByRole('button', { name: 'Вперёд на 10 дней' }).click();
  await expect(date).toHaveValue('2000-01-11');
  await page.getByRole('button', { name: 'Назад на 10 дней' }).click();
  await expect(date).toHaveValue('2000-01-01');
  await date.fill('1999-12-01');
  await date.dispatchEvent('change');
  await expect(date).toHaveValue('1999-12-01');
  await expect(page.getByRole('button', { name: 'Продолжить симуляцию' })).toHaveAttribute('aria-pressed', 'true');
});

test('canvas clicks select a planet and camera drags do not open the panel', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await page.locator('[data-body="earth"]').click();
  await page.getByRole('button', { name: 'Закрыть карточку объекта' }).click();
  await waitForCamera(page);
  const bounds = await sceneBounds(page);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  await page.mouse.click(centerX, centerY);
  await expect(page.locator('.planet-panel')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#planet-panel-title')).toHaveText('Земля');
  await page.getByRole('button', { name: 'Закрыть карточку объекта' }).click();
  await waitForCamera(page);
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 80, centerY + 20, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.planet-panel')).toHaveAttribute('aria-hidden', 'true');
});

test('a failed texture can be retried without breaking the scene', async ({ page }) => {
  await page.route('**/textures/2k/earthMap.webp', route => route.abort());
  await page.goto('');
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/textures/2k/earthMap.webp');
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.locator('.loading-status')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('canvas')).toBeVisible();
});

test('mobile layout and keyboard selection work without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await openCatalog(page);
  const earth = page.locator('[data-body="earth"]');
  await earth.focus();
  await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: 'Закрыть карточку объекта' });
  await expect(close).toBeFocused();
  await expect(page.locator('.planet-panel')).toBeInViewport({ ratio: 1 });
  await waitForCamera(page);
  const bounds = await page.locator('.planet-panel').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'test-results/mobile.png' });
  await page.keyboard.press('Escape');
  await expect(earth).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const dock = await page.locator('.control-dock').boundingBox();
  expect(dock!.x + dock!.width).toBeLessThanOrEqual(390);
});

test('scene settings persist after a reload', async ({ page }) => {
  await page.goto('');
  await page.locator('.scene-settings > summary').click();
  await page.getByText('Экран и эффекты', { exact: true }).click();
  const exposure = page.getByRole('spinbutton', { name: 'Экспозиция', exact: true });
  await exposure.fill('1.3');
  await exposure.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('solar-system-atlas.settings.v1') ?? '{}').settings?.exposure)).toBe(1.3);
  await page.reload();
  await page.locator('.scene-settings > summary').click();
  await page.getByText('Экран и эффекты', { exact: true }).click();
  await expect(exposure).toHaveValue('1.3');
  await page.getByRole('button', { name: 'Вернуть исходные настройки' }).click();
  await expect(exposure).toHaveValue('0.8');
});
