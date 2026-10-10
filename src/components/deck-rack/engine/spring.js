// Damped spring. Underdamped settings give the physical overshoot; reduced motion
// callers pass a critically damped config instead.
export class Spring {
  constructor(value = 0) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }
  step(dt, stiffness, damping) {
    const h = 1 / 240;
    for (let t = 0; t < dt; t += h) {
      const s = Math.min(h, dt - t);
      const a = -stiffness * (this.value - this.target) - damping * this.velocity;
      this.velocity += a * s;
      this.value += this.velocity * s;
    }
    return this.value;
  }
  snap(v) { this.value = this.target = v; this.velocity = 0; }
}
