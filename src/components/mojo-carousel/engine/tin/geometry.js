import * as THREE from 'three';

// The tin is built from a rounded-rectangle outline. Every surface except the two
// flat labels is a "sweep": a 2D profile (inset d from the outline, height z) carried
// around the outline. Insetting a rounded rectangle by d shrinks its half-sizes and
// corner radius by d, so one outline function serves every profile point.
//
// Cross-section of the lid half (the base mirrors it), from the spec sheet:
//
//   panel (flat, label) ── 20° slope ──╮ R2 round
//                                      │ wall
//
// The shrink sleeve covers the wall, the round and the outer part of the slope;
// its edge lifts off slightly; the white lid shows between it and the label.

export function tinDimensions(cfg) {
  const hw = cfg.width / 2, hh = cfg.length / 2;
  const edge = (cfg.width - cfg.panelW) / 2; // outline → panel edge (same on all sides)
  const R = cfg.cornerRadius;
  const sx = hw - R, sy = hh - R; // straight half-lengths of the sides
  return {
    hw, hh, radius: R, edge,
    labelRadius: R - edge,
    // sagitta of the bowed short ends at d = 0, from the bow radius over the straight run
    bow: (sx * sx) / (2 * cfg.endBow),
    outlineLength: 4 * (sx + sy) + 2 * Math.PI * R,
  };
}

// Points around the outline inset by d, counter-clockwise from +Z, starting at the
// middle of the bottom (short) edge. Also returns u ∈ [0,1] measured along the
// *outer* outline so the sleeve art keeps the same proportions on every ring.
// The short ends bow outwards; the bow fades to nothing at the panel edge.
function outline(dim, d, cornerSegs, straightSegs = 8) {
  const hw = dim.hw - d, hh = dim.hh - d, r = Math.max(dim.radius - d, 0);
  const R = dim.radius;
  const sx = dim.hw - R, sy = dim.hh - R;
  const bow = dim.bow * Math.max(0, 1 - d / dim.edge);
  const pts = [], us = [];
  let len = 0;
  const push = (x, y, du) => { len += du; pts.push(new THREE.Vector2(x, y)); us.push(len / dim.outlineLength); };
  // short ends run along x; offset outwards by a parabola that is 0 at the corners
  const bowed = (x) => bow * (1 - (x / sx) ** 2);
  const run = (x0, y0, x1, y1, sign, du) => {
    for (let i = 1; i <= straightSegs; i++) {
      const t = i / straightSegs, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      push(x, sign ? y + sign * bowed(x) : y, du / straightSegs);
    }
  };
  const arc = (cx, cy, a0) => {
    for (let i = 1; i <= cornerSegs; i++) {
      const a = a0 + (i / cornerSegs) * (Math.PI / 2);
      push(cx + r * Math.cos(a), cy + r * Math.sin(a), (Math.PI / 2) * R / cornerSegs);
    }
  };

  push(0, -hh - bow, 0);
  run(0, -hh, sx, -hh, -1, sx);           // bottom end, right half
  arc(sx, -sy, -Math.PI / 2);
  run(hw, -sy, hw, sy, 0, 2 * sy);        // right side
  arc(sx, sy, 0);
  run(sx, hh, -sx, hh, 1, 2 * sx);        // top end
  arc(-sx, sy, Math.PI / 2);
  run(-hw, sy, -hw, -sy, 0, 2 * sy);      // left side
  arc(-sx, -sy, Math.PI);
  run(-sx, -hh, 0, -hh, -1, sx);          // bottom end, left half (closes the seam)
  return { pts, us };
}

// profile: [{ d, z }] ordered from the lid towards the base, v ∈ [0,1] by arc length.
// Repeating a point duplicates its ring, which keeps that crease sharp.
export function sweep(dim, profile, cornerSegs) {
  let total = 0;
  const vs = [0];
  for (let j = 1; j < profile.length; j++) {
    total += Math.hypot(profile[j].d - profile[j - 1].d, profile[j].z - profile[j - 1].z);
    vs.push(total);
  }

  const positions = [], uvs = [], index = [];
  let ringSize = 0;
  profile.forEach((p, j) => {
    const { pts, us } = outline(dim, p.d, cornerSegs);
    ringSize = pts.length;
    pts.forEach((pt, i) => {
      positions.push(pt.x, pt.y, p.z);
      uvs.push(us[i], 1 - vs[j] / total);
    });
  });
  for (let j = 0; j < profile.length - 1; j++) {
    for (let i = 0; i < ringSize - 1; i++) {
      const a = j * ringSize + i, b = a + 1, c = a + ringSize, e = c + 1;
      index.push(a, c, b, b, c, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return { geometry: g, length: total };
}

// Height of the sloped border at inset d (lid side).
function slopeZ(cfg, dim, d) {
  return cfg.height / 2 - (dim.edge - d) * Math.tan((cfg.edgeSlope * Math.PI) / 180);
}

// Where the sleeve's lifted edge and the white lid begin, as insets from the outline.
function bands(cfg, dim) {
  const white = dim.edge - cfg.whiteW;
  return { white, sleeve: white - cfg.liftW };
}

// Shrink sleeve: lid slope → R2 round → (slightly swollen) wall → R2 round → base
// slope. Runs inside → out on the lid so faces point away from the tin.
export function bodyProfile(cfg, dim, segs) {
  const r = cfg.edgeRadius, a = (cfg.edgeSlope * Math.PI) / 180;
  // centre of the round, tangent to the wall (d = 0) and to the slope
  const zc = cfg.height / 2 - (dim.edge - r) * Math.tan(a) - r / Math.cos(a);
  const turn = Math.PI / 2 - a; // the round turns from the slope to vertical
  const { sleeve } = bands(cfg, dim);

  const top = [{ d: sleeve, z: slopeZ(cfg, dim, sleeve) }];
  for (let i = segs; i >= 0; i--) {
    const p = (i / segs) * turn;
    top.push({ d: r - r * Math.cos(p), z: zc + r * Math.sin(p) });
  }
  const wall = [], wallSegs = 10;
  for (let i = 1; i < wallSegs; i++) {
    const t = i / wallSegs;
    wall.push({ d: -cfg.bulge * Math.sin(Math.PI * t), z: zc - 2 * zc * t });
  }
  const bottom = top.map((p) => ({ d: p.d, z: -p.z })).reverse();
  return [...top, ...wall, ...bottom];
}

// Lid parts are written outside → in for the lid half; the base mirrors them and runs
// the other way so faces keep pointing away from the tin.
function lidPart(sign, raw) {
  const pts = raw.map(({ d, z }) => ({ d, z: sign * z }));
  return sign > 0 ? pts.reverse() : pts;
}

// The sleeve's edge: rises off the slope towards its end, then drops onto the lid.
export function liftProfile(cfg, dim, sign) {
  const { white, sleeve } = bands(cfg, dim);
  const zw = slopeZ(cfg, dim, white);
  return lidPart(sign, [
    { d: sleeve, z: slopeZ(cfg, dim, sleeve) },
    { d: white, z: zw + cfg.liftRise },
    { d: white, z: zw + cfg.liftRise },
    { d: white, z: zw },
  ]);
}

// White lid: the inner part of the 20° slope, then the flat panel the label sits on
// (running a little under the label so no seam shows).
export function lidTopProfile(cfg, dim, sign) {
  const { white } = bands(cfg, dim);
  const top = cfg.height / 2;
  return lidPart(sign, [
    { d: white, z: slopeZ(cfg, dim, white) },
    { d: dim.edge, z: top },
    { d: dim.edge, z: top },
    { d: dim.edge + 0.6, z: top },
  ]);
}

// Flat label covering the panel, with UVs spanning the art rectangle.
export function labelGeometry(cfg, dim) {
  const w = cfg.panelW / 2, h = cfg.panelH / 2, r = dim.labelRadius;
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h); s.absarc(w - r, -h + r, r, -Math.PI / 2, 0);
  s.lineTo(w, h - r); s.absarc(w - r, h - r, r, 0, Math.PI / 2);
  s.lineTo(-w + r, h); s.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-w, -h + r); s.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5);
  const g = new THREE.ShapeGeometry(s, 24);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w) / (2 * w), (pos.getY(i) + h) / (2 * h));
  return g;
}
