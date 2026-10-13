import * as THREE from 'three';
import { WORDMARK_PATHS, WORDMARK_BOUNDS } from '../wordmark.js';

const markPaths = WORDMARK_PATHS.map((d) => new Path2D(d));

// The label art is 108 × 162 with the printed rounded rect at (2.25, 4.5, 103.5, 153).
const ART_RECT = { x: 2.25, y: 4.5, w: 103.5, h: 153 };

async function loadSvgImage(url, scale) {
  const text = await (await fetch(url)).text();
  // give the SVG an explicit pixel size so it rasterises sharply in every browser
  const sized = text.replace('<svg ', `<svg width="${108 * scale}" height="${162 * scale}" `);
  const blobUrl = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = blobUrl;
  await img.decode();
  URL.revokeObjectURL(blobUrl);
  return img;
}

export async function labelTexture(url, fallback, renderer, width = 1024) {
  const scale = width / ART_RECT.w;
  const img = await loadSvgImage(url, scale);
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = Math.round(ART_RECT.h * scale);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = fallback; // the art's corners are transparent; the label mesh is already rounded
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, -ART_RECT.x * scale, -ART_RECT.y * scale);
  return finish(new THREE.CanvasTexture(cv), renderer);
}

// Where each logo column sits along the outline (mm from the start, the middle of the
// bottom edge). Each side runs between the middles of its two corners and gets
// `perSide` columns spaced evenly within it, so every side carries the same count.
function columnPositions(dim, perSide) {
  const R = dim.radius, sx = dim.hw - R, sy = dim.hh - R, arc = (Math.PI / 2) * R;
  const sides = [2 * sx + arc, 2 * sy + arc, 2 * sx + arc, 2 * sy + arc]; // bottom, right, top, left
  const us = [];
  let start = -sides[0] / 2;
  for (const len of sides) {
    for (let k = 0; k < perSide; k++) us.push(start + ((k + 0.5) / perSide) * len);
    start += len;
  }
  return us;
}

// The shrink sleeve: stacked MO/JO logos in `rows` across the sleeve height (lid edge
// to base edge) and `perSide` columns on each side, letter tops toward the lid,
// colours alternating like a checkerboard. Sized in millimetres along the outline.
export function wrapTexture({ dim, lengthMm, heightMm, colors, wrap }, renderer) {
  const px = wrap.pxPerMm;
  const cv = document.createElement('canvas');
  cv.width = Math.min(8192, Math.round(lengthMm * px));
  cv.height = Math.round(heightMm * px);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = colors.wrap;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.scale(cv.width / lengthMm, cv.height / heightMm);

  const B = WORDMARK_BOUNDS;
  const rowH = heightMm / wrap.rows;
  const markH = rowH * wrap.markFill;
  const columns = columnPositions(dim, wrap.perSide);
  columns.forEach((u, i) => {
    for (let r = 0; r < wrap.rows; r++) {
      // logos near the seam are drawn on both ends of the texture
      for (const x of [u, u + lengthMm, u - lengthMm]) {
        ctx.save();
        ctx.translate(x, (r + 0.5) * rowH);
        ctx.scale(markH / B.h, markH / B.h);
        ctx.translate(-(B.x + B.w / 2), -(B.y + B.h / 2));
        ctx.fillStyle = (i + r) % 2 ? colors.markAlt : colors.mark;
        for (const p of markPaths) ctx.fill(p);
        ctx.restore();
      }
    }
  });
  return finish(new THREE.CanvasTexture(cv), renderer);
}

function finish(tex, renderer) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  return tex;
}
