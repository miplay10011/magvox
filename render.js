import * as THREE from 'three';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);

export function initRender() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 400, 1400);
  camera.rotation.order = 'YXZ';
  
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(1, 2, 0.5);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}