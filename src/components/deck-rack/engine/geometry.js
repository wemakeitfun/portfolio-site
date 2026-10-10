import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Procedural skateboard deck.
//
// Local frame (inches):  X = length (nose at +X)   Y = up (grip side)   Z = width
// Everything is built from a "developed" length coordinate `u` (distance along the
// deck surface), so the bottom graphic maps without stretching into the kicks.

const DEG = Math.PI / 180;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export function createDeckShape(cfg) {
  const L = cfg.length;
  const W = cfg.width;
  const T = cfg.plies * cfg.plyThickness;
  const R = cfg.endRadius;
  const c = L / 2 - R;            // where the rounded end begins
  const bevel = Math.min(0.08, T * 0.3);
  const kickEnd = cfg.kickStart + cfg.kickBendLength;

  // ── side profile: integrate the bend angle along developed length ──
  const STEPS = 2000;
  const half = L / 2 + 0.5;
  const prof = new Float32Array((STEPS + 1) * 3); // x, y, theta
  {
    let x = 0, y = 0;
    for (let i = 0; i <= STEPS; i++) {
      const s = (i / STEPS) * half;
      const theta = cfg.kickAngle * DEG * smooth(clamp01((s - cfg.kickStart) / cfg.kickBendLength));
      prof[i * 3] = x; prof[i * 3 + 1] = y; prof[i * 3 + 2] = theta;
      const ds = half / STEPS;
      x += Math.cos(theta) * ds;
      y += Math.sin(theta) * ds;
    }
  }
  function profile(u) {
    const s = Math.abs(u), sg = Math.sign(u) || 1;
    const f = (s / half) * STEPS;
    const i = Math.min(STEPS - 1, Math.floor(f)), t = f - i;
    const a = i * 3, b = a + 3;
    const x = prof[a] + (prof[b] - prof[a]) * t;
    const y = prof[a + 1] + (prof[b + 1] - prof[a + 1]) * t;
    const th = prof[a + 2] + (prof[b + 2] - prof[a + 2]) * t;
    return { x: sg * x, y, nx: -sg * Math.sin(th), ny: Math.cos(th) };
  }

  const kickBlend = (u) => smooth(clamp01((Math.abs(u) - cfg.kickStart) / cfg.kickBendLength));
  const concaveK = (u) => cfg.concave * (1 + (cfg.concaveInKicks - 1) * kickBlend(u));
  const concave = (u, z) => concaveK(u) * (z / (W / 2)) ** 2;

  // Position of a point on (or inside) the deck.  h = 0 bottom face, h = T top face.
  function point(u, z, h, out = new THREE.Vector3()) {
    const p = profile(u);
    const o = h + concave(u, z);
    return out.set(p.x + p.nx * o, p.y + p.ny * o, z);
  }
  // Surface normal (pointing up / grip side) incl. concave slope.
  function normal(u, z, out = new THREE.Vector3()) {
    const p = profile(u);
    const dz = (2 * concaveK(u) * z) / (W / 2) ** 2;
    return out.set(p.nx, p.ny, -dz).normalize();
  }

  // ── outline: stadium with superelliptic ends; `inset` shrinks it for the edge bevel ──
  const P = 2.3; // superellipse exponent (2 = ellipse, higher = squarer nose)
  const samples = []; // { u, w, ui, wi }  full outline + inset outline at same index
  function pushEnd(sign, reverse) {
    const n = cfg.segmentsEnd;
    const arr = [];
    for (let k = 1; k <= n; k++) {
      const phi = (Math.PI / 2) * (1 - k / n); // π/2 → 0 (tip)
      const e = Math.cos(phi) ** (2 / P);
      const wn = Math.sin(phi) ** (2 / P);
      arr.push({
        u: sign * (c + R * e), w: (W / 2) * wn,
        ui: sign * (c + (R - bevel) * e), wi: (W / 2 - bevel) * wn,
      });
    }
    if (reverse) arr.reverse();
    samples.push(...arr);
  }
  pushEnd(-1, true);
  for (let k = 0; k <= cfg.segmentsLength; k++) {
    const u = -c + (2 * c * k) / cfg.segmentsLength;
    samples.push({ u, w: W / 2, ui: u, wi: W / 2 - bevel });
  }
  pushEnd(1, false);

  return { L, W, T, R, c, bevel, kickEnd, profile, point, normal, concave, samples };
}

export function createDeckGeometry(cfg) {
  const shape = createDeckShape(cfg);
  const { L, W, T, samples, bevel } = shape;
  const pos = [], nrm = [], uv = [], idx = [];
  const v = new THREE.Vector3();
  const groups = [];

  // ── top (grip) and bottom (graphic) faces ──
  const NW = cfg.segmentsWidth;
  const gripScale = 1 / 6; // grip noise texture tiles every 6"
  for (const side of ['top', 'bottom']) {
    const start = idx.length;
    const base = pos.length / 3;
    const h = side === 'top' ? T : 0;
    for (const s of samples) {
      for (let j = 0; j <= NW; j++) {
        const t = -1 + (2 * j) / NW;
        const z = t * s.wi;
        shape.point(s.ui, z, h, v);
        pos.push(v.x, v.y, v.z);
        nrm.push(0, 0, 0);
        if (side === 'top') uv.push(z * gripScale, s.ui * gripScale);
        // bottom: graphic covers the full deck rectangle (L × W).  U is mirrored so the
        // art reads correctly when the bottom faces the viewer.
        else uv.push((W / 2 - z) / W, (s.ui + L / 2) / L);
      }
    }
    const row = NW + 1;
    for (let i = 0; i < samples.length - 1; i++) {
      for (let j = 0; j < NW; j++) {
        const a = base + i * row + j, b = a + 1, c = a + row, d = c + 1;
        if (side === 'top') idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    }
    groups.push([start, idx.length - start]);
  }

  // ── sidewall (plywood edge) with rounded bevel ──
  {
    const start = idx.length;
    const base = pos.length / 3;
    // perimeter: t = -1 side tail→nose, then t = +1 side nose→tail (tips shared), closed loop
    const n = samples.length;
    const loop = [];
    for (let i = 0; i < n; i++) loop.push({ s: samples[i], sg: -1 });
    for (let i = n - 2; i >= 0; i--) loop.push({ s: samples[i], sg: 1 });
    // loop[last] === samples[0] with sg=+1 which coincides with tip; keep for UV seam
    const rows = [];
    const steps = cfg.segmentsEdge;
    for (let k = 0; k <= steps; k++) { const a = (k / steps) * Math.PI / 2; rows.push({ h: bevel * (1 - Math.cos(a)), g: Math.sin(a) }); }
    for (let k = steps; k >= 0; k--) { const a = (k / steps) * Math.PI / 2; rows.push({ h: T - bevel * (1 - Math.cos(a)), g: Math.sin(a) }); }
    let perim = 0, prev = null;
    for (const { s, sg } of loop) {
      if (prev) perim += Math.hypot(s.u - prev.u, sg * s.w - prev.z);
      prev = { u: s.u, z: sg * s.w };
      for (const r of rows) {
        const u = s.ui + (s.u - s.ui) * r.g;
        const z = sg * (s.wi + (s.w - s.wi) * r.g);
        shape.point(u, z, r.h, v);
        pos.push(v.x, v.y, v.z);
        nrm.push(0, 0, 0);
        uv.push(perim / 12, r.h / T);
      }
    }
    const R = rows.length;
    for (let i = 0; i < loop.length - 1; i++) {
      for (let k = 0; k < R - 1; k++) {
        const a = base + i * R + k, b = a + 1, c = a + R, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    groups.push([start, idx.length - start]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  groups.forEach(([s, c], i) => geo.addGroup(s, c, i));
  geo.computeVertexNormals();
  fixWinding(geo, groups);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { geometry: geo, shape };
}

// Sidewall normals must point outward; flip the edge group if computeVertexNormals says otherwise.
function fixWinding(geo, groups) {
  const [start, count] = groups[2];
  const index = geo.index.array, p = geo.attributes.position, n = geo.attributes.normal;
  const i0 = index[start];
  const px = p.getX(i0), pz = p.getZ(i0);
  const dot = px * n.getX(i0) + pz * n.getZ(i0);
  if (dot < 0) {
    for (let i = start; i < start + count; i += 3) {
      const t = index[i + 1]; index[i + 1] = index[i + 2]; index[i + 2] = t;
    }
    geo.computeVertexNormals();
  }
}

// Bolt heads (top) and bolt holes (bottom), merged into two shared geometries.
export function createHardwareGeometry(cfg, shape) {
  const heads = [], holes = [];
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const r = cfg.boltRadius;
  const headGeo = new THREE.CylinderGeometry(r * 1.15, r * 1.3, 0.035, 20);
  headGeo.translate(0, 0.0175, 0);
  const holeGeo = new THREE.CircleGeometry(r, 20).rotateX(Math.PI / 2); // faces -Y
  for (const sx of [-1, 1]) {
    for (const du of [0, cfg.boltSpacingLength]) {
      for (const sz of [-1, 1]) {
        const u = sx * (cfg.wheelbase / 2 + du);
        const z = (sz * cfg.boltSpacingWidth) / 2;
        shape.normal(u, z, n);
        q.setFromUnitVectors(up, n);
        shape.point(u, z, shape.T, p);
        heads.push(headGeo.clone().applyQuaternion(q).translate(p.x, p.y, p.z));
        shape.point(u, z, -0.004, p);
        holes.push(holeGeo.clone().applyQuaternion(q).translate(p.x, p.y, p.z));
      }
    }
  }
  return { heads: mergeGeometries(heads), holes: mergeGeometries(holes) };
}
