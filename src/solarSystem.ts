import * as THREE from "three";
import { PLANETS_DATA, AU_SCALE, PlanetOrbitData, getPlanetPosition } from "./utils/orbitPhysics";
import { MOONS_DATA } from "./moonsData";

// ── Текстуры ──────────────────────────────────────────────────────────────────
import sunMap            from './img/maps/8k_sun.jpg';
import mercuryMap        from './img/maps/8k_mercury.jpg';
import venusSurfaceMap   from './img/maps/8k_venus_surface.jpg';
import venusAtmosMap     from './img/maps/4k_venus_atmosphere.jpg';
import earthDayMap       from './img/maps/8k_earth_daymap.jpg';
import earthNightMap     from './img/maps/8k_earth_nightmap.jpg';
import earthCloudsMap    from './img/maps/8k_earth_clouds.jpg';
import earthNormalMap    from './img/maps/8k_earth_normal_map.tif';
import earthSpecMap      from './img/maps/8k_earth_specular_map.tif';
import earthBumpMap      from './img/maps/elev_bump_8k.jpg';
import waterMap          from './img/maps/water_8k.png';
import marsMap           from './img/maps/8k_mars.jpg';
import jupiterMap        from './img/maps/8k_jupiter.jpg';
import saturnMap         from './img/maps/8k_saturn.jpg';
import saturnRingMap     from './img/maps/8k_saturn_ring_alpha.png';
import uranusMap         from './img/maps/2k_uranus.jpg';
import neptuneMap        from './img/maps/2k_neptune.jpg';
import moonMap           from './img/maps/8k_moon.jpg';
import moonBumpMap       from './img/maps/8k_bump_moon.jpg';
import ceresMap          from './img/maps/4k_ceres_fictional.jpg';
import erisMap           from './img/maps/4k_eris_fictional.jpg';
import haumeaMap         from './img/maps/4k_haumea_fictional.jpg';
import makemakeMap       from './img/maps/4k_makemake_fictional.jpg';
// Плутон — используем eris как визуально похожую карликовую планету
import plutoMap          from './img/maps/4k_eris_fictional.jpg';

// ── Карта текстур по ключу ────────────────────────────────────────────────────
export const TEXTURE_MAP: Record<string, string> = {
  mercuryMap,
  venusMap:   venusSurfaceMap,
  earthMap:   earthDayMap,
  marsMap,
  jupiterMap,
  saturnMap,
  uranusMap,
  neptuneMap,
  moonMap,
  ceresMap,
  erisMap,
  haumeaMap,
  makemakeMap,
  plutoMap,
};

// ── Кольца Сатурна ────────────────────────────────────────────────────────────
function createSaturnRings(loader: THREE.TextureLoader) {
  const innerR = 5.5;
  const outerR = 10.0;
  const ringGeometry = new THREE.RingGeometry(innerR, outerR, 128, 32);
  const uvAttribute  = ringGeometry.attributes.uv;
  const posAttribute = ringGeometry.attributes.position;

  for (let i = 0; i < uvAttribute.count; i++) {
    const x      = posAttribute.getX(i);
    const y      = posAttribute.getY(i);
    const radius = Math.sqrt(x * x + y * y);
    const angle  = Math.atan2(y, x);
    uvAttribute.setXY(i,
      (angle + Math.PI) / (2 * Math.PI),
      (radius - innerR) / (outerR - innerR)
    );
  }
  uvAttribute.needsUpdate = true;

  const ringTexture = loader.load(saturnRingMap);
  ringTexture.wrapS = THREE.ClampToEdgeWrapping;
  ringTexture.wrapT = THREE.ClampToEdgeWrapping;

  const ringMaterial = new THREE.MeshStandardMaterial({
    map:         ringTexture,
    side:        THREE.DoubleSide,
    transparent: true,
    opacity:     0.85,
    depthWrite:  false,
    roughness:   0.6,
  });

  const rings = new THREE.Mesh(ringGeometry, ringMaterial);
  rings.rotation.x = Math.PI / 2;
  return rings;
}

// ── Орбитальная линия спутника ────────────────────────────────────────────────
function createMoonOrbit(radius: number, color: string) {
  const points   = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false });
  return new THREE.Line(geo, mat);
}

// ── Орбитальная линия планеты ─────────────────────────────────────────────────
function createOrbitLine(data: PlanetOrbitData) {
  const points   = [];
  const segments = 256;
  for (let i = 0; i <= segments; i++) {
    const days = (i / segments) * data.period;
    points.push(getPlanetPosition(data, days));
  }
  const geo  = new THREE.BufferGeometry().setFromPoints(points);
  const mat  = new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: 0.35, depthWrite: false });
  const line = new THREE.Line(geo, mat);
  line.visible = true;
  return line;
}

// ── Шейдер день/ночь для Земли ────────────────────────────────────────────────
function createEarthMaterial(loader: THREE.TextureLoader, sunLight: THREE.PointLight) {
  const dayTex    = loader.load(earthDayMap,    t => { t.anisotropy = 16; });
  const nightTex  = loader.load(earthNightMap,  t => { t.anisotropy = 16; });
  const normalTex = loader.load(earthNormalMap, t => { t.anisotropy = 16; });
  const specTex   = loader.load(earthSpecMap,   t => { t.anisotropy = 16; });
  const cloudsTex = loader.load(earthCloudsMap, t => { t.anisotropy = 16; });
  const waterTex  = loader.load(waterMap,       t => { t.anisotropy = 16; });

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap:    { value: dayTex },
      nightMap:  { value: nightTex },
      normalMap: { value: normalTex },
      specMap:   { value: specTex },
      cloudsMap: { value: cloudsTex },
      waterMap:  { value: waterTex },
      sunPos:    { value: new THREE.Vector3(0, 0, 0) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv      = uv;
        vNormal  = normalize(mat3(modelMatrix) * normal);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D normalMap;
      uniform sampler2D specMap;
      uniform sampler2D cloudsMap;
      uniform sampler2D waterMap;
      uniform vec3 sunPos;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3  toSun   = normalize(sunPos - vWorldPos);
        float NdotL   = dot(vNormal, toSun);
        float blend   = smoothstep(-0.15, 0.25, NdotL);

        vec4  dayCol   = texture2D(dayMap,   vUv);
        vec4  nightCol = texture2D(nightMap, vUv);
        vec4  clouds   = texture2D(cloudsMap, vUv);
        float water    = texture2D(waterMap,  vUv).r;

        // Смешиваем день/ночь
        vec3 surface = mix(nightCol.rgb * 1.2, dayCol.rgb, blend);

        // Облака поверх (ярче на дневной стороне)
        float cloudAlpha = clouds.r * mix(0.0, 0.85, blend);
        surface = mix(surface, vec3(1.0), cloudAlpha);

        // Лёгкий блик на воде
        float specular = water * pow(max(0.0, NdotL), 32.0) * 0.4 * blend;
        surface += vec3(specular);

        gl_FragColor = vec4(surface, 1.0);
      }
    `,
  });

  // Обновляем позицию Солнца каждый кадр через uniform
  (mat as any)._sunLight = sunLight;
  return mat;
}

// ── Атмосфера (Fresnel rim) ───────────────────────────────────────────────────
function createAtmosphere(radius: number, color: number, intensity: number) {
  const geo = new THREE.SphereGeometry(radius, 64, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      intensity: { value: intensity },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal  = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3  glowColor;
      uniform float intensity;
      varying vec3  vNormal;
      varying vec3  vViewDir;
      void main() {
        float rim = 1.0 - max(0.0, dot(vNormal, vViewDir));
        float alpha = pow(rim, 3.0) * intensity;
        gl_FragColor = vec4(glowColor, alpha);
      }
    `,
    side:        THREE.FrontSide,
    blending:    THREE.AdditiveBlending,
    transparent: true,
    depthWrite:  false,
  });
  return new THREE.Mesh(geo, mat);
}

// ── Главная функция ───────────────────────────────────────────────────────────
export function createSolarSystem(scene: THREE.Scene) {
  const loader  = new THREE.TextureLoader();
  const loadTex = (path: string) => loader.load(path, t => { t.anisotropy = 16; });

  // ── Солнце ──────────────────────────────────────────────────────────────────
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4, 64, 64),
    new THREE.MeshBasicMaterial({ map: loadTex(sunMap) })
  );
  scene.add(sunMesh);

  // decay=0: без затухания — все планеты получают одинаковый свет от Солнца.
  // Это не физично, но даёт хорошую видимость всех объектов.
  // Пересвет ближних планет контролируется через toneMappingExposure.
  const sunLight = new THREE.PointLight(0xfff5e0, 2.5, 0, 0);
  sunLight.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.bias       = -0.0005;
  sunLight.shadow.normalBias = -0.002;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far  = 2000;
  scene.add(sunLight);

  // Фоновый свет — тёмная сторона планет не полностью чёрная
  const ambientLight = new THREE.AmbientLight(0x202030, 0.15);
  scene.add(ambientLight);

  // Fill light — имитация рассеяния для дальних планет
  const fillLight = new THREE.DirectionalLight(0x334455, 0.2);
  fillLight.position.set(1, 0.5, 1).normalize();
  scene.add(fillLight);

  // Спрайт-ореол Солнца
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx  = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0,   'rgba(255, 220, 120, 1)');
  grad.addColorStop(0.3, 'rgba(255, 140, 50, 0.5)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map:        new THREE.CanvasTexture(canvas),
    blending:   THREE.AdditiveBlending,
    opacity:    0.75,
    transparent: true,
    depthWrite: false,
  }));
  sunSprite.scale.set(14, 14, 1);
  sunMesh.add(sunSprite);

  const planets: Record<string, any>      = { sun: { mesh: sunMesh, light: sunLight, sprite: sunSprite, pivot: sunMesh } };
  const orbits:  Record<string, THREE.Line> = {};
  const allMoons: Record<string, any>     = {};

  // ── Создание планет ─────────────────────────────────────────────────────────
  PLANETS_DATA.forEach(data => {
    const group = new THREE.Group();
    scene.add(group);

    const pivot = new THREE.Group();
    group.add(pivot);

    // Визуальные размеры (не масштабные, для наглядности)
    const SIZE: Record<string, number> = {
      mercury: 0.38, venus: 0.95, earth: 1.0, mars: 0.53,
      ceres: 0.20, jupiter: 3.8, saturn: 3.2, uranus: 2.2,
      neptune: 2.1, pluto: 0.25, haumea: 0.18, makemake: 0.19, eris: 0.24,
    };
    const size = SIZE[data.name] ?? 1.0;

    let mesh: THREE.Mesh;

    // ── Земля — шейдер день/ночь ──────────────────────────────────────────────
    if (data.name === 'earth') {
      const earthMat = createEarthMaterial(loader, sunLight);
      mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 64, 64), earthMat);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);

      // Атмосфера Земли
      pivot.add(createAtmosphere(1.06, 0x0066ff, 0.65));

    // ── Венера — поверхность + атмосфера ─────────────────────────────────────
    } else if (data.name === 'venus') {
      const mat = new THREE.MeshStandardMaterial({
        map:       loadTex(venusSurfaceMap),
        roughness: 0.7,
        metalness: 0.0,
      });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 64, 64), mat);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);

      // Слой атмосферы Венеры
      const atmosMat = new THREE.MeshStandardMaterial({
        map:         loadTex(venusAtmosMap),
        transparent: true,
        opacity:     0.55,
        blending:    THREE.AdditiveBlending,
        side:        THREE.DoubleSide,
        depthWrite:  false,
        roughness:   1.0,
      });
      const atmosMesh = new THREE.Mesh(new THREE.SphereGeometry(size * 1.03, 64, 64), atmosMat);
      pivot.add(atmosMesh);

      // Rim-свечение
      pivot.add(createAtmosphere(size * 1.07, 0xffcc44, 0.4));

    // ── Остальные планеты ─────────────────────────────────────────────────────
    } else {
      const texKey = TEXTURE_MAP[data.textureMap];
      const mat = new THREE.MeshStandardMaterial({
        map:       texKey ? loadTex(texKey) : undefined,
        roughness: 0.75,
        metalness: 0.05,
      });

      // Луна — bump-карта
      if (data.name === 'moon') {
        mat.bumpMap   = loadTex(moonBumpMap);
        mat.bumpScale = 0.04;
      }

      mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 64, 64), mat);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);

      // Кольца Сатурна
      if (data.name === 'saturn') {
        pivot.add(createSaturnRings(loader));
      }

      // Лёгкая атмосфера для газовых гигантов
      if (data.name === 'jupiter') pivot.add(createAtmosphere(size * 1.02, 0xd4a574, 0.2));
      if (data.name === 'saturn')  pivot.add(createAtmosphere(size * 1.02, 0xc9b896, 0.2));
      if (data.name === 'uranus')  pivot.add(createAtmosphere(size * 1.03, 0x88ddee, 0.3));
      if (data.name === 'neptune') pivot.add(createAtmosphere(size * 1.03, 0x4466ff, 0.35));
    }

    // Наклон оси
    mesh.rotation.z = (data.axialTilt * Math.PI) / 180;

    const orbitLine = createOrbitLine(data);
    scene.add(orbitLine);

    planets[data.name] = { group, mesh, pivot, data, orbitLine };
    orbits[data.name]  = orbitLine;
  });

  // ── Создание спутников ──────────────────────────────────────────────────────
  MOONS_DATA.forEach(moonData => {
    const parentGroup = planets[moonData.parent]?.group;
    if (!parentGroup) return;

    const texKey  = moonData.texture ? TEXTURE_MAP[moonData.texture] : null;
    const moonMat = new THREE.MeshStandardMaterial({
      map:       texKey ? loadTex(texKey) : undefined,
      color:     texKey ? 0xffffff : new THREE.Color(moonData.color),
      roughness: 0.9,
      metalness: 0.0,
    });

    // Луна — bump
    if (moonData.name === 'moon') {
      moonMat.bumpMap   = loadTex(moonBumpMap);
      moonMat.bumpScale = 0.04;
    }

    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(moonData.size, 32, 32),
      moonMat
    );
    moonMesh.castShadow    = true;
    moonMesh.receiveShadow = true;

    const moonOrbit = createMoonOrbit(moonData.orbitRadius, moonData.color);

    parentGroup.add(moonMesh);
    parentGroup.add(moonOrbit);

    allMoons[moonData.name] = { mesh: moonMesh, moonData, orbitLine: moonOrbit };
  });

  return { ...planets, moons: allMoons, ambientLight, fillLight, orbits, sunLight } as any;
}
