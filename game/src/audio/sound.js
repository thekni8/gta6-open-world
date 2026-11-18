// WebAudio-synthesized sound: no audio files, no network. Engine hum,
// sirens, gunshots, footsteps, UI blips, and a looping synthwave bassline.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  // Must be called from a user gesture (start button, first click).
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  _tone({ freq = 440, endFreq = null, type = 'sine', dur = 0.2, vol = 0.3, when = 0 }) {
    if (!this.ctx || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise({ dur = 0.15, vol = 0.4, low = 400, high = 4000, when = 0 }) {
    if (!this.ctx || !this.sfxOn) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (low + high) / 2;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  gunshot() {
    this._noise({ dur: 0.16, vol: 0.55, low: 300, high: 3000 });
    this._tone({ freq: 160, endFreq: 45, type: 'square', dur: 0.1, vol: 0.25 });
  }

  punch() {
    this._noise({ dur: 0.08, vol: 0.35, low: 200, high: 900 });
  }

  crash() {
    this._noise({ dur: 0.3, vol: 0.5, low: 100, high: 1200 });
    this._tone({ freq: 90, endFreq: 40, type: 'sawtooth', dur: 0.25, vol: 0.3 });
  }

  skid() {
    this._noise({ dur: 0.25, vol: 0.12, low: 1200, high: 3500 });
  }

  step() {
    this._noise({ dur: 0.05, vol: 0.08, low: 300, high: 800 });
  }

  pickup() {
    this._tone({ freq: 660, type: 'sine', dur: 0.09, vol: 0.25 });
    this._tone({ freq: 990, type: 'sine', dur: 0.14, vol: 0.25, when: 0.08 });
  }

  missionStart() {
    this._tone({ freq: 392, type: 'triangle', dur: 0.16, vol: 0.3 });
    this._tone({ freq: 523, type: 'triangle', dur: 0.16, vol: 0.3, when: 0.14 });
    this._tone({ freq: 659, type: 'triangle', dur: 0.28, vol: 0.3, when: 0.28 });
  }

  missionComplete() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this._tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.3, when: i * 0.13 }),
    );
  }

  missionFailed() {
    [392, 330, 262].forEach((f, i) =>
      this._tone({ freq: f, type: 'sawtooth', dur: 0.3, vol: 0.2, when: i * 0.18 }),
    );
  }

  uiClick() {
    this._tone({ freq: 880, type: 'sine', dur: 0.06, vol: 0.2 });
  }

  // Continuous engine hum whose pitch follows speed (0..1).
  setEngine(speed01, on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06, this.ctx.currentTime, 0.1);
  }

  // Two-tone siren while any police car is chasing.
  setSiren(on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 820;
      lfo.start();
    }
    this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.2);
  }

  // Simple synthwave loop: minor-key bass + sparkle arp, scheduled per bar.
  startMusic() {
    if (!this.ctx || this.musicTimer || !this.musicOn) return;
    const bass = [110, 110, 130.8, 98]; // A2 A2 C3 G2
    const arp = [440, 523.25, 659.25, 523.25, 440, 392, 329.63, 392];
    const stepDur = 0.21;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const bar = Math.floor(this.musicStep / 8) % 4;
      const s = this.musicStep % 8;
      if (s % 2 === 0) {
        this._tone({ freq: bass[bar], type: 'triangle', dur: stepDur * 1.8, vol: 0.16 });
      }
      this._tone({ freq: arp[s], type: 'sine', dur: stepDur * 0.9, vol: 0.05 });
      this.musicStep++;
    }, stepDur * 1000);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.startMusic();
    else this.stopMusic();
    return this.musicOn;
  }
}
