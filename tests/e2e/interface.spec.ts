import { expect, test } from '@playwright/test';
import { openCatalog, sceneBounds, waitForCamera } from './helpers';

test('catalog categories, global search and orbit details work with the keyboard', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await expect(page.locator('[data-body]:visible')).toHaveCount(9);
  await page.getByRole('tab', { name: 'Планеты', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Карликовые', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-body]:visible')).toHaveCount(5);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Спутники', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-body]:visible')).toHaveCount(18);

  const search = page.getByRole('searchbox', { name: 'Поиск объектов' });
  await search.fill('неизвестный объект');
  await expect(page.getByText('Ничего не найдено', { exact: true })).toBeVisible();
  await search.fill('Эрида');
  await expect(page.locator('[data-body]:visible')).toHaveCount(1);
  await page.locator('[data-body="eris"]').click();
  await expect(page.getByRole('tab', { name: 'Карликовые', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Орбита', exact: true }).click();
  await expect(page.locator('[data-orbit="distance"]')).toBeVisible();
  await expect(page.locator('[data-orbit="speed"]')).not.toHaveText('');
  await page.getByRole('button', { name: 'Скорость 10 дн/сек', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Скорость 10 дн/сек', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
  await expect(page.locator('.planet-panel')).toHaveAttribute('aria-hidden', 'true');
});

test('the scene and controls remain usable on narrow, landscape and tablet screens', async ({ page }) => {
  test.setTimeout(120_000);
  for (const size of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    await page.goto('');
    await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
    await openCatalog(page);
    await page.locator('[data-body="earth"]').click();
    await waitForCamera(page);
    await expect(page.locator('.planet-panel')).toBeInViewport({ ratio: 1 });
    const scene = await sceneBounds(page);
    const panel = (await page.locator('.planet-panel').boundingBox())!;
    const timeline = (await page.locator('.control-dock').boundingBox())!;
    const actions = (await page.locator('.header-actions').boundingBox())!;
    const brand = (await page.locator('.app-brand').boundingBox())!;
    expect(scene.width).toBeGreaterThan(100);
    expect(scene.height).toBeGreaterThan(100);
    expect(scene.x).toBeGreaterThanOrEqual(0);
    expect(scene.y).toBeGreaterThanOrEqual(0);
    expect(scene.x + scene.width).toBeLessThanOrEqual(size.width);
    expect(scene.y + scene.height).toBeLessThanOrEqual(timeline.y);
    const overlapX = Math.max(0, Math.min(scene.x + scene.width, panel.x + panel.width) - Math.max(scene.x, panel.x));
    const overlapY = Math.max(0, Math.min(scene.y + scene.height, panel.y + panel.height) - Math.max(scene.y, panel.y));
    expect(overlapX * overlapY).toBe(0);
    expect(brand.x + brand.width).toBeLessThanOrEqual(actions.x);
    expect(actions.x + actions.width).toBeLessThanOrEqual(size.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
    await page.screenshot({ path: 'test-results/interface-' + size.width + 'x' + size.height + '.png' });
    await page.getByRole('button', { name: 'Закрыть карточку объекта' }).click();
    await openCatalog(page);
    await page.getByRole('tab', { name: 'Спутники', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Поиск объектов' }).fill('Титан');
    await page.locator('[data-body="titan"]').click();
    await expect(page.locator('#planet-panel-title')).toHaveText('Титан');
  }
});
