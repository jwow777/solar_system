import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function setupScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 30, 60);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 400;

  const loader = new THREE.TextureLoader();
  import('./img/maps/8k_stars_milky_way.jpg').then((img) => {
    const galaxyGeo = new THREE.SphereGeometry(1500, 64, 64);
    const galaxyMat = new THREE.MeshBasicMaterial({
      map: loader.load(img.default, (t) => t.anisotropy = renderer.capabilities.getMaxAnisotropy()),
      side: THREE.BackSide,
      color: 0x888888,
      transparent: true,
      opacity: 0.8
    });
    scene.add(new THREE.Mesh(galaxyGeo, galaxyMat));
  });

  return { renderer, scene, camera, controls };
}