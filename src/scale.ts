import * as THREE from 'three';
import { PHYSICAL_RADIUS_KM, SATURN_RING_KM } from './constants/physicalData';
import { AU_KM, AU_SCALE, getPlanetPosition } from './utils/orbitPhysics';
import { PLANET_SIZES } from './solarSystem';
import type { PlanetInstance, SolarSystem } from './types/types';

export const KM_TO_SCENE = AU_SCALE / AU_KM;
const originalOrbits = new WeakMap<THREE.Line, Float32Array>();

/** Anchor a sampled orbit at the focused planet so its line stays accurate in a close view. */
export function updatePhysicalOrbit(planet: PlanetInstance, days: number) {
  const line = planet.orbitLine;
  const position = line.geometry.attributes.position;
  if (!originalOrbits.has(line)) originalOrbits.set(line, new Float32Array(position.array));
  const center = planet.group.position;
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    getPlanetPosition(planet.data, days + i / (position.count - 1) * planet.data.period, point);
    position.setXYZ(i, point.x - center.x, point.y - center.y, point.z - center.z);
  }
  line.position.copy(center);
  position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function updateRings(rings: THREE.Mesh<THREE.RingGeometry>, inner: number, outer: number) {
  const position = rings.geometry.attributes.position;
  const uv = rings.geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    const radius = Math.hypot(x, y);
    const next = inner + (outer - inner) * uv.getX(i);
    position.setXY(i, x / radius * next, y / radius * next);
  }
  position.needsUpdate = true;
  rings.geometry.computeBoundingSphere();
}

export function applyDisplayScale(system: SolarSystem, realistic: boolean, illustrativeScale = 1) {
  system.sun.mesh.scale.setScalar(realistic ? PHYSICAL_RADIUS_KM.sun * KM_TO_SCENE / 4 : 1);
  for (const planet of Object.values(system.planets)) {
    planet.group.scale.setScalar(realistic ? 1 : illustrativeScale);
    planet.pivot.scale.setScalar(realistic ? PHYSICAL_RADIUS_KM[planet.data.name] * KM_TO_SCENE / PLANET_SIZES[planet.data.name] : 1);
    const original = originalOrbits.get(planet.orbitLine);
    if (!realistic && original) {
      const position = planet.orbitLine.geometry.attributes.position;
      position.array.set(original); position.needsUpdate = true;
      planet.orbitLine.position.set(0, 0, 0);
      planet.orbitLine.geometry.computeBoundingSphere();
      originalOrbits.delete(planet.orbitLine);
    }
  }
  for (const moon of Object.values(system.moons)) {
    const distanceScale = realistic ? moon.moonData.semiMajorAxisKm * KM_TO_SCENE / moon.moonData.displaySemiMajorAxis : 1;
    moon.orbitGroup.scale.setScalar(distanceScale);
    moon.mesh.scale.setScalar(realistic ? PHYSICAL_RADIUS_KM[moon.moonData.name] * KM_TO_SCENE / (moon.moonData.size * distanceScale) : 1);
  }
  const saturn = system.planets.saturn;
  const rings = saturn.rings;
  const outer = realistic ? SATURN_RING_KM.outer / PHYSICAL_RADIUS_KM.saturn * PLANET_SIZES.saturn : 10;
  if (rings && rings.userData.realisticSizes !== realistic) {
    const inner = realistic ? SATURN_RING_KM.inner / PHYSICAL_RADIUS_KM.saturn * PLANET_SIZES.saturn : 5.5;
    updateRings(rings, inner, outer);
    rings.userData.realisticSizes = realistic;
  }
  const body = system.bodies.find(body => body.id === 'saturn');
  if (body) body.radius = outer;
}
