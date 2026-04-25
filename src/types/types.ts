export interface PlanetOrbitData {
  name: string;
  a: number;        // Большая полуось (а.е.)
  e: number;        // Эксцентриситет
  i: number;        // Наклон орбиты (град)
  node: number;     // Долгота восходящего узла Ω (град)
  periapsis: number;// Аргумент перигелия ω (град)
  period: number;   // Сидерический период (сут)
  meanLongJ2000: number; // Средняя долгота λ на эпоху J2000 (град)
  axialTilt: number;     // Наклон оси вращения (град)
  color: string;
  textureMap: string;    // Путь к текстуре
}
