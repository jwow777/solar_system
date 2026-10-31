import './index.css';
import * as THREE from 'three';
import { setupScene } from './setup';
import { setupPostProcessing } from './postProcessing';
import { createSolarSystem } from './solarSystem';
import { setupInterface } from './interface';
import { createPlanetPanel } from './planetPanel';
import { getPlanetPosition } from './utils/orbitPhysics';
import { getMoonMeanAnomaly, getMoonPosition } from './utils/moonOrbits';
import { advanceSimulation, daysSinceJ2000, FrameClock } from './simulation';
import { TextureManager } from './textures';
import { CameraController } from './camera';
import { ClickGesture } from './interaction';
import { loadPreferences } from './settings';
import { OrbitHover } from './orbits';
import { RenderOrigin } from './renderOrigin';
import { getRotationAngle } from './rotation';
import { updatePhysicalOrbit } from './scale';
import type { BodyId, SimulationState } from './types/types';

function startApplication() {
  const { renderer, scene, camera, controls } = setupScene();
  const { composer, bloomPass } = setupPostProcessing(scene, camera, renderer);
  const renderOrigin = new RenderOrigin(scene, camera);
  const textures = new TextureManager(renderer.capabilities.getMaxAnisotropy(), renderer.capabilities.maxTextureSize);
  const system = createSolarSystem(scene, textures);
  const orbitHover = new OrbitHover(system);
  textures.bind('background', 'galaxyMap', texture => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.backgroundIntensity = 0.45;
  });
  const preferences = loadPreferences();
  const state: SimulationState = { simDays: daysSinceJ2000(), isPaused: false, timeScale: preferences.timeScale };
  const abort = new AbortController();
  const { signal } = abort;
  const clock = new FrameClock();
  const cameraController = new CameraController(camera, controls, busy => {
    renderer.domElement.setAttribute('aria-busy', String(busy));
  });
  const panel = createPlanetPanel(state, signal, open => { ui.setInfoOpen(open); updateViewport(); });
  const bodies = new Map(system.bodies.map(body => [body.id, body]));
  const meshBodies = new Map(system.bodies.map(body => [body.mesh as THREE.Object3D, body]));
  const targets = system.bodies.map(body => body.mesh);
  let selectedId: BodyId | null = null;

  function updatePhysics() {
    for (const planet of Object.values(system.planets)) {
      getPlanetPosition(planet.data, state.simDays, planet.group.position);
      planet.mesh.rotation.y = getRotationAngle(planet.data.name, state.simDays, preferences.settings.realTime);
      if (planet.clouds && planet.mesh.material instanceof THREE.ShaderMaterial) {
        planet.clouds.rotation.y = planet.mesh.rotation.y * 1.02;
        planet.mesh.material.uniforms.cloudOffset.value = (planet.mesh.rotation.y - planet.clouds.rotation.y) / (Math.PI * 2);
      }
      if (preferences.settings.realisticSizes && planet.data.name === selectedId) updatePhysicalOrbit(planet, state.simDays);
    }
    for (const moon of Object.values(system.moons)) {
      getMoonPosition(moon.moonData, state.simDays, moon.mesh.position);
      // Uniform synchronous spin plus variable orbital speed produces optical libration.
      moon.mesh.quaternion.copy(moon.orbitalFrame);
      moon.mesh.rotateY(getMoonMeanAnomaly(moon.moonData, state.simDays));
    }
    system.sun.mesh.rotation.y = getRotationAngle('sun', state.simDays, preferences.settings.realTime);
  }

  function select(id: BodyId, keyboard = false) {
    const body = bodies.get(id);
    if (!body) return;
    selectedId = id;
    updatePhysics();
    cameraController.focus(body);
    textures.select(id);
    ui.setSelected(id);
    panel.open(id, keyboard);
  }

  const ui = setupInterface({
    system, state, settings: preferences.settings, bloomPass, renderer, signal,
    select,
    overview() {
      selectedId = null;
      cameraController.overview();
      textures.select(null);
      ui.setSelected(null);
      panel.close(false);
    },
    timeControl: {
      step(days) { state.simDays += days; updatePhysics(); panel.update(); ui.update(); },
      togglePlay() { state.isPaused = !state.isPaused; },
      setDays(days) { state.simDays = days; updatePhysics(); panel.update(); },
    },
    retryTextures: () => textures.retry(),
    browse: () => panel.close(false),
    onScaleChanged: () => { updatePhysics(); cameraController.refit(); },
  });
  textures.onStatus = ui.setLoading;
  ui.setLoading(textures.status);
  updatePhysics();

  function updateViewport() {
    const width = window.innerWidth, height = window.innerHeight;
    const bounds = ui.sceneElement.getBoundingClientRect();
    cameraController.setViewport(bounds.left, bounds.top, Math.max(1, bounds.width), Math.max(1, bounds.height), width, height);
  }
  const layoutObserver = new ResizeObserver(updateViewport);
  layoutObserver.observe(ui.sceneElement);
  layoutObserver.observe(ui.element);
  layoutObserver.observe(panel.element);
  updateViewport();

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const gesture = new ClickGesture();
  let pointer: { x: number; y: number } | null = null;
  let hovered: THREE.Object3D | null = null;
  const originalEmissive = new Map<THREE.MeshStandardMaterial, { color: THREE.Color; intensity: number }>();

  function highlight(mesh: THREE.Object3D | null, on: boolean) {
    if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
    const material = mesh.material;
    if (on) {
      originalEmissive.set(material, { color: material.emissive.clone(), intensity: material.emissiveIntensity });
      material.emissive.set(0x334466);
      material.emissiveIntensity = 0.6;
    } else {
      const original = originalEmissive.get(material);
      if (original) { material.emissive.copy(original.color); material.emissiveIntensity = original.intensity; }
      originalEmissive.delete(material);
    }
  }

  function pick(x: number, y: number) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(targets, false)[0];
    return hit ? meshBodies.get(hit.object) : undefined;
  }

  renderer.domElement.addEventListener('pointerdown', event => {
    if (event.button !== 0) { gesture.cancel(); return; }
    gesture.down(event.pointerId, event.clientX, event.clientY);
  }, { signal });
  renderer.domElement.addEventListener('pointermove', event => {
    gesture.move(event.pointerId, event.clientX, event.clientY);
    if (event.pointerType !== 'touch') pointer = { x: event.clientX, y: event.clientY };
  }, { signal });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!gesture.up(event.pointerId, event.clientX, event.clientY)) return;
    const body = pick(event.clientX, event.clientY);
    if (body) select(body.id);
    else panel.close(false);
  }, { signal });
  renderer.domElement.addEventListener('pointercancel', () => gesture.cancel(), { signal });
  renderer.domElement.addEventListener('lostpointercapture', () => gesture.cancel(), { signal });
  renderer.domElement.addEventListener('pointerleave', () => {
    pointer = null; panel.hideTooltip(); highlight(hovered, false); hovered = null;
    orbitHover.set(null);
    renderer.domElement.style.cursor = '';
  }, { signal });
  const cancelTransition = () => cameraController.cancelTransition();
  controls.addEventListener('start', cancelTransition);
  document.addEventListener('visibilitychange', () => clock.reset(), { signal });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(window.innerWidth, window.innerHeight);
    updateViewport();
  }, { signal });

  let lastPanelUpdate = 0;
  let animationId = 0;
  function animate(timestamp: number) {
    animationId = requestAnimationFrame(animate);
    if (document.hidden) { clock.reset(); return; }
    const seconds = clock.tick(timestamp, preferences.settings.realTime ? Infinity : 0.1);
    const delta = advanceSimulation(state, seconds, preferences.settings.realTime);
    if (delta !== 0) updatePhysics();
    for (const body of system.bodies) {
      if (body.mesh.material instanceof THREE.ShaderMaterial && body.mesh.material.uniforms.lightColor) {
        body.mesh.material.uniforms.lightColor.value.copy(system.sun.light.color);
        body.mesh.material.uniforms.lightIntensity.value = system.sun.light.intensity;
        body.mesh.material.uniforms.ambientStr.value = system.ambientLight.intensity;
      }
    }
    cameraController.update(seconds);
    controls.update(seconds);
    if (pointer) {
      const body = pick(pointer.x, pointer.y);
      const rect = renderer.domElement.getBoundingClientRect();
      const orbitId = body?.id ?? orbitHover.pick(camera, pointer.x - rect.left, pointer.y - rect.top, rect.width, rect.height);
      orbitHover.set(orbitId);
      const mesh = body?.mesh ?? null;
      if (mesh !== hovered) { highlight(hovered, false); highlight(mesh, true); hovered = mesh; }
      renderer.domElement.style.cursor = body ? 'pointer' : '';
      if (body) panel.showTooltip(body.id, pointer.x, pointer.y);
      else if (orbitId) panel.showTooltip(orbitId, pointer.x, pointer.y, true);
      else panel.hideTooltip();
    }
    if (timestamp - lastPanelUpdate >= 200) { panel.update(); ui.update(); lastPanelUpdate = timestamp; }
    if (preferences.settings.realisticSizes) renderOrigin.render(() => composer.render(seconds));
    else composer.render(seconds);
  }
  animationId = requestAnimationFrame(animate);

  const onContextLost = (event: Event) => {
    event.preventDefault();
    clock.reset();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, { signal });

  if (import.meta.hot) import.meta.hot.dispose(() => {
    abort.abort();
    layoutObserver.disconnect();
    cancelAnimationFrame(animationId);
    controls.removeEventListener('start', cancelTransition);
    controls.dispose();
    ui.dispose();
    panel.dispose();
    textures.dispose();
    system.sun.light.shadow.dispose();
    system.sun.sprite.material.map?.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
        if ('geometry' in object) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const pass of composer.passes) pass.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  });
}

try { startApplication(); }
catch (error) {
  const message = document.createElement('div');
  message.className = 'startup-error';
  message.setAttribute('role', 'alert');
  message.textContent = 'Не удалось запустить 3D-сцену. Проверьте поддержку WebGL2 и аппаратное ускорение браузера.';
  document.body.appendChild(message);
  console.error(error);
}
