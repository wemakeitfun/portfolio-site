import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function createRenderer(config) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = config.lighting.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0); // background comes from the CSS --bg variable
  return renderer;
}

const envCache = new WeakMap();
// A scene with the soft studio rig: key (with soft shadows), rim and subtle ambient.
// The environment map is generated once per renderer and shared by its scenes.
export function createStudioScene(config, renderer) {
  const scene = new THREE.Scene();
  if (!envCache.has(renderer)) envCache.set(renderer, new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture);
  scene.environment = envCache.get(renderer);
  scene.environmentIntensity = config.lighting.envIntensity;

  const L = config.lighting;
  const key = new THREE.DirectionalLight(0xfff6ec, L.keyIntensity);
  key.position.set(-22, 38, 70);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = L.shadowRadius;
  key.shadow.blurSamples = 24;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  const sc = key.shadow.camera;
  sc.left = -60; sc.right = 60; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 200;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xe8f0ff, L.rimIntensity);
  rim.position.set(35, 25, -40);
  scene.add(rim);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c8, L.ambientIntensity));
  return scene;
}
