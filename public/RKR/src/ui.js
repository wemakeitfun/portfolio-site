// Tiny UIKit-style helpers: every menu is laid out in the original 480x320 point space,
// using the frames from the game's Interface Builder files, then scaled to the window.

export const M = name => `assets/menu/${name}`;

export function el(tag, parent, cls = '', css = {}) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  Object.assign(e.style, css);
  if (parent) parent.appendChild(e);
  return e;
}

const pos = (x, y, w, h) => ({ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });

export function box(parent, x, y, w, h, cls = '') {
  return el('div', parent, `abs ${cls}`, pos(x, y, w, h));
}

export function img(parent, name, x, y, w, h, cls = '') {
  const i = el('img', parent, `abs ${cls}`, pos(x, y, w, h));
  i.src = M(name);
  i.alt = '';
  i.draggable = false;
  return i;
}

// UILabel: single line, vertically centred in its frame
export function label(parent, text, x, y, w, h, { font = 'interstate-bold', size = 13, align = 'left', color = '#fff', cls = '' } = {}) {
  const l = el('div', parent, `abs label ${font} ${cls}`, pos(x, y, w, h));
  l.style.fontSize = `${size}px`;
  l.style.justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  l.style.color = color;
  l.textContent = text;
  return l;
}

// UIButton with up/down background images (or foreground images for icon buttons)
export function button(parent, { x, y, w, h, up, down, title = '', size = 13, onClick, aria, cls = '' }) {
  const b = el('button', parent, `abs btn ${cls}`, pos(x, y, w, h));
  if (up) b.style.setProperty('--up', `url("${M(up)}")`);
  b.style.setProperty('--down', `url("${M(down || up)}")`);
  b.style.fontSize = `${size}px`;
  if (title) { const t = el('span', b); t.textContent = title; }
  b.setAttribute('aria-label', aria || title);
  b.type = 'button';
  if (onClick) b.addEventListener('click', e => { if (!b.disabled) onClick(e); });
  return b;
}

export function backButton(parent, onClick, x = 415, y = 255) {
  return button(parent, { x, y, w: 45, h: 45, up: 'btn-BACK-up.png', down: 'btn-BACK-down.png', onClick, aria: 'Back', cls: 'icon' });
}

export function title(parent, text, x = 25, y = 23, w = 300) {
  return label(parent, text, x, y, w, 21, { font: 'futura', size: 21 });
}

// UIImageView animationImages: cycles through frames; returns a stop function
export function frameAnim(imgEl, names, duration) {
  let i = 0;
  const per = (duration * 1000) / names.length;
  names.forEach(n => { const p = new Image(); p.src = M(n); });   // preload
  const t = setInterval(() => { i = (i + 1) % names.length; imgEl.src = M(names[i]); }, per);
  return () => clearInterval(t);
}

export const range = (prefix, a, b, suffix = '.png') => {
  const out = [];
  for (let i = a; i <= b; i++) out.push(`${prefix}${i}${suffix}`);
  return out;
};

export function fade(node, to, ms) {
  node.style.transition = `opacity ${ms}ms`;
  requestAnimationFrame(() => { node.style.opacity = String(to); });
  return new Promise(r => setTimeout(r, ms));
}
