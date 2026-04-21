// inclination — наклон орбиты спутника к экватору планеты (градусы)
export const MOONS_DATA = [
  // Земля
  { parent: "earth",   name: "moon",     orbitRadius: 3.0,  size: 0.27, period: 27.32,  color: "#aaaaaa", texture: "moonMap", inclination: 5.1  },
  // Юпитер (галилеевы спутники — малый наклон)
  { parent: "jupiter", name: "io",       orbitRadius: 6.0,  size: 0.35, period: 1.77,   color: "#cccc44", inclination: 0.04 },
  { parent: "jupiter", name: "europa",   orbitRadius: 8.0,  size: 0.30, period: 3.55,   color: "#eeeeff", inclination: 0.47 },
  { parent: "jupiter", name: "ganymede", orbitRadius: 11.0, size: 0.45, period: 7.15,   color: "#888888", inclination: 0.20 },
  { parent: "jupiter", name: "callisto", orbitRadius: 15.0, size: 0.40, period: 16.69,  color: "#555555", inclination: 0.19 },
  // Сатурн
  { parent: "saturn",  name: "mimas",    orbitRadius: 5.0,  size: 0.15, period: 0.94,   color: "#cccccc", inclination: 1.57 },
  { parent: "saturn",  name: "enceladus",orbitRadius: 6.5,  size: 0.18, period: 1.37,   color: "#ffffff", inclination: 0.02 },
  { parent: "saturn",  name: "tethys",   orbitRadius: 8.0,  size: 0.25, period: 1.89,   color: "#dddddd", inclination: 1.09 },
  { parent: "saturn",  name: "dione",    orbitRadius: 10.0, size: 0.28, period: 2.74,   color: "#cccccc", inclination: 0.02 },
  { parent: "saturn",  name: "rhea",     orbitRadius: 12.5, size: 0.32, period: 4.52,   color: "#bbbbbb", inclination: 0.35 },
  { parent: "saturn",  name: "titan",    orbitRadius: 17.0, size: 0.55, period: 15.95,  color: "#d4a056", inclination: 0.33 },
  { parent: "saturn",  name: "iapetus",  orbitRadius: 24.0, size: 0.35, period: 79.32,  color: "#443322", inclination: 15.47 },
  // Уран (орбиты наклонены ~97° из-за наклона оси Урана — показываем умеренный наклон)
  { parent: "uranus",  name: "miranda",  orbitRadius: 5.5,  size: 0.15, period: 1.41,   color: "#aaaaaa", inclination: 4.34 },
  { parent: "uranus",  name: "ariel",    orbitRadius: 7.5,  size: 0.25, period: 2.52,   color: "#cccccc", inclination: 0.26 },
  { parent: "uranus",  name: "umbriel",  orbitRadius: 9.5,  size: 0.24, period: 4.14,   color: "#555555", inclination: 0.13 },
  { parent: "uranus",  name: "titania",  orbitRadius: 12.0, size: 0.35, period: 8.71,   color: "#bbbbbb", inclination: 0.08 },
  { parent: "uranus",  name: "oberon",   orbitRadius: 15.0, size: 0.34, period: 13.46,  color: "#aaaaaa", inclination: 0.07 },
  // Нептун (Тритон — ретроградная орбита, наклон 157°)
  { parent: "neptune", name: "triton",   orbitRadius: 10.0, size: 0.38, period: -5.88,  color: "#ccdddd", inclination: 157.0 },
];
