import './index.css';
import { setupScene } from "./setup";
import { setupPostProcessing } from "./postProcessing";
import { createSolarSystem } from "./solarSystem";
import { setupInterface, params, TimeControl } from "./interface";
import { getPlanetPosition, PLANETS_DATA } from "./utils/orbitPhysics";
import * as THREE from "three";

const { renderer, scene, camera, controls } = setupScene();
const { composer, bloomPass } = setupPostProcessing(scene, camera, renderer);
const system = createSolarSystem(scene);

let simDays = 0;
let isPaused = false;

const ROTATION_PERIODS: Record<string, number> = {
  mercury: 58.6, venus: -243, earth: 1, mars: 1.03, ceres: 0.38,
  jupiter: 0.41, saturn: 0.44, uranus: -0.72, neptune: 0.67, 
  pluto: -6.39, haumea: 0.16, makemake: 0.95, eris: 1.0
};

function updatePhysics(deltaDays: number) {
  if (isPaused) return;
  simDays += deltaDays;

  PLANETS_DATA.forEach(data => {
    const p = system[data.name];
    if (!p) return;
    p.group.position.copy(getPlanetPosition(data, simDays));
    
    const period = ROTATION_PERIODS[data.name] || 1;
    const visualSlowdown = 0.05;
    const angleStep = (2 * Math.PI / Math.abs(period)) * deltaDays * visualSlowdown;
    p.pivot.rotation.y += Math.sign(period) * angleStep;
  });

  if (system.moons) {
    Object.values(system.moons).forEach((moonObj: any) => {
      const { mesh, moonData } = moonObj;
      const period = moonData.period;
      const angle = (simDays / period) * 2 * Math.PI;
      
      mesh.position.x = Math.cos(angle) * moonData.orbitRadius;
      mesh.position.z = Math.sin(angle) * moonData.orbitRadius;
      mesh.rotation.y += 0.01; 
    });
  }
}

const timeControl: TimeControl = {
  step: (days: number) => { updatePhysics(days); },
  togglePlay: () => { isPaused = !isPaused; }
};

const { setTargetCallback } = setupInterface(system, camera, controls, bloomPass, system.sun.sprite, renderer, timeControl);

let focusTarget: THREE.Object3D | null = null;
let isTransitioning = false;
let transitionProgress = 0;
const startCameraPos = new THREE.Vector3();
const targetCameraPos = new THREE.Vector3();
const targetLookAt = new THREE.Vector3();
const lastPlanetPos = new THREE.Vector3();

function switchFocus(targetObj: THREE.Object3D) {
  focusTarget = targetObj;
  isTransitioning = true;
  transitionProgress = 0;
  startCameraPos.copy(camera.position);

  // ИСПРАВЛЕНИЕ: Получаем МИРОВЫЕ координаты, а не локальные
  const worldPos = new THREE.Vector3();
  targetObj.getWorldPosition(worldPos);

  const isSun = targetObj === system.sun.mesh;
  const isGiant = [system.jupiter.group, system.saturn.group, system.uranus.group, system.neptune.group].includes(targetObj);
  const isMoon = targetObj === system.moons.moon.mesh;
  
  // Дистанции подогнаны под реальные размеры
  const dist = isSun ? 30 : (isGiant ? 25 : (isMoon ? 4 : 12)); 
  
  targetCameraPos.set(worldPos.x + dist, worldPos.y + dist / 3, worldPos.z + dist);
  targetLookAt.copy(worldPos);
  lastPlanetPos.copy(worldPos);
}

setTargetCallback(switchFocus);

updatePhysics(0);

function animate() {
  requestAnimationFrame(animate);

  if (!isPaused) {
    const deltaDays = params.timeScale / 60; 
    updatePhysics(deltaDays);
    system.sun.mesh.rotation.y += 0.0005;
  }
  
  // Камера
  if (focusTarget) {
    const currentPlanetPos = focusTarget.position; // Для следования используем локальную, это ок для привязки
    // НО для lastPlanetPos и переходов лучше использовать мировые:
    const currentWorldPos = new THREE.Vector3();
    focusTarget.getWorldPosition(currentWorldPos);

    if (isTransitioning) {
      transitionProgress += 0.03;
      if (transitionProgress >= 1) { transitionProgress = 1; isTransitioning = false; }
      camera.position.lerpVectors(startCameraPos, targetCameraPos, transitionProgress);
      controls.target.lerpVectors(startCameraPos, targetLookAt, transitionProgress);
      lastPlanetPos.copy(currentWorldPos);
    } else {
      const delta = new THREE.Vector3().subVectors(currentWorldPos, lastPlanetPos);
      camera.position.add(delta);
      controls.target.copy(currentWorldPos);
      lastPlanetPos.copy(currentWorldPos);
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