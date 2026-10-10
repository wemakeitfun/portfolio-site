// The detail view: one deck, large and centre stage. Drag spins it freely with inertia
// and it eases back to the nearest face (graphic or grip) when released.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer, createStudioScene } from './scene.js';
import { DeckFactory, UPRIGHT } from './Deck.js';
import { Spring } from './spring.js';

const D = {
  fillHeight: 0.74,     // max fraction of the viewport height the deck uses
  maxWidth: 0.62,       // …and never wider than this fraction of the viewport width
  topSpace: 64,         // px kept clear above the deck (counter, close button)
  bottomSpace: 190,     // px kept clear below the deck (name, Graphic/Grip toggle)
  stiffness: 120,       // spin spring
  damping: 15,          // < 2·√stiffness ≈ 22 gives a little overshoot as it lands on a face
  introFrom: 0.72,      // starting scale when the view opens
  dragSpeed: 0.011,     // radians per px dragged
  inertia: 260,         // ms of release velocity carried into the spin
};

/**
 * @param {HTMLElement} el  element to draw into (fills it); receives pointer events
 * @param {{ name: string, graphic: string }[]} products
 * @param {{ onFace?: (face: 'graphic' | 'grip') => void, onBackgroundClick?: () => void }} hooks
 */
export function mountDetail(el, products, hooks = {}) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = createRenderer(CONFIG);
  el.appendChild(renderer.domElement);
  const scene = createStudioScene(CONFIG, renderer);
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 1000);
  const factory = new DeckFactory(CONFIG, renderer);

  // soft shadow on an invisible wall behind the deck
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShadowMaterial({ opacity: 0.12 }));
  wall.position.z = -9;
  wall.receiveShadow = true;
  scene.add(wall);

  const pivot = new THREE.Group();
  scene.add(pivot);
  let deck = null;
  const angle = new Spring(0);
  const scale = new Spring(1);
  let face = 'graphic';

  function show(i, direction = 0) {
    if (deck) { pivot.remove(deck); }
    deck = factory.create(products[i]);
    deck.quaternion.copy(UPRIGHT);
    pivot.add(deck);
    // land on the graphic, swinging in from the side we're moving toward
    const target = Math.round(angle.target / (2 * Math.PI)) * 2 * Math.PI;
    if (reducedMotion) angle.snap(target);
    else if (direction) { angle.value = target - direction * Math.PI * 0.5; angle.velocity = 0; angle.target = target; }
    else { angle.snap(target); scale.value = D.introFrom; scale.target = 1; }
    setFace('graphic', false);
  }

  function setFace(f, animate = true) {
    face = f;
    const turns = Math.round(angle.target / (2 * Math.PI)) * 2 * Math.PI;
    const target = turns + (f === 'grip' ? Math.PI : 0);
    if (!animate || reducedMotion) angle.snap(target); else angle.target = target;
    hooks.onFace?.(f);
  }

  function fit() {
    const w = el.clientWidth, h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const L = CONFIG.deck.length, W = CONFIG.deck.width;
    // largest deck that fits between the top and bottom UI, the height cap and the width cap
    const availH = Math.max(120, h - D.topSpace - D.bottomSpace);
    const pxPerInch = Math.min(availH / L, (D.fillHeight * h) / L, (D.maxWidth * w) / W);
    const dist = h / pxPerInch / (2 * tan);
    // centre the deck in the space between the UI bands
    const offsetPx = D.topSpace + availH / 2 - h / 2;
    const aimY = offsetPx / pxPerInch;
    camera.position.set(0, aimY, dist);
    camera.lookAt(0, aimY, 0);
    camera.updateProjectionMatrix();
  }
  fit();
  addEventListener('resize', fit);

  // ── drag to spin ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const overDeck = (e) => {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(pivot, true).length > 0;
  };
  let drag = null;
  const down = (e) => {
    drag = { x: e.clientX, last: e.clientX, t: performance.now(), v: 0, moved: 0, id: e.pointerId };
  };
  const move = (e) => {
    if (!drag) {
      if (e.pointerType === 'mouse') el.style.cursor = overDeck(e) ? 'grab' : '';
      return;
    }
    const dx = e.clientX - drag.last;
    drag.moved += Math.abs(dx);
    if (drag.moved > 4 && !drag.active) { drag.active = true; el.setPointerCapture(drag.id); el.style.cursor = 'grabbing'; }
    if (!drag.active) return;
    const now = performance.now();
    const da = dx * D.dragSpeed;
    drag.v = 0.75 * drag.v + 0.25 * (da / Math.max(1, now - drag.t)); // radians per ms
    drag.t = now;
    drag.last = e.clientX;
    angle.value += da;
    angle.target = angle.value;
    angle.velocity = 0;
  };
  const up = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    el.style.cursor = '';
    if (d.active) {
      // carry the flick forward, then ease to the nearest face
      const projected = angle.value + d.v * D.inertia;
      const target = Math.round(projected / Math.PI) * Math.PI;
      angle.target = target;
      angle.velocity = reducedMotion ? 0 : d.v * 1000;
      if (reducedMotion) angle.snap(target);
      face = Math.round(target / Math.PI) % 2 === 0 ? 'graphic' : 'grip';
      hooks.onFace?.(face);
    } else if (e.type === 'pointerup' && !overDeck(e)) {
      hooks.onBackgroundClick?.();
    }
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (!drag?.active) angle.step(dt, D.stiffness, D.damping);
    pivot.rotation.y = angle.value;
    pivot.rotation.z = reducedMotion ? 0 : THREE.MathUtils.clamp(-angle.velocity * 0.004, -0.05, 0.05);
    pivot.scale.setScalar(reducedMotion ? 1 : scale.step(dt, 170, 22));
    renderer.render(scene, camera);
  });

  return {
    show,
    setFace,
    destroy() {
      renderer.setAnimationLoop(null);
      removeEventListener('resize', fit);
      factory.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
