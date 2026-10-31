import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { MOONS_DATA } from '../src/constants/moonsData';
import snapshot from '../src/constants/moonOrbitElements.json';
import { getMoonOrbitPoints, getMoonOrbitalFrame, getMoonPosition, getMoonPositionKm, getMoonSpeedKmS, getPlanetSpinAxis } from '../src/utils/moonOrbits';

const fromEcliptic = ([x, y, z]: number[]) => new Vector3(x, z, -y);

describe('satellite Kepler ellipses', () => {
  for (const data of MOONS_DATA) {
    it(data.name + ': matches independent JPL position and velocity vectors at the snapshot epoch', () => {
      const reference = snapshot.elements[data.name];
      const position = getMoonPositionKm(data, data.epochDays);
      const velocity = getMoonPositionKm(data, data.epochDays + 0.00001)
        .sub(getMoonPositionKm(data, data.epochDays - 0.00001)).divideScalar(2 * 0.00001 * 86400);
      expect(position.distanceTo(fromEcliptic(reference.positionAtEpochKm))).toBeLessThan(0.001);
      expect(velocity.distanceTo(fromEcliptic(reference.velocityAtEpochKmS))).toBeLessThan(0.00001);
      expect(getMoonSpeedKmS(data, position.length())).toBeCloseTo(fromEcliptic(reference.velocityAtEpochKmS).length(), 7);
    });

    it(data.name + ': closes after a period and reaches physical periapsis and apoapsis', () => {
      for (const days of [data.epochDays, -1000, 25000]) {
        expect(getMoonPosition(data, days).distanceTo(getMoonPosition(data, days + data.period))).toBeLessThan(1e-7);
      }
      const orbit = { ...data, meanAnomalyAtEpoch: 0 };
      const periapsis = getMoonPositionKm(orbit, orbit.epochDays).length();
      const apoapsis = getMoonPositionKm(orbit, orbit.epochDays + orbit.period / 2).length();
      expect(periapsis).toBeCloseTo(orbit.semiMajorAxisKm * (1 - orbit.eccentricity), 6);
      expect(apoapsis).toBeCloseTo(orbit.semiMajorAxisKm * (1 + orbit.eccentricity), 6);
      expect(getMoonSpeedKmS(orbit, periapsis) / getMoonSpeedKmS(orbit, apoapsis))
        .toBeCloseTo((1 + orbit.eccentricity) / (1 - orbit.eccentricity), 10);
    });

    it(data.name + ': draws a planar ellipse with the planet at one focus', () => {
      const frame = getMoonOrbitalFrame(data);
      const normal = new Vector3(0, 1, 0).applyQuaternion(frame);
      const otherFocus = new Vector3(-2 * data.displaySemiMajorAxis * data.eccentricity, 0, 0).applyQuaternion(frame);
      const points = getMoonOrbitPoints(data);
      expect(points[0].distanceTo(points.at(-1)!)).toBeLessThan(1e-8);
      for (const point of points) {
        expect(Math.abs(point.dot(normal))).toBeLessThan(1e-8);
        expect(point.length() + point.distanceTo(otherFocus)).toBeCloseTo(2 * data.displaySemiMajorAxis, 9);
      }
    });
  }

  it('moves faster near periapsis instead of stepping uniformly around the ellipse', () => {
    const moon = { ...MOONS_DATA[0], eccentricity: 0.6, meanAnomalyAtEpoch: 0 };
    const dt = moon.period / 10000;
    const speed = (time: number) => getMoonPositionKm(moon, time + dt).distanceTo(getMoonPositionKm(moon, time - dt)) / (2 * dt * 86400);
    expect(speed(moon.epochDays) / speed(moon.epochDays + moon.period / 2)).toBeCloseTo(4, 4);
  });

  it('keeps Saturnian moons outside the rendered rings, even at periapsis', () => {
    for (const moon of MOONS_DATA.filter(data => data.parent === 'saturn')) {
      expect(moon.displaySemiMajorAxis * (1 - moon.eccentricity) - moon.size).toBeGreaterThan(10);
    }
  });

  it('aligns the orbital planes with planetary poles and preserves Triton retrograde motion', () => {
    for (const moon of MOONS_DATA.filter(data => data.parent !== 'earth')) {
      const normal = new Vector3(0, 1, 0).applyQuaternion(getMoonOrbitalFrame(moon));
      const angle = normal.angleTo(getPlanetSpinAxis(moon.parent)!) * 180 / Math.PI;
      if (moon.name === 'triton') {
        expect(angle).toBeGreaterThan(150);
        expect(angle).toBeLessThan(165);
      } else if (moon.name === 'iapetus') {
        expect(angle).toBeGreaterThan(10);
        expect(angle).toBeLessThan(20);
      } else expect(angle).toBeLessThan(5);
    }
    expect(getPlanetSpinAxis('uranus')!.y).toBeLessThan(0);
  });
});
