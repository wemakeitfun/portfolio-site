import * as THREE from 'three';

// Shared materials (grip + plywood edge + hardware) and per-deck graphic materials.

function canvasTexture(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function gripTextures() {
  // fine grit noise — used as a bump map and to break up roughness
  const bump = canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const g = Math.random();
      const v = g > 0.82 ? 255 : g * 140; // sparse sharp grains over soft noise
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, false);
  const color = canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 18 + Math.random() * 16;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  return { bump, color };
}

function plyTexture(cfg, colors) {
  return canvasTexture(1024, 128, (ctx, w, h) => {
    const n = cfg.plies;
    const light = new THREE.Color(colors.plyLight), dark = new THREE.Color(colors.plyDark);
    for (let p = 0; p < n; p++) {
      // v = 0 is the bottom of the deck; canvas y = 0 is the top of the texture (v = 1)
      const y0 = h - ((p + 1) / n) * h, y1 = h - (p / n) * h;
      const base = p % 2 === 0 ? light : dark;
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
        for (let x = 0; x < w; x += 2) {
          // long wood grain streaks
          const grain = Math.sin(x * 0.02 + Math.sin(y * 0.9 + p * 3) * 2 + p * 11) * 0.06 + (Math.random() - 0.5) * 0.05;
          const c = base.clone().offsetHSL(0, 0, grain);
          ctx.fillStyle = `#${c.getHexString()}`;
          ctx.fillRect(x, y, 2, 1);
        }
      }
      // thin glue line between plies
      ctx.fillStyle = 'rgba(40,20,8,0.45)';
      ctx.fillRect(0, Math.round(y0), w, 1);
    }
  });
}

export function createSharedMaterials(cfg, colors, renderer) {
  const grip = gripTextures();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  grip.bump.anisotropy = grip.color.anisotropy = maxAniso;
  const ply = plyTexture(cfg, colors);
  ply.anisotropy = maxAniso;

  return {
    grip: new THREE.MeshStandardMaterial({
      color: colors.grip,
      map: grip.color,
      bumpMap: grip.bump,
      bumpScale: 1.2,
      roughness: 0.96,
      metalness: 0,
    }),
    ply: new THREE.MeshStandardMaterial({ map: ply, roughness: 0.62, metalness: 0 }),
    boltHead: new THREE.MeshStandardMaterial({ color: colors.hardware, roughness: 0.35, metalness: 0.85 }),
    boltHole: new THREE.MeshBasicMaterial({ color: 0x0a0a0a }),
  };
}

const loader = new THREE.TextureLoader();

// Fit the image like CSS `object-fit: cover`: never stretch, crop the overflow evenly.
function coverFit(tex, deckAspect) {
  const imgAspect = tex.image.width / tex.image.height;
  tex.repeat.set(1, 1);
  tex.offset.set(0, 0);
  if (imgAspect > deckAspect) tex.repeat.x = deckAspect / imgAspect;
  else tex.repeat.y = imgAspect / deckAspect;
  tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
}

export function createGraphicMaterial(url, renderer, deckAspect) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
  });
  loader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    coverFit(tex, deckAspect);
    mat.map = tex;
    mat.needsUpdate = true;
  });
  return mat;
}
