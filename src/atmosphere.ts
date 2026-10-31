import * as THREE from 'three';
import type { PlanetId } from './types/types';
import { eclipseGLSL, eclipseUniforms } from './eclipse';

interface AtmosphereProfile {
  thickness: number; // Fraction of the visible planet radius, above the surface/cloud tops.
  scaleHeight: number;
  rayleigh: [number, number, number];
  mie: number;
  tint: number;
}

// Single-scattering model: https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering
// Rendering approximations, not measurements of the planets' bulk atmospheres.
// Gas-giant textures already represent cloud tops, so only a very thin upper haze is added.
const profiles: Partial<Record<PlanetId, AtmosphereProfile>> = {
  earth: { thickness: 0.015, scaleHeight: 0.0014, rayleigh: [30, 70, 170], mie: 3, tint: 0xffffff },
  venus: { thickness: 0.012, scaleHeight: 0.002, rayleigh: [10, 12, 16], mie: 24, tint: 0xfff6e7 },
  mars: { thickness: 0.007, scaleHeight: 0.0016, rayleigh: [5, 3.5, 2], mie: 0.8, tint: 0xffdec4 },
  jupiter: { thickness: 0.004, scaleHeight: 0.0009, rayleigh: [10, 14, 20], mie: 1.4, tint: 0xfff6e9 },
  saturn: { thickness: 0.004, scaleHeight: 0.001, rayleigh: [8, 12, 18], mie: 1.5, tint: 0xfff8e9 },
  uranus: { thickness: 0.006, scaleHeight: 0.0013, rayleigh: [16, 30, 42], mie: 1.5, tint: 0xf2ffff },
  neptune: { thickness: 0.006, scaleHeight: 0.0013, rayleigh: [12, 26, 52], mie: 1.5, tint: 0xf4faff },
};

export function createAtmosphere(planet: PlanetId, radius: number, sun: THREE.PointLight) {
  const profile = profiles[planet];
  if (!profile) return null;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...eclipseUniforms(),
      surfaceRadius: { value: radius },
      thickness: { value: profile.thickness },
      scaleHeight: { value: profile.scaleHeight },
      rayleigh: { value: new THREE.Vector3(...profile.rayleigh) },
      mie: { value: profile.mie },
      tint: { value: new THREE.Color(profile.tint) },
      sunPosition: { value: new THREE.Vector3() },
      sunColor: { value: new THREE.Color() },
      sunIntensity: { value: sun.intensity },
    },
    vertexShader: `
      uniform float surfaceRadius;
      varying vec3 vWorldPosition, vPlanetCenter;
      varying float vSurfaceRadius;
      void main() {
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vPlanetCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vSurfaceRadius = surfaceRadius * length(modelMatrix[0].xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float thickness, scaleHeight, mie, sunIntensity;
      uniform vec3 rayleigh, tint, sunPosition, sunColor;
      varying vec3 vWorldPosition, vPlanetCenter;
      varying float vSurfaceRadius;
      const float PI = 3.14159265359;
      ${eclipseGLSL}

      vec2 intersectSphere(vec3 origin, vec3 direction, float radius) {
        float projected = dot(origin, direction);
        vec3 closest = origin - direction * projected;
        float discriminant = radius * radius - dot(closest, closest);
        if (discriminant < 0.0) return vec2(1e20, -1e20);
        float halfChord = sqrt(discriminant);
        return vec2(-projected - halfChord, -projected + halfChord);
      }

      float densityAt(vec3 point) {
        float altitude = max(length(point) - 1.0, 0.0);
        float fade = 1.0 - smoothstep(thickness * 0.7, thickness, altitude);
        return exp(-altitude / scaleHeight) * fade;
      }

      void main() {
        // Integrate in planet-radius units so scaling a planet does not change its haze.
        vec3 origin = (cameraPosition - vPlanetCenter) / vSurfaceRadius;
        vec3 direction = normalize(vWorldPosition - cameraPosition);
        float outerRadius = 1.0 + thickness;
        vec2 atmosphere = intersectSphere(origin, direction, outerRadius);
        float start = max(atmosphere.x, 0.0);
        float finish = atmosphere.y;
        vec2 ground = intersectSphere(origin, direction, 1.0);
        if (ground.x > 0.0) finish = min(finish, ground.x);
        if (finish <= start) discard;

        vec3 lightDirection = normalize(sunPosition - vPlanetCenter);
        float mu = dot(direction, lightDirection);
        float rayleighPhase = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
        float g = 0.6;
        float miePhase = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
        vec3 extinction = rayleigh + vec3(mie);
        vec3 scattering = rayleigh * rayleighPhase + vec3(mie * miePhase);
        float stepLength = (finish - start) / 8.0;
        float viewDepth = 0.0;
        vec3 radiance = vec3(0.0);

        // Single scattering with an exponentially thinning atmosphere; no emissive rim.
        for (int i = 0; i < 8; i++) {
          vec3 samplePoint = origin + direction * (start + (float(i) + 0.5) * stepLength);
          float density = densityAt(samplePoint);
          viewDepth += density * stepLength * 0.5;
          vec2 lightGround = intersectSphere(samplePoint, lightDirection, 1.0);
          if (lightGround.y < 0.0 || lightGround.x <= 0.00001) {
            float lightDistance = max(intersectSphere(samplePoint, lightDirection, outerRadius).y, 0.0);
            float lightStep = lightDistance / 4.0;
            float lightDepth = 0.0;
            for (int j = 0; j < 4; j++) {
              lightDepth += densityAt(samplePoint + lightDirection * ((float(j) + 0.5) * lightStep)) * lightStep;
            }
            vec3 transmittance = exp(-extinction * (viewDepth + lightDepth));
            vec3 worldSample = vPlanetCenter + samplePoint * vSurfaceRadius;
            radiance += transmittance * scattering * density * stepLength * solarVisibility(worldSample, sunPosition);
          }
          viewDepth += density * stepLength * 0.5;
        }

        float opacity = 1.0 - exp(-viewDepth * dot(extinction, vec3(0.2126, 0.7152, 0.0722)));
        // Premultiplied, linear radiance. OutputPass performs the only display conversion.
        gl_FragColor = vec4(radiance * tint * sunColor * sunIntensity, opacity);
      }
    `,
    transparent: true,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * (1 + profile.thickness), 64, 48), material);
  atmosphere.name = planet + '-atmosphere';
  atmosphere.onBeforeRender = () => {
    material.uniforms.sunPosition.value.setFromMatrixPosition(sun.matrixWorld);
    material.uniforms.sunColor.value.copy(sun.color);
    material.uniforms.sunIntensity.value = sun.intensity;
  };
  return atmosphere;
}
