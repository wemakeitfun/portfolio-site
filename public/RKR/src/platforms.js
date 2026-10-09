// Moving platforms, spike boxes, treadmills and moving walls (BaseMovingPlatform family),
// plus fireball launchers and fireballs.
import {
  Node, Sprite, assets, frameFromImage, loadImage, loadJSON, MoveTo, Sequence, RepeatForever, Call, FadeIn, FadeOut, Delay, rectInset,
} from './engine.js';
import { ParticleSystem, SUN } from './particles.js';
import { bool } from './tilemap.js';
import { game } from './model.js';
import * as audio from './audio.js';

const DEFAULT_MOVING_PLATFORM_SPEED = 80;
const PLATFORM_FADE_TIME = 0.25;

// Loose images: chapter-folder images get a "chN_" prefix; others live in assets/sprites.
// Prefer the HD file when there is one (drawn at half scale).
export function platformImageURLs(name, chapter) {
  if (!name.endsWith('.png')) name += '.png';
  const hd = n => n.replace('.png', '-hd.png');
  const ch = `levels/ch${chapter}_${name}`, sp = `sprites/${name}`;
  return [hd(ch), ch, hd(sp), sp].map(u => `assets/${u}`);
}

let manifest = null;
export async function loadPlatformImage(name, chapter) {
  if (!manifest) manifest = new Set(await loadJSON('assets/files.json'));
  const url = platformImageURLs(name, chapter).find(u => manifest.has(u.slice('assets/'.length)));
  if (url) await loadImage(url);
  else console.warn('Missing image', name);
}

function platformFrame(name, chapter) {
  for (const url of platformImageURLs(name, chapter)) {
    const img = assets.images[url];
    if (img) return frameFromImage(img, url.includes('-hd.png') ? 0.5 : 1);
  }
  return frameFromImage(makeMissingImage(), 1);
}
export { platformFrame as imageFrame };
let missing = null;
function makeMissingImage() {
  if (!missing) { missing = document.createElement('canvas'); missing.width = missing.height = 26; }
  return missing;
}

export class BaseMovingPlatform {
  constructor() {
    this.riders = [];
    this.isAcceptingRiders = true;
    this.causesDamage = false;
    this.isSolid = false;
    this.isFlaming = false;
    this.damageInset = 0;
  }

  addSprite(imageName, parentNode, inset = 0) {
    if (!imageName.endsWith('.png')) imageName += '.png';
    const lower = imageName.toLowerCase();
    if (lower.includes('smallspike')) { inset = 5; this.causesDamage = true; }
    else if (lower.includes('bigspike')) { inset = 9; this.causesDamage = true; }
    this.sprite = new Sprite(platformFrame(imageName, game.currentChapter));
    parentNode.addChild(this.sprite);
    if (this.causesDamage) this.damageInset = inset;
    this.halfPlatform = { x: this.sprite.width * 0.5, y: this.sprite.height * 0.5 };
  }

  boundingBox() { return this.sprite.boundingBox(); }
  damageBox() { return rectInset(this.sprite.boundingBox(), this.damageInset, this.damageInset); }

  addRider(r) { this.riders.push(r); }
  removeRider(r) { const i = this.riders.indexOf(r); if (i >= 0) this.riders.splice(i, 1); }
  // Riders are children of the platform sprite (origin at its bottom-left corner)
  worldPositionOfRider(r) {
    return { x: r.sprite.x - this.halfPlatform.x + this.sprite.x, y: r.sprite.y - this.halfPlatform.y + this.sprite.y };
  }
  dropAllRiders() { for (const r of [...this.riders]) r.dropOffPlatform(); }
}

export class LinearMovingPlatform extends BaseMovingPlatform {
  // Tiled objects are y-down; convert to the world's y-up coordinates
  constructor(obj, parentNode, worldHeight) {
    super();
    const d = obj.props;
    this.causesDamage = bool(d.damage);
    this.isFlaming = bool(d.fire);
    const dirs = { '-': [[0, 0.5], [1, 0.5]], '|': [[0.5, 0], [0.5, 1]], '/': [[0, 0], [1, 1]], '\\': [[0, 1], [1, 0]] };
    const [s, e] = dirs[d.direction] || [[0, 0], [0, 0]];
    const x = obj.x, w = obj.width, h = obj.height;
    const y = worldHeight - obj.y - h;
    this.start = { x: x + w * s[0], y: y + h * s[1] };
    this.end = { x: x + w * e[0], y: y + h * e[1] };
    if (bool(d.flipDirection)) [this.start, this.end] = [this.end, this.start];
    let speed = parseFloat(d.speed);
    if (!(speed > 0)) speed = DEFAULT_MOVING_PLATFORM_SPEED;
    this.timeToTraverse = Math.hypot(this.end.x - this.start.x, this.end.y - this.start.y) / speed;
    this.addSprite(d.image || 'smallBlackPlatform.png', parentNode, parseFloat(d.inset) || 0);
    this.sprite.x = this.start.x; this.sprite.y = this.start.y;
    if (d.footSound !== undefined) this.footSound = parseInt(d.footSound, 10);
  }
  addMotion() {}
}

export class BackAndForthMovingPlatform extends LinearMovingPlatform {
  addMotion() {
    this.sprite.runAction(new RepeatForever(new Sequence(
      new MoveTo(this.timeToTraverse, this.end.x, this.end.y),
      new MoveTo(this.timeToTraverse, this.start.x, this.start.y))));
  }
}

export class OneWayMovingPlatform extends LinearMovingPlatform {
  addMotion() { this.beginFullMoveCycle(); }

  beginPartialMoveCycle(advancement) {
    this.isAcceptingRiders = false;
    const sp = this.sprite;
    sp.stopAllActions();
    sp.opacity = 1;
    sp.x = this.start.x + (this.end.x - this.start.x) * advancement;
    sp.y = this.start.y + (this.end.y - this.start.y) * advancement;
    const t = this.timeToTraverse * (1 - advancement);
    sp.runAction(new Sequence(new MoveTo(t, this.end.x, this.end.y), new Call(() => this.beginFullMoveCycle())));
    sp.runAction(new Sequence(
      FadeIn(PLATFORM_FADE_TIME), new Call(() => { this.isAcceptingRiders = true; }),
      new Delay(Math.max(0, t - 2 * PLATFORM_FADE_TIME)),
      new Call(() => { this.isAcceptingRiders = false; this.dropAllRiders(); }),
      FadeOut(PLATFORM_FADE_TIME)));
  }

  beginFullMoveCycle() {
    this.dropAllRiders();
    this.isAcceptingRiders = true;
    const sp = this.sprite;
    sp.stopAllActions();
    sp.x = this.start.x; sp.y = this.start.y;
    sp.opacity = 0;
    const t = this.timeToTraverse;
    sp.runAction(new Sequence(new MoveTo(t, this.end.x, this.end.y), new Call(() => this.beginFullMoveCycle())));
    sp.runAction(new Sequence(FadeIn(PLATFORM_FADE_TIME), new Delay(Math.max(0, t - 2 * PLATFORM_FADE_TIME)), FadeOut(PLATFORM_FADE_TIME)));
  }

  static treadmill(obj, parentNode, worldHeight) {
    const count = parseInt(obj.props.count, 10) || 1;
    const out = [];
    for (let i = 0; i < count; i++) {
      const p = new OneWayMovingPlatform(obj, parentNode, worldHeight);
      p.beginPartialMoveCycle(i / count);
      out.push(p);
    }
    return out;
  }
}

// The wall of fire that chases Timmy down Run Kitty Run! (FirewallPlatform.m).
// Touching it is instant death (isFlaming); it never falls more than 350 points behind Timmy.
const FIREWALL_HEIGHT = 52;
const FIREWALL_MAX_DIST = 350;

export class FirewallPlatform extends OneWayMovingPlatform {
  constructor(obj, parentNode, worldHeight, flameConfig) {
    super(obj, parentNode, worldHeight);
    const sp = this.sprite;
    sp.width = obj.width; sp.height = FIREWALL_HEIGHT;
    this.halfPlatform = { x: sp.width * 0.5, y: sp.height * 0.5 };
    this.speed = parseFloat(obj.props.speed) || 0;
    this.timmyDistance = 0;
    this.flameSound = null;
    // Flames spread along the whole wall and move with it
    this.flames = sp.addChild(new ParticleSystem(flameConfig, { sourcePositionVariancex: sp.width * 0.5 }), 99);
    this.flames.x = sp.width * 0.5; this.flames.y = sp.height * 0.5;
  }
  // An invisible box (the original used transparent.png); the particles are the visuals
  addSprite(_imageName, parentNode) {
    this.sprite = parentNode.addChild(new Node());
    this.sprite.anchorX = this.sprite.anchorY = 0.5;
  }
  addMotion() {}

  update(dt) {
    if (game.gameplayIsPaused || this.speed === 0) return;
    const sp = this.sprite;
    const timmyY = this.gameScene.timmy.position.y;
    this.timmyDistance = Math.abs(sp.y - timmyY);
    // don't let the wall get too far behind
    if (this.timmyDistance > FIREWALL_MAX_DIST) {
      sp.y = timmyY + FIREWALL_MAX_DIST;
      this.timmyDistance = FIREWALL_MAX_DIST;
    }
    sp.y -= this.speed * dt;
    this.updateFlameSound();
  }

  // The roar gets louder as the fire closes in
  updateFlameSound() {
    if (!audio.settings.sfx) { this.stopAllSounds(); return; }
    if (!this.flameSound) this.flameSound = audio.playEffect('fire', { loop: true, adjustable: true });
    this.flameSound.setVolume(Math.max(1 - this.timmyDistance / FIREWALL_MAX_DIST, 0.1));
  }
  stopAllSounds() {
    if (this.flameSound) this.flameSound.stop();
    this.flameSound = null;
  }
}

// A solid wall that doesn't move by itself (used for the boss-arena doors)
export class MovingWall extends BaseMovingPlatform {
  constructor(imageName, parentNode) {
    super();
    this.isSolid = true;
    this.addSprite(imageName, parentNode, 0);
  }
}

// ------------------------------------------------------------------ fireballs
export const FireballType = { Fire: 0, Panda: 1, Sparkle: 2 };

export class Fireball extends ParticleSystem {
  constructor(startSize, type) {
    const o = {
      maxParticles: 150, emissionRate: 150, particleLifespan: 0.3, particleLifespanVariance: 0.15,
      startParticleSize: startSize, startParticleSizeVariance: 10, finishParticleSize: 1,
    };
    if (type === FireballType.Sparkle) {
      Object.assign(o, {
        startColorRed: 0.22, startColorGreen: 0.25, startColorBlue: 0.78, startColorAlpha: 1,
        startColorRedVariance: 0.34, startColorGreenVariance: 0.58,
        finishColorRed: 1, finishColorGreen: 1, finishColorBlue: 1, finishColorAlpha: 1,
      });
    }
    super(SUN, o);
    this.lifespan = 0;
    this.minLifespan = 0.75;
    this.bbSize = startSize * 0.707;
  }
  boundingBox() { const h = this.bbSize / 2; return { x: this.x - h, y: this.y - h, w: this.bbSize, h: this.bbSize }; }

  step(dt) {
    super.step(dt);
    if (this.dead) return;
    this.lifespan += dt;
    const gs = this.gameScene;
    const props = gs.propertiesForTileAtWorldLocation(this);
    const pass = !!props && bool(props.passThrough);
    const solid = !!props && (bool(props.solid) || (!pass && props.slopeMap !== undefined));
    if (solid && this.lifespan > this.minLifespan) this.reachedEndOfRange();
  }
  hitTimmy() { this.reachedEndOfRange(); }
  reachedEndOfRange() {
    this.dead = true;
    this.gameScene.activeFireballs.delete(this);
    this.removeFromParent();
  }
}

export class FireballLauncher extends Sprite {
  constructor(obj, worldHeight, chapter) {
    super(platformFrame('chapter2FireballLauncher.png', 2));
    const d = obj.props;
    this.x = obj.x + obj.width / 2;
    this.y = worldHeight - obj.y - obj.height + obj.height / 2;
    let angle = 0, speed = 150, size = 30, every = 2;
    const dir = d.direction;
    if (dir === '>') angle = 0;
    else if (dir === '<') angle = Math.PI;
    else if (dir === '^') angle = Math.PI / 2;
    else if (dir === 'v') angle = -Math.PI / 2;
    else if (dir) angle = parseFloat(dir) * Math.PI / 180;
    this.rotation = -angle * 180 / Math.PI - 180;
    if (d.speed) speed = parseFloat(d.speed);
    if (d.size) size = parseFloat(d.size);
    if (d.secondsBetweenShots) every = parseFloat(d.secondsBetweenShots);
    Object.assign(this, { angle, speed, size, every, timer: 0 });
  }
  updateActions(dt) {
    super.updateActions(dt);
    this.timer += dt;
    if (this.timer >= this.every) {
      this.timer -= this.every;
      if (!game.gameplayIsPaused) {
        this.gameScene.launchFireball(this.x, this.y, this.angle, this.speed, this.size, 8, FireballType.Fire);
      }
    }
  }
}

export function fireSound(type) {
  audio.playEffect(type === FireballType.Panda ? 'panda_fireball' : type === FireballType.Sparkle ? 'unicorn_shoot' : 'fireshot');
}

// Platform that loops around a shape (square, hourglass, triangle, octagon)
export class PathMovingPlatform extends BaseMovingPlatform {
  constructor(obj, parentNode, worldHeight) {
    super();
    const d = obj.props;
    this.causesDamage = bool(d.damage);
    this.isFlaming = bool(d.fire);
    const x = obj.x, w = obj.width, h = obj.height, y = worldHeight - obj.y - h;
    const P = (fx, fy) => ({ x: x + w * fx, y: y + h * fy });
    const shapes = {
      square: [P(0, 0), P(0, 1), P(1, 1), P(1, 0)],
      hourglass: [P(0, 0), P(1, 1), P(0, 1), P(1, 0)],
      triangle: [P(0, 0), P(0.5, 1), P(1, 0)],
      octagon: [P(0, 0.3), P(0, 0.7), P(0.3, 1), P(0.7, 1), P(1, 0.7), P(1, 0.3), P(0.7, 0), P(0.3, 0)],
    };
    let pts = shapes[d.direction] || [P(0, 0)];
    if (bool(d.flipDirection)) pts = [...pts].reverse();
    this.addSprite(d.image || 'smallBlackPlatform.png', parentNode);
    this.sprite.x = pts[0].x; this.sprite.y = pts[0].y;
    let speed = parseFloat(d.speed);
    if (!(speed > 0)) speed = DEFAULT_MOVING_PLATFORM_SPEED;
    if (pts.length > 1) {
      const moves = [];
      const loop = [...pts.slice(1), pts[0]];
      let last = pts[0];
      for (const p of loop) {
        moves.push(new MoveTo(Math.hypot(p.x - last.x, p.y - last.y) / speed, p.x, p.y));
        last = p;
      }
      this.sprite.runAction(new RepeatForever(new Sequence(...moves)));
    }
  }
}
