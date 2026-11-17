// WebAudio-synthesized sound: no audio files, no network. Engine hum,
// two-tone sirens, gunshots, footsteps and a looping synthwave bassline are
// all oscillators and filtered noise built at runtime.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  /** Must be called from a user gesture at least once. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngineHum();
    this.startSiren();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  startEngineHum() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  /** speed 0..1 — engine pitch and loudness follow the car. */
  setEngine(speed, driving) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(48 + speed * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed * 0.05 : 0.0, t, 0.1);
  }

  startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    // Two-tone wail: alternate 700 / 950 Hz.
    let high = false;
    setInterval(() => {
      if (!this.sirenOsc || !this.ctx) return;
      high = !high;
      this.sirenOsc.frequency.setTargetAtTime(high ? 950 : 700, this.ctx.currentTime, 0.05);
    }, 420);
  }

  /** wanted 0..5 — siren fades in with the heat. */
  setSiren(stars) {
    if (!this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(stars > 0 ? 0.015 + stars * 0.008 : 0, this.ctx.currentTime, 0.3);
  }

  /** Short noise burst through a lowpass: a gunshot. */
  shot() {
    if (!this.ctx) return;
    const dur = 0.14;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  /** Soft thud for a punch or a car impact. */
  thud(strength = 1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3 * strength, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  /** Two-note chime when a mission pays out. */
  cash() {
    if (!this.ctx) return;
    [880, 1318].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      const t0 = this.ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    });
  }

  footstep() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.07);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  /** A slow synthwave loop: Am – F – C – G pads over a pulsing bass. */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [
      [220.0, 261.6, 329.6], // Am
      [174.6, 220.0, 261.6], // F
      [261.6, 329.6, 392.0], // C
      [196.0, 246.9, 293.7], // G
    ];
    const bass = [55.0, 43.65, 65.41, 49.0];
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep++;
      const chord = chords[Math.floor(step / 4) % 4];
      const root = bass[Math.floor(step / 4) % 4];
      const t = this.ctx.currentTime;
      // Bass pulse on every step.
      const bOsc = this.ctx.createOscillator();
      bOsc.type = 'triangle';
      bOsc.frequency.value = root * 2;
      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.09, t);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      bOsc.connect(bGain).connect(this.master);
      bOsc.start(t);
      bOsc.stop(t + 0.5);
      // Pad note on the chord change.
      if (step % 4 === 0) {
        for (const freq of chord) {
          const o = this.ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = freq;
          const f = this.ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 900;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.02, t + 0.4);
          g.gain.linearRampToValueAtTime(0.0001, t + 1.9);
          o.connect(f).connect(g).connect(this.master);
          o.start(t);
          o.stop(t + 2.0);
        }
      }
    }, 500);
  }
}
