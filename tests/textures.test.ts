import { afterEach, expect, it, vi } from 'vitest';
import { NoColorSpace, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { TextureManager } from '../src/textures';

const flush = () => new Promise(resolve => setImmediate(resolve));
afterEach(() => vi.restoreAllMocks());

it('starts at 2K, upgrades the selected body, and releases previous 4K textures', async () => {
  const loads = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async () => new Texture());
  const textures = new TextureManager(4, 8192);
  let earth: Texture | undefined;
  textures.bind('earth', 'earthMap', texture => { earth = texture; });
  await flush();
  expect(loads.mock.calls[0][0]).toContain('textures/2k/earthMap.webp');
  expect(earth?.colorSpace).toBe(SRGBColorSpace);
  textures.select('earth');
  await flush();
  expect(loads.mock.calls.some(([url]) => url.includes('/4k/earthMap.webp'))).toBe(true);
  const high = earth!;
  const dispose = vi.spyOn(high, 'dispose');
  textures.select('mars');
  await flush();
  expect(earth).not.toBe(high);
  expect(dispose).toHaveBeenCalledOnce();
  textures.dispose();
});

it('keeps mask textures linear and retries failed loads', async () => {
  const loads = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(new Texture());
  const textures = new TextureManager(4, 4096);
  let mask: Texture | undefined;
  textures.bind('earth', 'waterMap', texture => { mask = texture; });
  await flush();
  expect(textures.status.failed).toBe(1);
  expect(textures.status.pending).toBe(0);
  textures.retry();
  await flush();
  expect(loads).toHaveBeenCalledTimes(2);
  expect(textures.status.failed).toBe(0);
  expect(mask?.colorSpace).toBe(NoColorSpace);
  textures.dispose();
});

it('does not apply a late high-resolution response after focus changed', async () => {
  let finish: (texture: Texture) => void = () => {};
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(url => url.includes('/4k/')
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(new Texture()));
  const textures = new TextureManager(4, 4096);
  let visible: Texture | undefined;
  textures.bind('earth', 'earthMap', texture => { visible = texture; });
  await flush();
  const low = visible;
  textures.select('earth');
  await flush();
  textures.select('sun');
  const stale = new Texture();
  const dispose = vi.spyOn(stale, 'dispose');
  finish(stale);
  await flush();
  expect(visible).toBe(low);
  expect(dispose).toHaveBeenCalledOnce();
  textures.dispose();
});
