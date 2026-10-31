import * as THREE from 'three';

export function eclipseUniforms() {
  return {
    occluderPosition: { value: new THREE.Vector3() },
    occluderRadius: { value: 0 },
    sunRadius: { value: 0 },
  };
}

// Fraction of the apparent solar disk visible from a world-space sample.
// Disk overlap gives continuous penumbra, umbra and annular eclipses.
export const eclipseGLSL = `
  uniform vec3 occluderPosition;
  uniform float occluderRadius, sunRadius;

  float solarVisibility(vec3 point, vec3 lightPosition) {
    if (occluderRadius <= 0.0) return 1.0;
    vec3 toLight = lightPosition - point;
    vec3 toOccluder = occluderPosition - point;
    float lightDistance = length(toLight);
    float occluderDistance = length(toOccluder);
    if (occluderDistance >= lightDistance || dot(toLight, toOccluder) <= 0.0) return 1.0;
    if (occluderDistance <= occluderRadius) return 0.0;
    float lightAngle = asin(clamp(sunRadius / lightDistance, 0.000001, 1.0));
    float occluderAngle = asin(clamp(occluderRadius / occluderDistance, 0.0, 1.0));
    // atan(cross, dot) retains precision for the tiny apparent disks at real scale.
    float separation = atan(length(cross(toLight, toOccluder)), dot(toLight, toOccluder));
    if (separation >= lightAngle + occluderAngle) return 1.0;
    float lightArea = 3.14159265359 * lightAngle * lightAngle;
    if (separation <= abs(lightAngle - occluderAngle)) {
      float coveredRadius = min(lightAngle, occluderAngle);
      return clamp(1.0 - coveredRadius * coveredRadius / (lightAngle * lightAngle), 0.0, 1.0);
    }
    float d2 = separation * separation;
    float l2 = lightAngle * lightAngle;
    float o2 = occluderAngle * occluderAngle;
    float lightSector = acos(clamp((d2 + l2 - o2) / (2.0 * separation * lightAngle), -1.0, 1.0));
    float occluderSector = acos(clamp((d2 + o2 - l2) / (2.0 * separation * occluderAngle), -1.0, 1.0));
    float triangle = max((-separation + lightAngle + occluderAngle)
      * (separation + lightAngle - occluderAngle)
      * (separation - lightAngle + occluderAngle)
      * (separation + lightAngle + occluderAngle), 0.0);
    float coveredArea = l2 * lightSector + o2 * occluderSector - 0.5 * sqrt(triangle);
    return clamp(1.0 - coveredArea / lightArea, 0.0, 1.0);
  }
`;

/** Update eclipse geometry at render time, including paused scenes and parent scaling. */
export function bindEclipseShadow(receiver: THREE.Mesh, occluder: THREE.Mesh, radius: number, sun: THREE.Mesh, lightRadius: number) {
  const material = receiver.material;
  if (!(material instanceof THREE.ShaderMaterial)) return;
  const previous = receiver.onBeforeRender;
  const scale = new THREE.Vector3();
  const sunScale = new THREE.Vector3();
  receiver.onBeforeRender = (...args) => {
    previous.apply(receiver, args);
    occluder.getWorldPosition(material.uniforms.occluderPosition.value);
    occluder.getWorldScale(scale);
    material.uniforms.occluderRadius.value = radius * Math.max(scale.x, scale.y, scale.z);
    sun.getWorldScale(sunScale);
    material.uniforms.sunRadius.value = lightRadius * Math.max(sunScale.x, sunScale.y, sunScale.z);
    const position = material.uniforms.sunPos ?? material.uniforms.sunPosition;
    sun.getWorldPosition(position.value);
  };
}
