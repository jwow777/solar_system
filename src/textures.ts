import * as THREE from 'three';
import sources from './constants/textureSources.json';
import type { BodyId } from './types/types';

type Owner = BodyId | 'background';
export type TextureKey = keyof typeof sources;
export interface LoadingStatus { pending: number; failed: number }
interface Binding { owner: Owner; key: TextureKey; apply: (texture: THREE.Texture) => void; generation: number }
interface Entry { promise: Promise<THREE.Texture | null>; texture?: THREE.Texture }

export class TextureManager {
  private loader = new THREE.TextureLoader();
  private cache = new Map<string, Entry>();
  private bindings: Binding[] = [];
  private selected: BodyId | null = null;
  private pending = 0;
  private failed = new Set<string>();
  private disposed = false;
  private placeholder = new THREE.DataTexture(new Uint8Array([180, 180, 180, 255]), 1, 1);
  onStatus: (status: LoadingStatus) => void = () => {};

  get status(): LoadingStatus { return { pending: this.pending, failed: this.failed.size }; }

  constructor(private anisotropy: number, private maxTextureSize: number) {
    this.placeholder.needsUpdate = true;
  }

  bind(owner: Owner, key: string, apply: Binding['apply']) {
    if (!(key in sources)) throw new Error('Unknown texture: ' + key);
    const binding: Binding = { owner, key: key as TextureKey, apply, generation: 0 };
    this.bindings.push(binding);
    apply(this.placeholder);
    this.sync(binding);
  }

  private report() { this.onStatus({ pending: this.pending, failed: this.failed.size }); }

  private load(key: TextureKey, quality: '2k' | '4k'): Promise<THREE.Texture | null> {
    const cacheKey = quality + '/' + key;
    const existing = this.cache.get(cacheKey);
    if (existing) return existing.promise;
    const entry: Entry = { promise: Promise.resolve(null) };
    this.cache.set(cacheKey, entry);
    this.pending++;
    this.report();
    entry.promise = this.loader.loadAsync(import.meta.env.BASE_URL + 'textures/' + cacheKey + '.webp')
      .then(texture => {
        if (this.disposed || this.cache.get(cacheKey) !== entry) { texture.dispose(); return null; }
        texture.anisotropy = Math.min(this.anisotropy, 8);
        texture.colorSpace = key === 'waterMap' || key === 'earthCloudsMap' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        entry.texture = texture;
        this.failed.delete(cacheKey);
        return texture;
      }).catch(() => {
        if (!this.disposed && this.cache.get(cacheKey) === entry) this.failed.add(cacheKey);
        return null;
      }).finally(() => { this.pending--; if (!this.disposed) this.report(); });
    return entry.promise;
  }

  private sync(binding: Binding) {
    const generation = ++binding.generation;
    const high = binding.owner === this.selected && this.maxTextureSize >= 4096;
    void this.load(binding.key, '2k').then(async low => {
      if (this.disposed || generation !== binding.generation) return;
      if (low) binding.apply(low);
      if (high) {
        const detail = await this.load(binding.key, '4k');
        if (detail && !this.disposed && generation === binding.generation) binding.apply(detail);
      }
    });
  }

  select(id: BodyId | null) {
    this.selected = id;
    const needed = new Set(this.bindings.filter(b => b.owner === id).map(b => '4k/' + b.key));
    // Return other bodies to 2K before releasing their 4K GPU resources.
    for (const binding of this.bindings) {
      const low = this.cache.get('2k/' + binding.key)?.texture;
      if (binding.owner !== id) binding.apply(low ?? this.placeholder);
      this.sync(binding);
    }
    for (const [key, entry] of this.cache) {
      if (key.startsWith('4k/') && !needed.has(key)) {
        entry.texture?.dispose();
        this.cache.delete(key);
        this.failed.delete(key);
      }
    }
    this.report();
  }

  retry() {
    for (const key of this.failed) this.cache.delete(key);
    this.failed.clear();
    for (const binding of this.bindings) this.sync(binding);
    this.report();
  }

  dispose() {
    this.disposed = true;
    for (const entry of this.cache.values()) entry.texture?.dispose();
    this.cache.clear();
    this.placeholder.dispose();
  }
}
