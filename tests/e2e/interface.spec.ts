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

test('mobile catalog keeps tabs and names aligned when the keyboard reduces the layout viewport', async ({ page }) => {
  test.setTimeout(90_000);
  for (const size of [{ width: 320, height: 720 }, { width: 390, height: 430 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await page.goto('');
    await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
    await openCatalog(page);
    // Opening the catalog by touch should not open the keyboard automatically.
    const search = page.getByRole('searchbox', { name: 'Поиск объектов' });
    await expect(search).not.toBeFocused();
    await search.focus();
    const catalog = (await page.locator('.catalog-panel').boundingBox())!;
    expect(catalog.width).toBeGreaterThan(size.width * 0.85);
    expect(catalog.y).toBeGreaterThanOrEqual(0);
    expect(catalog.y + catalog.height).toBeLessThanOrEqual(size.height);
    const tabs = await page.locator('.catalog-tab').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, clipped: element.scrollWidth > element.clientWidth };
    }));
    expect(tabs.every(tab => !tab.clipped)).toBe(true);
    for (let i = 1; i < tabs.length; i++) expect(tabs[i].left).toBeGreaterThanOrEqual(tabs[i - 1].right);
    const navigation = (await page.locator('.lil-nav-panel').boundingBox())!;
    expect(navigation.y).toBeGreaterThanOrEqual(tabs[0].bottom);
    expect(navigation.height).toBeGreaterThan(80);
    const names = await page.locator('[data-body]:visible .body-name').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect(); return { x: rect.x, height: rect.height };
    }));
    expect(Math.max(...names.map(name => name.x)) - Math.min(...names.map(name => name.x))).toBeLessThan(1);
    expect(new Set(names.map(name => name.height)).size).toBe(1);
    await page.getByRole('tab', { name: 'Карликовые', exact: true }).click();
    await expect(page.locator('[data-body]:visible')).toHaveCount(5);
    await search.fill('Нептун');
    await page.locator('[data-body="neptune"]').click();
    await expect(page.locator('#planet-panel-title')).toHaveText('Нептун');
    await expect(page.getByRole('searchbox', { name: 'Поиск объектов', includeHidden: true })).not.toBeFocused();
    await expect(page.locator('.control-dock')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
  }
});

test('mobile search stays above a keyboard that resizes only the visual viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await openCatalog(page);
  const search = page.getByRole('searchbox', { name: 'Поиск объектов' });
  await search.focus();
  // Headless Chromium has no OS keyboard; reproduce Safari/Chrome viewport events.
  await page.evaluate(() => {
    Object.defineProperties(window.visualViewport!, {
      height: { configurable: true, value: 400 },
      offsetTop: { configurable: true, value: 30 },
    });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  const catalog = (await page.locator('.catalog-panel').boundingBox())!;
  const header = (await page.locator('.app-header').boundingBox())!;
  expect(header.y).toBeGreaterThanOrEqual(30);
  expect(catalog.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(catalog.y + catalog.height).toBeLessThanOrEqual(430);
  await expect(page.locator('.control-dock')).toBeHidden();
  await page.locator('[data-body="neptune"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-body="neptune"]')).toBeInViewport();
  await page.screenshot({ path: 'test-results/mobile-keyboard.png' });
  await search.fill('Земля');
  await page.locator('[data-body="earth"]').click();
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, 'height');
    Reflect.deleteProperty(window.visualViewport!, 'offsetTop');
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('#planet-panel-title')).toHaveText('Земля');
  await expect(page.locator('body')).not.toHaveClass(/catalog-searching/);
  await expect(page.locator('.control-dock')).toBeVisible();
});

test('overview toggles back to the previous object or free view', async ({ page }) => {
  test.setTimeout(75_000);
  for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.goto('');
    await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
    const overview = page.getByRole('button', { name: 'Общий обзор', exact: true });
    await overview.click(); await waitForCamera(page);
    await expect(overview).toHaveAttribute('aria-pressed', 'true');
    await overview.click(); await waitForCamera(page);
    await expect(overview).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.planet-panel')).toHaveAttribute('aria-hidden', 'true');
    await openCatalog(page);
    await page.locator('[data-body="earth"]').click();
    await waitForCamera(page);
    await overview.click(); await waitForCamera(page);
    await expect(page.locator('.planet-panel')).toHaveAttribute('aria-hidden', 'true');
    await overview.click(); await waitForCamera(page);
    await expect(page.locator('#planet-panel-title')).toHaveText('Земля');
    await expect(page.locator('[data-body="earth"]')).toHaveAttribute('aria-pressed', 'true');
    const scene = await sceneBounds(page);
    await page.getByRole('button', { name: 'Закрыть карточку объекта' }).click();
    await waitForCamera(page);
    const free = await sceneBounds(page);
    await page.mouse.click(free.x + free.width / 2, free.y + free.height / 2);
    await expect(page.locator('#planet-panel-title')).toHaveText('Земля');
    expect(scene.width).toBeGreaterThan(100);
  }
});

test('the close button stays in its own toolbar while object details scroll', async ({ page }) => {
  for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.goto('');
    await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
    await openCatalog(page);
    await page.locator('[data-body="earth"]').click();
    const close = page.getByRole('button', { name: 'Закрыть карточку объекта' });
    const before = (await close.boundingBox())!;
    const content = page.locator('.planet-panel-content');
    await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const after = (await close.boundingBox())!;
    const bounds = (await content.boundingBox())!;
    expect(after.y).toBe(before.y);
    expect(after.y + after.height).toBeLessThanOrEqual(bounds.y);
    expect(await content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/panel-scroll-' + size.width + '.png' });
    await close.click();
    await expect(page.locator('.planet-panel')).toHaveAttribute('aria-hidden', 'true');
  }
});
