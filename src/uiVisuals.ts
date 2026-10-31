import { BODY_CATALOG } from './catalog';
import { PLANETS_DATA } from './constants/planetsData';
import { MOONS_DATA } from './constants/moonsData';
import { PLANET_INFO } from './constants/planetInfo';
import type { BodyId } from './types/types';

const paths = {
  orbit: '<ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="3"/><circle cx="19.8" cy="6.4" r="1.6" fill="currentColor" stroke="none"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="var(--panel-solid, #101923)"/><circle cx="15" cy="17" r="2.5" fill="var(--panel-solid, #101923)"/>',
  play: '<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3.5"/>',
  back: '<path d="m10 6-6 6 6 6M5 12h15"/>',
  forward: '<path d="m14 6 6 6-6 6M19 12H4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  overview: '<circle cx="12" cy="12" r="3"/><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
  mouse: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v4"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16"/>',
} as const;

export function icon(name: keyof typeof paths): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths[name] + '</svg>';
}

export function bodyAvatar(id: BodyId, className = ''): string {
  const body = BODY_CATALOG.find(body => body.id === id)!;
  const key = id === 'sun' ? 'sunMap' : id === 'venus' ? 'venusAtmosMap'
    : PLANETS_DATA.find(planet => planet.name === id)?.textureMap
      ?? MOONS_DATA.find(moon => moon.name === id)?.texture;
  const map = key ? ';--globe-map:url(&quot;' + import.meta.env.BASE_URL + 'textures/2k/' + key + '.webp&quot;)' : '';
  return '<span class="planet-avatar ' + className + '" data-planet="' + id + '" style="--planet-color:' + body.color + map + '" aria-hidden="true"><span class="planet-globe"></span>' + (id === 'saturn' ? '<span class="planet-ring"></span>' : '') + '</span>';
}

export function bodySubtitle(id: BodyId): string {
  const moon = MOONS_DATA.find(body => body.name === id);
  if (moon) return PLANET_INFO[moon.parent].nameRu;
  const kind = BODY_CATALOG.find(body => body.id === id)!.kind;
  return { star: 'Звезда', planet: 'Планета', dwarf: 'Карликовая планета', moon: 'Спутник' }[kind];
}
