/**
 * Ink smear — big type that melts under the cursor and settles back.
 *
 * Two ping-pong buffers on a WebGL2 canvas:
 *   1. velocity: the pointer stamps its motion into a low-res field; it decays each step.
 *   2. ink: every step the previous frame is re-sampled along that velocity (with per-pixel
 *      noise scaled by speed, which gives the grainy spray) and eased back toward the clean text.
 *
 * The simulation runs at a fixed 60Hz regardless of display refresh rate, and stops
 * rendering entirely a few seconds after the pointer goes quiet.
 */

const STEP_MS = 1000 / 60;
const IDLE_MS = 4000;
const MAX_STEPS_PER_FRAME = 3;
const MAX_PIXELS = 4_500_000;

// Feel — tweak these.
const BRUSH_RADIUS = 0.3; // brush radius as a fraction of the text's cap height
const PUSH_GAIN = 3; // how far ink is thrown relative to how far the pointer moved
const VEL_DECAY = 0.94; // how quickly a push fades (per step); higher = longer streaks
const RELAX = 0.035; // how quickly ink returns to the clean text (per step)
const GRAIN = 1.2; // noise jitter, in multiples of the current push speed
const MAX_PUSH = 0.07; // clamp on a single step's push (fraction of canvas)
const VEL_RES_SCALE = 0.25; // velocity field resolution relative to the canvas
const REVEAL_RADIUS_SCALE = 1.4; // image mode: reveal brush size relative to the smear brush
const REVEAL_DECAY = 0.985; // image mode: how quickly the reveal fades back (per step)

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG_HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
`;

// Stamps the pointer's motion into the velocity field, then decays it.
const FRAG_VEL = `${FRAG_HEAD}
uniform sampler2D uVel;
uniform vec2 uRes;    // canvas size in px
uniform vec2 uFrom;   // pointer position last step, px (y up)
uniform vec2 uTo;     // pointer position this step, px (y up)
uniform vec2 uDelta;  // pointer movement this step, in uv
uniform float uRadius;
uniform float uDecay;
uniform float uActive;
uniform float uMaskRadius;
uniform float uMaskDecay;
void main() {
  vec4 prev = texture(uVel, vUv);
  vec2 v = prev.xy * uDecay;
  float m = prev.z * uMaskDecay;
  if (uActive > 0.5) {
    vec2 p = vUv * uRes;
    vec2 ab = uTo - uFrom;
    float t = clamp(dot(p - uFrom, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float d = length(p - (uFrom + ab * t));
    float w = exp(-(d * d) / (uRadius * uRadius));
    v = mix(v, uDelta, w);
    float wm = exp(-(d * d) / (uMaskRadius * uMaskRadius));
    m = max(m, wm);
  }
  vec2 px = v * uRes;
  if (dot(px, px) < 0.0004) v = vec2(0.0); // under 0.02px: call it still
  outColor = vec4(v, m, 1.0);
}`;

// Drags last frame's ink along the velocity field, then eases toward the original.
const FRAG_INK = `${FRAG_HEAD}
uniform sampler2D uInk;
uniform sampler2D uOrig;
uniform sampler2D uVel;
uniform vec2 uRes;
uniform float uFrame;
uniform float uRelax;
uniform float uGrain;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 vel = texture(uVel, vUv).xy;
  float speed = length(vel * uRes); // px moved this step
  vec2 n = vec2(
    hash12(gl_FragCoord.xy + uFrame * vec2(17.0, 31.0)),
    hash12(gl_FragCoord.yx * 1.37 + uFrame * vec2(53.0, 7.0))
  ) - 0.5;
  vec2 src = vUv - vel + n * speed * uGrain / uRes;

  vec4 orig = texture(uOrig, vUv);
  vec4 c = mix(texture(uInk, src), orig, uRelax);
  // half floats stall just short of the target; snap the last few levels
  if (all(lessThan(abs(c.rgb - orig.rgb), vec3(0.012)))) c = orig;
  outColor = vec4(c.rgb, 1.0);
}`;

const FRAG_SHOW = `${FRAG_HEAD}
uniform sampler2D uTex;
void main() {
  outColor = vec4(texture(uTex, vUv).rgb, 1.0);
}`;

// Cross-fades from the (smeared) base image to the reveal image where the pointer has been.
const FRAG_REVEAL = `${FRAG_HEAD}
uniform sampler2D uTex;
uniform sampler2D uReveal;
uniform sampler2D uVel;
uniform vec2 uRes;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  float m = texture(uVel, vUv).z;
  m = smoothstep(0.12, 0.4, m + (hash12(gl_FragCoord.xy) - 0.5) * 0.18 * smoothstep(0.0, 0.12, m));
  vec3 base = texture(uTex, vUv).rgb;
  vec3 rev = texture(uReveal, vUv).rgb;
  outColor = vec4(mix(base, rev, m), 1.0);
}`;

export interface InkSmearOptions {
  /** Text to render. Landscape screens get one line; portrait screens stack one word per line. */
  text?: string;
  /** CSS font-family value for the canvas (must already be loaded or loadable). */
  font?: string;
  /** CSS colors. */
  ink?: string;
  paper?: string;
  /** Text mode only: if given, cycles to the next one each time a new smear gesture starts. */
  treatments?: { ink: string; mode?: "fill" | "outline" }[];
  /** Image mode: `base` smears under the cursor and `reveal` shows through where the cursor has been. */
  image?: {
    base: string;
    reveal: string;
    /**
     * Extra images to keep randomly cycling to (shuffle-bag: every image in
     * `[reveal, ...pool]` shown once before any repeat) each time a real
     * smear fully reveals the current one. Omit for the simple, one-time
     * two-image reveal (no cycling).
     */
    pool?: string[];
    /** 0 = keep the top when cropping, 1 = keep the bottom. */
    focusY?: number;
    /** Baked onto `base` (not `reveal`), so smearing this spot fades the text away to the reveal image. */
    text?: { value: string; font: string; color: string; /** Fraction of the frame width. */ fill?: number };
  };
  /** Fraction of the canvas width the widest line may fill. */
  fill?: number;
  signal?: AbortSignal;
}

export interface InkSmear {
  destroy(): void;
}

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
}

interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

export async function createInkSmear(
  canvas: HTMLCanvasElement,
  opts: InkSmearOptions,
): Promise<InkSmear | null> {
  const fill = opts.fill ?? 0.88;

  // Text can only be measured once the webfont is in.
  // Index 0 is always `base`; index 1 is `reveal`; any further indices are
  // `pool`, all treated as equally eligible once the shuffle-bag cycle starts.
  let allImages: HTMLImageElement[] | null = null;
  if (opts.image) {
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`couldn't load ${src}`));
        img.src = src;
      });
    try {
      allImages = await Promise.all(
        [opts.image.base, opts.image.reveal, ...(opts.image.pool ?? [])].map(load),
      );
    } catch (err) {
      console.warn("[ink-smear] image load failed:", err);
      return null;
    }
    const t = opts.image.text;
    if (t) {
      await Promise.race([
        document.fonts.load(`100px ${t.font}`, t.value).catch(() => undefined),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    }
  } else {
    await Promise.race([
      document.fonts.load(`100px ${opts.font}`, opts.text).catch(() => undefined),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  }
  if (opts.signal?.aborted) return null;

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;
  if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) {
    return null;
  }

  // ---- GL plumbing -------------------------------------------------------

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed");
    }
    return s;
  };

  const makeProgram = (frag: string, uniforms: string[]): Program => {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "program link failed");
    }
    const u: Program["u"] = {};
    for (const name of uniforms) u[name] = gl.getUniformLocation(prog, name);
    return { prog, u };
  };

  const setupTexture = (tex: WebGLTexture) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  const makeTarget = (w: number, h: number): Target => {
    const tex = gl.createTexture()!;
    setupTexture(tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("float framebuffer unsupported");
    }
    // texImage2D with null data leaves the contents undefined (not
    // guaranteed zero) — without this, the mask channel in a fresh `vel`
    // target can start as GPU-memory garbage instead of 0, silently leaking
    // a bit of the reveal image in even before any smearing happens.
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo };
  };

  const clearTarget = (t: Target, w: number, h: number) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  const freeTarget = (t: Target) => {
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
  };

  let progVel: Program, progInk: Program, progShow: Program, progReveal: Program;
  try {
    progVel = makeProgram(FRAG_VEL, [
      "uVel", "uRes", "uFrom", "uTo", "uDelta", "uRadius", "uDecay", "uActive", "uMaskRadius", "uMaskDecay",
    ]);
    progReveal = makeProgram(FRAG_REVEAL, ["uTex", "uReveal", "uVel", "uRes"]);
    progInk = makeProgram(FRAG_INK, ["uInk", "uOrig", "uVel", "uRes", "uFrame", "uRelax", "uGrain"]);
    progShow = makeProgram(FRAG_SHOW, ["uTex"]);
  } catch (err) {
    console.warn("[ink-smear] falling back to static text:", err);
    return null;
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const bind = (unit: number, tex: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  };

  const draw = (target: Target | null, w: number, h: number) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // ---- Text -> texture ----------------------------------------------------

  const textCanvas = document.createElement("canvas");
  const origTex = gl.createTexture()!;
  setupTexture(origTex);
  const revealCanvas = document.createElement("canvas");
  const revealTex = gl.createTexture()!;
  setupTexture(revealTex);

  const paintCover = (target: HTMLCanvasElement, img: HTMLImageElement, w: number, h: number) => {
    target.width = w;
    target.height = h;
    const ctx = target.getContext("2d")!;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) * (opts.image?.focusY ?? 0.3), dw, dh);
  };

  /** Paints the text onto textCanvas and returns the cap height in px. */
  const paintText = (w: number, h: number): number => {
    if (allImages) {
      paintCover(textCanvas, allImages[curBaseIdx], w, h);
      paintCover(revealCanvas, allImages[curRevealIdx], w, h);
      // Baked onto the base layer only — the reveal layer (X-ray) stays clean, so
      // smearing over the text fades it into the plain image underneath.
      const t = opts.image?.text;
      if (t) {
        const ctx = textCanvas.getContext("2d")!;
        const fill = t.fill ?? 0.5;
        const pad = w * 0.06;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = `100px ${t.font}`;
        const widest = ctx.measureText(t.value).width;
        const cap100 = ctx.measureText("H").actualBoundingBoxAscent;
        const size = Math.min((100 * (w - pad * 2) * fill) / widest, (100 * h * 0.14) / cap100);
        ctx.font = `${size}px ${t.font}`;
        const cap = cap100 * (size / 100);
        ctx.fillStyle = t.color;
        ctx.fillText(t.value, pad, h - pad - cap * 0.15);
      }
      return h * 0.45; // stands in for cap height: sets the brush size
    }
    const text = opts.text ?? "";
    const paper = opts.paper ?? "#000";
    const treatment = opts.treatments?.[treatmentIndex % opts.treatments.length];
    const inkColor = treatment?.ink ?? opts.ink ?? "#fff";
    const mode = treatment?.mode ?? "fill";
    const font = opts.font ?? "sans-serif";
    textCanvas.width = w;
    textCanvas.height = h;
    const ctx = textCanvas.getContext("2d")!;
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const lines = w / h < 0.85 ? text.split(/\s+/) : [text];
    ctx.font = `100px ${font}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const cap100 = ctx.measureText("H").actualBoundingBoxAscent;
    const gap100 = cap100 * 0.16;
    const stack100 = lines.length * cap100 + (lines.length - 1) * gap100;

    const size = Math.min((100 * w * fill) / widest, (100 * h * 0.7) / stack100);
    const k = size / 100;
    const cap = cap100 * k;
    const gap = gap100 * k;
    ctx.font = `${size}px ${font}`;

    const top = (h - (lines.length * cap + (lines.length - 1) * gap)) / 2;
    if (mode === "outline") {
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = Math.max(2, size * 0.045);
      lines.forEach((line, i) => ctx.strokeText(line, w / 2, top + cap * (i + 1) + gap * i));
    } else {
      ctx.fillStyle = inkColor;
      lines.forEach((line, i) => ctx.fillText(line, w / 2, top + cap * (i + 1) + gap * i));
    }
    return cap;
  };

  // ---- Sized resources ----------------------------------------------------

  let W = 0;
  let H = 0;
  let VW = 0;
  let VH = 0;
  let cap = 0;
  let treatmentIndex = 0;
  // Image-pool cycling: index 0 is always `base`; `curRevealIdx` starts as a
  // random pick among [reveal, ...pool] (so with no pool it's always 1, the
  // plain `reveal`) and the shuffle-bag keeps every image shown once before
  // any repeat.
  let curBaseIdx = 0;
  let curRevealIdx = -1;
  let bagQueue: number[] = [];
  let ink: [Target, Target];
  let vel: [Target, Target];
  let inkRead = 0;
  let velRead = 0;
  let lastKey = "";

  const allocate = () => {
    const rect = canvas.getBoundingClientRect();
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (rect.width * rect.height * dpr * dpr > MAX_PIXELS) {
      dpr = Math.sqrt(MAX_PIXELS / (rect.width * rect.height));
    }
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));
    const key = `${w}x${h}`;
    if (key === lastKey) return false;
    lastKey = key;

    if (allImages && curRevealIdx === -1) {
      curRevealIdx = 1 + Math.floor(Math.random() * (allImages.length - 1));
    }

    if (ink) [...ink, ...vel].forEach(freeTarget);
    W = canvas.width = w;
    H = canvas.height = h;
    cap = paintText(w, h);

    gl.bindTexture(gl.TEXTURE_2D, origTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    if (allImages) {
      gl.bindTexture(gl.TEXTURE_2D, revealTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, revealCanvas);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    ink = [makeTarget(w, h), makeTarget(w, h)];
    VW = Math.max(2, Math.round(w * VEL_RES_SCALE));
    VH = Math.max(2, Math.round(h * VEL_RES_SCALE));
    vel = [makeTarget(VW, VH), makeTarget(VW, VH)];
    inkRead = 0;
    velRead = 0;

    // Seed both ink buffers with the clean text.
    gl.useProgram(progShow.prog);
    gl.uniform1i(progShow.u.uTex, 0);
    bind(0, origTex);
    draw(ink[0], w, h);
    draw(ink[1], w, h);
    return true;
  };

  try {
    allocate();
  } catch (err) {
    console.warn("[ink-smear] falling back to static text:", err);
    return null;
  }

  let destroyed = false;

  // The initial paint above raced the webfont against a timeout so a slow
  // connection can't block first paint forever — but if that race was lost,
  // the canvas is now showing a fallback font with no way to notice or
  // correct itself. Once the real font actually finishes loading (even if
  // that's well after first paint), repaint the text with it for real.
  const repaintText = () => {
    if (destroyed) return;
    cap = paintText(W, H);
    gl.bindTexture(gl.TEXTURE_2D, origTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    // Reseed both ink buffers, or the old (wrong-font) ink would only slowly
    // relax into the corrected text over the next several seconds of RELAX.
    gl.useProgram(progShow.prog);
    gl.uniform1i(progShow.u.uTex, 0);
    bind(0, origTex);
    draw(ink[0], W, H);
    draw(ink[1], W, H);
    present();
  };
  if (!opts.image) {
    document.fonts.load(`100px ${opts.font}`, opts.text).then(repaintText).catch(() => undefined);
  } else if (opts.image.text) {
    const t = opts.image.text;
    document.fonts.load(`100px ${t.font}`, t.value).then(repaintText).catch(() => undefined);
  }

  // Image-pool cycling: the just-revealed image becomes the new base, a new
  // reveal target is drawn from a shuffle bag (every image shown once before
  // any repeat), and the wipe mask resets so the pairing starts unsmeared.
  const advanceImageCycle = () => {
    if (destroyed || !allImages) return;
    curBaseIdx = curRevealIdx;
    if (bagQueue.length === 0) {
      bagQueue = allImages.map((_, i) => i).filter((i) => i !== curBaseIdx);
      for (let i = bagQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bagQueue[i], bagQueue[j]] = [bagQueue[j], bagQueue[i]];
      }
    }
    curRevealIdx = bagQueue.shift()!;

    cap = paintText(W, H);
    gl.bindTexture(gl.TEXTURE_2D, origTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    gl.bindTexture(gl.TEXTURE_2D, revealTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, revealCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    // Zero the velocity/mask buffers so the new pairing starts fully unsmeared.
    for (const t of vel) clearTarget(t, VW, VH);

    // Reseed both ink buffers with the new base.
    gl.useProgram(progShow.prog);
    gl.uniform1i(progShow.u.uTex, 0);
    bind(0, origTex);
    draw(ink[0], W, H);
    draw(ink[1], W, H);
    present();
  };

  // ---- Simulation ----------------------------------------------------------

  const pointer = { x: 0, y: 0, has: false };
  const prev = { x: 0, y: 0, has: false };
  let frame = 0;
  // Cumulative cursor travel this gesture — advancing the treatment on mere
  // cursor entry made it change from just passing over the text, not smearing
  // it. Only a real smear (enough accumulated distance) should count.
  let smearDistance = 0;
  let treatmentAdvancedThisGesture = false;

  const simulate = () => {
    const dx = pointer.x - prev.x;
    const dy = pointer.y - prev.y;
    const moving = pointer.has && prev.has && dx * dx + dy * dy > 0.01;

    const hasTreatments = !!opts.treatments && opts.treatments.length > 0;
    const hasImagePool = !!opts.image?.pool && opts.image.pool.length > 0;
    if (moving && !treatmentAdvancedThisGesture && (hasTreatments || hasImagePool)) {
      smearDistance += Math.hypot(dx, dy);
      if (smearDistance > Math.max(60, cap * 1.2)) {
        treatmentAdvancedThisGesture = true;
        if (hasTreatments) {
          treatmentIndex = (treatmentIndex + 1) % opts.treatments!.length;
          repaintText();
        } else {
          advanceImageCycle();
        }
      }
    }

    // velocity pass
    gl.useProgram(progVel.prog);
    const v = progVel.u;
    gl.uniform1i(v.uVel, 0);
    gl.uniform2f(v.uRes, W, H);
    gl.uniform2f(v.uFrom, prev.x, prev.y);
    gl.uniform2f(v.uTo, pointer.x, pointer.y);
    let ux = (dx / W) * PUSH_GAIN;
    let uy = (dy / H) * PUSH_GAIN;
    const mag = Math.hypot(ux, uy);
    if (mag > MAX_PUSH) {
      ux *= MAX_PUSH / mag;
      uy *= MAX_PUSH / mag;
    }
    gl.uniform2f(v.uDelta, ux, uy);
    gl.uniform1f(v.uRadius, Math.max(24, cap * BRUSH_RADIUS));
    gl.uniform1f(v.uDecay, VEL_DECAY);
    gl.uniform1f(v.uActive, moving ? 1 : 0);
    gl.uniform1f(v.uMaskRadius, Math.max(24, cap * BRUSH_RADIUS * REVEAL_RADIUS_SCALE));
    gl.uniform1f(v.uMaskDecay, REVEAL_DECAY);
    bind(0, vel[velRead].tex);
    draw(vel[1 - velRead], VW, VH);
    velRead = 1 - velRead;

    // ink pass
    gl.useProgram(progInk.prog);
    const k = progInk.u;
    gl.uniform1i(k.uInk, 0);
    gl.uniform1i(k.uOrig, 1);
    gl.uniform1i(k.uVel, 2);
    gl.uniform2f(k.uRes, W, H);
    gl.uniform1f(k.uFrame, frame++ % 4096);
    gl.uniform1f(k.uRelax, RELAX);
    gl.uniform1f(k.uGrain, GRAIN);
    bind(0, ink[inkRead].tex);
    bind(1, origTex);
    bind(2, vel[velRead].tex);
    draw(ink[1 - inkRead], W, H);
    inkRead = 1 - inkRead;

    prev.x = pointer.x;
    prev.y = pointer.y;
    prev.has = pointer.has;
  };

  const present = () => {
    if (allImages) {
      gl.useProgram(progReveal.prog);
      gl.uniform1i(progReveal.u.uTex, 0);
      gl.uniform1i(progReveal.u.uReveal, 1);
      gl.uniform1i(progReveal.u.uVel, 2);
      gl.uniform2f(progReveal.u.uRes, W, H);
      bind(0, ink[inkRead].tex);
      bind(1, revealTex);
      bind(2, vel[velRead].tex);
      draw(null, W, H);
      return;
    }
    gl.useProgram(progShow.prog);
    gl.uniform1i(progShow.u.uTex, 0);
    bind(0, ink[inkRead].tex);
    draw(null, W, H);
  };

  // ---- Loop (runs only while there's something to animate) -----------------

  let raf = 0;
  let running = false;
  let lastTime = 0;
  let acc = 0;
  let lastActivity = 0;

  const tick = (now: number) => {
    raf = 0;
    if (destroyed) return;
    acc += Math.min(now - lastTime, 100);
    lastTime = now;

    let steps = 0;
    while (acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      simulate();
      acc -= STEP_MS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) acc = 0;
    if (steps > 0) present();

    if (now - lastActivity < IDLE_MS) {
      raf = requestAnimationFrame(tick);
    } else {
      running = false;
      smearDistance = 0;
      treatmentAdvancedThisGesture = false;
    }
  };

  const wake = () => {
    lastActivity = performance.now();
    if (running) return;
    running = true;
    lastTime = lastActivity;
    acc = 0;
    raf = requestAnimationFrame(tick);
  };

  // ---- Input ---------------------------------------------------------------

  const toCanvas = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * W;
    pointer.y = (1 - (e.clientY - r.top) / r.height) * H; // GL y is up
  };

  const onMove = (e: PointerEvent) => {
    toCanvas(e);
    if (!pointer.has) {
      pointer.has = true;
      prev.x = pointer.x;
      prev.y = pointer.y;
      prev.has = true;
    }
    wake();
  };

  const onLeave = () => {
    pointer.has = false;
    prev.has = false;
  };

  const onResize = () => {
    if (destroyed) return;
    try {
      if (allocate()) {
        present();
        wake(); // let the loop settle, then idle out
      }
    } catch (err) {
      console.warn("[ink-smear] resize failed:", err);
    }
  };

  const onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    running = false;
  };

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointercancel", onLeave);
  canvas.addEventListener("webglcontextlost", onContextLost);
  const ro = new ResizeObserver(onResize);
  ro.observe(canvas);
  window.addEventListener("resize", onResize);

  present();

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointercancel", onLeave);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      [...ink, ...vel].forEach(freeTarget);
      gl.deleteTexture(origTex);
      gl.deleteTexture(revealTex);
      [progVel, progInk, progShow, progReveal].forEach((p) => gl.deleteProgram(p.prog));
      gl.deleteVertexArray(vao);
    },
  };
}
