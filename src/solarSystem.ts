import * as THREE from "three";
import { PLANETS_DATA, AU_SCALE, PlanetOrbitData, getPlanetPosition } from "./utils/orbitPhysics";
import { MOONS_DATA } from "./moonsData";

// Импорт текстур (основные)
import sunMap from './img/maps/8k_sun.jpg';
import mercuryMap from './img/maps/8k_mercury.jpg';
import venusSurfaceMap from './img/maps/8k_venus_surface.jpg';
import earthDayMap from './img/maps/8k_earth_daymap.jpg';
import earthCloudsMap from './img/maps/8k_earth_clouds.jpg';
import earthBumpMap from './img/maps/elev_bump_8k.jpg';
import marsMap from './img/maps/8k_mars.jpg';
import jupiterMap from './img/maps/8k_jupiter.jpg';
import saturnMap from './img/maps/8k_saturn.jpg';
import saturnRingMap from './img/maps/8k_saturn_ring_alpha.png';
import uranusMap from './img/maps/2k_uranus.jpg';
import neptuneMap from './img/maps/2k_neptune.jpg';
import moonMap from './img/maps/8k_moon.jpg';
import moonBumpMap from './img/maps/8k_bump_moon.jpg';
import ceresMap from './img/maps/4k_ceres_fictional.jpg';
import erisMap from './img/maps/4k_eris_fictional.jpg';
import haumeaMap from './img/maps/4k_haumea_fictional.jpg';
import makemakeMap from './img/maps/4k_makemake_fictional.jpg';
import plutoMap from './img/maps/4k_pluto_fictional.jpg';

const TEXTURE_MAP: Record<string, string> = {
  mercuryMap, venusMap: venusSurfaceMap, earthMap: earthDayMap, marsMap,
  jupiterMap, saturnMap, uranusMap, neptuneMap
};

// --- КОЛЬЦА САТУРНА ---
function createSaturnRings() {
  const innerR = 5.5;
  const outerR = 10.0;
  const ringGeometry = new THREE.RingGeometry(innerR, outerR, 128, 32);
  const uvAttribute = ringGeometry.attributes.uv;
  const posAttribute = ringGeometry.attributes.position;
  
  for (let i = 0; i < uvAttribute.count; i++) {
    const x = posAttribute.getX(i);
    const y = posAttribute.getY(i);
    const radius = Math.sqrt(x * x + y * y);
    const angle = Math.atan2(y, x);
    uvAttribute.setXY(i, (angle + Math.PI) / (2 * Math.PI), (radius - innerR) / (outerR - innerR));
  }
  uvAttribute.needsUpdate = true;

  const loader = new THREE.TextureLoader();
  const ringTexture = loader.load(saturnRingMap);
  ringTexture.wrapS = THREE.ClampToEdgeWrapping; 
  ringTexture.wrapT = THREE.ClampToEdgeWrapping;

  const ringMaterial = new THREE.MeshStandardMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    roughness: 0.6
  });
  
  const rings = new THREE.Mesh(ringGeometry, ringMaterial);
  rings.rotation.x = Math.PI / 2;
  return rings;
}

// --- ОРБИТА СПУТНИКА ---
function createMoonOrbit(radius: number, color: string) {
  const points = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false });
  return new THREE.Line(geo, mat);
}

function createOrbitLine(data: PlanetOrbitData) {
  const points = [];
  const segments = 180;
  for (let i = 0; i <= segments; i++) {
    const days = (i / segments) * data.period;
    points.push(getPlanetPosition(data, days));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: 0.35, depthWrite: false });
  const line = new THREE.Line(geo, mat);
  line.visible = true;
  return line;
}

export function createSolarSystem(scene: THREE.Scene) {
  const loader = new THREE.TextureLoader();
  const loadTex = (path: string) => loader.load(path, (t) => t.anisotropy = 16);

  const TEXTURE_MAP: Record<string, string> = {
    mercuryMap, venusMap: venusSurfaceMap, earthMap: earthDayMap, marsMap,
    jupiterMap, saturnMap, uranusMap, neptuneMap,
    moonMap
  };

  // ☀️ Солнце
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(4, 64, 64), new THREE.MeshBasicMaterial({ map: loadTex(sunMap) }));
  scene.add(sunMesh);

  const sunLight = new THREE.PointLight(0xffffff, 120, 1500, 1.0);
  sunLight.position.set(0, 0, 0);
  sunLight.radius = 20; sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.bias = -0.0005; sunLight.shadow.normalBias = -0.002;
  scene.add(sunLight);

  const ambientLight = new THREE.AmbientLight(0x404060, 0.05);
  scene.add(ambientLight);

  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d'); const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 200, 100, 1)'); grad.addColorStop(0.4, 'rgba(255, 100, 50, 0.4)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), blending: THREE.AdditiveBlending, opacity: 0.7, transparent: true, depthWrite: false }));
  sunSprite.scale.set(12, 12, 1); 
  sunMesh.add(sunSprite);

  const planets: Record<string, any> = { sun: { mesh: sunMesh, light: sunLight, sprite: sunSprite, pivot: sunMesh } };
  const orbits: Record<string, THREE.Line> = {};
  const allMoons: Record<string, any> = {};

  // --- СОЗДАНИЕ ПЛАНЕТ ---
  PLANETS_DATA.forEach(data => {
    const group = new THREE.Group();
    scene.add(group);

    const pivot = new THREE.Group();
    group.add(pivot);
    
    let size = 1.0;
    if (data.name === 'jupiter') size = 3.8;
    if (data.name === 'saturn') size = 3.2;
    if (data.name === 'uranus') size = 2.2;
    if (data.name === 'neptune') size = 2.1;
    if (data.name === 'earth') size = 1.0;
    if (data.name === 'venus') size = 0.95;
    if (data.name === 'mars') size = 0.53;
    if (data.name === 'mercury') size = 0.38;
    if (data.name === 'ceres') size = 0.2; 
    if (data.name === 'pluto') size = 0.25;
    if (data.name === 'eris') size = 0.24;
    if (data.name === 'haumea') size = 0.18;
    if (data.name === 'makemake') size = 0.19;

    const textureKey = TEXTURE_MAP[data.textureMap] || sunMap;
    const mat = new THREE.MeshStandardMaterial({ 
      map: loadTex(textureKey), 
      roughness: 0.7, metalness: 0.1 
    });

    if (data.name === 'earth') {
      mat.map = loadTex(earthDayMap);
      mat.bumpMap = loadTex(earthBumpMap);
      mat.bumpScale = 0.05;
      mat.roughness = 0.6;
    }
    if (data.name === 'venus') {
       mat.map = loadTex(venusSurfaceMap);
       mat.roughness = 0.5;
    }

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 64, 64), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    pivot.add(mesh);

    // --- ИСПРАВЛЕННАЯ АТМОСФЕРА ЗЕМЛИ ---
    if (data.name === 'earth') {
      pivot.add(new THREE.Mesh(new THREE.SphereGeometry(1.02, 64, 64), new THREE.MeshStandardMaterial({ map: loadTex(earthCloudsMap), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })));
      
      const atmosGeo = new THREE.SphereGeometry(1.05, 64, 64); // Уменьшен радиус для плотности
      const atmosMat = new THREE.ShaderMaterial({
        uniforms: { 
          glowColor: { value: new THREE.Color(0x0088ff) }
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-mvPosition.xyz);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            // Fresnel Rim Light: Свечение только по краям
            float rim = 1.0 - max(0.0, dot(vNormal, vViewDir));
            float intensity = pow(rim, 3.0);
            
            // Уменьшена интенсивность, чтобы не было пересвета
            gl_FragColor = vec4(glowColor, intensity * 0.6);
          }
        `,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      });
      pivot.add(new THREE.Mesh(atmosGeo, atmosMat));
    }
    
    if (data.name === 'saturn') {
      pivot.add(createSaturnRings());
    }

    mesh.rotation.z = (data.axialTilt * Math.PI) / 180;
    
    planets[data.name] = { group, mesh, pivot, data, orbitLine: createOrbitLine(data) };
    scene.add(planets[data.name].orbitLine);
    orbits[data.name] = planets[data.name].orbitLine;
  });

  // --- СОЗДАНИЕ СПУТНИКОВ ---
  MOONS_DATA.forEach(moonData => {
    const parentGroup = planets[moonData.parent].group;
    
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(moonData.size, 32, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0xffffff, // <-- ИСПРАВЛЕНО: белый цвет, чтобы не затемнять текстуру
        roughness: 0.9,
        metalness: 0.0,
        map: moonData.texture ? loadTex(TEXTURE_MAP[moonData.texture]) : undefined
      })
    );
    moonMesh.castShadow = true;
    moonMesh.receiveShadow = true;
    
    const moonOrbit = createMoonOrbit(moonData.orbitRadius, moonData.color);
    
    parentGroup.add(moonMesh);
    parentGroup.add(moonOrbit);
    
    allMoons[moonData.name] = { mesh: moonMesh,  moonData, orbitLine: moonOrbit };
  });

  return { ...planets, moons: allMoons, ambientLight, orbits };
}