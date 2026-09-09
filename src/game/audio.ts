/**
 * Tiny WebAudio synth for game SFX — zero assets, all procedural.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private last: Record<string, number> = {};

  ensure() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private throttle(key: string, ms: number): boolean {
    const t = performance.now();
    if (this.last[key] && t - this.last[key] < ms) return true;
    this.last[key] = t;
    return false;
  }

  private tone(
    f: number,
    opts: { d?: number; type?: OscillatorType; g?: number; slide?: number; delay?: number } = {}
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const { d = 0.1, type = "sine", g = 0.15, slide, delay = 0 } = opts;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const gn = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t0 + d);
    gn.gain.setValueAtTime(g, t0);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(gn);
    gn.connect(this.master);
    o.start(t0);
    o.stop(t0 + d + 0.03);
  }

  private noise(d: number, opts: { g?: number; f?: number; q?: number; delay?: number } = {}) {
    if (!this.ctx || !this.master || this.muted) return;
    const { g = 0.2, f = 1200, q = 1, delay = 0 } = opts;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * d));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const fl = this.ctx.createBiquadFilter();
    fl.type = "bandpass";
    fl.frequency.value = f;
    fl.Q.value = q;
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(g, t0);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(fl);
    fl.connect(gn);
    gn.connect(this.master);
    src.start(t0);
  }

  shoot() {
    if (this.throttle("shoot", 45)) return;
    this.noise(0.07, { g: 0.15, f: 950, q: 0.6 });
    this.tone(190, { d: 0.055, type: "square", g: 0.045, slide: 70 });
  }
  zhit() {
    if (this.throttle("zhit", 60)) return;
    this.noise(0.05, { g: 0.1, f: 480, q: 1.4 });
  }
  zdie() {
    if (this.throttle("zdie", 70)) return;
    this.tone(88, { d: 0.17, type: "sawtooth", g: 0.09, slide: 38 });
    this.noise(0.11, { g: 0.08, f: 300, q: 1 });
  }
  hurt() {
    this.tone(140, { d: 0.2, type: "sawtooth", g: 0.16, slide: 60 });
    this.noise(0.14, { g: 0.1, f: 250 });
  }
  gem() {
    if (this.throttle("gem", 55)) return;
    this.tone(660 + Math.random() * 240, { d: 0.07, type: "triangle", g: 0.045, slide: 1080 });
  }
  levelup() {
    [440, 554, 659, 880].forEach((f, i) =>
      this.tone(f, { d: 0.16, type: "triangle", g: 0.11, delay: i * 0.07 })
    );
  }
  upgrade() {
    this.tone(520, { d: 0.12, type: "triangle", g: 0.11, slide: 800 });
    this.tone(780, { d: 0.14, type: "triangle", g: 0.07, slide: 1040, delay: 0.08 });
  }
  wave() {
    this.tone(64, { d: 0.5, type: "sawtooth", g: 0.17, slide: 44 });
    this.noise(0.4, { g: 0.07, f: 130, q: 0.8 });
  }
  click() {
    this.tone(340, { d: 0.05, type: "square", g: 0.05 });
  }
  die() {
    this.tone(160, { d: 0.9, type: "sawtooth", g: 0.18, slide: 30 });
    this.noise(0.7, { g: 0.12, f: 200, q: 0.7 });
  }
  dash() {
    if (this.throttle("dash", 120)) return;
    this.noise(0.15, { g: 0.08, f: 1800, q: 0.8 });
  }
  /** magazine out / click */
  reloadStart() {
    this.noise(0.06, { g: 0.12, f: 2200, q: 2, delay: 0 });
    this.tone(320, { d: 0.06, type: "square", g: 0.05, slide: 180, delay: 0.02 });
  }
  /** magazine seated + slide rack */
  reloadEnd() {
    this.noise(0.07, { g: 0.14, f: 1500, q: 1.6 });
    this.tone(180, { d: 0.07, type: "square", g: 0.07, slide: 320, delay: 0.05 });
    this.noise(0.05, { g: 0.1, f: 2600, q: 2.2, delay: 0.09 });
  }
  /** dry fire on empty mag */
  dryFire() {
    if (this.throttle("dry", 260)) return;
    this.noise(0.04, { g: 0.09, f: 2800, q: 3 });
    this.tone(140, { d: 0.04, type: "square", g: 0.035 });
  }
  jump() {
    if (this.throttle("jump", 90)) return;
    this.tone(290, { d: 0.08, type: "sine", g: 0.045, slide: 470 });
  }
  spit() {
    if (this.throttle("spit", 100)) return;
    this.tone(235, { d: 0.1, type: "square", g: 0.035, slide: 120 });
  }
}
