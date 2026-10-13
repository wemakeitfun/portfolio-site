import * as THREE from 'three';
import { tinDimensions, sweep, bodyProfile, liftProfile, lidTopProfile, labelGeometry } from './geometry.js';
import { labelTexture, wrapTexture } from './textures.js';

// Builds tins. Geometry and the lid materials are shared; each flavour gets
// its own label and side-band materials.
export class TinFactory {
  constructor(config, renderer) {
    this.config = config;
    this.renderer = renderer;
    const cfg = config.tin;
    this.dim = tinDimensions(cfg);
    const body = sweep(this.dim, bodyProfile(cfg, this.dim, cfg.profileSegments), cfg.pathSegments);
    this.bodyLength = body.length;
    this.geo = {
      body: body.geometry,
      liftTop: sweep(this.dim, liftProfile(cfg, this.dim, 1), cfg.pathSegments).geometry,
      liftBottom: sweep(this.dim, liftProfile(cfg, this.dim, -1), cfg.pathSegments).geometry,
      lidTop: sweep(this.dim, lidTopProfile(cfg, this.dim, 1), cfg.pathSegments).geometry,
      lidBottom: sweep(this.dim, lidTopProfile(cfg, this.dim, -1), cfg.pathSegments).geometry,
      label: labelGeometry(cfg, this.dim),
    };

    this.lidMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdddbde, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.3,
    });
    // the angled lift between sleeve and lid reads as a soft grey band in the renders
    this.liftMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb9afb4, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3,
    });
  }

  async create(flavour) {
    const { config, renderer, geo } = this;
    const cfg = config.tin;
    const [front, back] = await Promise.all([
      labelTexture(flavour.art.front, flavour.colors.label, renderer),
      labelTexture(flavour.art.back, flavour.colors.label, renderer),
    ]);
    const wrap = wrapTexture({
      dim: this.dim, lengthMm: this.dim.outlineLength, heightMm: this.bodyLength, colors: flavour.colors, wrap: config.wrap,
    }, renderer);

    // shrink film: glossy, with the print under a clear layer
    const film = new THREE.MeshPhysicalMaterial({
      map: wrap, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.14,
    });
    // paper label: a soft sheen that keeps the art's colours true
    // polygon offset always draws the label in front of the white lid it sits on,
    // so the two never fight over depth (that showed as flicker from far away)
    const label = (map) => new THREE.MeshPhysicalMaterial({
      map, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.35,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });

    const group = new THREE.Group();
    group.name = flavour.id;
    const add = (g, m) => { const mesh = new THREE.Mesh(g, m); group.add(mesh); return mesh; };
    add(geo.body, film);
    add(geo.liftTop, this.liftMaterial);
    add(geo.liftBottom, this.liftMaterial);
    add(geo.lidTop, this.lidMaterial);
    add(geo.lidBottom, this.lidMaterial);
    const top = cfg.height / 2 + 0.05; // sits flush on the flat panel (visually)
    add(geo.label, label(front)).position.z = top;
    const base = add(geo.label, label(back));
    base.position.z = -top;
    base.rotation.y = Math.PI; // flip over like turning a page, so the back reads upright
    return group;
  }
}
