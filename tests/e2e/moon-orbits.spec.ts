import { expect, test } from '@playwright/test';
import snapshot from '../../src/constants/moonOrbitElements.json' with { type: 'json' };
import { waitForCamera } from './helpers';

test('satellite orbit cards show physical distances, speed changes and reversible time steps', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('');
  await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
  const date = page.getByLabel('Дата симуляции (UTC)');
  await date.fill('2026-10-29');
  await date.dispatchEvent('change');
  await page.getByRole('tab', { name: 'Спутники', exact: true }).click();
  for (const id of ['moon', 'titan', 'triton'] as const) {
    await page.locator('[data-body="' + id + '"]').click();
    await page.getByRole('tab', { name: 'Орбита', exact: true }).click();
    await expect(page.getByText('От планеты', { exact: true })).toBeVisible();
    await expect(page.getByText('Наклон к эклиптике', { exact: true })).toBeVisible();
    const distance = page.locator('[data-orbit="distance"]');
    const speed = page.locator('[data-orbit="speed"]');
    const initialDistance = (await distance.textContent())!;
    const initialSpeed = (await speed.textContent())!;
    const value = Number(initialDistance.replace(/\s/g, '').replace(',', '.'));
    const data = snapshot.elements[id];
    expect(value).toBeGreaterThanOrEqual(data.semiMajorAxisKm * (1 - data.eccentricity) - 1);
    expect(value).toBeLessThanOrEqual(data.semiMajorAxisKm * (1 + data.eccentricity) + 1);
    await page.getByRole('button', { name: 'Вперёд на 10 дней' }).click();
    await expect(distance).not.toHaveText(initialDistance);
    if (id !== 'triton') await expect(speed).not.toHaveText(initialSpeed);
    await page.getByRole('button', { name: 'Назад на 10 дней' }).click();
    await expect(distance).toHaveText(initialDistance);
    await expect(speed).toHaveText(initialSpeed);
    await expect(page.locator('.loading-status')).toBeHidden({ timeout: 30_000 });
    await waitForCamera(page);
    await page.screenshot({ path: 'test-results/moon-orbit-' + id + '.png' });
  }
  expect(errors).toEqual([]);
});
