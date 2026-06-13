// All sound effects are synthesized with Web Audio — no asset files.
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }

  // Must be called from a user gesture (click) before any sound plays.
  unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 8;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(comp);

      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get t() { return this.ctx.currentTime; }

  noise({ dur = 0.1, vol = 0.5, type = 'bandpass', freq = 1500, q = 1, sweepTo = null }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, this.t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, this.t + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.t);
    gain.gain.exponentialRampToValueAtTime(0.001, this.t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    src.stop(this.t + dur + 0.02);
  }

  tone({ dur = 0.15, vol = 0.3, type = 'sine', from = 440, to = null, delay = 0 }) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    const t0 = this.t + delay;
    osc.frequency.setValueAtTime(from, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  ready() { return !!this.ctx; }

  shot(weapon) {
    if (!this.ready()) return;
    if (weapon === 'SHOTGUN') {
      this.noise({ dur: 0.28, vol: 0.9, type: 'lowpass', freq: 1400, sweepTo: 220 });
      this.tone({ dur: 0.18, vol: 0.55, type: 'sine', from: 110, to: 38 });
    } else if (weapon === 'RIPPER') {
      this.noise({ dur: 0.07, vol: 0.4, type: 'bandpass', freq: 2400, sweepTo: 900, q: 1.2 });
      this.tone({ dur: 0.06, vol: 0.25, type: 'square', from: 220, to: 90 });
    } else {
      this.noise({ dur: 0.11, vol: 0.55, type: 'bandpass', freq: 1900, sweepTo: 500, q: 1.1 });
      this.tone({ dur: 0.1, vol: 0.35, type: 'sine', from: 170, to: 55 });
    }
  }

  dryFire() {
    if (!this.ready()) return;
    this.noise({ dur: 0.04, vol: 0.25, type: 'highpass', freq: 2500 });
  }

  switchWeapon() {
    if (!this.ready()) return;
    this.noise({ dur: 0.05, vol: 0.3, type: 'highpass', freq: 1800 });
    this.tone({ dur: 0.05, vol: 0.12, type: 'square', from: 320, delay: 0.04 });
  }

  enemyHit() {
    if (!this.ready()) return;
    this.tone({ dur: 0.07, vol: 0.28, type: 'square', from: 240, to: 130 });
  }

  enemyDie() {
    if (!this.ready()) return;
    this.tone({ dur: 0.4, vol: 0.4, type: 'sawtooth', from: 160, to: 32 });
    this.noise({ dur: 0.3, vol: 0.35, type: 'lowpass', freq: 900, sweepTo: 150 });
  }

  spit() {
    if (!this.ready()) return;
    this.tone({ dur: 0.18, vol: 0.2, type: 'sawtooth', from: 320, to: 620 });
  }

  hurt() {
    if (!this.ready()) return;
    this.tone({ dur: 0.22, vol: 0.45, type: 'square', from: 190, to: 70 });
    this.noise({ dur: 0.15, vol: 0.3, type: 'lowpass', freq: 700 });
  }

  pickup(kind) {
    if (!this.ready()) return;
    if (kind === 'weapon') {
      this.tone({ dur: 0.1, vol: 0.32, type: 'triangle', from: 380 });
      this.tone({ dur: 0.14, vol: 0.32, type: 'triangle', from: 640, delay: 0.09 });
      this.noise({ dur: 0.08, vol: 0.2, type: 'highpass', freq: 1800 });
      return;
    }
    if (kind === 'sentry') {
      this.tone({ dur: 0.1, vol: 0.28, type: 'square', from: 300 });
      this.tone({ dur: 0.12, vol: 0.28, type: 'square', from: 450, delay: 0.08 });
      return;
    }
    const base = kind === 'health' ? 520 : 420;
    this.tone({ dur: 0.09, vol: 0.25, type: 'triangle', from: base });
    this.tone({ dur: 0.12, vol: 0.25, type: 'triangle', from: base * 1.5, delay: 0.08 });
  }

  reload() {
    if (!this.ready()) return;
    this.noise({ dur: 0.05, vol: 0.3, type: 'highpass', freq: 1500 });      // mag out
    this.tone({ dur: 0.05, vol: 0.18, type: 'square', from: 150, delay: 0.55 }); // mag in
    this.noise({ dur: 0.05, vol: 0.28, type: 'highpass', freq: 1900, q: 1.4 });
    this.tone({ dur: 0.06, vol: 0.2, type: 'square', from: 260, delay: 1.2 });   // charge
  }

  sentryDeploy() {
    if (!this.ready()) return;
    this.tone({ dur: 0.2, vol: 0.3, type: 'square', from: 200, to: 540 });
    this.noise({ dur: 0.12, vol: 0.2, type: 'bandpass', freq: 900 });
  }

  sentryShot() {
    if (!this.ready()) return;
    this.noise({ dur: 0.05, vol: 0.16, type: 'bandpass', freq: 3000, sweepTo: 1500, q: 1.5 });
  }

  sentryDown() {
    if (!this.ready()) return;
    this.tone({ dur: 0.5, vol: 0.35, type: 'sawtooth', from: 300, to: 38 });
    this.noise({ dur: 0.4, vol: 0.3, type: 'lowpass', freq: 1200, sweepTo: 200 });
  }

  dash() {
    if (!this.ready()) return;
    this.noise({ dur: 0.22, vol: 0.35, type: 'highpass', freq: 300, sweepTo: 2400 });
  }

  waveHorn() {
    if (!this.ready()) return;
    this.tone({ dur: 0.9, vol: 0.3, type: 'sawtooth', from: 98, to: 110 });
    this.tone({ dur: 0.9, vol: 0.3, type: 'sawtooth', from: 147, to: 165, delay: 0.05 });
    this.noise({ dur: 0.8, vol: 0.12, type: 'lowpass', freq: 500 });
  }

  gameOver() {
    if (!this.ready()) return;
    this.tone({ dur: 1.4, vol: 0.4, type: 'sawtooth', from: 120, to: 28 });
    this.tone({ dur: 1.4, vol: 0.3, type: 'square', from: 80, to: 24, delay: 0.1 });
  }
}
