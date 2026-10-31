import { PHYSICAL_ROTATION_DAYS } from './constants/physicalData';
import type { PlanetId } from './types/types';

const illustrativePeriods: Record<PlanetId, number> = {
  mercury: 58.6, venus: 243, earth: 1, mars: 1.03, ceres: 0.38, jupiter: 0.41,
  saturn: 0.44, uranus: 0.72, neptune: 0.67, pluto: 6.39, haumea: 0.16, makemake: 0.95, eris: 1.08,
};

export function getRotationAngle(id: PlanetId | 'sun', days: number, realTime: boolean): number {
  const period = id === 'sun' ? 25.4 : realTime ? PHYSICAL_ROTATION_DAYS[id] : illustrativePeriods[id];
  return days / period * Math.PI * 2 * (realTime ? 1 : 0.05);
}
