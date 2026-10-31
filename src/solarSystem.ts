import * as THREE from 'three';
import { getPlanetPosition } from './utils/orbitPhysics';
import { getMoonOrbitalFrame, getMoonOrbitPoints, getPlanetSpinAxis } from './utils/moonOrbits';
import { PLANETS_DATA } from './constants/planetsData';
import { MOONS_DATA } from './constants/moonsData';
import { BODY_CATALOG } from './catalog';
import { createAtmosphere } from './atmosphere';
import { bindEclipseShadow, eclipseGLSL, eclipseUniforms } from './eclipse';
import { ORBIT_OPACITY, MOON_ORBIT_OPACITY } from './orbits';
import type { TextureManager } from './textures';
import type { BodyInstance, MoonData, MoonId, MoonInstance, PlanetId, PlanetInstance, PlanetOrbitData, SolarSystem } from './types/types';

export const PLANET_SIZES: Record<PlanetId, number> = {
  mercury: 0.38, venus: 0.95, earth: 1, mars: 0.53, ceres: 0.2, jupiter: 3.8,
  saturn: 3.2, uranus: 2.2, neptune: 2.1, pluto: 0.25, haumea: 0.18, makemake: 0.19, eris: 0.24,
};

const worldVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function lightingUniforms() {
  return {
    sunPos: { value: new THREE.Vector3() },
    lightColor: { value: new THREE.Color('#fff5e0') },
    lightIntensity: { value: 1.2 },
    ambientStr: { value: 0.12 },
  };
}

function createEarthMaterial(textures: TextureManager) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...lightingUniforms(), ...eclipseUniforms(), dayMap: { value: null }, nightMap: { value: null },
      cloudsMap: { value: null }, waterMap: { value: null }, cloudOffset: { value: 0 },
    },
    vertexShader: worldVertexShader,
    fragmentShader: `
      uniform sampler2D dayMap, nightMap, cloudsMap, waterMap;
      uniform vec3 sunPos, lightColor;
      uniform float lightIntensity, ambientStr, cloudOffset;
      varying vec2 vUv;
      varying vec3 vNormal, vWorldPos;
      ${eclipseGLSL}
      void main() {
        vec3 toSun = normalize(sunPos - vWorldPos);
        vec3 normal = normalize(vNormal);
        float NdotL = dot(normal, toSun);
        float blend = smoothstep(-0.06, 0.12, NdotL);
        vec3 day = texture2D(dayMap, vUv).rgb;
        vec3 night = texture2D(nightMap, vUv).rgb;
        float clouds = texture2D(cloudsMap, vec2(fract(vUv.x + cloudOffset), vUv.y)).r;
        float water = texture2D(waterMap, vUv).r;
        float cloudShadow = 1.0 - smoothstep(0.15, 0.85, clouds) * 0.22;
        float visibility = NdotL > 0.0 ? solarVisibility(vWorldPos, sunPos) : 1.0;
        vec3 sunlight = lightColor * max(NdotL, 0.0) * lightIntensity * cloudShadow * visibility;
        vec3 surface = mix(night * 0.55, day * (vec3(ambientStr) + sunlight), blend);
        vec3 toCamera = normalize(cameraPosition - vWorldPos);
        vec3 halfVector = toSun + toCamera;
        halfVector *= inversesqrt(max(dot(halfVector, halfVector), 0.000001));
        float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(normal, toCamera), 0.0), 5.0);
        float reflection = (104.0 / (8.0 * 3.14159265)) * pow(max(dot(normal, halfVector), 0.0), 96.0) * fresnel;
        surface += sunlight * water * reflection * blend;
        // Linear output: tone mapping and sRGB encoding happen once, in OutputPass.
        gl_FragColor = vec4(surface, 1.0);
      }
    `,
  });
  for (const [uniform, key] of Object.entries({ dayMap: 'earthMap', nightMap: 'earthNightMap', cloudsMap: 'earthCloudsMap', waterMap: 'waterMap' })) {
    textures.bind('earth', key, texture => { material.uniforms[uniform].value = texture; });
  }
  return material;
}

function createEarthClouds(textures: TextureManager, sun: THREE.PointLight, ambient: THREE.AmbientLight) {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...lightingUniforms(), ...eclipseUniforms(), cloudsMap: { value: null } },
    vertexShader: worldVertexShader,
    fragmentShader: `
      uniform sampler2D cloudsMap;
      uniform vec3 sunPos, lightColor;
      uniform float lightIntensity, ambientStr;
      varying vec2 vUv;
      varying vec3 vNormal, vWorldPos;
      ${eclipseGLSL}
      void main() {
        float coverage = smoothstep(0.04, 0.9, texture2D(cloudsMap, vUv).r);
        if (coverage < 0.005) discard;
        float NdotL = dot(normalize(vNormal), normalize(sunPos - vWorldPos));
        float visibility = NdotL > 0.0 ? solarVisibility(vWorldPos, sunPos) : 1.0;
        vec3 light = vec3(ambientStr * 0.3) + lightColor * max(NdotL, 0.0) * lightIntensity * visibility;
        gl_FragColor = vec4(vec3(0.95, 0.97, 1.0) * light * coverage, coverage);
      }
    `,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
  textures.bind('earth', 'earthCloudsMap', texture => { material.uniforms.cloudsMap.value = texture; });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.0015, 64, 48), material);
  clouds.name = 'earth-clouds';
  clouds.onBeforeRender = () => {
    material.uniforms.sunPos.value.setFromMatrixPosition(sun.matrixWorld);
    material.uniforms.lightColor.value.copy(sun.color);
    material.uniforms.lightIntensity.value = sun.intensity;
    material.uniforms.ambientStr.value = ambient.intensity;
  };
  return clouds;
}

function createSaturnRings(textures: TextureManager) {
  const inner = 5.5, outer = 10;
  const geometry = new THREE.RingGeometry(inner, outer, 128, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const radius = Math.hypot(position.getX(i), position.getY(i));
    geometry.attributes.uv.setXY(i, (radius - inner) / (outer - inner), 0.5);
  }
  const material = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false, roughness: 0.6,
  });
  textures.bind('saturn', 'saturnRingMap', texture => { material.map = texture; material.needsUpdate = true; });
  const rings = new THREE.Mesh(geometry, material);
  rings.name = 'saturn-rings';
  rings.userData.realisticSizes = false;
  rings.rotation.x = Math.PI / 2;
  return rings;
}

function createOrbitLine(data: PlanetOrbitData) {
  const points = Array.from({ length: 257 }, (_, i) => getPlanetPosition(data, i / 256 * data.period));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: ORBIT_OPACITY, depthWrite: false }));
}

function createMoonOrbit(data: MoonData) {
  const points = getMoonOrbitPoints(data);
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: MOON_ORBIT_OPACITY, depthWrite: false }));
}

export function createSolarSystem(scene: THREE.Scene, textures: TextureManager): SolarSystem {
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(4, 64, 48), new THREE.MeshBasicMaterial());
  textures.bind('sun', 'sunMap', texture => { sunMesh.material.map = texture; sunMesh.material.needsUpdate = true; });
  scene.add(sunMesh);
  const sunLight = new THREE.PointLight(0xfff5e0, 1.2, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.bias = -0.001;
  sunLight.shadow.normalBias = 0.02;
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = 4000;
  scene.add(sunLight);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(ambientLight);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Не удалось создать изображение Солнца.');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,220,120,1)');
  gradient.addColorStop(0.3, 'rgba(255,140,50,0.5)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), blending: THREE.AdditiveBlending, opacity: 0.75, transparent: true, depthWrite: false,
  }));
  sprite.scale.set(14, 14, 1);
  sunMesh.add(sprite);

  const planets = {} as Record<PlanetId, PlanetInstance>;
  const moons = {} as Record<MoonId, MoonInstance>;
  const orbits = {} as Record<PlanetId, THREE.Line>;
  const bodies: BodyInstance[] = [{ id: 'sun', kind: 'star', mesh: sunMesh, focusObject: sunMesh, radius: 4, color: '#ffaa00' }];

  for (const data of PLANETS_DATA) {
    const group = new THREE.Group();
    const pivot = new THREE.Group();
    scene.add(group);
    group.add(pivot);
    const radius = PLANET_SIZES[data.name];
    let material: THREE.Material;
    if (data.name === 'earth') material = createEarthMaterial(textures);
    else {
      const standard = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.0 });
      if (data.name === 'venus') {
        // The source cloud map has exaggerated yellow contrast; preserve its patterns
        // in a pale, opaque cloud deck instead of exposing the rocky surface.
        standard.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
            #include <map_fragment>
            float cloudDetail = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = vec3(0.88, 0.83, 0.70) * (0.78 + 0.22 * cloudDetail);
          `);
        };
      }
      textures.bind(data.name, data.name === 'venus' ? 'venusAtmosMap' : data.textureMap, texture => { standard.map = texture; standard.needsUpdate = true; });
      material = standard;
    }
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), material);
    mesh.castShadow = mesh.receiveShadow = true;
    pivot.add(mesh);
    const clouds = data.name === 'earth' ? createEarthClouds(textures, sunLight, ambientLight) : undefined;
    if (clouds) pivot.add(clouds);
    // Venus is seen at its opaque cloud tops; the rocky surface is hidden in visible light.
    const atmosphere = createAtmosphere(data.name, radius, sunLight);
    if (atmosphere) pivot.add(atmosphere);
    const rings = data.name === 'saturn' ? createSaturnRings(textures) : undefined;
    if (rings) pivot.add(rings);
    const spinAxis = getPlanetSpinAxis(data.name);
    if (spinAxis) pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), spinAxis);
    else pivot.rotation.z = data.axialTilt * Math.PI / 180;
    const orbitLine = createOrbitLine(data);
    scene.add(orbitLine);
    planets[data.name] = { group, pivot, mesh, data, orbitLine, clouds, rings };
    orbits[data.name] = orbitLine;
    bodies.push({
      id: data.name, kind: BODY_CATALOG.find(body => body.id === data.name)!.kind,
      mesh, focusObject: group, radius: data.name === 'saturn' ? 10 : radius, color: data.color,
    });
  }

  for (const data of MOONS_DATA) {
    const parent = planets[data.parent];
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...lightingUniforms(), moonMap: { value: null }, hasTex: { value: data.texture ? 1 : 0 },
        baseColor: { value: new THREE.Color(data.color) },
        planetPos: { value: new THREE.Vector3() }, planetRadius: { value: PLANET_SIZES[data.parent] },
      },
      vertexShader: worldVertexShader,
      fragmentShader: `
        uniform sampler2D moonMap;
        uniform float hasTex, planetRadius, ambientStr, lightIntensity;
        uniform vec3 baseColor, sunPos, planetPos, lightColor;
        varying vec2 vUv;
        varying vec3 vNormal, vWorldPos;
        void main() {
          vec3 toSun = normalize(sunPos - vWorldPos);
          float projection = dot(planetPos - vWorldPos, toSun);
          float distanceToRay = length(vWorldPos + toSun * projection - planetPos);
          float shadow = projection > 0.0 ? smoothstep(planetRadius * 0.9, planetRadius * 1.1, distanceToRay) : 1.0;
          float diffuse = max(0.0, dot(normalize(vNormal), toSun));
          vec3 light = vec3(ambientStr) + diffuse * shadow * lightColor * lightIntensity;
          vec3 color = hasTex > 0.5 ? texture2D(moonMap, vUv).rgb : baseColor;
          gl_FragColor = vec4(color * light, 1.0);
        }
      `,
    });
    if (data.texture) textures.bind(data.name, data.texture, texture => { material.uniforms.moonMap.value = texture; });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.size, 32, 24), material);
    const parentScale = new THREE.Vector3();
    mesh.onBeforeRender = () => {
      sunLight.getWorldPosition(material.uniforms.sunPos.value);
      parent.group.getWorldPosition(material.uniforms.planetPos.value);
      parent.mesh.getWorldScale(parentScale);
      material.uniforms.planetRadius.value = PLANET_SIZES[data.parent] * Math.max(parentScale.x, parentScale.y, parentScale.z);
    };
    const orbitGroup = new THREE.Group();
    // Horizons elements are already in the scene's ecliptic frame: no extra axial tilt.
    const orbitLine = createMoonOrbit(data);
    orbitGroup.add(mesh, orbitLine);
    parent.group.add(orbitGroup);
    moons[data.name] = { mesh, moonData: data, orbitLine, orbitGroup, orbitalFrame: getMoonOrbitalFrame(data) };
    bodies.push({ id: data.name, kind: 'moon', mesh, focusObject: mesh, radius: data.size, color: data.color });
  }
  // ShaderMaterial does not consume Three.js shadow maps. Apply the Moon's
  // occlusion explicitly to every illuminated layer of the Earth.
  const earth = planets.earth;
  for (const layer of earth.pivot.children) {
    if (layer instanceof THREE.Mesh && layer.material instanceof THREE.ShaderMaterial) {
      bindEclipseShadow(layer, moons.moon.mesh, moons.moon.moonData.size, sunMesh, 4);
    }
  }
  return { sun: { mesh: sunMesh, light: sunLight, sprite }, planets, moons, bodies, ambientLight, orbits };
}
