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
camera.position.set(0, 0, 30);

// Свет
const spotLight = new THREE.SpotLight(0xffffff, 2); // увеличена интенсивность
spotLight.position.set(0, 0, 400);
spotLight.castShadow = true;
spotLight.shadow.focus = 0.15;
spotLight.shadowMapVisible = true;

const ambientLight = new THREE.AmbientLight(0x808080, 1); // brighter ambient, полная интенсивность
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
const earth = new ProtoPlanet(6.371, { 
  bumpScale: 0.01,
  bumpMap: texture.load(earthBumpMap, () => console.log('Earth bump loaded')),
  map: texture.load(earthMap, () => console.log('Earth map loaded')),
  shininess: 100,  // увеличено
  specular: 0x111111,  // число вместо Color
  specularMap: texture.load(earthSpecularMap, () => console.log('Earth specular loaded')),
}).generate();
earth.castShadow = true;
earth.receiveShadow = true;

// Атмосфера Земли
const atmosphere = new ProtoPlanet(6.44, { 
  alphaMap: texture.load(earthAtmosphereMap, () => console.log('Atmosphere loaded')),
  transparent: true
}).generate();

// Луна
const moon = new ProtoPlanet(1.7371, { 
  bumpScale: 0.03,
  bumpMap: texture.load(moonBumpMap, () => console.log('Moon bump loaded')),
  map: texture.load(moonMap, () => console.log('Moon map loaded')),
}).generate();
moon.position.set(100, 0, 0);
moon.castShadow = true;
moon.receiveShadow = true;

// Физика движения по орбите 
let theta = 90 * degree; // начальный угол
const radius = moon.position.x;

scene.add(spotLight, galaxy, earth, atmosphere, moon);

const animate = () => {
  requestAnimationFrame(animate);

  // Движение по окружности 
  // x=r*cos(theta), y=r*sin(theta)
  // Движение по эллипсу 
  // x=r*cos(theta), y=1,5*r*sin(theta)+10

  earth.rotation.y += 0.01 * degree;
  atmosphere.rotation.y += 0.015 * degree;
  theta += 0.01 * degree;
  moon.position.set(radius * Math.cos(theta), 0, radius * Math.sin(theta));
  moon.rotation.y -= 0.01 * degree;

  controls.update();
  renderer.render(scene, camera);
};

animate();