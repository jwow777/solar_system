import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

let script: string;
test.beforeAll(async () => {
  const result = await build({ configFile: false, logLevel: 'error', build: {
    write: false, emptyOutDir: false, minify: false,
    lib: { entry: fileURLToPath(new URL('../fixtures/eclipse.ts', import.meta.url)), name: 'EclipseFixture', formats: ['iife'] },
  } });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => 'output' in bundle ? bundle.output : []);
  const chunk = outputs.find(item => item.type === 'chunk');
  if (!chunk) throw new Error('Missing fixture bundle');
  script = chunk.code;
});

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><html><body style="margin:0;background:black"></body></html>');
  await page.addScriptTag({ content: script });
});

test('the lunar shadow has umbra, penumbra and correct world-space placement', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const render = (moon: [number, number, number], scale = 1, sunIntensity = 1.2) => page.evaluate(({ moon, scale, sunIntensity }) =>
    (window as any).EclipseFixture.render({ moon, scale, sunIntensity }), { moon, scale, sunIntensity });
  const lit = await render([3, 0, 1.8]);
  const full = await render([0, 0, 1.8]);
  expect(lit.center).toBeGreaterThan(80);
  expect(full.center).toBeLessThan(lit.center * 0.6);
  expect(full.edge).toBeGreaterThan(full.center + 20);
  await page.locator('#eclipse-fixture').screenshot({ path: 'test-results/eclipse-surface.png' });
  const annular = await render([0, 0, 4]);
  expect(annular.center).toBeGreaterThan(full.center + 5);
  expect(annular.center).toBeLessThan(lit.center - 10);
  let previous = full.center;
  for (const x of [0.1, 0.2, 0.3, 0.4, 0.6, 1]) {
    const result = await render([x, 0, 1.8]);
    expect(result.center).toBeGreaterThanOrEqual(previous - 1);
    previous = result.center;
  }
  expect(previous).toBeCloseTo(lit.center, 0);
  for (const moon of [[0, 0, -3], [0, 0, 35]] as [number, number, number][]) {
    expect((await render(moon)).center).toBeCloseTo(lit.center, 0);
  }
  for (const scale of [0.5, 2]) {
    expect((await render([0, 0, 1.8], scale)).center).toBeCloseTo(full.center, 0);
  }
  const ambient = await render([3, 0, 1.8], 1, 0);
  expect((await render([0, 0, 1.8], 1, 0)).center).toBeCloseTo(ambient.center, 0);
  expect(errors).toEqual([]);
});

test('the Moon also shadows opaque clouds and atmospheric scattering', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const layer of ['clouds', 'atmosphere']) {
    const render = (x: number) => page.evaluate(({ x, layer }) => (window as any).EclipseFixture.render({
      moon: [x, 0, 1.8], clouds: layer === 'clouds', atmosphere: layer === 'atmosphere', surface: false,
    }), { x, layer });
    const lit = await render(3);
    const shadow = await render(0);
    expect(lit.center).toBeGreaterThan(2);
    expect(shadow.center).toBeLessThan(lit.center * 0.6);
    await page.locator('#eclipse-fixture').screenshot({ path: 'test-results/eclipse-' + layer + '.png' });
  }
  expect(errors).toEqual([]);
});

test('the lunar shadow also renders with physical sizes and distances', async ({ page }) => {
  const render = (x: number) => page.evaluate(x => (window as any).EclipseFixture.render({
    moon: [x, 0, 2.85], realisticSizes: true,
  }), x);
  const lit = await render(3);
  const eclipse = await render(0);
  expect(lit.center).toBeGreaterThan(80);
  expect(eclipse.center).toBeLessThan(lit.center * 0.7);
  expect(eclipse.edge).toBeGreaterThan(eclipse.center + 10);
  await page.locator('#eclipse-fixture').screenshot({ path: 'test-results/eclipse-real-scale.png' });
});
