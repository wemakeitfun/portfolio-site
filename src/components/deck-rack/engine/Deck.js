import * as THREE from 'three';
import { createDeckGeometry, createHardwareGeometry } from './geometry.js';
import { createSharedMaterials, createGraphicMaterial } from './materials.js';

// Builds the shared geometry/materials once; each Deck only owns its graphic material.
export class DeckFactory {
  constructor(config, renderer) {
    this.config = config;
    this.renderer = renderer;
    const { geometry, shape } = createDeckGeometry(config.deck);
    this.geometry = geometry;
    this.shape = shape;
    this.hardware = createHardwareGeometry(config.deck, shape);
    this.materials = createSharedMaterials(config.deck, config.colors, renderer);
    this.graphics = [];
  }

  // Free GPU memory (geometry, textures, materials) when the rack unmounts.
  dispose() {
    this.geometry.dispose();
    this.hardware.heads.dispose();
    this.hardware.holes.dispose();
    for (const m of [...Object.values(this.materials), ...this.graphics]) {
      for (const key of ['map', 'bumpMap']) m[key]?.dispose();
      m.dispose();
    }
  }

  create(product) {
    const m = this.materials;
    const graphic = createGraphicMaterial(product.graphic, this.renderer, this.shape.W / this.shape.L);
    this.graphics.push(graphic);
    const mesh = new THREE.Mesh(this.geometry, [m.grip, graphic, m.ply]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Center the deck on its thickness so rotations pivot around the middle.
    const inner = new THREE.Group();
    inner.position.y = -this.shape.T / 2;
    inner.add(mesh);
    if (this.config.deck.showHardware) {
      const heads = new THREE.Mesh(this.hardware.heads, m.boltHead);
      heads.castShadow = true;
      inner.add(heads);
    }
    inner.add(new THREE.Mesh(this.hardware.holes, m.boltHole));

    const root = new THREE.Group();
    root.add(inner);
    root.userData.product = product;
    root.userData.mesh = mesh;
    return root;
  }
}

// Upright, nose up, graphic facing the camera (local X → up, local Y → away from viewer).
export const UPRIGHT = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)),
);
