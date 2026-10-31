import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AU_SCALE } from './utils/orbitPhysics';
import { PLANETS_DATA } from './constants/planetsData';
import type { BodyInstance } from './types/types';

export function focusDistance(radius: number, fov: number, aspect: number): number {
  const vertical = fov * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return radius / Math.sin(Math.min(vertical, horizontal)) * 1.35;
}

export class CameraController {
  private body: BodyInstance | null = null;
  private progress = 1;
  private startPosition = new Vector3();
  private startTarget = new Vector3();
  private lastPosition = new Vector3();
  private worldPosition = new Vector3();
  private worldScale = new Vector3();
  private destination = new Vector3();
  private lookAt = new Vector3();
  private direction = new Vector3(1, 0.35, 1).normalize();
  private distance = 0;
  private delta = new Vector3();
  private viewport: { width: number; height: number; fullHeight: number } | null = null;
  private isOverview = false;

  constructor(
    private camera: PerspectiveCamera,
    private controls: Pick<OrbitControls, 'target' | 'minDistance' | 'maxDistance'>,
    private onTransitionChange: (busy: boolean) => void = () => {},
  ) {}

  setViewport(x: number, y: number, width: number, height: number, fullWidth: number, fullHeight: number) {
    this.viewport = { width, height, fullHeight };
    this.camera.setViewOffset(fullWidth, fullHeight, fullWidth / 2 - x - width / 2, fullHeight / 2 - y - height / 2, fullWidth, fullHeight);
    if (this.isOverview) this.overview();
    else this.refit();
  }

  private fitDistance(radius: number) {
    if (!this.viewport) return focusDistance(radius, this.camera.fov, this.camera.aspect);
    const { width, height, fullHeight } = this.viewport;
    const fov = 2 * Math.atan(Math.tan(this.camera.fov * Math.PI / 360) * height / fullHeight) * 180 / Math.PI;
    return focusDistance(radius, fov, width / height);
  }

  focus(body: BodyInstance) {
    this.isOverview = false;
    this.body = body;
    body.focusObject.getWorldPosition(this.lastPosition);
    this.refit();
    this.begin();
  }

  refit() {
    if (!this.body) return;
    this.body.mesh.getWorldScale(this.worldScale);
    const radius = this.body.radius * Math.max(this.worldScale.x, this.worldScale.y, this.worldScale.z);
    const distance = this.fitDistance(radius);
    if (Math.abs(distance - this.distance) > Math.max(1e-12, distance * 1e-6)) this.begin();
    this.distance = distance;
    this.controls.minDistance = radius * 1.15;
    this.camera.near = Math.max(1e-9, radius / 100);
    this.camera.updateProjectionMatrix();
  }

  overview() {
    this.isOverview = true;
    this.body = null;
    const extent = Math.max(...PLANETS_DATA.map(p => p.a * (1 + p.e))) * AU_SCALE;
    const distance = this.fitDistance(extent);
    this.controls.maxDistance = Math.max(15000, distance * 1.5);
    this.camera.far = Math.max(20000, this.controls.maxDistance + extent * 3);
    this.camera.near = 0.01;
    this.camera.updateProjectionMatrix();
    this.destination.set(0, distance * 0.6, distance * 0.8);
    this.lookAt.set(0, 0, 0);
    this.controls.minDistance = 0.1;
    this.begin();
  }

  cancelTransition() {
    const wasTransitioning = this.progress < 1;
    this.progress = 1;
    if (wasTransitioning) this.onTransitionChange(false);
    if (this.body) this.body.focusObject.getWorldPosition(this.lastPosition);
  }

  private begin() {
    const wasTransitioning = this.progress < 1;
    this.startPosition.copy(this.camera.position);
    this.startTarget.copy(this.controls.target);
    this.progress = 0;
    if (!wasTransitioning) this.onTransitionChange(true);
  }

  update(seconds: number) {
    if (this.body) {
      this.body.focusObject.getWorldPosition(this.worldPosition);
      this.destination.copy(this.worldPosition).addScaledVector(this.direction, this.distance);
      this.lookAt.copy(this.worldPosition);
    }
    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + seconds / 0.65);
      const eased = this.progress * this.progress * (3 - 2 * this.progress);
      this.camera.position.lerpVectors(this.startPosition, this.destination, eased);
      this.controls.target.lerpVectors(this.startTarget, this.lookAt, eased);
      if (this.progress === 1) this.onTransitionChange(false);
    } else if (this.body) {
      this.camera.position.add(this.delta.subVectors(this.worldPosition, this.lastPosition));
      this.controls.target.copy(this.worldPosition);
    }
    if (this.body) this.lastPosition.copy(this.worldPosition);
  }
}
