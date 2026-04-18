import * as THREE from "./three.module.js";

export default class ProtoPlanet {
  private _size: number;
  private _material: any;

  constructor(size: number, material: any) {
    this._size = size;
    this._material = material;
  }

  generate(): any {
    const proto = new THREE.Mesh(new THREE.SphereGeometry(this._size, 80, 80), new THREE.MeshPhongMaterial(this._material));
    return proto;
  }
}