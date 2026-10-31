import { Camera, Scene, Vector3 } from 'three';

/** Rebase only the rendered frame; controls and orbital calculations keep full coordinates. */
export class RenderOrigin {
  private cameraPosition = new Vector3();
  private scenePosition = new Vector3();

  constructor(private scene: Scene, private camera: Camera) {}

  render(draw: () => void) {
    this.cameraPosition.copy(this.camera.position);
    this.scenePosition.copy(this.scene.position);
    this.scene.position.sub(this.cameraPosition);
    this.camera.position.set(0, 0, 0);
    this.camera.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    try { draw(); }
    finally {
      this.scene.position.copy(this.scenePosition);
      this.camera.position.copy(this.cameraPosition);
      this.scene.updateMatrixWorld(true);
      this.camera.updateMatrixWorld(true);
    }
  }
}
