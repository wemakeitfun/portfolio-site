import * as THREE from 'three';
import { Spring } from './spring.js';
import { UPRIGHT } from './Deck.js';

const ease = (t) => t * t * (3 - 2 * t);

// One long curved rack. `focus` is a continuous deck index (0 … n-1); the deck at the
// focus swings face-on in the spotlight and the rest hang edge-on along a curved rail.
export class Carousel {
  constructor({ config, scene, camera, factory, products, el, reducedMotion }) {
    Object.assign(this, { config, scene, camera, products, el, reducedMotion });
    const C = config.carousel;
    this.R = C.arcRadius;
    this.focus = new Spring(0);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.slots = products.map((p, i) => {
      const pivot = new THREE.Group();
      const deck = factory.create(p);
      deck.quaternion.copy(UPRIGHT);
      pivot.add(deck);
      deck.userData.mesh.userData.index = i;
      scene.add(pivot);
      return { pivot, mesh: deck.userData.mesh };
    });
    this.meshes = this.slots.map((s) => s.mesh);
    this.buildFixtures();
    this.update(0);
  }

  // A point on the rail circle (centre of the circle sits behind the wall).
  onArc(s, radius, out) {
    const phi = s / this.R;
    return out.set(radius * Math.sin(phi), 0, -this.R + radius * Math.cos(phi));
  }

  buildFixtures() {
    const { config } = this;
    const C = config.carousel, R = this.R, wallDist = config.rack.wallDistance;
    const n = this.products.length;

    // curved wall (shadows only) following the rail
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(R - wallDist, R - wallDist, 200, 128, 1, true, -1.3, 2.6),
      new THREE.ShadowMaterial({ opacity: config.lighting.shadowOpacity }),
    );
    wall.position.z = -R;
    wall.receiveShadow = true;
    this.scene.add(wall);

    // extra light on the centre deck
    const spot = new THREE.SpotLight(0xffffff, 900, 120, 0.28, 0.9, 1.6);
    spot.position.set(0, 30, 40);
    spot.target.position.set(0, 0, 0);
    this.scene.add(spot, spot.target);

    // rail spans first → last deck; it rotates around the circle centre as the rack slides
    const metal = new THREE.MeshStandardMaterial({ color: config.colors.rail, roughness: 0.35, metalness: 0.6 });
    const railR = R - wallDist + 0.9;
    const pts = [];
    const s0 = -C.spacing * 0.8, s1 = (n - 1 + 0.8) * C.spacing;
    for (let k = 0; k <= 96; k++) {
      const v = this.onArc(s0 + ((s1 - s0) * k) / 96, railR, new THREE.Vector3());
      v.z += R; // local to the circle centre
      v.y = 9.5;
      pts.push(v);
    }
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.32, 16), metal);
    rail.castShadow = true;
    this.rail = new THREE.Group();
    this.rail.position.z = -R;
    this.rail.add(rail);
    this.scene.add(this.rail);
  }

  fit() {
    const C = this.config.carousel, cam = this.camera;
    cam.fov = this.config.rack.fov;
    cam.aspect = this.el.clientWidth / Math.max(1, this.el.clientHeight);
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const deckH = this.config.deck.length * C.focusScale;
    const minW = this.config.deck.width * C.focusScale + 2 * (C.focusGap + C.spacing) + 4; // centre + a neighbour each side
    const dist = Math.max(deckH / C.fillHeight / (2 * tan), minW / (2 * tan * cam.aspect)) + C.focusForward;
    const visibleH = 2 * tan * dist;
    const aimY = (C.centerY - 0.5) * visibleH;
    cam.position.set(0, aimY + 1.5, dist);
    cam.lookAt(0, aimY, 0);
    cam.updateProjectionMatrix();
  }

  bottomOnScreen() {
    const v = new THREE.Vector3(0, -(this.config.deck.length / 2) * this.config.carousel.focusScale, this.config.carousel.focusForward).project(this.camera);
    return ((1 - v.y) / 2) * this.el.clientHeight;
  }

  pick(clientX, clientY) {
    const rect = this.el.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
    return hit ? hit.object.userData.index : -1;
  }

  // px on screen between two neighbouring decks near the centre (for drag → scroll mapping)
  spacingPx() {
    const a = new THREE.Vector3(0, 0, 0).project(this.camera);
    const b = new THREE.Vector3(this.config.carousel.spacing, 0, 0).project(this.camera);
    return Math.abs(b.x - a.x) * 0.5 * this.el.clientWidth;
  }

  setTarget(f) { this.focus.target = f; }

  update(dt) {
    const C = this.config.carousel, S = this.config.spring;
    const k = C.followStiffness;
    const f = this.reducedMotion ? (this.focus.snap(this.focus.target), this.focus.value)
      : this.focus.step(dt, k, C.followDamping);
    const vel = this.focus.velocity;
    const faceHalf = (this.config.deck.width / 2) * C.focusScale;
    const push = Math.max(0, faceHalf + C.focusGap + 1.3 - C.spacing);
    const p = new THREE.Vector3();
    this.slots.forEach((slot, i) => {
      const d = i - f;
      const ad = Math.min(Math.abs(d), 1);
      const w = 1 - ease(ad); // 1 at the focus, 0 one deck away
      const sgn = Math.sign(d) || 1;
      const s = d * C.spacing + sgn * push * ease(ad);
      this.onArc(s, this.R, p);
      const phi = s / this.R;
      p.x += Math.sin(phi) * C.focusForward * w;
      p.z += Math.cos(phi) * C.focusForward * w;
      slot.pivot.position.copy(p);
      // angle relative to the camera ray, so every side deck shows the same slim slice of
      // graphic (C.sideReveal) no matter how far out it hangs
      const toCam = Math.atan2(this.camera.position.x - p.x, this.camera.position.z - p.z);
      slot.pivot.rotation.y = toCam - sgn * (this.config.rack.edgeAngle - C.sideReveal) * ease(ad);
      slot.pivot.rotation.z = this.reducedMotion ? 0 : THREE.MathUtils.clamp(-vel * S.swing * 0.5, -0.06, 0.06);
      slot.pivot.scale.setScalar(1 + (C.focusScale - 1) * w);
      slot.pivot.visible = Math.abs(d) < 12;
    });
    this.rail.rotation.y = (-f * C.spacing) / this.R;
    return f;
  }
}
