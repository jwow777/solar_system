import * as THREE from 'three';
import type { BodyId, SolarSystem } from './types/types';

export const ORBIT_OPACITY = 0.12;
export const MOON_ORBIT_OPACITY = 0.09;

export class OrbitHover {
  private entries: { id: BodyId; line: THREE.Line; opacity: number }[];
  private current: BodyId | null = null;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();

  constructor(system: Pick<SolarSystem, 'planets' | 'moons'>) {
    this.entries = [
      ...Object.values(system.planets).map(body => ({ id: body.data.name, line: body.orbitLine })),
      ...Object.values(system.moons).map(body => ({ id: body.moonData.name, line: body.orbitLine })),
    ].map(entry => ({ ...entry, opacity: (entry.line.material as THREE.LineBasicMaterial).opacity }));
  }

  set(id: BodyId | null) {
    if (this.current === id) return;
    this.current = id;
    for (const { id: bodyId, line, opacity } of this.entries) {
      (line.material as THREE.LineBasicMaterial).opacity = bodyId === id ? 1 : opacity;
    }
  }

  // Measure in CSS pixels so a distant orbit is as easy to hover as a nearby one.
  pick(camera: THREE.Camera, x: number, y: number, width: number, height: number): BodyId | null {
    let closest = 6 * 6;
    let result: BodyId | null = null;
    for (const { id, line } of this.entries) {
      let visible = true;
      for (let parent: THREE.Object3D | null = line; parent; parent = parent.parent) {
        if (!parent.visible) { visible = false; break; }
      }
      if (!visible) continue;
      const points = line.geometry.getAttribute('position');
      for (let i = 1; i < points.count; i++) {
        this.from.fromBufferAttribute(points, i - 1).applyMatrix4(line.matrixWorld).project(camera);
        this.to.fromBufferAttribute(points, i).applyMatrix4(line.matrixWorld).project(camera);
        if (this.from.z < -1 || this.from.z > 1 || this.to.z < -1 || this.to.z > 1) continue;
        const ax = (this.from.x + 1) * width / 2, ay = (1 - this.from.y) * height / 2;
        const bx = (this.to.x + 1) * width / 2, by = (1 - this.to.y) * height / 2;
        const dx = bx - ax, dy = by - ay;
        const length = dx * dx + dy * dy;
        const t = length === 0 ? 0 : THREE.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / length, 0, 1);
        const distance = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
        if (distance <= closest) { closest = distance; result = id; }
      }
    }
    return result;
  }
}
