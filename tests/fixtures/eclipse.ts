import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createSolarSystem } from '../../src/solarSystem';
import type { TextureManager } from '../../src/textures';
import { applyDisplayScale } from '../../src/scale';
import { RenderOrigin } from '../../src/renderOrigin';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(400, 400);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.domElement.id = 'eclipse-fixture';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0);
const camera = new THREE.OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.01, 1000);
const maps = new Map<string, THREE.DataTexture>();
const textures = {
  bind(_owner: string, key: string, apply: (texture: THREE.Texture) => void) {
    let texture = maps.get(key);
    if (!texture) {
      const value = key === 'earthMap' ? 180 : 0;
      texture = new THREE.DataTexture(new Uint8Array([value, value, value, 255]), 1, 1);
      texture.colorSpace = key === 'earthMap' || key === 'earthNightMap' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.needsUpdate = true;
      maps.set(key, texture);
    }
    apply(texture);
  },
} as unknown as TextureManager;
// Use the production scene constructor, including its automatic eclipse bindings.
const solar = createSolarSystem(scene, textures);
for (const planet of Object.values(solar.planets)) {
  planet.group.visible = false;
  planet.orbitLine.visible = false;
}
for (const moon of Object.values(solar.moons)) {
  // The foreground Moon must not mask the patch being measured by the test camera.
  moon.mesh.visible = false;
  moon.orbitLine.visible = false;
}
const system = solar.planets.earth.group;
system.visible = true;
const earth = solar.planets.earth.mesh;
const earthMaterial = earth.material as THREE.ShaderMaterial;
const clouds = solar.planets.earth.clouds!;
const atmosphere = solar.planets.earth.pivot.getObjectByName('earth-atmosphere')!;
const moon = solar.moons.moon.mesh;
solar.sun.mesh.visible = false;
solar.sun.mesh.position.z = 30;
solar.sun.light.position.z = 30;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());
const origin = new RenderOrigin(scene, camera);

interface Options {
  moon: [number, number, number];
  clouds?: boolean;
  atmosphere?: boolean;
  surface?: boolean;
  scale?: number;
  sunIntensity?: number;
  realisticSizes?: boolean;
}

export function render(options: Options) {
  const scale = options.scale ?? 1;
  applyDisplayScale(solar, options.realisticSizes ?? false);
  system.scale.setScalar(scale);
  moon.position.set(...options.moon);
  earth.visible = options.surface ?? true;
  clouds.visible = options.clouds ?? false;
  atmosphere.visible = options.atmosphere ?? false;
  solar.sun.light.intensity = options.sunIntensity ?? 1.2;
  earthMaterial.uniforms.lightIntensity.value = solar.sun.light.intensity;
  const cloudMap = maps.get('earthCloudsMap')!;
  const bytes = cloudMap.image.data as Uint8Array;
  bytes[0] = bytes[1] = bytes[2] = options.clouds ? 255 : 0;
  cloudMap.needsUpdate = true;
  const viewScale = scale * solar.planets.earth.pivot.scale.x;
  camera.left = camera.bottom = -1.1 * viewScale;
  camera.right = camera.top = 1.1 * viewScale;
  camera.near = viewScale / 100;
  camera.position.set(0, 0, 5 * viewScale);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  if (options.realisticSizes) origin.render(() => composer.render());
  else composer.render();
  const gl = renderer.getContext();
  function brightness(x: number, y: number) {
    const pixels = new Uint8Array(12 * 12 * 4);
    gl.readPixels(x - 6, y - 6, 12, 12, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
    return sum / (12 * 12);
  }
  return { center: brightness(200, 200), edge: brightness(300, 200) };
}
