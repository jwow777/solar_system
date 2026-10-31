import { Vector3 } from 'three';
import type { PlanetOrbitData } from '../types/types';

export const AU_SCALE = 30;
const TAU = 2 * Math.PI;
const RAD = Math.PI / 180;
export const AU_KM = 149_597_870.7;
const SOLAR_MU = 1.32712440018e11; // km³/s², IAU/JPL solar gravitational parameter

export function normalizeAngle(angle: number): number {
  return ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

export function solveKepler(meanAnomaly: number, eccentricity: number): number {
  if (!Number.isFinite(meanAnomaly) || !Number.isFinite(eccentricity) || eccentricity < 0 || eccentricity >= 1) {
    throw new RangeError('Expected a finite anomaly and an elliptic orbit (0 ≤ e < 1).');
  }
  const M = normalizeAngle(meanAnomaly);
  let E = eccentricity < 0.8 ? M : (M < 0 ? -Math.PI : Math.PI);
  for (let iteration = 0; iteration < 50; iteration++) {
    const step = (E - eccentricity * Math.sin(E) - M) / (1 - eccentricity * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-12) return E;
  }
  throw new Error('Kepler solver did not converge.');
}

export function getMeanAnomaly(data: PlanetOrbitData, daysSinceJ2000: number): number {
  return normalizeAngle((data.meanLongJ2000 - data.longitudeOfPerihelion) * RAD + TAU * daysSinceJ2000 / data.period);
}

export function getPlanetPosition(data: PlanetOrbitData, daysSinceJ2000: number, target = new Vector3()): Vector3 {
  const E = solveKepler(getMeanAnomaly(data, daysSinceJ2000), data.e);
  const xOrbit = data.a * (Math.cos(E) - data.e);
  const yOrbit = data.a * Math.sqrt(1 - data.e * data.e) * Math.sin(E);
  return perifocalToScene(xOrbit, yOrbit, data.i, data.node, data.longitudeOfPerihelion - data.node, target).multiplyScalar(AU_SCALE);
}

/** Classical perifocal coordinates → right-handed, Y-up J2000 ecliptic scene. */
export function perifocalToScene(xOrbit: number, yOrbit: number, inclinationDeg: number, nodeDeg: number, argumentDeg: number, target = new Vector3()): Vector3 {
  const w = argumentDeg * RAD;
  const node = nodeDeg * RAD;
  const inclination = inclinationDeg * RAD;
  const x = (Math.cos(w) * Math.cos(node) - Math.sin(w) * Math.sin(node) * Math.cos(inclination)) * xOrbit
    + (-Math.sin(w) * Math.cos(node) - Math.cos(w) * Math.sin(node) * Math.cos(inclination)) * yOrbit;
  const z = (Math.cos(w) * Math.sin(node) + Math.sin(w) * Math.cos(node) * Math.cos(inclination)) * xOrbit
    + (-Math.sin(w) * Math.sin(node) + Math.cos(w) * Math.cos(node) * Math.cos(inclination)) * yOrbit;
  const y = Math.sin(w) * Math.sin(inclination) * xOrbit + Math.cos(w) * Math.sin(inclination) * yOrbit;
  // Reflect ecliptic Y so north is +Y in Three.js's right-handed frame.
  return target.set(x, y, -z);
}

export function getOrbitalSpeedKmS(data: PlanetOrbitData, radiusAU: number): number {
  return Math.sqrt(SOLAR_MU / AU_KM * (2 / radiusAU - 1 / data.a));
}
