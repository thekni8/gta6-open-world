// Every sound is synthesized with WebAudio — no audio files, no network.
// A sawtooth engine hum that follows the car's speed, a wailing two-tone
// siren, noise-burst gunshots, thuds, a cash chime, and a slow synthwave
// loop (Dm – Bb – F – C) built from oscillators at runtime.

const CHORDS = [
  { pad: [293.66, 349.23, 440.0], bass: 73.42 }, // Dm
  { pad: [233.08, 293.66, 349.23], bass: 58.27 }, // Bb
  { pad: [261.63, 329.63, 392.0], bass: 87.31 }, // F
  { pad: [261.63, 329.63, 392.0], bass: 65.41 }, // C
];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  /** Create the context on a user gesture; resume it if it was suspended. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.buildEngineLoop();
    this.buildSirenLoop();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  buildEngineLoop() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  /** speed 0..1 — pitch and loudness follow the car; silent on foot. */
  setEngine(speed, driving) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(46 + speed * 135, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.045 + speed * 0.05 : 0, t, 0.1);
  }

  buildSirenLoop() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 820;
    // An LFO swings the siren between its two tones — a wail, not a beep.
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 1.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 140;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  /** stars 0..5 — the siren fades in with the heat. */
  setSiren(stars) {
    if (!this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(
      stars > 0 ? 0.014 + stars * 0.007 : 0,
      this.ctx.currentTime,
      0.3,
    );
  }

  /** Noise burst through a lowpass: a gunshot. */
  shot() {
    if (!this.ctx) return;
    const dur = 0.13;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.32;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  /** Low sine thump for a punch, a crash, or a door slam. */
  thud(strength = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28 * strength, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /** Two-note chime when a mission pays out. */
  cash() {
    if (!this.ctx) return;
    [880, 1318.5].forEach((freq, i) => {
      const t0 = this.ctx.currentTime + i * 0.1;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    });
  }

  footstep() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.07);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** A slow synthwave loop: a pulsing bass under long soft pads. */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep++;
      const chord = CHORDS[Math.floor(step / 4) % CHORDS.length];
      const t = this.ctx.currentTime;
      // Bass pulse on every eighth note.
      const bassOsc = this.ctx.createOscillator();
      bassOsc.type = 'triangle';
      bassOsc.frequency.value = chord.bass * 2;
      const bassGain = this.ctx.createGain();
      bassGain.gain.setValueAtTime(0.085, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      bassOsc.connect(bassGain);
      bassGain.connect(this.master);
      bassOsc.start(t);
      bassOsc.stop(t + 0.45);
      // A soft pad swells in on each chord change.
      if (step % 4 === 0) {
        for (const freq of chord.pad) {
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 850;
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(0.018, t + 0.4);
          gain.gain.linearRampToValueAtTime(0.0001, t + 1.9);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.master);
          osc.start(t);
          osc.stop(t + 2.0);
        }
      }
    }, 480);
  }
}
