import { describe, expect, it } from 'vitest';
import { PLANETS_DATA } from '../src/constants/planetsData';
import { BODY_CATALOG } from '../src/catalog';
import { AU_SCALE, getMeanAnomaly, getOrbitalSpeedKmS, getPlanetPosition, normalizeAngle, solveKepler } from '../src/utils/orbitPhysics';

describe('Keplerian orbits', () => {
  for (const planet of PLANETS_DATA) {
    it(planet.name + ': closes after a period, including negative dates', () => {
      for (const days of [0, 1234, -321]) {
        expect(getPlanetPosition(planet, days).distanceTo(getPlanetPosition(planet, days + planet.period))).toBeLessThan(1e-8);
      }
    });
    it(planet.name + ': reaches the expected perihelion and aphelion', () => {
      const orbit = { ...planet, meanLongJ2000: planet.longitudeOfPerihelion };
      expect(getPlanetPosition(orbit, 0).length() / AU_SCALE).toBeCloseTo(planet.a * (1 - planet.e), 9);
      expect(getPlanetPosition(orbit, planet.period / 2).length() / AU_SCALE).toBeCloseTo(planet.a * (1 + planet.e), 9);
    });
  }

  it('uses longitude of perihelion without subtracting the ascending node twice', () => {
    const mercury = PLANETS_DATA[0];
    expect(getMeanAnomaly(mercury, 0)).toBeCloseTo(normalizeAngle((252.25 - 77.46) * Math.PI / 180), 12);
  });

  it('orients circular orbits by mean longitude in the right-handed scene frame', () => {
    const orbit = { ...PLANETS_DATA[0], a: 1, e: 0, i: 0, node: 48, longitudeOfPerihelion: 77, meanLongJ2000: 60 };
    const position = getPlanetPosition(orbit, 0);
    expect(position.x / AU_SCALE).toBeCloseTo(0.5, 12);
    expect(position.y).toBeCloseTo(0, 12);
    expect(position.z / AU_SCALE).toBeCloseTo(-Math.sqrt(3) / 2, 12);
  });

  it('returns realistic circular speeds at Earth, Jupiter and Neptune distances', () => {
    for (const [a, expected] of [[1, 29.785], [5.2026, 13.058], [30.1104, 5.428]]) {
      expect(getOrbitalSpeedKmS({ ...PLANETS_DATA[0], a }, a)).toBeCloseTo(expected, 2);
    }
  });

  it('keeps dwarf-planet periods consistent with Kepler’s third law', () => {
    for (const name of ['haumea', 'makemake', 'eris']) {
      const data = PLANETS_DATA.find(p => p.name === name)!;
      expect(Math.abs(data.period / (365.256 * data.a ** 1.5) - 1)).toBeLessThan(0.02);
    }
  });

  it('solves eccentric orbits and normalizes very large and negative anomalies', () => {
    for (const e of [0, 0.44, 0.95]) for (const M of [-1e6, -Math.PI, 0, 0.1, 1e6]) {
      const E = solveKepler(M, e);
      expect(E - e * Math.sin(E)).toBeCloseTo(normalizeAngle(M), 10);
    }
    expect(() => solveKepler(0, 1)).toThrow(RangeError);
    expect(() => solveKepler(NaN, 0.5)).toThrow(RangeError);
  });

  it('provides all 32 named, unique navigation entries', () => {
    expect(BODY_CATALOG).toHaveLength(32);
    expect(new Set(BODY_CATALOG.map(body => body.id)).size).toBe(32);
    expect(BODY_CATALOG.every(body => body.name.length > 0)).toBe(true);
    expect(BODY_CATALOG.filter(body => body.kind === 'moon')).toHaveLength(18);
    expect(BODY_CATALOG.filter(body => body.kind === 'dwarf')).toHaveLength(5);
  });
});
