export interface OrbitParams {
  a: number;       // Большая полуось (расстояние)
  e: number;       // Эксцентриситет (0 = круг, <1 = эллипс)
  inc: number;     // Наклон орбиты в градусах
  node: number;    // Долгота восходящего узла (поворот вокруг Y) в градусах
}

const DEG = Math.PI / 180;

// Рассчитывает 3D позицию планеты на орбите
export function getOrbitPosition(theta: number, params: OrbitParams) {
  const { a, e, inc, node } = params;
  
  // 1. Эллипс с Солнцем в фокусе (Первый закон Кеплера)
  // Минимальное расстояние = a * (1 - e), поэтому пересечения с Солнцем невозможны
  const xOrb = a * (Math.cos(theta) - e);
  const zOrb = a * Math.sqrt(1 - e * e) * Math.sin(theta);
  
  // 2. Наклон орбиты (вращение вокруг оси X)
  const incRad = inc * DEG;
  const yTilt = -zOrb * Math.sin(incRad);
  const zTilt = zOrb * Math.cos(incRad);
  
  // 3. Поворот узла (вращение вокруг оси Y для объёма)
  const nodeRad = node * DEG;
  const cosN = Math.cos(nodeRad);
  const sinN = Math.sin(nodeRad);
  
  return {
    x: xOrb * cosN + zTilt * sinN,
    y: yTilt,
    z: -xOrb * sinN + zTilt * cosN
  };
}

// Генерирует точки для THREE.Line по тем же формулам
export function createOrbitGeometry(params: OrbitParams, segments = 128) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(getOrbitPosition(theta, params));
  }
  return points;
}