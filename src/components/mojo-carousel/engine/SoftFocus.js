import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Soft focus for the tins that aren't in the centre, like a shallow depth of field.
// Each frame the tins are drawn into a mask where every pixel holds that tin's blur
// amount (0 = sharp). The composite pass then blurs the image by that amount, reading
// the mask over a wider area so a soft tin's edges spread into the backdrop instead of
// staying cut out. The backdrop itself never blurs.

const LAYER = 1; // tins render on this layer as well, so the mask pass can draw them alone

const maskMaterial = new THREE.ShaderMaterial({
  uniforms: { uBlur: { value: 0 } },
  vertexShader: /* glsl */ `
    void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform float uBlur;
    void main() { gl_FragColor = vec4(uBlur, 0.0, 0.0, 1.0); }
  `,
});

const compositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tMask: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uMaxRadius: { value: 8 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tMask;
    uniform vec2 uResolution;
    uniform float uMaxRadius;
    varying vec2 vUv;
    const int TAPS = 28;
    // golden-angle spiral: evenly spread sample points over the unit disc
    vec2 tap(int i) {
      float r = sqrt((float(i) + 0.5) / float(TAPS));
      float a = float(i) * 2.39996323;
      return vec2(cos(a), sin(a)) * r;
    }
    void main() {
      vec2 px = 1.0 / uResolution;
      // how soft this pixel should be: the strongest nearby tin, fading with distance,
      // so blur spreads past a soft tin's silhouette
      float m = texture2D(tMask, vUv).r;
      for (int i = 0; i < TAPS; i++) {
        vec2 o = tap(i);
        m = max(m, texture2D(tMask, vUv + o * uMaxRadius * px).r * (1.0 - length(o) * 0.6));
      }
      float radius = m * uMaxRadius;
      vec4 base = texture2D(tDiffuse, vUv);
      if (radius < 0.35) { gl_FragColor = base; return; }
      vec4 sum = base;
      for (int i = 0; i < TAPS; i++) sum += texture2D(tDiffuse, vUv + tap(i) * radius * px);
      gl_FragColor = sum / float(TAPS + 1);
    }
  `,
};

export class SoftFocus {
  constructor({ renderer, scene, camera, items, maxRadius = 8 }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.items = items;
    this.mask = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.pass = new ShaderPass(compositeShader);
    this.pass.uniforms.tMask.value = this.mask.texture;
    this.maxRadius = maxRadius;

    // every tin mesh joins the mask layer and hands the mask material its blur amount
    for (const it of items) {
      it.tin.traverse((m) => {
        if (!m.isMesh) return;
        m.layers.enable(LAYER);
        m.onBeforeRender = (r, s, c, g, material) => {
          if (material !== maskMaterial) return;
          maskMaterial.uniforms.uBlur.value = it.blur ?? 0;
          maskMaterial.uniformsNeedUpdate = true;
        };
      });
    }
  }

  setSize(width, height, pixelRatio) {
    this.mask.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
    this.pass.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    this.pass.uniforms.uMaxRadius.value = this.maxRadius * pixelRatio;
  }

  // draw the blur mask; call once per frame before the composer renders
  update() {
    const { renderer, scene, camera } = this;
    const prevTarget = renderer.getRenderTarget();
    const prevOverride = scene.overrideMaterial;
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    const prevShadows = renderer.shadowMap.autoUpdate;

    camera.layers.set(LAYER);
    scene.overrideMaterial = maskMaterial;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.mask);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);

    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.shadowMap.autoUpdate = prevShadows;
    scene.overrideMaterial = prevOverride;
    camera.layers.set(0);
  }
}
