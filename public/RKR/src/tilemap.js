// CCTMXTiledMap replacement: holds level data, answers tile queries and draws visible layers.
import { Node, loadImage, loadJSON } from './engine.js';

// NSString boolValue semantics ("1", "YES", "true" -> true; "0", missing -> false)
export function bool(v) {
  if (v === undefined || v === null) return false;
  if (typeof v !== 'string') return !!v;
  const c = v.trim()[0];
  if (!c) return false;
  if ('YyTt'.includes(c)) return true;
  const n = parseInt(v, 10);
  return !isNaN(n) && n !== 0;
}

export async function loadLevel(name) {
  const data = await loadJSON(`assets/levels/${name}.json`);
  for (const ts of data.tilesets) {
    if (!ts.img) ts.img = await loadImage(`assets/levels/${ts.image}`);
    const cols = Math.floor((ts.img.width - 2 * ts.margin + ts.spacing) / (ts.tileW + ts.spacing));
    ts.cols = Math.max(1, cols);
  }
  return data;
}

export class TileMap extends Node {
  constructor(data) {
    super();
    this.data = data;
    this.mapW = data.width;
    this.mapH = data.height;
    this.tileSize = data.tileSize;
    this.width = this.mapW * this.tileSize;
    this.height = this.mapH * this.tileSize;
    this.properties = data.properties || {};
    this.layers = {};
    for (const l of data.layers) this.layers[l.name] = l;
    this.tilesets = [...data.tilesets].sort((a, b) => b.firstgid - a.firstgid);
    this.drawLayers = data.layers.filter(l => l.visible && l.name !== 'meta');
    this.viewX = 0; this.viewY = 0; this.viewW = 480; this.viewH = 320;
  }

  gidAt(layerName, col, row) {
    const l = this.layers[layerName];
    if (!l || col < 0 || row < 0 || col >= this.mapW || row >= this.mapH) return 0;
    return l.data[row * this.mapW + col];
  }

  propertiesForGID(gid) {
    return gid ? (this.data.tileProps[gid] || null) : null;
  }

  // Visible world rectangle (y-up), set by the game scene from the camera.
  setView(x, y, w, h) { this.viewX = x; this.viewY = y; this.viewW = w; this.viewH = h; }

  draw(ctx) {
    const ts = this.tileSize;
    const worldH = this.height;
    // Rows/cols (Tiled rows are counted from the top)
    const c0 = Math.max(0, Math.floor(this.viewX / ts));
    const c1 = Math.min(this.mapW - 1, Math.floor((this.viewX + this.viewW) / ts));
    const r0 = Math.max(0, Math.floor((worldH - (this.viewY + this.viewH)) / ts));
    const r1 = Math.min(this.mapH - 1, Math.floor((worldH - this.viewY) / ts));
    ctx.save();
    ctx.translate(0, worldH);
    ctx.scale(1, -1);       // y-down, origin at top-left of map
    for (const layer of this.drawLayers) {
      const d = layer.data;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const gid = d[r * this.mapW + c];
          if (!gid) continue;
          const set = this.tilesets.find(t => gid >= t.firstgid);
          if (!set) continue;
          const id = gid - set.firstgid;
          const sx = set.margin + (id % set.cols) * (set.tileW + set.spacing);
          const sy = set.margin + Math.floor(id / set.cols) * (set.tileH + set.spacing);
          ctx.drawImage(set.img, sx, sy, set.tileW, set.tileH, c * ts, r * ts, set.tileW * set.scale, set.tileH * set.scale);
        }
      }
    }
    ctx.restore();
  }
}
