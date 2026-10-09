// HorizontalInputLayer port: keyboard, gamepad and the original on-screen D-pad + jump button.
import { Node, Sprite, WIN_W, rectContains } from './engine.js';

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyX', 'KeyK']);

export const keys = new Set();
let lastHorizontal = 0;
const listeners = new Set();
export function onKeyDown(fn) { listeners.add(fn); return () => listeners.delete(fn); }

window.addEventListener('keydown', e => {
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (!e.repeat) for (const fn of [...listeners]) fn(e.code);
  if (LEFT_KEYS.has(e.code)) lastHorizontal = -1;
  else if (RIGHT_KEYS.has(e.code)) lastHorizontal = 1;
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

export let touchMode = matchMedia('(pointer: coarse)').matches;
export function setTouchMode(v) { touchMode = v; }

function gamepadState() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let x = 0, jump = false;
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0;
    if (ax < -0.4 || p.buttons[14]?.pressed) x = -1;
    if (ax > 0.4 || p.buttons[15]?.pressed) x = 1;
    if (p.buttons[0]?.pressed || p.buttons[1]?.pressed || p.buttons[12]?.pressed) jump = true;
  }
  return { x, jump };
}

export class InputLayer extends Node {
  constructor() {
    super();
    this.pointers = new Map();   // pointerId -> {role, x, y}
    this.overrideUserInput = false;
    this.overrideX = 0;

    // D-pad and jump button (positions from the original HorizontalInputLayer)
    this.leftUp = this.addChild(new Sprite('dpad-left.png'));
    this.leftDown = this.addChild(new Sprite('dpad-left-active.png'));
    this.rightUp = this.addChild(new Sprite('dpad-right.png'));
    this.rightDown = this.addChild(new Sprite('dpad-right-active.png'));
    for (const s of [this.leftUp, this.leftDown, this.rightUp, this.rightDown]) { s.anchorX = 0; s.anchorY = 0; }
    this.leftUp.x = this.leftDown.x = 36; this.leftUp.y = this.leftDown.y = 27;
    this.rightUp.x = this.rightDown.x = 119; this.rightUp.y = this.rightDown.y = 27;
    const pad = 50;
    this.leftPadRect = { x: 0, y: 0, w: 36 + this.leftUp.width, h: 27 + this.leftUp.height + pad };
    this.rightPadRect = { x: 119, y: 0, w: this.rightUp.width + pad, h: 27 + this.rightUp.height + pad };
    this.jumpBtn = this.addChild(new Sprite('jump.png'));
    this.jumpActive = this.addChild(new Sprite('jump-active.png'));
    this.jumpBtn.x = this.jumpActive.x = 420; this.jumpBtn.y = this.jumpActive.y = 50;
    this.jumpDividerX = WIN_W * 0.5;
  }

  // Pointer events in game coordinates (y-up). Returns true if consumed.
  pointerDown(id, x, y) {
    if (!touchMode) return false;
    const role = x > this.jumpDividerX ? 'jump' : 'move';
    this.pointers.set(id, { role, x, y });
    return true;
  }
  pointerMove(id, x, y) {
    const p = this.pointers.get(id);
    if (p) { p.x = x; p.y = y; }
  }
  pointerUp(id) { this.pointers.delete(id); }
  reset() { this.pointers.clear(); }

  touchState() {
    let x = 0, jump = false;
    for (const p of this.pointers.values()) {
      if (p.role === 'jump') jump = true;
      else if (rectContains(this.leftPadRect, p.x, p.y) || p.x < this.rightPadRect.x) x = -1;
      else x = 1;
    }
    return { x, jump };
  }

  get xInput() {
    if (this.overrideUserInput) return this.overrideX;
    // When both directions are held, the most recently pressed one wins (like a thumb stick)
    const left = [...LEFT_KEYS].some(k => keys.has(k));
    const right = [...RIGHT_KEYS].some(k => keys.has(k));
    let x = 0;
    if (left && right) x = lastHorizontal;
    else if (left) x = -1;
    else if (right) x = 1;
    if (x === 0) x = this.touchState().x;
    if (x === 0) x = gamepadState().x;
    return x;
  }

  // Simulated jump press used by scripted sequences (boss defeats)
  overrideJump() {
    this.overriddenJump = true;
    clearTimeout(this.jumpTimer);
    this.jumpTimer = setTimeout(() => { this.overriddenJump = false; }, 500);
  }

  get isJumpPressed() {
    if (this.overriddenJump) return true;
    return [...JUMP_KEYS].some(k => keys.has(k)) || this.touchState().jump || gamepadState().jump;
  }

  draw() {
    const show = touchMode;
    const t = show ? this.touchState() : { x: 0, jump: false };
    this.leftUp.visible = show && t.x >= 0;
    this.leftDown.visible = show && t.x < 0;
    this.rightUp.visible = show && t.x <= 0;
    this.rightDown.visible = show && t.x > 0;
    this.jumpBtn.visible = show && !t.jump;
    this.jumpActive.visible = show && t.jump;
  }
}
