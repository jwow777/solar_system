import * as THREE from "three";

import { PlanetOrbitData } from "../types/types";

// Масштаб: 1 а.е. = 30 единиц в сцене (немного увеличил для наглядности)
export const AU_SCALE = 30; 

// Решение уравнения Кеплера
function solveKepler(M: number, e: number, tol = 1e-7): number {
  let E = M;
  for (let i = 0; i < 10; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

// Расчёт позиции
export function getPlanetPosition(data: PlanetOrbitData, daysSinceJ2000: number): THREE.Vector3 {
  /* среднее движение (угловая скорость в радианах/сутки) */
  const n = (2 * Math.PI) / data.period; 
  /* средняя аномалия в эпоху J2000 */
  const M0 = ((data.meanLongJ2000 - data.periapsis - data.node) * Math.PI) / 180;
  /* средняя аномалия */
  const M = M0 + n * daysSinceJ2000;

  /* эксцентрическая аномалия */
  const E = solveKepler(M, data.e);
  /* истинная аномалия (ν) */
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + data.e) * Math.sin(E / 2),
    Math.sqrt(1 - data.e) * Math.cos(E / 2)
  );

  /* гелиоцентрическое расстояние */
  const r = data.a * (1 - data.e * data.e) / (1 + data.e * Math.cos(nu));

  /* наклонение орбиты к плоскости отсчёта (эклиптике) */
  const iRad = (data.i * Math.PI) / 180;
  /* долгота восходящего узла (Ω) */
  const nodeRad = (data.node * Math.PI) / 180;
  /* аргумент широты */
  const w = (data.periapsis * Math.PI) / 180 + nu;

  const x = r * (Math.cos(nodeRad) * Math.cos(w) - Math.sin(nodeRad) * Math.sin(w) * Math.cos(iRad));
  const z = r * (Math.sin(nodeRad) * Math.cos(w) + Math.cos(nodeRad) * Math.sin(w) * Math.cos(iRad));
  const y = r * Math.sin(w) * Math.sin(iRad);

  return new THREE.Vector3(x, y, z).multiplyScalar(AU_SCALE);
}