import { expect, test } from '@playwright/test';
import { sceneBounds, waitForCamera } from './helpers';

test.describe('touch time controls', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('step size and playback speed remain visible and independent on compact screens', async ({ page }) => {
    test.setTimeout(90_000);
    for (const size of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      await page.goto('');
      await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
      const date = page.getByLabel('Дата симуляции (UTC)');
      await date.fill('2000-01-01'); await date.dispatchEvent('change');
      const step = page.getByRole('combobox', { name: 'Шаг времени', exact: true });
      await expect(step).toBeInViewport({ ratio: 1 });
      await step.selectOption('1');
      await page.getByRole('button', { name: 'Вперёд на 1 день', exact: true }).click();
      await expect(date).toHaveValue('2000-01-02');
      await step.selectOption('30');
      await page.getByRole('button', { name: 'Вперёд на 30 дней', exact: true }).click();
      await expect(date).toHaveValue('2000-02-01');
      await page.getByRole('button', { name: 'Назад на 30 дней', exact: true }).click();
      await expect(date).toHaveValue('2000-01-02');
      for (const rate of ['0,1', '1', '10']) {
        const speed = page.getByRole('button', { name: 'Скорость ' + rate + ' дн/сек', exact: true });
        await expect(speed).toBeInViewport({ ratio: 1 });
        await speed.click();
        await expect(speed).toHaveAttribute('aria-pressed', 'true');
        await expect(step).toHaveValue('30');
      }
      await expect(page.getByRole('button', { name: 'Продолжить симуляцию' })).toHaveAttribute('aria-pressed', 'true');
      const dock = (await page.locator('.control-dock').boundingBox())!;
      for (const selector of ['.simulation-date', '.time-transport', '.time-step-control', '.speed-control']) {
        const bounds = (await page.locator(selector).boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(dock.x);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(dock.x + dock.width);
        expect(bounds.y).toBeGreaterThanOrEqual(dock.y);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(dock.y + dock.height);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
      await page.screenshot({ path: 'test-results/time-controls-' + size.width + '.png' });
      await page.reload();
      await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
      await expect(step).toHaveValue('30');
      await expect(page.getByRole('button', { name: 'Скорость 10 дн/сек', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    const settings = page.locator('.scene-settings > summary');
    await settings.click();
    const realTime = page.getByRole('switch', { name: 'Реальные скорости — время 1:1', exact: true });
    await realTime.check();
    await settings.click();
    await expect(page.locator('.real-time-badge')).toBeVisible();
    await expect(page.locator('.speed-presets')).toBeHidden();
    await expect(page.getByRole('combobox', { name: 'Шаг времени' })).toBeVisible();
    await settings.click();
    await page.getByRole('button', { name: 'Вернуть исходные настройки' }).click();
    await settings.click();
    await expect(page.getByRole('combobox', { name: 'Шаг времени' })).toHaveValue('10');
    await expect(page.getByRole('button', { name: 'Скорость 1 дн/сек', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('gesture hints match touch and switch when a mouse is used', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('');
    await page.getByRole('button', { name: 'Приостановить симуляцию' }).click();
    const hint = page.locator('.scene-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAttribute('data-input', 'touch');
    await expect(hint).toContainText('Одним пальцем — вращение');
    await expect(hint).toContainText('Двумя — масштаб и сдвиг');
    await expect(hint).not.toContainText('Колесо');
    let scene = await sceneBounds(page);
    await page.mouse.click(scene.x + scene.width / 2, scene.y + scene.height / 2);
    await expect(hint).toHaveAttribute('data-input', 'mouse');
    await expect(hint).toContainText('Колесо — масштаб');
    await waitForCamera(page);
    scene = await sceneBounds(page);
    await page.touchscreen.tap(scene.x + scene.width / 2, scene.y + scene.height / 2);
    await expect(hint).toHaveAttribute('data-input', 'touch');
    await expect(page.locator('canvas')).toHaveAttribute('aria-description', /Одним пальцем/);
  });
});

test('a mouse keeps the wheel and drag hint on a desktop screen', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.scene-hint')).toHaveAttribute('data-input', 'mouse');
  await expect(page.locator('.scene-hint')).toContainText('Колесо — масштаб');
});
