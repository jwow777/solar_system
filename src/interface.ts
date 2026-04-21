import { GUI } from "lil-gui";
import * as THREE from "three";

export const params = {
  sunIntensity: 1.2,
  sunDistance: 0,
  sunDecay: 0,
  sunColor: '#fff5e0',
  ambientIntensity: 0.2,
  bloomStrength: 0.3,
  bloomRadius: 0.3,
  bloomThreshold: 0.45,
  bloomTint: '#ffffaa',
  timeScale: 1.0,
  fov: 45,
  starOpacity: 0.8,
  planetScale: 1.0,
  showOrbits: true,
  exposure: 0.5
};

export interface TimeControl {
  step: (days: number) => void;
  togglePlay: () => void;
}

export function setupInterface(system: any, camera: THREE.PerspectiveCamera, controls: any, bloomPass: any, sunSprite: THREE.Sprite, renderer: THREE.WebGLRenderer, timeControl: TimeControl) {
  const gui = new GUI({ title: 'Настройки сцены', width: 320 });
  gui.domElement.style.position = 'absolute';
  gui.domElement.style.left = '20px'; 
  gui.domElement.style.right = 'auto';
  gui.domElement.style.top = '20px';

  // ... (Код для левой панели настроек GUI без изменений, чтобы не раздувать ответ, 
  // оставляем добавление папок: Источник света, Экран, Время) ...
  
  const lightFolder = gui.addFolder('💡 Источник света');
  lightFolder.add(params, 'sunIntensity', 0, 5, 0.05).name('Мощность Солнца').onChange((v: number) => system.sun.light.intensity = v);
  lightFolder.add(params, 'ambientIntensity', 0, 1, 0.01).name('Фоновый свет').onChange((v: number) => system.ambientLight.intensity = v);
  lightFolder.addColor(params, 'sunColor').name('Цвет Солнца').onChange((v: string) => {
    system.sun.light.color.set(v);
    sunSprite.material.color.set(v);
  });

  const renderFolder = gui.addFolder('🎨 Экран и эффекты');
  renderFolder.add(params, 'exposure', 0.2, 2.0).name('Экспозиция').onChange((v: number) => renderer.toneMappingExposure = v);
  renderFolder.add(params, 'bloomStrength', 0, 2).name('Bloom Сила').onChange((v: number) => bloomPass.strength = v);
  renderFolder.add(params, 'bloomRadius', 0, 1).name('Bloom Радиус').onChange((v: number) => bloomPass.radius = v);
  renderFolder.add(params, 'bloomThreshold', 0, 1).name('Bloom Порог').onChange((v: number) => bloomPass.threshold = v);
  renderFolder.addColor(params, 'bloomTint').name('Bloom Цвет').onChange((v: string) => sunSprite.material.color.set(v));

  gui.add(params, 'showOrbits').name('Показать орбиты').onChange((v: boolean) => {
    Object.values(system.orbits).forEach((line: any) => { line.visible = v; });
    if (system.moons) Object.values(system.moons).forEach((m: any) => m.orbitLine.visible = v);
  });

  gui.add(params, 'planetScale', 0.5, 2).name('Масштаб планет').onChange((v: number) => {
    Object.values(system).forEach((obj: any) => { if (obj.group) obj.group.scale.setScalar(v); });
  });

  const timeFolder = gui.addFolder('⏱️ Время симуляции');
  timeFolder.add(params, 'timeScale', 0, 50, 1).name('Скорость (дн/сек)');

  // --- СТИЛИ ИНТЕРФЕЙСА ---
  const style = document.createElement('style');
  style.textContent = `
    /* Панель управления временем (над навигацией) */
    .lil-time-panel { 
      position: absolute; bottom: 140px; left: 50%; transform: translateX(-50%); 
      background: rgba(20,20,20,0.7); backdrop-filter: blur(10px); 
      padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); 
      box-shadow: 0 10px 20px rgba(0,0,0,0.4); display: flex; gap: 12px; z-index: 101; align-items: center; 
    }
    .time-btn { 
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
      color: #ddd; cursor: pointer; width: 36px; height: 36px; border-radius: 10px; 
      transition: all 0.2s; display: flex; align-items: center; justify-content: center; 
    }
    .time-btn svg { width: 18px; height: 18px; fill: currentColor; }
    .time-btn:hover { background: rgba(255,255,255,0.15); color: #fff; border-color: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .time-btn:active { transform: translateY(0) scale(0.95); }
    .time-btn.active { background: rgba(68,136,255,0.3); border-color: rgba(68,136,255,0.5); color: #4488ff; }

    /* Главная панель навигации (ДВА РЯДА) */
    .lil-nav-panel { 
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); 
      background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(10px);
      padding: 12px 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); 
      box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
      display: flex; flex-direction: column; /* Вертикальное расположение рядов */
      gap: 10px; z-index: 100; 
      max-width: 95vw; max-height: 180px; /* Ограничение высоты */
    }

    /* Строки с прокруткой */
    .nav-row {
      display: flex; flex-direction: row; gap: 8px; 
      overflow-x: auto; padding-bottom: 4px; /* Место для скроллбара */
      min-width: 0;
    }
    .nav-row::-webkit-scrollbar { height: 4px; }
    .nav-row::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }

    /* Кнопки планет */
    .lil-nav-btn { 
      padding: 8px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
      border-radius: 15px; color: #ddd; cursor: pointer; font-size: 12px; font-weight: 500; 
      white-space: nowrap; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; flex-shrink: 0; 
    }
    .lil-nav-btn:hover { background: rgba(255,255,255,0.2); color: #fff; border-color: rgba(255,255,255,0.3); transform: translateY(-2px); }
    .lil-nav-btn:active { background: rgba(255,255,255,0.1); transform: translateY(0); }

    /* Заголовки рядов (опционально, для красоты) */
    .row-label { font-size: 10px; color: #888; margin-bottom: -5px; margin-left: 5px; text-transform: uppercase; letter-spacing: 1px; }
  `;
  document.head.appendChild(style);

  // --- ИКОНКИ ---
  const skipBackIcon = `<svg viewBox="0 0 24 24"><path d="M11 19V5l-7 7 7 7zm8 0V5l-7 7 7 7z"/></svg>`;
  const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  const skipFwdIcon = `<svg viewBox="0 0 24 24"><path d="M4 19V5l7 7-7 7zm8 0V5l7 7-7 7z"/></svg>`;

  // --- ПАНЕЛЬ ВРЕМЕНИ ---
  const timePanel = document.createElement('div');
  timePanel.className = 'lil-time-panel';
  const btnBack = document.createElement('button'); btnBack.className = 'time-btn'; btnBack.innerHTML = skipBackIcon;
  const btnPlay = document.createElement('button'); btnPlay.className = 'time-btn active'; btnPlay.innerHTML = pauseIcon;
  const btnFwd = document.createElement('button'); btnFwd.className = 'time-btn'; btnFwd.innerHTML = skipFwdIcon;

  let isPlaying = true;
  btnPlay.onclick = () => {
    timeControl.togglePlay();
    isPlaying = !isPlaying;
    if (!isPlaying) { btnPlay.innerHTML = playIcon; btnPlay.classList.remove('active'); }
    else { btnPlay.innerHTML = pauseIcon; btnPlay.classList.add('active'); }
  };
  btnBack.onclick = () => timeControl.step(-10);
  btnFwd.onclick = () => timeControl.step(10);
  timePanel.append(btnBack, btnPlay, btnFwd);

  // --- ПАНЕЛЬ НАВИГАЦИИ (ДВА РЯДА) ---
  const mainPanel = document.createElement('div');
  mainPanel.className = 'lil-nav-panel';

  let onTargetSelected: ((obj: THREE.Object3D) => void) | null = null;

  // Данные для РЯДА 1: ПЛАНЕТЫ
  const planetsList = [
    { name: '☀️ Солнце', key: 'sun', isPlanet: true, color: '#ffaa00' },
    { name: '☿️ Меркурий', key: 'mercury', isPlanet: true, color: '#aaaaaa' },
    { name: '♀️ Венера', key: 'venus', isPlanet: true, color: '#e6c280' },
    { name: '🌍 Земля', key: 'earth', isPlanet: true, color: '#4488ff' },
    { name: '♂️ Марс', key: 'mars', isPlanet: true, color: '#cc5533' },
    { name: '💎 Церера', key: 'ceres', isPlanet: true, color: '#887766' },
    { name: '♃ Юпитер', key: 'jupiter', isPlanet: true, color: '#d4a574' },
    { name: '♄ Сатурн', key: 'saturn', isPlanet: true, color: '#c9b896' },
    { name: '♅ Уран', key: 'uranus', isPlanet: true, color: '#afeeee' },
    { name: '♆ Нептун', key: 'neptune', isPlanet: true, color: '#4169e1' },
    { name: '❄️ Плутон', key: 'pluto', isPlanet: true, color: '#aabbcc' },
  ];

  // Данные для РЯДА 2: СПУТНИКИ
  const moonsList = [
    { name: '🌕 Луна', key: 'moon', parent: 'earth', color: '#aaaaaa' },
    { name: '🟠 Ио', key: 'io', parent: 'jupiter', color: '#cccc44' },
    { name: '⚪ Европа', key: 'europa', parent: 'jupiter', color: '#eeeeff' },
    { name: '⚫ Ганимед', key: 'ganymede', parent: 'jupiter', color: '#888888' },
    { name: '🌑 Каллисто', key: 'callisto', parent: 'jupiter', color: '#555555' },
    { name: '🌕 Мимас', key: 'mimas', parent: 'saturn', color: '#cccccc' },
    { name: '❄️ Энцелад', key: 'enceladus', parent: 'saturn', color: '#ffffff' },
    { name: '🟡 Титан', key: 'titan', parent: 'saturn', color: '#d4a056' },
    { name: '🌓 Япет', key: 'iapetus', parent: 'saturn', color: '#443322' },
    { name: '🧊 Миранда', key: 'miranda', parent: 'uranus', color: '#aaaaaa' },
    { name: '🧊 Титания', key: 'titania', parent: 'uranus', color: '#bbbbbb' },
    { name: '🔵 Тритон', key: 'triton', parent: 'neptune', color: '#ccdddd' },
  ];

  // Функция создания строки
  function createRow(items: any[], container: HTMLElement) {
    items.forEach(p => {
      let objToFocus: THREE.Object3D | null = null;
      if (p.isPlanet && system[p.key]) objToFocus = system[p.key].group;
      if (!p.isPlanet && system.moons && system.moons[p.key]) objToFocus = system.moons[p.key].mesh;

      if (objToFocus) {
        const btn = document.createElement('button');
        btn.className = 'lil-nav-btn';
        btn.innerHTML = `<span style="color:${p.color}">●</span> ${p.name}`;
        btn.onclick = () => { if (onTargetSelected) onTargetSelected(objToFocus!); };
        container.appendChild(btn);
      }
    });
  }

  // Создаем ряд планет
  const rowPlanets = document.createElement('div');
  rowPlanets.className = 'nav-row';
  createRow(planetsList, rowPlanets);

  // Создаем ряд спутников
  const rowMoons = document.createElement('div');
  rowMoons.className = 'nav-row';
  createRow(moonsList, rowMoons);

  // Собираем всё вместе
  mainPanel.appendChild(rowPlanets);
  mainPanel.appendChild(rowMoons);

  // Добавляем панели в DOM
  document.body.append(timePanel, mainPanel);

  return { setTargetCallback: (cb: typeof onTargetSelected) => onTargetSelected = cb };
}