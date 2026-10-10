// Mounts the long, scroll-pinned deck rack into the DOM the React component renders.
// Page scroll is the single source of truth for which deck is in the spotlight;
// drag/swipe and arrow keys just scroll the page. Returns a destroy() for unmount.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer, createStudioScene } from './scene.js';
import { DeckFactory } from './Deck.js';
import { Carousel } from './carousel.js';

/**
 * @param {{ pin: HTMLElement, sticky: HTMLElement, stage: HTMLElement, caption: HTMLElement,
 *           section: HTMLElement, name: HTMLElement, count: HTMLElement, progress: HTMLElement }} els
 * @param {{ name: string, graphic: string, section: string | null }[]} products
 * @param {{ onSelect?: (index: number) => void }} [options]
 */
export function mountRack(els, products, options = {}) {
  const N = products.length;
  const C = CONFIG.carousel;
  const { pin, sticky, stage } = els;
  const cleanups = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  sticky.style.setProperty('--spot', String(C.spotlight));
  sticky.style.setProperty('--spot-y', `${C.centerY * 100}%`);

  const renderer = createRenderer(CONFIG);
  stage.appendChild(renderer.domElement);
  const scene = createStudioScene(CONFIG, renderer);
  const camera = new THREE.PerspectiveCamera(CONFIG.rack.fov, 1, 1, 1000);
  const factory = new DeckFactory(CONFIG, renderer);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const carousel = new Carousel({ config: CONFIG, scene, camera, factory, products, el: stage, reducedMotion });

  // ── pinned scroll length ──
  const stepPx = () => (C.stepVh / 100) * innerHeight;

  const pinTop = () => pin.getBoundingClientRect().top + scrollY;
  const focusFromScroll = () => {
    if (N < 2) return 0;
    const t = (scrollY - pinTop()) / ((N - 1) * stepPx());
    return THREE.MathUtils.clamp(t, 0, 1) * (N - 1);
  };
  // Settle on the nearest deck shortly after scrolling stops — only while inside the
  // rack, so the rest of the page scrolls freely (CSS scroll-snap would yank the page
  // to the rack from far away).
  let settleTimer = 0;
  const inRack = () => {
    const y = scrollY - pinTop();
    return y > 2 && y < (N - 1) * stepPx() - 2;
  };
  const onScroll = () => {
    carousel.setTarget(focusFromScroll());
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (drag || !inRack()) return;
      const f = focusFromScroll();
      if (Math.abs(f - Math.round(f)) > 0.02) goTo(f);
    }, 160);
  };
  cleanups.push(() => clearTimeout(settleTimer));

  function layout() {
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    pin.style.height = `${(N - 1) * stepPx() + innerHeight}px`;
    carousel.fit();
    els.caption.style.top = `${carousel.bottomOnScreen() + CONFIG.rack.captionGap}px`;
    onScroll();
  }
  listen(window, 'scroll', onScroll, { passive: true });
  listen(window, 'resize', layout);

  function goTo(i, smooth = true) {
    i = THREE.MathUtils.clamp(Math.round(i), 0, N - 1);
    scrollTo({ top: pinTop() + i * stepPx(), behavior: smooth && !reducedMotion ? 'smooth' : 'auto' });
  }

  // ── drag / swipe sideways → scroll ──
  let drag = null;
  listen(stage, 'pointerdown', (e) => {
    drag = { last: e.clientX, t: performance.now(), v: 0, moved: 0, id: e.pointerId, active: false };
  });
  listen(stage, 'pointermove', (e) => {
    if (!drag) {
      if (e.pointerType === 'mouse') stage.style.cursor = carousel.pick(e.clientX, e.clientY) >= 0 ? 'pointer' : 'grab';
      return;
    }
    const dx = e.clientX - drag.last;
    drag.moved += Math.abs(dx);
    if (drag.moved > 6 && !drag.active) {
      drag.active = true;
      stage.setPointerCapture(drag.id);
      stage.style.cursor = 'grabbing';
    }
    if (!drag.active) return;
    const now = performance.now();
    const decks = -dx / carousel.spacingPx();
    drag.v = 0.8 * drag.v + 0.2 * (decks / Math.max(1, now - drag.t)); // decks per ms
    drag.t = now;
    drag.last = e.clientX;
    scrollBy(0, decks * stepPx());
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.active) {
      goTo(focusFromScroll() + d.v * 180); // a little inertia, then settle on a deck
    } else if (e.type === 'pointerup') {
      const i = carousel.pick(e.clientX, e.clientY);
      if (i < 0) return;
      if (i === Math.round(focusFromScroll())) options.onSelect?.(i);
      else goTo(i);
    }
  };
  listen(stage, 'pointerup', endDrag);
  listen(stage, 'pointercancel', endDrag);

  const isPinned = () => {
    const r = pin.getBoundingClientRect();
    return r.top <= 1 && r.bottom >= innerHeight - 1;
  };
  let keysPaused = false;
  listen(window, 'keydown', (e) => {
    if (!isPinned() || keysPaused) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(Math.round(focusFromScroll()) + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(Math.round(focusFromScroll()) - 1); }
  });

  // ── caption ──
  let shown = -1, shownSection;
  const swap = (el) => { el.classList.remove('deck-swap'); void el.offsetWidth; el.classList.add('deck-swap'); };
  function updateCaption(f) {
    const i = THREE.MathUtils.clamp(Math.round(f), 0, N - 1);
    els.progress.style.transform = `scaleX(${N > 1 ? f / (N - 1) : 1})`;
    if (i === shown) return;
    shown = i;
    const p = products[i];
    els.name.textContent = p.name;
    swap(els.name);
    els.count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
    if (p.section !== shownSection) {
      shownSection = p.section;
      els.section.textContent = p.section ?? '';
      swap(els.section);
    }
  }

  let destroyed = false;
  layout();
  document.fonts?.ready.then(() => !destroyed && layout());

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    const r = sticky.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return; // off-screen: skip rendering
    updateCaption(carousel.update(dt));
    renderer.render(scene, camera);
  });

  return {
    goTo,
    /** Pause rack keyboard handling (e.g. while the detail view is open). */
    pauseKeys(paused) { keysPaused = paused; },
    destroy() {
      destroyed = true;
      renderer.setAnimationLoop(null);
      cleanups.forEach((fn) => fn());
      factory.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
