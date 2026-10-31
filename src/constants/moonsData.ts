import type { MoonData } from '../types/types';
import snapshot from './moonOrbitElements.json';

// Distances remain compressed for browsing; physical elements come from Horizons.
const appearances: Pick<MoonData, 'parent' | 'name' | 'displaySemiMajorAxis' | 'size' | 'color'>[] = [
  { parent: 'earth', name: 'moon', displaySemiMajorAxis: 3, size: 0.27, color: '#aaaaaa' },
  { parent: 'jupiter', name: 'io', displaySemiMajorAxis: 6, size: 0.35, color: '#cccc44' },
  { parent: 'jupiter', name: 'europa', displaySemiMajorAxis: 8, size: 0.30, color: '#eeeeff' },
  { parent: 'jupiter', name: 'ganymede', displaySemiMajorAxis: 11, size: 0.45, color: '#888888' },
  { parent: 'jupiter', name: 'callisto', displaySemiMajorAxis: 15, size: 0.40, color: '#555555' },
  // All Saturnian moons stay outside the rendered rings (outer radius 10).
  { parent: 'saturn', name: 'mimas', displaySemiMajorAxis: 11.5, size: 0.15, color: '#cccccc' },
  { parent: 'saturn', name: 'enceladus', displaySemiMajorAxis: 13, size: 0.18, color: '#ffffff' },
  { parent: 'saturn', name: 'tethys', displaySemiMajorAxis: 14.5, size: 0.25, color: '#dddddd' },
  { parent: 'saturn', name: 'dione', displaySemiMajorAxis: 17, size: 0.28, color: '#cccccc' },
  { parent: 'saturn', name: 'rhea', displaySemiMajorAxis: 20, size: 0.32, color: '#bbbbbb' },
  { parent: 'saturn', name: 'titan', displaySemiMajorAxis: 25, size: 0.55, color: '#d4a056' },
  { parent: 'saturn', name: 'iapetus', displaySemiMajorAxis: 35, size: 0.35, color: '#443322' },
  { parent: 'uranus', name: 'miranda', displaySemiMajorAxis: 5.5, size: 0.15, color: '#aaaaaa' },
  { parent: 'uranus', name: 'ariel', displaySemiMajorAxis: 7.5, size: 0.25, color: '#cccccc' },
  { parent: 'uranus', name: 'umbriel', displaySemiMajorAxis: 9.5, size: 0.24, color: '#555555' },
  { parent: 'uranus', name: 'titania', displaySemiMajorAxis: 12, size: 0.35, color: '#bbbbbb' },
  { parent: 'uranus', name: 'oberon', displaySemiMajorAxis: 15, size: 0.34, color: '#aaaaaa' },
  { parent: 'neptune', name: 'triton', displaySemiMajorAxis: 10, size: 0.38, color: '#ccdddd' },
];

export const MOON_ORBIT_EPOCH = snapshot.epochUtc;
export const MOONS_DATA: MoonData[] = appearances.map(body => ({
  ...body, ...snapshot.elements[body.name], epochDays: snapshot.epochDays, texture: body.name + 'Map',
}));
