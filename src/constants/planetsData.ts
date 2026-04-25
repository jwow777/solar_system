import { PlanetOrbitData } from "../types/types";

// Полные данные (J2000.0) + карликовые планеты
export const PLANETS_DATA: PlanetOrbitData[] = [
  { name: "mercury", a: 0.3871, e: 0.2056, i: 7.00, node: 48.33, periapsis: 77.46, period: 87.97, meanLongJ2000: 252.25, axialTilt: 0.00, color: "#aaaaaa", textureMap: "mercuryMap" },
  { name: "venus",   a: 0.7233, e: 0.0068, i: 3.39, node: 76.68, periapsis: 131.56, period: 224.70, meanLongJ2000: 181.98, axialTilt: 177.36, color: "#e6c280", textureMap: "venusMap" },
  { name: "earth",   a: 1.0000, e: 0.0167, i: 0.00, node: 0.00,  periapsis: 102.94, period: 365.24, meanLongJ2000: 100.47, axialTilt: 23.45, color: "#4488ff", textureMap: "earthMap" },
  { name: "mars",    a: 1.5237, e: 0.0934, i: 1.85, node: 49.56, periapsis: 336.06, period: 686.93, meanLongJ2000: 355.43, axialTilt: 25.19, color: "#cc5533", textureMap: "marsMap" },
  { name: "ceres",   a: 2.7675, e: 0.0760, i: 10.59, node: 80.32, periapsis: 72.50, period: 1681.0, meanLongJ2000: 150.00, axialTilt: 4.00, color: "#887766", textureMap: "ceresMap" },
  { name: "jupiter", a: 5.2026, e: 0.0485, i: 1.30, node: 100.46, periapsis: 14.33, period: 4330.60, meanLongJ2000: 34.35, axialTilt: 3.13, color: "#d4a574", textureMap: "jupiterMap" },
  { name: "saturn",  a: 9.5549, e: 0.0555, i: 2.49, node: 113.67, periapsis: 93.06, period: 10746.94, meanLongJ2000: 50.08, axialTilt: 25.33, color: "#c9b896", textureMap: "saturnMap" },
  { name: "uranus",  a: 19.2184, e: 0.0463, i: 0.77, node: 74.01, periapsis: 173.01, period: 30588.74, meanLongJ2000: 314.06, axialTilt: 97.86, color: "#afeeee", textureMap: "uranusMap" },
  { name: "neptune", a: 30.1104, e: 0.0095, i: 1.77, node: 131.78, periapsis: 48.12, period: 59799.90, meanLongJ2000: 304.35, axialTilt: 28.31, color: "#4169e1", textureMap: "neptuneMap" },
  { name: "pluto",   a: 39.5182, e: 0.2459, i: 17.12, node: 109.61, periapsis: 113.34, period: 90739.0, meanLongJ2000: 289.28, axialTilt: 122.52, color: "#aabbcc", textureMap: "plutoMap" },
  { name: "haumea",  a: 43.33, e: 0.1949, i: 28.21, node: 122.17, periapsis: 239.00, period: 10370.0, meanLongJ2000: 200.00, axialTilt: 10.00, color: "#dddddd", textureMap: "haumeaMap" },
  { name: "makemake", a: 45.80, e: 0.1612, i: 29.00, node: 79.50, periapsis: 295.00, period: 11250.0, meanLongJ2000: 210.00, axialTilt: 5.00, color: "#ccbbbb", textureMap: "makemakeMap" },
  { name: "eris",    a: 68.01, e: 0.4400, i: 44.04, node: 35.90, periapsis: 150.00, period: 20500.0, meanLongJ2000: 230.00, axialTilt: 5.00, color: "#ffffff", textureMap: "erisMap" },
];
