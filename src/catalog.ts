import { PLANETS_DATA } from './constants/planetsData';
import { MOONS_DATA } from './constants/moonsData';
import { PLANET_INFO } from './constants/planetInfo';
import type { BodyId, BodyInstance } from './types/types';

const dwarfs = new Set<BodyId>(['ceres', 'pluto', 'haumea', 'makemake', 'eris']);
export const BODY_CATALOG: { id: BodyId; name: string; kind: BodyInstance['kind']; color: string }[] = [
  { id: 'sun', name: PLANET_INFO.sun.nameRu, kind: 'star', color: '#ffaa00' },
  ...PLANETS_DATA.map(p => ({ id: p.name, name: PLANET_INFO[p.name].nameRu, kind: dwarfs.has(p.name) ? 'dwarf' as const : 'planet' as const, color: p.color })),
  ...MOONS_DATA.map(m => ({ id: m.name, name: PLANET_INFO[m.name].nameRu, kind: 'moon' as const, color: m.color })),
];

export function isBodyId(value: string): value is BodyId {
  return BODY_CATALOG.some(body => body.id === value);
}
