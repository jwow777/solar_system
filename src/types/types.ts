import type * as THREE from 'three';

export type PlanetId = 'mercury' | 'venus' | 'earth' | 'mars' | 'ceres' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto' | 'haumea' | 'makemake' | 'eris';
export type MoonId = 'moon' | 'io' | 'europa' | 'ganymede' | 'callisto' | 'mimas' | 'enceladus' | 'tethys' | 'dione' | 'rhea' | 'titan' | 'iapetus' | 'miranda' | 'ariel' | 'umbriel' | 'titania' | 'oberon' | 'triton';
export type BodyId = 'sun' | PlanetId | MoonId;

export interface PlanetOrbitData {
  name: PlanetId;
  a: number; // AU
  e: number;
  i: number; // degrees, ecliptic reference plane
  node: number; // longitude of ascending node Ω, degrees
  longitudeOfPerihelion: number; // ϖ = Ω + ω, degrees
  period: number; // days
  meanLongJ2000: number; // mean longitude L at J2000, degrees
  axialTilt: number;
  color: string;
  textureMap: string;
}

export interface MoonData {
  parent: PlanetId;
  name: MoonId;
  displaySemiMajorAxis: number; // Compressed scene distance, independent of physical km.
  semiMajorAxisKm: number;
  eccentricity: number;
  ascendingNode: number; // degrees, J2000 ecliptic
  argumentOfPeriapsis: number; // ω, degrees (not longitude of periapsis)
  meanAnomalyAtEpoch: number; // degrees
  epochDays: number; // UTC days relative to J2000 noon
  gmKm3S2: number;
  size: number;
  period: number;
  color: string;
  texture?: string;
  inclination: number; // degrees relative to the J2000 ecliptic
}

export interface BodyInstance {
  id: BodyId;
  kind: 'star' | 'planet' | 'dwarf' | 'moon';
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  focusObject: THREE.Object3D;
  radius: number;
  color: string;
}

export interface PlanetInstance {
  group: THREE.Group;
  pivot: THREE.Group;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  data: PlanetOrbitData;
  orbitLine: THREE.Line;
  clouds?: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  rings?: THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial>;
}

export interface MoonInstance {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  moonData: MoonData;
  orbitLine: THREE.Line;
  orbitGroup: THREE.Group;
  orbitalFrame: THREE.Quaternion;
}

export interface SolarSystem {
  sun: { mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>; light: THREE.PointLight; sprite: THREE.Sprite };
  planets: Record<PlanetId, PlanetInstance>;
  moons: Record<MoonId, MoonInstance>;
  bodies: BodyInstance[];
  ambientLight: THREE.AmbientLight;
  orbits: Record<PlanetId, THREE.Line>;
}

export interface SimulationState {
  simDays: number;
  isPaused: boolean;
  timeScale: number;
}

export interface TimeControl {
  step(days: number): void;
  togglePlay(): void;
}
