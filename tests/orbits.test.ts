import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OrbitHover, ORBIT_OPACITY } from '../src/orbits';
import type { SolarSystem } from '../src/types/types';

function fixture() {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0),
  ]), new THREE.LineBasicMaterial({ transparent: true, opacity: ORBIT_OPACITY }));
  const parent = new THREE.Group();
  parent.add(line);
  parent.updateMatrixWorld(true);
  const system = { planets: { earth: { data: { name: 'earth' }, orbitLine: line } }, moons: {} } as unknown as SolarSystem;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.z = 10;
  camera.updateMatrixWorld();
  return { line, parent, camera, hover: new OrbitHover(system) };
}

describe('orbit hover', () => {
  it('uses the same pixel tolerance at different camera distances', () => {
    const { hover, camera } = fixture();
    for (const distance of [3, 100]) {
      camera.position.z = distance;
      camera.updateMatrixWorld();
      expect(hover.pick(camera, 250, 255, 500, 500)).toBe('earth');
      expect(hover.pick(camera, 250, 258, 500, 500)).toBe(null);
    }
  });

  it('ignores hidden ancestors, clipped lines and segments behind the camera', () => {
    const { hover, parent, line, camera } = fixture();
    parent.visible = false;
    expect(hover.pick(camera, 250, 250, 500, 500)).toBe(null);
    parent.visible = true;
    line.position.z = 20;
    parent.updateMatrixWorld(true);
    expect(hover.pick(camera, 250, 250, 500, 500)).toBe(null);
    line.position.z = -2000;
    parent.updateMatrixWorld(true);
    expect(hover.pick(camera, 250, 250, 500, 500)).toBe(null);
  });

  it('restores the original opacity when the pointer leaves or hovers the Sun', () => {
    const { hover, line } = fixture();
    hover.set('earth');
    expect(line.material.opacity).toBe(1);
    hover.set(null);
    expect(line.material.opacity).toBe(ORBIT_OPACITY);
    hover.set('earth');
    hover.set('sun');
    expect(line.material.opacity).toBe(ORBIT_OPACITY);
  });
});
