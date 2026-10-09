// A tiny Cocos2d-style engine: nodes, sprites, sprite frames, bitmap-font labels and actions.
// World coordinates are y-up (like Cocos2d) and measured in iPhone "points" (480x320 screen).

export const WIN_W = 480;
export const WIN_H = 320;

// ------------------------------------------------------------------ assets
export const assets = { images: {}, frames: {}, fonts: {}, json: {} };

export function loadImage(url) {
  if (assets.images[url]) return Promise.resolve(assets.images[url]);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { assets.images[url] = img; resolve(img); };
    img.onerror = () => reject(new Error('Failed to load ' + url));
    img.src = url;
  });
}

export async function loadJSON(url) {
  if (assets.json[url]) return assets.json[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load ' + url);
  return (assets.json[url] = await res.json());
}

// Sprite frame: region of an HD texture plus Cocos2d trim/offset data. `s` converts pixels to points.
export async function loadAtlas(name) {
  const data = await loadJSON(`assets/atlas/${name}.json`);
  const img = await loadImage(`assets/atlas/${data.image}`);
  for (const [key, f] of Object.entries(data.frames)) {
    assets.frames[key] = { img, x: f[0], y: f[1], w: f[2], h: f[3], ox: f[4], oy: f[5], sw: f[6], sh: f[7], rot: !!f[8], s: 0.5 };
  }
}

export function frameFromImage(img, scale = 1, rect = null) {
  const r = rect || [0, 0, img.width, img.height];
  return { img, x: r[0], y: r[1], w: r[2], h: r[3], ox: 0, oy: 0, sw: r[2], sh: r[3], rot: false, s: scale };
}

export function frame(name) {
  const f = assets.frames[name];
  if (!f) throw new Error('Missing sprite frame ' + name);
  return f;
}

export async function loadFont(name) {
  const data = await loadJSON(`assets/fonts/${name}.json`);
  data.img = await loadImage(`assets/fonts/${data.image}`);
  data.s = 0.5;
  assets.fonts[name] = data;
}

// ------------------------------------------------------------------ nodes
let orderCounter = 0;

export class Node {
  constructor() {
    this.x = 0; this.y = 0;
    this.anchorX = 0; this.anchorY = 0;
    this.width = 0; this.height = 0;
    this.scaleX = 1; this.scaleY = 1;
    this.rotation = 0;             // degrees, clockwise (Cocos2d convention)
    this.opacity = 255;
    this.visible = true;
    this.z = 0; this.order = 0;
    this.children = [];
    this.parent = null;
    this.actions = [];
    this.tag = null;
  }
  set scale(v) { this.scaleX = this.scaleY = v; }
  get scale() { return this.scaleX; }

  addChild(child, z = 0, tag = null) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this; child.z = z; child.order = orderCounter++;
    if (tag !== null) child.tag = tag;
    this.children.push(child);
    this.sortChildren();
    return child;
  }
  sortChildren() { this.children.sort((a, b) => (a.z - b.z) || (a.order - b.order)); }
  reorderChild(child, z) { child.z = z; this.sortChildren(); }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parent = null;
  }
  removeFromParent() { if (this.parent) this.parent.removeChild(this); }
  removeAllChildren() { for (const c of this.children) c.parent = null; this.children = []; }
  getChildByTag(tag) { return this.children.find(c => c.tag === tag) || null; }

  runAction(action) { action.start(this); this.actions.push(action); return action; }
  stopAction(action) {
    const i = this.actions.indexOf(action);
    if (i >= 0) { this.actions.splice(i, 1); action.stop(); }
  }
  stopAllActions() { const a = this.actions; this.actions = []; for (const x of a) x.stop(); }

  // Actions only run while the node is part of the visible tree (as in Cocos2d).
  updateActions(dt) {
    if (this.actions.length) {
      for (const a of this.actions.slice()) {
        if (!this.actions.includes(a)) continue;
        if (a.update(dt) >= 0) {
          const i = this.actions.indexOf(a);
          if (i >= 0) this.actions.splice(i, 1);
          a.stop();
        }
      }
    }
    for (const c of this.children.slice()) if (c.parent === this) c.updateActions(dt);
  }

  get position() { return { x: this.x, y: this.y }; }
  set position(p) { this.x = p.x; this.y = p.y; }

  // Axis-aligned bounds in the parent's space (accounts for rotation like Cocos2d's boundingBox)
  boundingBox() {
    const w = this.width * Math.abs(this.scaleX), h = this.height * Math.abs(this.scaleY);
    if (!this.rotation) return { x: this.x - this.anchorX * w, y: this.y - this.anchorY * h, w, h };
    const r = -this.rotation * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const xs = [], ys = [];
    for (const [px, py] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const lx = px - this.anchorX * w, ly = py - this.anchorY * h;
      xs.push(this.x + lx * c - ly * s); ys.push(this.y + lx * s + ly * c);
    }
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
  }

  render(ctx) {
    if (!this.visible) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.rotation) ctx.rotate(-this.rotation * Math.PI / 180);
    if (this.scaleX !== 1 || this.scaleY !== 1) ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(-this.anchorX * this.width, -this.anchorY * this.height);
    let i = 0;
    const kids = this.children;
    for (; i < kids.length && kids[i].z < 0; i++) kids[i].render(ctx);
    this.draw(ctx);
    for (; i < kids.length; i++) kids[i].render(ctx);
    ctx.restore();
  }
  draw(_ctx) {}
}

// Draws a frame with its bottom-left content corner at the current origin (y-up space).
export function drawFrame(ctx, f, flipX = false, flipY = false, alpha = 1) {
  if (alpha <= 0) return;
  const W = f.sw * f.s, H = f.sh * f.s;
  ctx.save();
  if (flipX) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  if (flipY) { ctx.translate(0, H); ctx.scale(1, -1); }
  const left = ((f.sw - f.w) / 2 + f.ox) * f.s;
  const bottom = ((f.sh - f.h) / 2 + f.oy) * f.s;
  if (alpha < 1) ctx.globalAlpha *= alpha;
  if (f.rot) {
    // Stored turned 90 degrees in the texture: texture x runs up the sprite, texture y runs along it
    ctx.translate(left, bottom);
    ctx.transform(0, 1, 1, 0, 0, 0);
    ctx.drawImage(f.img, f.x, f.y, f.h, f.w, 0, 0, f.h * f.s, f.w * f.s);
  } else {
    const hh = f.h * f.s;
    ctx.translate(left, bottom + hh);
    ctx.scale(1, -1);
    ctx.drawImage(f.img, f.x, f.y, f.w, f.h, 0, 0, f.w * f.s, hh);
  }
  ctx.restore();
}

export class Sprite extends Node {
  constructor(f) {
    super();
    this.anchorX = 0.5; this.anchorY = 0.5;
    this.flipX = false; this.flipY = false;
    this.setFrame(typeof f === 'string' ? frame(f) : f);
  }
  setFrame(f) {
    this.frame = f;
    if (f) { this.width = f.sw * f.s; this.height = f.sh * f.s; }
  }
  draw(ctx) {
    if (this.frame) drawFrame(ctx, this.frame, this.flipX, this.flipY, this.opacity / 255);
  }
}

// Bitmap font label (BMFont data from the original game)
export class Label extends Node {
  constructor(text, fontName) {
    super();
    this.font = assets.fonts[fontName];
    this.anchorX = 0.5; this.anchorY = 0.5;
    this.setString(String(text));
  }
  setString(text) {
    this.text = text;
    const f = this.font;
    let w = 0;
    for (const ch of text) {
      const c = f.chars[ch.charCodeAt(0)];
      if (c) w += c[6];
    }
    this.width = w * f.s;
    this.height = f.lineHeight * f.s;
  }
  draw(ctx) {
    const f = this.font, s = f.s;
    ctx.save();
    ctx.globalAlpha *= this.opacity / 255;
    ctx.translate(0, this.height);
    ctx.scale(1, -1);
    let x = 0;
    for (const ch of this.text) {
      const c = f.chars[ch.charCodeAt(0)];
      if (!c) continue;
      if (c[2] && c[3]) ctx.drawImage(f.img, c[0], c[1], c[2], c[3], (x + c[4]) * s, c[5] * s, c[2] * s, c[3] * s);
      x += c[6];
    }
    ctx.restore();
  }
}

export class ColorLayer extends Node {
  constructor(color, w = WIN_W, h = WIN_H) { super(); this.color = color; this.width = w; this.height = h; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha *= this.opacity / 255;
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ actions
// update(dt) returns the unused time (>= 0) once finished, or -1 while still running.
export class Action {
  start(target) { this.target = target; }
  stop() {}
  update() { return 0; }
}

export class Interval extends Action {
  constructor(duration) { super(); this.duration = duration; }
  start(target) { super.start(target); this.elapsed = 0; }
  update(dt) {
    this.elapsed += dt;
    const p = this.duration > 0 ? Math.min(1, this.elapsed / this.duration) : 1;
    this.apply(p);
    return this.elapsed >= this.duration ? this.elapsed - this.duration : -1;
  }
  apply(_p) {}
}

export class Animate extends Interval {
  constructor(frames, delay, restoreOriginalFrame = true) {
    super(frames.length * delay);
    this.frames = frames.map(f => (typeof f === 'string' ? frame(f) : f));
    this.restore = restoreOriginalFrame;
  }
  start(target) { super.start(target); this.original = target.frame; this.last = -1; }
  apply(p) {
    const n = this.frames.length;
    const i = Math.min(n - 1, Math.floor(p * n));
    if (i !== this.last) { this.target.setFrame(this.frames[i]); this.last = i; }
  }
  stop() { if (this.restore && this.original && this.target) this.target.setFrame(this.original); }
}

export function animFrames(prefix, count, first, suffix = '.png') {
  const out = [];
  for (let i = first; i < first + count; i++) out.push(`${prefix}${i}${suffix}`);
  return out;
}

export class Delay extends Interval {}

export class Call extends Action {
  constructor(fn) { super(); this.fn = fn; }
  update(dt) { this.fn(this.target); return dt; }
}

export class FadeTo extends Interval {
  constructor(d, opacity) { super(d); this.to = opacity; }
  start(t) { super.start(t); this.from = t.opacity; }
  apply(p) { this.target.opacity = this.from + (this.to - this.from) * p; }
}
export const FadeIn = d => new FadeTo(d, 255);
export const FadeOut = d => new FadeTo(d, 0);

export class MoveBy extends Interval {
  constructor(d, dx, dy) { super(d); this.dx = dx; this.dy = dy; }
  start(t) { super.start(t); this.sx = t.x; this.sy = t.y; }
  apply(p) { this.target.x = this.sx + this.dx * p; this.target.y = this.sy + this.dy * p; }
}

export class MoveTo extends Interval {
  constructor(d, x, y) { super(d); this.tx = x; this.ty = y; }
  start(t) { super.start(t); this.sx = t.x; this.sy = t.y; }
  apply(p) { this.target.x = this.sx + (this.tx - this.sx) * p; this.target.y = this.sy + (this.ty - this.sy) * p; }
}

export class JumpBy extends Interval {
  constructor(d, dx, dy, height, jumps) { super(d); Object.assign(this, { dx, dy, height, jumps }); }
  start(t) { super.start(t); this.sx = t.x; this.sy = t.y; }
  apply(p) {
    const frac = (p * this.jumps) % 1;
    const y = this.height * 4 * frac * (1 - frac);
    this.target.x = this.sx + this.dx * p;
    this.target.y = this.sy + y + this.dy * p;
  }
}

export class ScaleTo extends Interval {
  constructor(d, s) { super(d); this.to = s; }
  start(t) { super.start(t); this.fx = t.scaleX; this.fy = t.scaleY; }
  apply(p) { this.target.scaleX = this.fx + (this.to - this.fx) * p; this.target.scaleY = this.fy + (this.to - this.fy) * p; }
}

export class EaseBackIn extends Interval {
  constructor(inner) { super(inner.duration); this.inner = inner; }
  start(t) { super.start(t); this.inner.start(t); }
  apply(p) { const o = 1.70158; this.inner.apply(p * p * ((o + 1) * p - o)); }
}

// Cubic bezier to an absolute end point (control points are absolute too)
export class BezierTo extends Interval {
  constructor(d, c1, c2, end) { super(d); this.c1 = c1; this.c2 = c2; this.end = end; }
  start(t) { super.start(t); this.sx = t.x; this.sy = t.y; }
  apply(t) {
    const b = (a, c1, c2, e) => (1 - t) ** 3 * a + 3 * t * (1 - t) ** 2 * c1 + 3 * t * t * (1 - t) * c2 + t ** 3 * e;
    this.target.x = b(this.sx, this.c1.x, this.c2.x, this.end.x);
    this.target.y = b(this.sy, this.c1.y, this.c2.y, this.end.y);
  }
}

export class RotateBy extends Interval {
  constructor(d, angle) { super(d); this.by = angle; }
  start(t) { super.start(t); this.from = t.rotation; }
  apply(p) { this.target.rotation = this.from + this.by * p; }
}

export class RotateTo extends Interval {
  constructor(d, angle) { super(d); this.to = angle; }
  start(t) { super.start(t); this.from = t.rotation; }
  apply(p) { this.target.rotation = this.from + (this.to - this.from) * p; }
}

export class EaseBounceOut extends Interval {
  constructor(inner) { super(inner.duration); this.inner = inner; }
  start(t) { super.start(t); this.inner.start(t); }
  apply(t) {
    let v;
    if (t < 1 / 2.75) v = 7.5625 * t * t;
    else if (t < 2 / 2.75) { t -= 1.5 / 2.75; v = 7.5625 * t * t + 0.75; }
    else if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; v = 7.5625 * t * t + 0.9375; }
    else { t -= 2.625 / 2.75; v = 7.5625 * t * t + 0.984375; }
    this.inner.apply(v);
  }
}

// Runs actions in parallel; finishes when the longest one does
export class Spawn extends Action {
  constructor(...actions) { super(); this.actions = actions; }
  start(t) { super.start(t); this.done = this.actions.map(() => false); for (const a of this.actions) a.start(t); }
  update(dt) {
    let left = Infinity;
    this.actions.forEach((a, i) => {
      if (this.done[i]) return;
      const r = a.update(dt);
      if (r >= 0) { this.done[i] = true; a.stop(); left = Math.min(left, r); }
    });
    return this.done.every(Boolean) ? (left === Infinity ? 0 : left) : -1;
  }
  stop() { this.actions.forEach((a, i) => { if (!this.done[i]) a.stop(); }); }
}

export class Sequence extends Action {
  constructor(...actions) { super(); this.actions = actions; }
  start(t) { super.start(t); this.i = 0; this.actions[0].start(t); }
  update(dt) {
    for (;;) {
      const cur = this.actions[this.i];
      const r = cur.update(dt);
      if (r < 0) return -1;
      cur.stop();
      this.i++;
      if (this.i >= this.actions.length) return r;
      this.actions[this.i].start(this.target);
      dt = r;
    }
  }
  stop() { if (this.i < this.actions.length) this.actions[this.i].stop(); }
}

export class Repeat extends Action {
  constructor(action, times) { super(); this.action = action; this.times = times; }
  start(t) { super.start(t); this.n = 0; this.action.start(t); }
  update(dt) {
    for (;;) {
      const r = this.action.update(dt);
      if (r < 0) return -1;
      this.n++;
      if (this.n >= this.times) { this.action.stop(); return r; }
      this.action.stop();
      this.action.start(this.target);
      dt = r;
    }
  }
}

export class RepeatForever extends Action {
  constructor(action) { super(); this.action = action; }
  start(t) { super.start(t); this.action.start(t); }
  update(dt) {
    let guard = 0;
    for (;;) {
      const r = this.action.update(dt);
      if (r < 0 || guard++ > 8) return -1;
      this.action.stop();
      this.action.start(this.target);
      dt = r;
    }
  }
  stop() { this.action.stop(); }
}

// ------------------------------------------------------------------ helpers
export function rectIntersects(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}
export function rectContains(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
export function rectInset(r, dx, dy) {
  return { x: r.x + dx, y: r.y + dy, w: r.w - 2 * dx, h: r.h - 2 * dy };
}

// Haptic feedback (replaces the iPhone's AudioServicesPlaySystemSound vibrate)
export function vibrate(ms) {
  try {
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms);
  } catch { /* unsupported */ }
}
