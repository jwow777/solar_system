import "core-js/stable";
import "regenerator-runtime/runtime";
import './index.css';
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ProtoPlanet from "./js/ProtoPlanet.ts";
import galaxyMap from './img/maps/8k_stars_milky_way.jpg';
import earthMap from './img/maps/2_no_clouds_8k.jpg';
import earthBumpMap from './img/maps/elev_bump_8k.jpg';
import earthSpecularMap from './img/maps/water_8k.png';
import earthAtmosphereMap from './img/maps/clouds_8k.jpg';
import moonMap from './img/maps/8k_moon.jpg';
import moonBumpMap from './img/maps/8k_bump_moon.jpg';

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const degree = Math.PI / 180;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(0, 50, 100); // поднята для лучшего вида

// Свет
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); // солнце
directionalLight.position.set(100, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404040, 0.3); // уменьшен ambient для реализма
scene.add(ambientLight);

// const light = new THREE.Light( 0xffffbb,  1 );
// light.position.set(0, 0, 400);
// scene.add( light );

// Камера
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxDistance = 200;
controls.update();

const texture = new THREE.TextureLoader();

// Фон
const galaxy = new THREE.Mesh(new THREE.SphereGeometry(400, 64, 64), new THREE.MeshBasicMaterial({
  map: texture.load(galaxyMap, () => console.log('Galaxy texture loaded')), 
  side: THREE.DoubleSide
}));

// Земля
const earth = new ProtoPlanet(1, { 
  bumpScale: 0.01,
  bumpMap: texture.load(earthBumpMap, () => console.log('Earth bump loaded')),
  map: texture.load(earthMap, () => console.log('Earth map loaded')),
  shininess: 100,  // увеличено
  specular: 0x111111,  // число вместо Color
  specularMap: texture.load(earthSpecularMap, () => console.log('Earth specular loaded')),
}).generate();
earth.position.set(20, 0, 0); // орбита вокруг солнца
earth.castShadow = true;
earth.receiveShadow = true;

// Атмосфера Земли
const atmosphere = new ProtoPlanet(1.05, { 
  alphaMap: texture.load(earthAtmosphereMap, () => console.log('Atmosphere loaded')),
  transparent: true
}).generate();
atmosphere.position.copy(earth.position); // следует за Землей

// Луна
const moon = new ProtoPlanet(0.27, { 
  bumpScale: 0.03,
  bumpMap: texture.load(moonBumpMap, () => console.log('Moon bump loaded')),
  map: texture.load(moonMap, () => console.log('Moon map loaded')),
}).generate();
moon.position.set(earth.position.x + 3, 0, earth.position.z); // вокруг Земли
moon.castShadow = true;
moon.receiveShadow = true;

// Солнце (визуальная сфера)
const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // желтый
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0, 0, 0); // в центре

// Физика движения по орбите 
let thetaEarth = 0; // угол для Земли
let thetaMoon = 0; // угол для Луны
const earthRadius = 20; // радиус орбиты Земли
const moonRadius = 3; // радиус орбиты Луны вокруг Земли

scene.add(directionalLight, galaxy, earth, atmosphere, moon, sun);

const animate = () => {
  requestAnimationFrame(animate);

  // Движение Земли вокруг Солнца
  thetaEarth += 0.005;
  earth.position.set(earthRadius * Math.cos(thetaEarth), 0, earthRadius * Math.sin(thetaEarth));
  atmosphere.position.copy(earth.position); // атмосфера следует

  // Движение Луны вокруг Земли
  thetaMoon += 0.02;
  moon.position.set(
    earth.position.x + moonRadius * Math.cos(thetaMoon),
    0,
    earth.position.z + moonRadius * Math.sin(thetaMoon)
  );

  // Вращение объектов
  earth.rotation.y += 0.01;
  atmosphere.rotation.y += 0.015;
  moon.rotation.y += 0.005;

  controls.update();
  renderer.render(scene, camera);
};

animate();