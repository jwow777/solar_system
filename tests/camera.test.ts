import { expect, it } from 'vitest';
import { Frustum, Group, Matrix4, Mesh, PerspectiveCamera, SphereGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { CameraController, focusDistance } from '../src/camera';
import { PLANETS_DATA } from '../src/constants/planetsData';
import { getPlanetPosition } from '../src/utils/orbitPhysics';

it('fits by radius and by the narrower viewport dimension', () => {
  expect(focusDistance(10, 45, 1)).toBeGreaterThan(focusDistance(1, 45, 1));
  expect(focusDistance(1, 45, 0.5)).toBeGreaterThan(focusDistance(1, 45, 2));
});

it('frames the selected body inside the area left free by interface panels', () => {
  const camera = new PerspectiveCamera(45, 1280 / 720, 0.01, 20000);
  const controls = { target: new Vector3(), minDistance: 0, maxDistance: 15000 };
  const controller = new CameraController(camera, controls);
  const mesh = new Mesh(new SphereGeometry(1), new MeshBasicMaterial());
  controller.setViewport(0, 0, 920, 420, 1280, 720);
  controller.focus({ id: 'earth', kind: 'planet', mesh, focusObject: mesh, radius: 1, color: '#fff' });
  controller.update(1);
  camera.lookAt(controls.target);
  camera.updateMatrixWorld();
  const screen = new Vector3().project(camera);
  expect((screen.x + 1) / 2 * 1280).toBeCloseTo(460, 8);
  expect((1 - screen.y) / 2 * 720).toBeCloseTo(210, 8);
});

it('follows a moving target during and after a transition', () => {
  const camera = new PerspectiveCamera(45, 1, 0.01, 20000);
  camera.position.set(0, 30, 60);
  const controls = { target: new Vector3(), minDistance: 0, maxDistance: 15000 };
  const transitions: boolean[] = [];
  const controller = new CameraController(camera, controls, busy => transitions.push(busy));
  const group = new Group();
  const mesh = new Mesh(new SphereGeometry(1), new MeshBasicMaterial());
  group.add(mesh);
  controller.focus({ id: 'earth', kind: 'planet', mesh, focusObject: group, radius: 1, color: '#fff' });
  controller.update(0.3);
  expect(transitions).toEqual([true]);
  group.position.set(100, 0, 0);
  controller.update(0.35);
  expect(transitions).toEqual([true, false]);
  expect(controls.target.x).toBeCloseTo(100);
  const offset = camera.position.clone().sub(controls.target);
  group.position.x += 10;
  controller.update(1 / 60);
  expect(controls.target.x).toBe(110);
  expect(camera.position.clone().sub(controls.target).distanceTo(offset)).toBeLessThan(1e-10);
});

for (const aspect of [16 / 9, 390 / 844]) it('fits the entire system in overview at aspect ' + aspect, () => {
  const camera = new PerspectiveCamera(45, aspect, 0.01, 20000);
  const controls = { target: new Vector3(), minDistance: 0, maxDistance: 15000 };
  const controller = new CameraController(camera, controls);
  controller.overview();
  controller.update(1);
  expect(controls.maxDistance).toBeGreaterThan(camera.position.length());
  camera.lookAt(controls.target);
  camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (const planet of PLANETS_DATA) for (let i = 0; i < 16; i++) {
    expect(frustum.containsPoint(getPlanetPosition(planet, planet.period * i / 16))).toBe(true);
  }
});

it('returns from overview to a free camera view after resizing', () => {
  const camera = new PerspectiveCamera(45, 1, 0.02, 22000);
  camera.position.set(12, 34, 56);
  const controls = { target: new Vector3(2, 3, 4), minDistance: 0.2, maxDistance: 18000 };
  const controller = new CameraController(camera, controls);
  const original = camera.position.clone();
  const target = controls.target.clone();
  expect(controller.toggleOverview()).toBe(true);
  controller.update(1);
  controller.setViewport(10, 60, 370, 350, 390, 500);
  controller.update(1);
  expect(controller.toggleOverview()).toBe(false);
  controller.update(1);
  expect(camera.position.distanceTo(original)).toBeLessThan(1e-10);
  expect(controls.target.distanceTo(target)).toBeLessThan(1e-10);
  expect(camera.near).toBe(0.02);
  expect(camera.far).toBe(22000);
  expect(controls.minDistance).toBe(0.2);
  expect(controls.maxDistance).toBe(18000);
});

it('restores a manually rotated and zoomed body view at its new position and scale', () => {
  const camera = new PerspectiveCamera(45, 1, 0.01, 20000);
  const controls = { target: new Vector3(), minDistance: 0, maxDistance: 15000 };
  const controller = new CameraController(camera, controls);
  const mesh = new Mesh(new SphereGeometry(1), new MeshBasicMaterial());
  mesh.position.set(100, 0, 0);
  controller.focus({ id: 'earth', kind: 'planet', mesh, focusObject: mesh, radius: 1, color: '#fff' });
  controller.update(1);
  const offset = new Vector3(-8, 5, 12);
  camera.position.copy(mesh.position).add(offset);
  expect(controller.toggleOverview()).toBe(true);
  controller.update(1);
  mesh.position.set(150, 10, 5);
  mesh.scale.setScalar(2);
  expect(controller.toggleOverview()).toBe(false);
  controller.update(1);
  expect(camera.position.clone().sub(mesh.position).distanceTo(offset.clone().multiplyScalar(2))).toBeLessThan(1e-10);
  expect(controls.target.distanceTo(mesh.position)).toBeLessThan(1e-10);
  mesh.position.x += 10;
  controller.update(1 / 60);
  expect(camera.position.clone().sub(mesh.position).distanceTo(offset.clone().multiplyScalar(2))).toBeLessThan(1e-10);
  expect(camera.near).toBe(0.02);
});

it('can return before the overview transition finishes and repeat the round trip', () => {
  const camera = new PerspectiveCamera(45, 1, 0.01, 20000);
  camera.position.set(0, 30, 60);
  const controls = { target: new Vector3(), minDistance: 0.1, maxDistance: 15000 };
  const controller = new CameraController(camera, controls);
  const original = camera.position.clone();
  for (let i = 0; i < 2; i++) {
    controller.toggleOverview(); controller.update(0.1);
    controller.toggleOverview(); controller.update(1);
    expect(camera.position.distanceTo(original)).toBeLessThan(1e-10);
  }
});
