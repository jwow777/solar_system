import './index.css';
import { setupScene } from "./setup";
import { setupPostProcessing } from "./postProcessing";
import { createSolarSystem } from "./solarSystem";
import { setupInterface, params, TimeControl } from "./interface";
import { getPlanetPosition } from "./utils/orbitPhysics";
import * as THREE from "three";
import { PLANETS_DATA } from './constants/planetsData';

const { renderer, scene, camera, controls } = setupScene();
const { composer, bloomPass } = setupPostProcessing(scene, camera, renderer);
const system = createSolarSystem(scene);
const axesHelper = new THREE.AxesHelper(50); // длина в юнитах сцены
scene.add(axesHelper);

let simDays = 0;
let isPaused = false;

// Периоды осевого вращения (дней). Отрицательный = ретроградное.
const ROTATION_PERIODS: Record<string, number> = {
  mercury: 58.6, venus: -243, earth: 1, mars: 1.03, ceres: 0.38,
  jupiter: 0.41, saturn: 0.44, uranus: -0.72, neptune: 0.67,
  pluto: -6.39, haumea: 0.16, makemake: 0.95, eris: 1.0
};

// Вектор для обновления uniform шейдера Земли
const sunWorldPos = new THREE.Vector3(0, 0, 0);

function updatePhysics(deltaDays: number) {
  if (isPaused) return;
  simDays += deltaDays;

  PLANETS_DATA.forEach(data => {
    const p = system[data.name];
    if (!p) return;

    // Позиция группы по орбите
    p.group.position.copy(getPlanetPosition(data, simDays));

    // Осевое вращение вокруг наклонённой оси (mesh крутится, pivot наклонён)
    const period = ROTATION_PERIODS[data.name] || 1;
    const visualSlowdown = 0.05;
    const angleStep = (2 * Math.PI / Math.abs(period)) * deltaDays * visualSlowdown;
    p.mesh.rotation.y += Math.sign(period) * angleStep;
  });

  // Обновляем uniform sunPos для шейдера день/ночь Земли
  if (system.earth?.mesh?.material?.uniforms?.sunPos) {
    system.earth.mesh.material.uniforms.sunPos.value.copy(sunWorldPos);
  }

  // Движение спутников — позиция относительно родительской группы
  if (system.moons) {
    Object.values(system.moons).forEach((moonObj: any) => {
      const { mesh, moonData } = moonObj;
      const period = moonData.period; // дней
      // Угол в радианах: полный оборот за period дней
      const angle = (simDays / Math.abs(period)) * 2 * Math.PI * Math.sign(period);

      mesh.position.x = Math.cos(angle) * moonData.orbitRadius;
      mesh.position.z = Math.sin(angle) * moonData.orbitRadius;
      mesh.position.y = 0;

      // Синхронное вращение (приливная блокировка) — луна всегда смотрит на планету
      mesh.rotation.y = -angle;

      // Обновляем uniforms шейдера тени
      if (mesh.material?.uniforms) {
        // Мировая позиция родительской планеты
        const parentPlanet = system[moonData.parent];
        if (parentPlanet?.group) {
          mesh.material.uniforms.planetPos.value.copy(parentPlanet.group.position);
        }
        // Солнце всегда в (0,0,0)
        mesh.material.uniforms.sunPos.value.set(0, 0, 0);
      }
    });
  }
}

const timeControl: TimeControl = {
  step: (days: number) => {
    const wasPaused = isPaused;
    isPaused = false;
    updatePhysics(days);
    isPaused = wasPaused;
  },
  togglePlay: () => { isPaused = !isPaused; }
};

const { setTargetCallback } = setupInterface(
  system, camera, controls, bloomPass, system.sun.sprite, renderer, timeControl
);

let focusTarget: THREE.Object3D | null = null;
let isTransitioning = false;
let transitionProgress = 0;
const startCameraPos  = new THREE.Vector3();
const targetCameraPos = new THREE.Vector3();
const targetLookAt    = new THREE.Vector3();
const lastPlanetPos   = new THREE.Vector3();
const _worldPos       = new THREE.Vector3(); // переиспользуемый вектор
const _delta          = new THREE.Vector3(); // переиспользуемый вектор

function switchFocus(targetObj: THREE.Object3D) {
  focusTarget = targetObj;
  isTransitioning = true;
  transitionProgress = 0;
  startCameraPos.copy(camera.position);

  targetObj.getWorldPosition(_worldPos);

  const isSun   = targetObj === system.sun.mesh;
  const isGiant = [
    system.jupiter?.group, system.saturn?.group,
    system.uranus?.group,  system.neptune?.group
  ].includes(targetObj);
  const isMoon = targetObj === system.moons?.moon?.mesh;

  const dist = isSun ? 30 : (isGiant ? 25 : (isMoon ? 4 : 12));

  targetCameraPos.set(_worldPos.x + dist, _worldPos.y + dist / 3, _worldPos.z + dist);
  targetLookAt.copy(_worldPos);
  lastPlanetPos.copy(_worldPos);
}

setTargetCallback(switchFocus);

// Начальный расчёт позиций
updatePhysics(0);

function animate() {
  requestAnimationFrame(animate);

  if (!isPaused) {
    const deltaDays = params.timeScale / 60;
    updatePhysics(deltaDays);
    system.sun.mesh.rotation.y += 0.0005;
  }

  // Обновление камеры
  if (focusTarget) {
    focusTarget.getWorldPosition(_worldPos);

    if (isTransitioning) {
      transitionProgress += 0.03;
      if (transitionProgress >= 1) {
        transitionProgress = 1;
        isTransitioning = false;
      }
      camera.position.lerpVectors(startCameraPos, targetCameraPos, transitionProgress);
      controls.target.lerpVectors(startCameraPos, targetLookAt, transitionProgress);
      lastPlanetPos.copy(_worldPos);
    } else {
      _delta.subVectors(_worldPos, lastPlanetPos);
      camera.position.add(_delta);
      controls.target.copy(_worldPos);
      lastPlanetPos.copy(_worldPos);
    }
  }

  controls.update();
  composer.render();
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
