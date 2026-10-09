// Cocos2d (gravity mode) particle system, driven by the original particle .plist configs.
import { Node, loadImage, loadJSON } from './engine.js';

const configs = {};
const textures = {};

export async function loadParticles(name) {
  if (configs[name]) return configs[name];
  const cfg = await loadJSON(`assets/particles/${name}.json`);
  if (cfg.texture) await loadTexture(cfg.texture);
  return (configs[name] = cfg);
}
export async function loadTexture(file) {
  if (!textures[file]) textures[file] = await loadImage(`assets/particles/${file}`);
  return textures[file];
}

const rnd = () => Math.random() * 2 - 1;

// Tinted copies of a texture, cached per quantized colour (canvas can't multiply-tint per draw)
const tintCache = new Map();
function tinted(img, r, g, b) {
  const q = v => Math.max(0, Math.min(15, Math.round(v * 15)));
  const key = `${img.src}|${q(r)},${q(g)},${q(b)}`;
  let c = tintCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = `rgb(${q(r) * 17},${q(g) * 17},${q(b) * 17})`;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, 0, 0);
  tintCache.set(key, c);
  return c;
}

export class ParticleSystem extends Node {
  // cfg uses Cocos2d plist keys; overrides may set any of them
  constructor(cfg, overrides = {}) {
    super();
    const c = Object.assign({}, cfg, overrides);
    this.c = c;
    this.texture = c.texture ? textures[c.texture] : null;
    this.total = Math.max(1, Math.round(c.maxParticles || 100));
    this.duration = c.duration === undefined ? -1 : c.duration;
    const life = c.particleLifespan || 0;
    this.emissionRate = c.emissionRate || (life > 0 ? this.total / life : Infinity);
    this.additive = c.blendFuncDestination === 1 || c.blendFuncSource === 1;
    this.particles = [];
    this.active = true;
    this.elapsed = 0;
    this.emitCounter = 0;
    this.autoRemoveOnFinish = !!c.autoRemove;
  }

  resetSystem() { this.active = true; this.elapsed = 0; this.emitCounter = 0; this.particles = []; }
  stopSystem() { this.active = false; this.elapsed = this.duration; }

  emit() {
    const c = this.c;
    const life = Math.max(0, (c.particleLifespan || 0) + (c.particleLifespanVariance || 0) * rnd());
    if (life <= 0) return;
    const col = k => Math.max(0, Math.min(1, (c[k] || 0) + (c[k + 'Variance'] || 0) * rnd()));
    const sc = ['startColorRed', 'startColorGreen', 'startColorBlue', 'startColorAlpha'].map(col);
    const ec = ['finishColorRed', 'finishColorGreen', 'finishColorBlue', 'finishColorAlpha'].map(col);
    const size = Math.max(0, (c.startParticleSize || 0) + (c.startParticleSizeVariance || 0) * rnd());
    let endSize = c.finishParticleSize;
    endSize = endSize === -1 || endSize === undefined ? size : Math.max(0, endSize + (c.finishParticleSizeVariance || 0) * rnd());
    const a = ((c.angle || 0) + (c.angleVariance || 0) * rnd()) * Math.PI / 180;
    const sp = (c.speed || 0) + (c.speedVariance || 0) * rnd();
    // Radius mode (emitterType 1): particles spiral from maxRadius towards minRadius
    const radius = (c.maxRadius || 0) + (c.maxRadiusVariance || 0) * rnd();
    const endRadius = c.minRadius === -1 || c.minRadius === undefined ? radius : c.minRadius;
    this.particles.push({
      angle: a, radius, dRadius: (endRadius - radius) / life,
      dps: ((c.rotatePerSecond || 0) + (c.rotatePerSecondVariance || 0) * rnd()) * Math.PI / 180,
      x: this.x + (c.sourcePositionVariancex || 0) * rnd(),
      y: this.y + (c.sourcePositionVariancey || 0) * rnd(),
      sx: this.x, sy: this.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      color: sc, dColor: sc.map((v, i) => (ec[i] - v) / life),
      size, dSize: (endSize - size) / life,
      radial: (c.radialAcceleration || 0) + (c.radialAccelVariance || 0) * rnd(),
      tangential: (c.tangentialAcceleration || 0) + (c.tangentialAccelVariance || 0) * rnd(),
      ttl: life,
    });
  }

  step(dt) {
    if (this.active && this.emissionRate) {
      const rate = 1 / this.emissionRate;
      this.emitCounter += dt;
      while (this.particles.length < this.total && this.emitCounter > rate) {
        this.emit();
        this.emitCounter -= rate;
        if (!isFinite(this.emissionRate)) this.emitCounter = Math.max(this.emitCounter, rate + 1e-6);
      }
      if (!isFinite(this.emissionRate)) this.emitCounter = 0;
      this.elapsed += dt;
      if (this.duration !== -1 && this.elapsed > this.duration) this.active = false;
    }
    const gx = this.c.gravityx || 0, gy = this.c.gravityy || 0;
    for (const p of this.particles) {
      p.ttl -= dt;
      if (p.ttl <= 0) continue;
      if (this.c.emitterType === 1) {
        p.angle += p.dps * dt;
        p.radius += p.dRadius * dt;
        p.x = p.sx - Math.cos(p.angle) * p.radius;
        p.y = p.sy - Math.sin(p.angle) * p.radius;
        for (let i = 0; i < 4; i++) p.color[i] += p.dColor[i] * dt;
        p.size = Math.max(0, p.size + p.dSize * dt);
        continue;
      }
      let rx = p.x - p.sx, ry = p.y - p.sy;
      const len = Math.hypot(rx, ry) || 1;
      rx /= len; ry /= len;
      p.vx += (rx * p.radial - ry * p.tangential + gx) * dt;
      p.vy += (ry * p.radial + rx * p.tangential + gy) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      for (let i = 0; i < 4; i++) p.color[i] += p.dColor[i] * dt;
      p.size = Math.max(0, p.size + p.dSize * dt);
    }
    this.particles = this.particles.filter(p => p.ttl > 0);
    if (!this.active && !this.particles.length && this.autoRemoveOnFinish) this.removeFromParent();
  }

  updateActions(dt) { this.step(dt); super.updateActions(dt); }

  // Particles live in the parent's coordinate space (position types "free"/"relative")
  render(ctx) {
    if (!this.visible || !this.particles.length) return;
    ctx.save();
    if (this.additive) ctx.globalCompositeOperation = 'lighter';
    const tex = this.texture;
    for (const p of this.particles) {
      if (p.size <= 0.1) continue;
      const [r, g, b, a] = p.color;
      const alpha = this.c.blendFuncSource === 1 ? 1 : Math.max(0, Math.min(1, a));
      if (alpha <= 0.003) continue;
      ctx.globalAlpha = alpha * (this.opacity / 255);
      const s = p.size;
      if (tex) {
        ctx.drawImage(tinted(tex, r, g, b), p.x - s / 2, p.y - s / 2, s, s);
      } else {
        ctx.fillStyle = `rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
}

// CCParticleSun defaults — the base for the game's Fireball class
export const SUN = {
  duration: -1, gravityx: 0, gravityy: 0, angle: 90, angleVariance: 360, speed: 20, speedVariance: 5,
  radialAcceleration: 0, radialAccelVariance: 0, tangentialAcceleration: 0, tangentialAccelVariance: 0,
  sourcePositionVariancex: 0, sourcePositionVariancey: 0, particleLifespan: 1, particleLifespanVariance: 0.5,
  startParticleSize: 30, startParticleSizeVariance: 10, finishParticleSize: -1,
  startColorRed: 0.76, startColorGreen: 0.25, startColorBlue: 0.12, startColorAlpha: 1,
  finishColorRed: 0, finishColorGreen: 0, finishColorBlue: 0, finishColorAlpha: 1,
  blendFuncSource: 770, blendFuncDestination: 1, texture: 'fire.png',
};
