import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createSolarSystem } from '../src/solarSystem';
import { PHYSICAL_RADIUS_KM, PHYSICAL_ROTATION_DAYS, SATURN_RING_KM } from '../src/constants/physicalData';
import { applyDisplayScale, KM_TO_SCENE, updatePhysicalOrbit } from '../src/scale';
import { getMoonPosition, getMoonPositionKm } from '../src/utils/moonOrbits';
import { getPlanetPosition } from '../src/utils/orbitPhysics';
import { advanceSimulation, FrameClock } from '../src/simulation';
import { getRotationAngle } from '../src/rotation';
import { loadPreferences } from '../src/settings';
import { RenderOrigin } from '../src/renderOrigin';
import { CameraController } from '../src/camera';
import type { TextureManager } from '../src/textures';
import type { PlanetId, SolarSystem } from '../src/types/types';

describe('physical scale', () => {
  let system: SolarSystem;
  let scene: THREE.Scene;
  const texture = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  const radius = (mesh: THREE.Mesh) => (mesh.geometry as THREE.SphereGeometry).parameters.radius * mesh.getWorldScale(new THREE.Vector3()).x;
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({
      createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillStyle: '',
    }) }) });
    scene = new THREE.Scene();
    const textures = { bind: (_owner: string, _key: string, apply: (texture: THREE.Texture) => void) => apply(texture) } as unknown as TextureManager;
    system = createSolarSystem(scene, textures);
    for (const planet of Object.values(system.planets)) getPlanetPosition(planet.data, 9798, planet.group.position);
    for (const moon of Object.values(system.moons)) getMoonPosition(moon.moonData, 9798, moon.mesh.position);
  });
  beforeEach(() => applyDisplayScale(system, false));
  afterAll(() => {
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      }
    });
    texture.dispose(); system.sun.sprite.material.map?.dispose(); system.sun.sprite.material.dispose();
    vi.unstubAllGlobals();
  });

  it('gives all 32 bodies their physical radii in the same units as planetary distances', () => {
    applyDisplayScale(system, true);
    for (const body of system.bodies) expect(radius(body.mesh)).toBeCloseTo(PHYSICAL_RADIUS_KM[body.id] * KM_TO_SCENE, 12);
    expect(radius(system.sun.mesh) / radius(system.planets.earth.mesh)).toBeCloseTo(695700 / 6371.0084, 8);
  });

  it('uses physical satellite distances independently of body size', () => {
    applyDisplayScale(system, true);
    for (const moon of Object.values(system.moons)) {
      const distance = moon.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(system.planets[moon.moonData.parent].group.getWorldPosition(new THREE.Vector3()));
      expect(distance).toBeCloseTo(getMoonPositionKm(moon.moonData, 9798).length() * KM_TO_SCENE, 10);
    }
  });

  it('scales Saturn’s rings physically and fits their outer edge in the focus bounds', () => {
    applyDisplayScale(system, true);
    const ring = system.planets.saturn.rings!;
    const attribute = ring.geometry.attributes.position;
    const radii = Array.from({ length: attribute.count }, (_, i) => Math.hypot(attribute.getX(i), attribute.getY(i)) * ring.getWorldScale(new THREE.Vector3()).x);
    expect(Math.min(...radii)).toBeCloseTo(SATURN_RING_KM.inner * KM_TO_SCENE, 7);
    expect(Math.max(...radii)).toBeCloseTo(SATURN_RING_KM.outer * KM_TO_SCENE, 7);
    const body = system.bodies.find(body => body.id === 'saturn')!;
    expect(body.radius * body.mesh.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(SATURN_RING_KM.outer * KM_TO_SCENE, 12);
  });

  it('restores the illustrative scale and saved magnification after repeated switches', () => {
    const original = system.bodies.map(body => radius(body.mesh));
    for (let i = 0; i < 3; i++) { applyDisplayScale(system, true); applyDisplayScale(system, false, 1.6); }
    system.bodies.forEach((body, i) => expect(radius(body.mesh)).toBeCloseTo(original[i] * (body.id === 'sun' ? 1 : 1.6), 10));
    expect(system.bodies.find(body => body.id === 'saturn')!.radius).toBe(10);
  });

  it('uses the physical planet radius in satellite shadow uniforms', () => {
    applyDisplayScale(system, true);
    const moon = system.moons.moon.mesh;
    moon.onBeforeRender(null!, null!, null!, null!, null!, null!);
    expect(moon.material.uniforms.planetRadius.value).toBeCloseTo(PHYSICAL_RADIUS_KM.earth * KM_TO_SCENE, 12);
  });

  it('anchors the focused planet orbit precisely and restores the original line afterwards', () => {
    const earth = system.planets.earth;
    const position = earth.orbitLine.geometry.attributes.position;
    const original = Array.from(position.array);
    applyDisplayScale(system, true);
    updatePhysicalOrbit(earth, 9798);
    expect(new THREE.Vector3().fromBufferAttribute(position, 0).length()).toBeLessThan(1e-8);
    expect(earth.orbitLine.position.distanceTo(earth.group.position)).toBeLessThan(1e-12);
    applyDisplayScale(system, false);
    expect(Array.from(position.array)).toEqual(original);
    expect(earth.orbitLine.position.length()).toBe(0);
  });

  it('focuses a tiny moon at a distant planet without clipping it', () => {
    applyDisplayScale(system, true);
    const body = system.bodies.find(body => body.id === 'mimas')!;
    const camera = new THREE.PerspectiveCamera(45, 1280 / 720, 0.01, 20000);
    const controls = { target: new THREE.Vector3(), minDistance: 0, maxDistance: 15000 };
    const controller = new CameraController(camera, controls);
    controller.setViewport(268, 100, 676, 440, 1280, 720);
    controller.focus(body); controller.update(1);
    camera.lookAt(controls.target); camera.updateMatrixWorld();
    const center = body.mesh.getWorldPosition(new THREE.Vector3());
    expect(camera.near).toBeLessThan(radius(body.mesh) / 50);
    expect(camera.position.distanceTo(center) - radius(body.mesh)).toBeGreaterThan(camera.near);
    const screen = center.project(camera);
    expect((screen.x + 1) / 2 * 1280).toBeCloseTo(606, 4);
    expect((1 - screen.y) / 2 * 720).toBeCloseTo(320, 4);
  });
});

describe('real-time motion', () => {
  for (const fps of [30, 60, 144]) it('runs one simulated second per real second at ' + fps + ' FPS', () => {
    const state = { simDays: 0, isPaused: false, timeScale: 10 };
    for (let i = 0; i < fps * 10; i++) advanceSimulation(state, 1 / fps, true);
    expect(state.simDays * 86400).toBeCloseTo(10, 9);
    expect(state.timeScale).toBe(10);
    state.isPaused = true;
    advanceSimulation(state, 100, true);
    expect(state.simDays * 86400).toBeCloseTo(10, 9);
  });

  it('keeps real-time speed during a long frame and resets after hiding the tab', () => {
    const clock = new FrameClock();
    clock.tick(0);
    expect(clock.tick(1000, Infinity)).toBe(1);
    clock.reset();
    expect(clock.tick(600000, Infinity)).toBe(0);
  });

  for (const id of Object.keys(PHYSICAL_ROTATION_DAYS) as PlanetId[]) it(id + ': completes one spin in its sidereal period', () => {
    expect(getRotationAngle(id, PHYSICAL_ROTATION_DAYS[id], true)).toBeCloseTo(Math.PI * 2, 12);
    expect(getRotationAngle(id, 1 / 86400, true)).toBeCloseTo(Math.PI * 2 / (PHYSICAL_ROTATION_DAYS[id] * 86400), 12);
  });

  it('persists and validates both independent mode flags without losing the previous speed', () => {
    const prefs = loadPreferences({ getItem: () => JSON.stringify({ version: 1, timeScale: 10, settings: { realisticSizes: true, realTime: true } }) });
    expect(prefs.settings.realisticSizes).toBe(true);
    expect(prefs.settings.realTime).toBe(true);
    expect(prefs.timeScale).toBe(10);
    const invalid = loadPreferences({ getItem: () => JSON.stringify({ version: 1, settings: { realisticSizes: 'true', realTime: 1 } }) });
    expect(invalid.settings.realisticSizes).toBe(false);
    expect(invalid.settings.realTime).toBe(false);
  });
});

describe('render origin', () => {
  it('preserves small geometry near distant objects and restores absolute positions', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.position.x = 1000.0002;
    const body = new THREE.Object3D(); body.position.x = 1000; scene.add(body);
    expect(Math.fround(1000 + 0.00001)).toBe(Math.fround(1000));
    const origin = new RenderOrigin(scene, camera);
    origin.render(() => {
      const x = body.getWorldPosition(new THREE.Vector3()).x;
      expect(Math.fround(x + 0.00001) - Math.fround(x)).toBeGreaterThan(0.000009);
      expect(camera.position.length()).toBe(0);
    });
    expect(camera.position.x).toBe(1000.0002);
    expect(scene.position.length()).toBe(0);
    expect(body.getWorldPosition(new THREE.Vector3()).x).toBe(1000);
  });

  it('restores the scene and camera if drawing throws', () => {
    const scene = new THREE.Scene(); scene.position.set(3, 2, 1);
    const camera = new THREE.PerspectiveCamera(); camera.position.set(100, 20, 30);
    const origin = new RenderOrigin(scene, camera);
    expect(() => origin.render(() => { throw new Error('context lost'); })).toThrow('context lost');
    expect(scene.position.toArray()).toEqual([3, 2, 1]);
    expect(camera.position.toArray()).toEqual([100, 20, 30]);
  });
});
