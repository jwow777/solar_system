import { expect, test } from '@playwright/test';
import { PerspectiveCamera } from 'three';
import sharp from 'sharp';
import { PLANETS_DATA } from '../../src/constants/planetsData';
import { getPlanetPosition } from '../../src/utils/orbitPhysics';
import { sceneBounds, waitForCamera } from './helpers';

test('orbit hover brightens the line and restores transparency on pointer leave', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await expect(page.locator('.loading-status')).toBeHidden({ timeout: 30_000 });
  const bounds = await sceneBounds(page);
  const { width, height } = page.viewportSize()!;
  // Locate a known orbit in the initial view without adding a debug API to the app.
  const camera = new PerspectiveCamera(45, width / height, 0.01, 20000);
  camera.position.set(0, 30, 60);
  camera.lookAt(0, 0, 0);
  camera.setViewOffset(width, height, width / 2 - bounds.x - bounds.width / 2, height / 2 - bounds.y - bounds.height / 2, width, height);
  camera.updateMatrixWorld();
  const earth = PLANETS_DATA.find(body => body.name === 'earth')!;
  const points = Array.from({ length: 256 }, (_, i) => {
    const point = getPlanetPosition(earth, i / 256 * earth.period).project(camera);
    return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
  }).filter(point => point.x > bounds.x + 20 && point.x < bounds.x + bounds.width - 20 && point.y > bounds.y + 20 && point.y < bounds.y + bounds.height - 20);
  expect(points.length).toBeGreaterThan(0);
  const point = points[Math.floor(points.length / 2)];
  const clip = { x: Math.floor(point.x) - 6, y: Math.floor(point.y) - 6, width: 12, height: 12 };
  const brightness = async () => {
    const { channels } = await sharp(await page.screenshot({ clip })).stats();
    return (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
  };
  await page.mouse.move(40, 40);
  const normal = await brightness();
  await page.mouse.move(point.x, point.y);
  await expect(page.locator('.planet-tooltip')).toHaveText(/^Орбита: /);
  await expect.poll(brightness).toBeGreaterThan(normal + 1);
  await page.mouse.move(40, 40);
  await expect(page.locator('.planet-tooltip')).not.toHaveClass(/visible/);
  await expect.poll(brightness).toBeLessThan(normal + 1);
});

test('the renamed atlas starts at the current UTC date on every visit', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-29T23:59:59Z'));
  await page.addInitScript(() => {
    localStorage.setItem('solar-system-atlas.settings.v1', JSON.stringify({ version: 1, timeScale: 0, settings: {} }));
  });
  await page.goto('');
  await expect(page).toHaveTitle('Атлас Солнечной системы — планеты и спутники');
  await expect(page.getByRole('heading', { name: 'Солнечный атлас' })).toBeVisible();
  const date = page.getByLabel('Дата симуляции (UTC)');
  await expect(date).toHaveValue('2026-10-29');
  await date.fill('2000-01-01');
  await date.dispatchEvent('change');
  await expect(date).toHaveValue('2000-01-01');
  await page.reload();
  await expect(date).toHaveValue('2026-10-29');
});

test('downloaded moon maps load locally and explain their sources', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  page.on('request', request => requests.push(request.url()));
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  await page.getByRole('tab', { name: 'Спутники', exact: true }).click();
  for (const id of ['io', 'enceladus', 'titan', 'ariel', 'triton']) {
    await page.locator('[data-body="' + id + '"]').click();
    await expect(page.locator('.loading-status')).toBeHidden({ timeout: 30_000 });
    await waitForCamera(page);
    expect(requests.some(url => url.endsWith('/textures/4k/' + id + 'Map.webp'))).toBe(true);
    await page.getByText('О текстуре', { exact: true }).click();
    await expect(page.locator('.planet-description a')).toBeVisible();
    if (id === 'titan') await expect(page.getByText(/Поверхность в ИК-диапазоне/)).toBeVisible();
    await page.screenshot({ path: 'test-results/moon-' + id + '.png' });
  }
  expect(errors).toEqual([]);
});
