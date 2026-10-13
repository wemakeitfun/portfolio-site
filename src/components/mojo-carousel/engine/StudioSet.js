import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

// A fully 3D product studio, so the set, the light, the shadows and the reflections all
// come from one place and agree with each other:
//  - a seamless sweep (cyclorama): floor curving up into the back wall, satin finish
//  - a large softbox overhead that pools light on the floor and falls off up the wall
//  - two tall strip lights behind for crisp edge highlights, and a dim front fill
//  - a high spot that only adds the soft shadows under the tins
//  - reflections baked from a studio laid out like those same lights
// Same interface as Studio: resize(W, H) maps framing points to screen pixels.

// Floor → cove → wall profile as (y, z) points, swept across x.
function cycGeometry({ floorY, width, front, back, cove, wallTop, segments = 24 }) {
  const profile = [[floorY, front], [floorY, back + cove]];
  for (let i = 1; i <= segments; i++) {
    const a = (i / segments) * (Math.PI / 2);
    profile.push([floorY + cove - cove * Math.cos(a), back + cove - cove * Math.sin(a)]);
  }
  profile.push([wallTop, back]);
  const xs = [-width / 2, 0, width / 2];
  const positions = [], uvs = [], index = [];
  profile.forEach(([y, z], j) => {
    xs.forEach((x, i) => {
      positions.push(x, y, z);
      uvs.push(i / (xs.length - 1), j / (profile.length - 1));
    });
  });
  for (let j = 0; j < profile.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// Reflections: a room the colour of the set (dimmed), with panels where the real lights are.
function studioEnvironment(renderer, roomColor) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(roomColor);
  const panel = (w, h, level, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(level, level, level), side: THREE.DoubleSide }),
    );
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  panel(9, 9, 2.4, new THREE.Vector3(0, 6, 1));      // overhead softbox
  panel(1.4, 9, 2.0, new THREE.Vector3(-5, 1, -4));  // back-left strip
  panel(1.4, 9, 1.8, new THREE.Vector3(5, 1, -4));   // back-right strip
  panel(10, 5, 0.35, new THREE.Vector3(-2, 1, 8));   // front fill
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.05).texture;
  pmrem.dispose();
  return env;
}

export class StudioSet {
  // set: { color, roughness, room, key, rim, fill, shadowLight, shadow } — `room` is
  // the colour of the surroundings the tins reflect; `shadow` tints the cast shadows
  constructor({ scene, renderer, set, floorY }) {
    this.set = set;
    RectAreaLightUniformsLib.init();
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    scene.background = new THREE.Color(set.color);
    scene.environment = studioEnvironment(renderer, set.room);
    scene.environmentIntensity = 0.55;

    // the sweep
    const cyc = new THREE.Mesh(
      cycGeometry({ floorY, width: 4000, front: 900, back: -520, cove: 260, wallTop: 1400 }),
      new THREE.MeshStandardMaterial({ color: set.color, roughness: set.roughness, metalness: 0 }),
    );
    cyc.receiveShadow = true;
    scene.add(cyc);
    // Area lights can't cast shadows, so on a bright set they wash out the spot's
    // shadows. A catcher just above the floor darkens only where the tins block the
    // spot, whatever else is lighting the floor.
    const catcher = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.ShadowMaterial({ color: set.shadow.color, opacity: set.shadow.opacity }),
    );
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = floorY + 0.1;
    catcher.receiveShadow = true;
    scene.add(catcher);

    // overhead softbox: big and soft, slightly in front so it also reaches the lids
    const key = new THREE.RectAreaLight(0xfffaf5, set.key, 260, 260);
    key.position.set(0, floorY + 380, 70);
    key.lookAt(0, floorY, 10);
    // strip lights behind either side: the edge highlights that separate the tins
    const stripL = new THREE.RectAreaLight(0xf4f1ff, set.rim, 40, 420);
    stripL.position.set(-300, floorY + 160, -230);
    stripL.lookAt(0, 0, 0);
    const stripR = new THREE.RectAreaLight(0xfff6f0, set.rim * 0.85, 40, 420);
    stripR.position.set(300, floorY + 160, -230);
    stripR.lookAt(0, 0, 0);
    // dim front fill so the labels read true
    const fill = new THREE.RectAreaLight(0xffffff, set.fill, 600, 320);
    fill.position.set(-140, 40, 700);
    fill.lookAt(0, 0, 0);
    scene.add(key, stripL, stripR, fill);

    // shadows only: a high, weak spot over the centre
    const height = 700;
    const spot = new THREE.SpotLight(0xffffff, set.shadowLight, 0, Math.atan(300 / height), 1, 0);
    spot.position.set(0, floorY + height, 30);
    spot.target.position.set(0, floorY, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.radius = 16;
    spot.shadow.blurSamples = 24;
    spot.shadow.bias = -0.0004;
    spot.shadow.camera.near = height - 200;
    spot.shadow.camera.far = height + 40;
    scene.add(spot, spot.target);
  }

  // No image to crop: framing points are already screen fractions.
  resize(W, H) {
    return (u, v) => [u * W, v * H];
  }
}
