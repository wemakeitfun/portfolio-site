// EffectsFactory port + a small particle emitter for Timmy's foot dust.
import { Sprite, Label, Node, Animate, Sequence, Call, MoveBy, FadeOut, RepeatForever, animFrames, frame } from './engine.js';

export function smokePoof(parent, x, y) {
  const s = new Sprite('poof1.png');
  s.x = x; s.y = y;
  s.runAction(new Sequence(new Animate(animFrames('poof', 3, 1), 0.07), new Call(() => s.removeFromParent())));
  parent.addChild(s);
  return s;
}

export function pointsLabel(parent, text, x, y) {
  const l = new Label(String(text), 'pointNumbers');
  l.x = x; l.y = y;
  l.runAction(new Sequence(
    new MoveBy(0.45, 0, 20),
    new Call(() => {
      l.runAction(FadeOut(0.45));
      l.runAction(new Sequence(new MoveBy(0.45, 0, 20), new Call(() => l.removeFromParent())));
    }),
  ));
  parent.addChild(l);
  return l;
}

export function animatedTorch() {
  const t = new Sprite('flame-1.png');
  t.runAction(new RepeatForever(new Animate(animFrames('flame-', 6, 1), 0.05)));
  return t;
}

export function animatedSwingset() {
  const s = new Sprite('swingset1.png');
  const names = ['swingset1.png', 'swingset2.png', 'swingset3.png', 'swingset4.png', 'swingset3.png', 'swingset2.png'];
  s.runAction(new RepeatForever(new Animate(names.map(frame), 0.3)));
  return s;
}

// timmyDust.plist: soft white puffs, 20 max particles, life .35±.25, speed 40±25
export class DustEmitter extends Node {
  constructor() {
    super();
    this.particles = [];
    this.active = false;
    this.angle = 90;
    this.emitCounter = 0;
    this.rate = 20 / 0.35;
  }
  resetSystem() { this.active = true; this.emitCounter = 0; }
  stopSystem() { this.active = false; }
  step(dt) {
    if (this.active) {
      this.emitCounter += this.rate * dt;
      while (this.emitCounter >= 1 && this.particles.length < 20) {
        this.emitCounter -= 1;
        const a = (this.angle + (Math.random() * 2 - 1) * 45) * Math.PI / 180;
        const sp = 40 + (Math.random() * 2 - 1) * 25;
        const life = Math.max(0.05, 0.35 + (Math.random() * 2 - 1) * 0.25);
        this.particles.push({
          x: this.x + (Math.random() * 2 - 1) * 7, y: this.y + (Math.random() * 2 - 1) * 2,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, t: life,
          size: Math.max(0, 8 + (Math.random() * 2 - 1) * 8),
        });
      }
    }
    for (const p of this.particles) {
      p.vx += 1 * dt; p.vy += 2 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.t -= dt;
    }
    this.particles = this.particles.filter(p => p.t > 0);
  }
  updateActions(dt) { this.step(dt); super.updateActions(dt); }
  render(ctx) {
    // Particles live in the parent's space (position type "relative")
    if (!this.visible || !this.particles.length) return;
    ctx.save();
    for (const p of this.particles) {
      const k = p.t / p.life;
      const size = p.size * k;
      if (size <= 0.2) continue;
      ctx.globalAlpha = 0.16 * k;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// CCMotionStreak: a fading ribbon textured with an image, following a target point.
// Points are kept in the owner's parent space so the trail stays put while the owner moves.
export class MotionStreak extends Node {
  constructor(img, fade, width, alpha, follow) {
    super();
    Object.assign(this, { img, fade, ribbonWidth: width, alpha, follow, points: [], t: 0 });
  }
  updateActions(dt) {
    super.updateActions(dt);
    this.t += dt;
    const p = this.follow();
    const last = this.points[this.points.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 1) this.points.push({ x: p.x, y: p.y, t: this.t });
    this.points = this.points.filter(q => this.t - q.t < this.fade);
  }
  render(ctx) {
    // Drawn in the parent's coordinate space, offset back from the owner's content origin
    if (this.points.length < 2) return;
    const o = this.origin ? this.origin() : { x: 0, y: 0 };
    ctx.save();
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1], b = this.points[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.01) continue;
      ctx.globalAlpha = this.alpha * Math.max(0, 1 - (this.t - b.t) / this.fade);
      ctx.save();
      ctx.translate(a.x - o.x, a.y - o.y);
      ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
      ctx.drawImage(this.img, 0, -this.ribbonWidth / 2, len + 0.5, this.ribbonWidth);
      ctx.restore();
    }
    ctx.restore();
  }
}
