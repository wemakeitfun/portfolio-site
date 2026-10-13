// Mounts the scroll-pinned Mojo tin carousel into the DOM the React component renders.
// Like the deck rack, page scroll is the single source of truth for which tin is in
// the centre: the section pins while you scroll through it, drag/swipe and arrow keys
// just scroll the page, and the page carries on after the last flavour.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CONFIG } from './config.js';
import { TinFactory } from './tin/Tin.js';
import { Carousel } from './Carousel.js';
import { StudioSet } from './StudioSet.js';
import { SoftFocus } from './SoftFocus.js';

// Camera finish: fine moving grain and a soft vignette on the final image.
const finishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0 }, uVignette: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.0, 1.25)));
      c.rgb += (hash(vUv * 1024.0 + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = c;
    }
  `,
};

/**
 * @param {{ pin: HTMLElement, sticky: HTMLElement, stage: HTMLElement }} els
 * @param {{ onReady?: () => void }} [options]
 * @returns {{ destroy: () => void }}
 */
export function mountCarousel(els, options = {}) {
  const { pin, sticky, stage } = els;
  const flavours = CONFIG.flavours;
  const N = flavours.length;
  const C = CONFIG.carousel;
  const S = CONFIG.studio;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };
  let destroyed = false;

  // ── renderer, scene, camera ──
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const narrow = () => Math.min(innerWidth, innerHeight) < 700;
  const pixelRatio = () =>
    Math.min(devicePixelRatio, narrow() ? CONFIG.render.mobilePixelRatio : CONFIG.render.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // made for accurate product colour
  renderer.toneMappingExposure = CONFIG.render.exposure;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(C.camera.fov, 1, 20, 4000);

  // ── the set and its framing ──
  const tinH = CONFIG.tin.length * C.centreScale;
  const floorY = -tinH / 2 - S.hover * tinH;
  const studio = new StudioSet({ scene, renderer, set: S.set, floorY });

  // ── post: soft focus → bloom → output → grain/vignette ──
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, samples: 4,
  }));
  composer.addPass(new RenderPass(scene, camera));
  let softFocus = null; // added once the tins exist
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.14, 0.6, 0.97);
  const finish = new ShaderPass(finishShader);
  finish.uniforms.uGrain.value = S.finish.grain;
  finish.uniforms.uVignette.value = S.finish.vignette;

  let carousel = null;

  // Frame the shot so the centre tin sits between the framing points at `tinFill`
  // of the gap, keeping both neighbours on screen; a view offset puts it in place.
  function frame() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(W, H);
    const toScreen = studio.resize(W, H);
    const F = H / W > 1.2 ? S.portrait : S;
    const [px, pedY] = toScreen(F.pedestal[0], F.pedestal[1]);
    const [, lampY] = toScreen(F.lamp[0], F.lamp[1]);
    camera.aspect = W / H;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(C.camera.fov / 2));
    let tinPx = S.tinFill * (pedY - lampY);
    tinPx = Math.min(tinPx, (W / 2) / ((C.spacing * 1.55) / tinH));
    const distance = (tinH * H) / (2 * tanHalf * tinPx);
    const el = THREE.MathUtils.degToRad(C.camera.elevation);
    camera.position.set(0, Math.sin(el) * distance, Math.cos(el) * distance);
    camera.lookAt(0, 0, 0);
    const want = [px, pedY - tinPx * (0.5 + S.hover)];
    camera.setViewOffset(W, H, W / 2 - want[0], H / 2 - want[1], W, H);
    camera.updateProjectionMatrix();
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(W, H);
    softFocus?.setSize(W, H, renderer.getPixelRatio());
  }

  // ── pinned scroll ──
  // The studio is a band `heightVh` tall that pins centred on screen, so it sticks once
  // the section's top reaches `topPx()` rather than the top of the window.
  const stepPx = () => (C.stepVh / 100) * innerHeight;
  const bandPx = () => (C.heightVh / 100) * innerHeight;
  const topPx = () => (innerHeight - bandPx()) / 2;
  const pinStart = () => pin.getBoundingClientRect().top + scrollY - topPx();
  const focusFromScroll = () => {
    if (N < 2) return 0;
    const t = (scrollY - pinStart()) / ((N - 1) * stepPx());
    return THREE.MathUtils.clamp(t, 0, 1) * (N - 1);
  };
  const inRange = () => {
    const y = scrollY - pinStart();
    return y > 2 && y < (N - 1) * stepPx() - 2;
  };
  function goTo(i, smooth = true) {
    i = THREE.MathUtils.clamp(Math.round(i), 0, N - 1);
    scrollTo({ top: pinStart() + i * stepPx(), behavior: smooth && !reducedMotion ? 'smooth' : 'auto' });
  }
  // settle on the nearest tin shortly after scrolling stops, only while inside the
  // carousel so the rest of the page scrolls freely
  let settleTimer = 0;
  let drag = null;
  function onScroll() {
    carousel?.goTo(focusFromScroll());
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (drag || !inRange()) return;
      const f = focusFromScroll();
      if (Math.abs(f - Math.round(f)) > 0.02) goTo(f);
    }, 160);
  }
  cleanups.push(() => clearTimeout(settleTimer));

  function layout() {
    pin.style.height = `${(N - 1) * stepPx() + bandPx()}px`;
    sticky.style.top = `${topPx()}px`;
    sticky.style.height = `${bandPx()}px`;
    frame();
    onScroll();
  }
  listen(window, 'scroll', onScroll, { passive: true });
  listen(window, 'resize', layout);

  // ── pointer: drag sideways scrolls; a click on a side tin brings it to the centre ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e) {
    if (!carousel) return -1;
    const r = stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return carousel.pick(raycaster);
  }
  const spacingPx = () => stage.clientWidth * 0.22;
  listen(stage, 'pointerdown', (e) => {
    drag = { last: e.clientX, t: performance.now(), v: 0, moved: 0, id: e.pointerId, active: false };
  });
  listen(stage, 'pointermove', (e) => {
    if (!drag) {
      if (e.pointerType === 'mouse') stage.style.cursor = pick(e) >= 0 ? 'pointer' : 'grab';
      return;
    }
    const dx = e.clientX - drag.last;
    drag.moved += Math.abs(dx);
    if (drag.moved > 6 && !drag.active) {
      drag.active = true;
      try { stage.setPointerCapture(drag.id); } catch { /* pointer already gone */ }
      stage.style.cursor = 'grabbing';
    }
    if (!drag.active) return;
    const now = performance.now();
    const tins = -dx / spacingPx();
    drag.v = 0.8 * drag.v + 0.2 * (tins / Math.max(1, now - drag.t)); // tins per ms
    drag.t = now;
    drag.last = e.clientX;
    scrollBy(0, tins * stepPx());
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    stage.style.cursor = '';
    if (d.active) goTo(focusFromScroll() + d.v * 180); // a little inertia, then settle
    else if (e.type === 'pointerup') {
      const i = pick(e);
      if (i >= 0 && i !== Math.round(focusFromScroll())) goTo(i);
    }
  };
  listen(stage, 'pointerup', endDrag);
  listen(stage, 'pointercancel', endDrag);

  const isPinned = () => {
    const r = pin.getBoundingClientRect();
    return r.top <= topPx() + 1 && r.bottom >= topPx() + bandPx() - 1;
  };
  listen(window, 'keydown', (e) => {
    if (!isPinned()) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(Math.round(focusFromScroll()) + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(Math.round(focusFromScroll()) - 1); }
  });

  // ── build the tins (label art loads asynchronously), then start ──
  const factory = new TinFactory(CONFIG, renderer);
  Promise.all(flavours.map((f) => factory.create(f))).then((tins) => {
    if (destroyed) return;
    for (const tin of tins) tin.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    carousel = new Carousel({ config: CONFIG, tins, reducedMotion });
    scene.add(carousel.group);
    softFocus = new SoftFocus({ renderer, scene, camera, items: carousel.items, maxRadius: C.softFocus.radius });
    composer.addPass(softFocus.pass);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(finish);
    layout();
    carousel.goTo(focusFromScroll(), { instant: true });
    options.onReady?.();
  });

  layout();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (!carousel) return;
    const r = sticky.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return; // off-screen: skip rendering
    carousel.update(dt);
    if (!reducedMotion) finish.uniforms.uTime.value += dt;
    softFocus.update();
    composer.render(dt);
  });

  return {
    destroy() {
      destroyed = true;
      renderer.setAnimationLoop(null);
      cleanups.forEach((fn) => fn());
      const textures = new Set();
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [].concat(o.material ?? [])) {
          for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
          m.dispose();
        }
      });
      textures.forEach((t) => t.dispose());
      scene.environment?.dispose();
      composer.dispose();
      softFocus?.mask.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
