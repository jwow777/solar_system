import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { bindEclipseShadow, eclipseUniforms } from '../src/eclipse';

function fixture(atmosphere = false) {
  const material = new THREE.ShaderMaterial({ uniforms: {
    ...eclipseUniforms(), [atmosphere ? 'sunPosition' : 'sunPos']: { value: new THREE.Vector3() },
  } });
  const receiver = new THREE.Mesh(new THREE.SphereGeometry(1), material);
  const moon = new THREE.Mesh();
  const parent = new THREE.Group();
  parent.position.set(10, 0, 0);
  parent.scale.setScalar(2);
  parent.add(moon);
  moon.position.set(1, 2, 3);
  const sun = new THREE.Mesh();
  sun.position.set(0, 0, 30);
  sun.scale.setScalar(3);
  const render = () => receiver.onBeforeRender(null!, null!, null!, null!, null!, null!);
  return { material, receiver, moon, parent, sun, render };
}

it('uses world positions and radii when planets and the Sun are scaled', () => {
  const { material, receiver, moon, sun, render } = fixture();
  bindEclipseShadow(receiver, moon, 0.27, sun, 4);
  render();
  expect(material.uniforms.occluderPosition.value.toArray()).toEqual([12, 4, 6]);
  expect(material.uniforms.occluderRadius.value).toBeCloseTo(0.54);
  expect(material.uniforms.sunPos.value.toArray()).toEqual([0, 0, 30]);
  expect(material.uniforms.sunRadius.value).toBe(12);
});

it('updates the shadow after movement or scaling even without a simulation tick', () => {
  const { material, receiver, moon, parent, sun, render } = fixture();
  bindEclipseShadow(receiver, moon, 0.27, sun, 4);
  render();
  moon.position.set(-1, 0, 4);
  parent.scale.setScalar(0.5);
  sun.position.z = 50;
  render();
  expect(material.uniforms.occluderPosition.value.toArray()).toEqual([9.5, 0, 2]);
  expect(material.uniforms.occluderRadius.value).toBeCloseTo(0.135);
  expect(material.uniforms.sunPos.value.z).toBe(50);
});

it('preserves existing cloud/atmosphere callbacks and their mesh context', () => {
  const { material, receiver, moon, sun, render } = fixture(true);
  const callback = vi.fn(function (this: THREE.Mesh) { this.userData.lightingUpdated = true; });
  receiver.onBeforeRender = callback;
  bindEclipseShadow(receiver, moon, 0.27, sun, 4);
  render();
  expect(callback).toHaveBeenCalledOnce();
  expect(receiver.userData.lightingUpdated).toBe(true);
  expect(material.uniforms.sunPosition.value.toArray()).toEqual([0, 0, 30]);
});
