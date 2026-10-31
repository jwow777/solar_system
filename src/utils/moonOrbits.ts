import { Matrix4, Quaternion, Vector3 } from 'three';
import { normalizeAngle, perifocalToScene, solveKepler } from './orbitPhysics';
import type { MoonData, PlanetId } from '../types/types';

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

export function getMoonMeanAnomaly(data: MoonData, days: number): number {
  return normalizeAngle(data.meanAnomalyAtEpoch * RAD + (days - data.epochDays) / data.period * TAU);
}

export function getMoonPositionKm(data: MoonData, days: number, target = new Vector3()): Vector3 {
  const E = solveKepler(getMoonMeanAnomaly(data, days), data.eccentricity);
  return perifocalToScene(data.semiMajorAxisKm * (Math.cos(E) - data.eccentricity),
    data.semiMajorAxisKm * Math.sqrt(1 - data.eccentricity ** 2) * Math.sin(E),
    data.inclination, data.ascendingNode, data.argumentOfPeriapsis, target);
}

export function getMoonPosition(data: MoonData, days: number, target = new Vector3()): Vector3 {
  return getMoonPositionKm(data, days, target).multiplyScalar(data.displaySemiMajorAxis / data.semiMajorAxisKm);
}

export function getMoonSpeedKmS(data: MoonData, radiusKm: number): number {
  return Math.sqrt(data.gmKm3S2 * (2 / radiusKm - 1 / data.semiMajorAxisKm));
}

export function getMoonOrbitPoints(data: MoonData, segments = 128): Vector3[] {
  return Array.from({ length: segments + 1 }, (_, i) => getMoonPosition(data, data.epochDays + i / segments * data.period));
}

export function getMoonOrbitalFrame(data: MoonData): Quaternion {
  const x = perifocalToScene(1, 0, data.inclination, data.ascendingNode, data.argumentOfPeriapsis);
  const z = perifocalToScene(0, -1, data.inclination, data.ascendingNode, data.argumentOfPeriapsis);
  const y = new Vector3().crossVectors(z, x);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

// IAU pole constants at J2000, from NAIF pck00011.tpc. The sign for Uranus
// follows its retrograde spin, allowing positive spin periods throughout the app.
const spinPoles: Partial<Record<PlanetId, [number, number]>> = {
  earth: [0, 90], jupiter: [268.056595, 64.495303], saturn: [40.589, 83.537],
  uranus: [77.311, 15.175], neptune: [299.36, 43.46],
};

export function getPlanetSpinAxis(id: PlanetId): Vector3 | null {
  const pole = spinPoles[id];
  if (!pole) return null;
  const [ra, dec] = pole.map(value => value * RAD);
  const x = Math.cos(dec) * Math.cos(ra), y = Math.cos(dec) * Math.sin(ra), z = Math.sin(dec);
  const obliquity = 23.439291111 * RAD;
  return new Vector3(x, -y * Math.sin(obliquity) + z * Math.cos(obliquity),
    -y * Math.cos(obliquity) - z * Math.sin(obliquity)).normalize();
}
