// Synthesized sound only — no audio files, no network. Engine hum, sirens,
// gunshots and a slow chord-pad music loop, all from WebAudio oscillators.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = 0;
    this.chordIndex = 0;
    this.started = false;
    // A minor drift: Am – F – C – G, one chord every two bars.
    this.chords = [
      [110, 164.8, 220], [87.3, 174.6, 261.6],
      [130.8, 196, 261.6], [98, 196, 246.9],
    ];
  }

  // Must be called from a user gesture at least once.
  unlock() {
    if (this.started) {
      this.ctx?.resume?.().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.started = true;
      this.startEngine();
    } catch {
      this.ctx = null;
    }
  }

  startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speedNorm, driving) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(50 + speedNorm * 90, t, 0.1);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedNorm * 0.06 : 0, t, 0.15);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenLfo?.stop();
      } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenLfo = null;
    }
  }

  noiseBurst(duration, volume, filterFreq) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  shot() {
    this.noiseBurst(0.16, 0.5, 1800);
  }

  crash() {
    this.noiseBurst(0.3, 0.4, 500);
  }

  reload() {
    this.blip(880, 0.07, 0.15);
    setTimeout(() => this.blip(660, 0.07, 0.15), 90);
  }

  blip(freq, duration, volume) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.02);
  }

  pickup() {
    this.blip(660, 0.09, 0.2);
    setTimeout(() => this.blip(990, 0.12, 0.2), 90);
  }

  missionJingle() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 0.22), i * 110));
  }

  update(dt) {
    if (!this.ctx) return;
    this.musicTimer += dt;
    if (this.musicTimer >= 4) {
      this.musicTimer = 0;
      const chord = this.chords[this.chordIndex % this.chords.length];
      this.chordIndex++;
      for (const freq of chord) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.035, t + 0.8);
        gain.gain.linearRampToValueAtTime(0, t + 3.8);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 4);
      }
    }
  }
}
