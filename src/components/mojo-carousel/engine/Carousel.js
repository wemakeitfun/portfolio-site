import * as THREE from 'three';
import { Spring } from './spring.js';

// Lays the tins out in a floating row. Everything about a tin — where it sits, how
// big it is, how far it is turned and leaning — is a function of its offset `o`
// from the centre slot, so sliding the row (a spring on `position`) is all it takes
// to make each tin twist as it passes through the middle.
export class Carousel {
  constructor({ config, tins, reducedMotion, spotlight = null }) {
    this.cfg = config.carousel;
    this.reducedMotion = reducedMotion;
    this.position = new Spring(0);
    this.group = new THREE.Group();
    this.items = tins.map((tin, i) => {
      const holder = new THREE.Group(); // placed by the layout
      holder.add(tin);
      this.group.add(holder);
      return { holder, tin, lean: this.cfg.leans[i % this.cfg.leans.length], phase: i * 1.7 };
    });
    this.count = tins.length;

    // Position-dependent lighting: each tin gets its own copies of its materials so it
    // can be brightened or dimmed on its own as it moves through the centre beam.
    this.spotlight = spotlight;
    if (spotlight) {
      this.tint = new THREE.Color(spotlight.tint);
      for (const it of this.items) {
        it.lit = [];
        it.tin.traverse((m) => {
          if (!m.isMesh) return;
          m.material = m.material.clone();
          it.lit.push({ mat: m.material, color: m.material.color.clone(), env: m.material.envMapIntensity ?? 1 });
        });
      }
    }
    this.time = 0;
    this.current = 0; // which tin holds the centre slot
    this.spun = 0;    // the last tin that did its arrival spin
  }

  get index() { return Math.round(THREE.MathUtils.clamp(this.position.target, 0, this.count - 1)); }

  // `i` may run slightly past either end while scrubbing; the row stretches a little
  // there and springs back once the input lets go.
  goTo(i, { instant = false } = {}) {
    const t = THREE.MathUtils.clamp(i, -0.35, this.count - 0.65);
    if (instant) {
      this.position.snap(t);
      this.current = this.spun = this.index;
    } else this.position.target = t;
  }

  update(dt) {
    const c = this.cfg;
    const s = this.reducedMotion ? c.calmSpring : c.spring;
    const pos = this.position.step(dt, s.stiffness, s.damping);
    this.time += dt;

    // A tin does one full turn when the row comes to rest on it — not while tins are
    // just passing through — spinning the way the row travelled. Only one spins at a
    // time: if another is still turning, it hurries to finish rather than overlap.
    const centre = Math.round(THREE.MathUtils.clamp(pos, 0, this.count - 1));
    if (centre !== this.current) {
      this.travel = Math.sign(centre - this.current);
      this.current = centre;
    }
    const resting = Math.abs(pos - centre) < 0.08 && Math.abs(this.position.velocity) < 0.6;
    if (resting && centre !== this.spun) {
      if (!this.reducedMotion && c.spin) {
        for (const it of this.items) if (it.spin) it.spin.hurry = true;
        this.items[centre].spin = { t: 0, dir: this.travel || 1 };
      }
      this.spun = centre;
    }

    for (let i = 0; i < this.count; i++) {
      const { holder, lean, phase } = this.items[i];
      const o = i - pos;
      const a = Math.abs(o);
      const near = Math.exp(-o * o * 2.2); // 1 in the centre slot, falls off by ±1

      // the row is an arc of a big horizontal ring whose front point is the centre
      // slot: tins swing forward as they come in and fall away as they leave
      const theta = (o * c.spacing) / c.ringRadius;
      const bob = this.reducedMotion ? 0 : Math.sin(this.time * 1.3 + phase) * c.bob;
      holder.position.set(
        c.ringRadius * Math.sin(theta),
        bob,
        c.ringRadius * (Math.cos(theta) - 1) + c.centreForward * near,
      );
      holder.scale.setScalar(1 + (c.centreScale - 1) * near);
      let spin = 0;
      const sp = this.items[i].spin;
      if (sp) {
        sp.t += sp.hurry ? dt * 4 : dt;
        const p = Math.min(1, sp.t / c.spin.duration);
        spin = -sp.dir * Math.PI * 2 * (1 - (1 - p) ** 3); // ease out: fast start, soft landing
        if (p >= 1) this.items[i].spin = null;
      }
      // YXZ: turn about the vertical first, then lean back, then roll
      holder.rotation.set(
        c.pitch,
        theta * c.faceOut - c.twist * o + spin, // follow the ring, plus a little extra twist
        THREE.MathUtils.lerp(lean, c.centreLean, near),
        'YXZ',
      );
      // items far off to the sides fade from view rather than popping
      holder.visible = a < 4.5;

      if (this.spotlight) this.light(this.items[i], o);
      // soft focus: sharp in the centre slot, softening with distance from it
      if (c.softFocus) this.items[i].blur = THREE.MathUtils.smoothstep(a, c.softFocus.start, c.softFocus.full);
    }
  }

  // Under the beam a tin shows its true colours; away from it, it dims and picks up
  // the room's tint.
  light(item, o) {
    const sp = this.spotlight;
    const inBeam = Math.exp(-(o * o) / (sp.width * sp.width)); // 1 in the centre
    const level = THREE.MathUtils.lerp(sp.side, 1, inBeam);
    const tint = (1 - inBeam) * sp.tintAmount;
    for (const l of item.lit) {
      l.mat.color.copy(l.color).lerp(this.tint, tint).multiplyScalar(level);
      l.mat.envMapIntensity = l.env * level;
    }
  }

  // The tin under a screen point, for click-to-select.
  pick(raycaster) {
    const hits = raycaster.intersectObjects(this.items.map((it) => it.holder), true);
    if (!hits.length) return -1;
    return this.items.findIndex((it) => it.tin === hits[0].object.parent); // meshes sit directly in the tin group
  }
}
