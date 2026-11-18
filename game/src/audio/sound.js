// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum and sirens are live oscillators; shots and crashes are shaped
// noise bursts; the music is a small scheduled bass-and-pad loop.

export class Sound {
  constructor(G) {
    this.G = G;
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.unlocked = false;
    this.muted = false;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
      this.startEngineLoop();
      this.startSirenLoop();
      this.startMusic();
    } catch (_) {
      // Audio is a nicety; the game plays fine silent.
      this.ctx = null;
    }
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noiseBurst(dur, vol, filterFreq, type) {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  startEngineLoop() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = gain;
    this.engineFilter = filter;
  }

  setEngine(speed01, driving) {
    if (!this.ctx) return;
    const t = this.now();
    const target = driving ? 0.05 + speed01 * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 95, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.1);
  }

  startSirenLoop() {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 720;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.9;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    lfo.start();
    this.sirenOsc = osc;
    this.sirenGain = gain;
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.now(), 0.2);
  }

  sirenSting() {
    this.blip(880, 0.25, 'triangle', 0.18, 660);
    setTimeout(() => this.blip(660, 0.3, 'triangle', 0.18, 880), 220);
  }

  shot() {
    this.noiseBurst(0.14, 0.5, 2400, 'highpass');
    this.blip(160, 0.1, 'square', 0.22, 60);
  }

  enemyShot(dist) {
    const vol = dist === undefined ? 0.3 : Math.max(0.05, 0.35 - dist * 0.006);
    this.noiseBurst(0.12, vol, 1800, 'highpass');
  }

  dryFire() {
    this.blip(1200, 0.05, 'square', 0.08);
  }

  reload() {
    this.blip(500, 0.07, 'square', 0.1);
    setTimeout(() => this.blip(700, 0.07, 'square', 0.1), 120);
  }

  punch() {
    this.noiseBurst(0.09, 0.35, 500);
  }

  crash(intensity) {
    this.noiseBurst(0.25, 0.2 + intensity * 0.4, 700);
    this.blip(90, 0.2, 'sine', 0.25, 45);
  }

  thud() {
    this.blip(70, 0.18, 'sine', 0.3, 40);
  }

  yelp() {
    this.blip(620, 0.16, 'sine', 0.12, 900);
  }

  hurt() {
    this.blip(140, 0.2, 'sawtooth', 0.16, 70);
  }

  enemyDown() {
    this.blip(320, 0.12, 'triangle', 0.15, 180);
  }

  explosion() {
    this.noiseBurst(0.8, 0.6, 300);
    this.blip(55, 0.7, 'sine', 0.5, 28);
  }

  footstep() {
    this.noiseBurst(0.05, 0.05, 400);
  }

  uiClick() {
    this.blip(880, 0.06, 'sine', 0.12);
  }

  missionStart() {
    this.blip(392, 0.18, 'triangle', 0.2);
    setTimeout(() => this.blip(523, 0.25, 'triangle', 0.2), 160);
  }

  stageClear() {
    this.blip(659, 0.12, 'triangle', 0.18);
    setTimeout(() => this.blip(784, 0.2, 'triangle', 0.18), 110);
  }

  missionWin() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.28, 'triangle', 0.2), i * 140);
    });
  }

  missionFail() {
    [392, 330, 262].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.3, 'triangle', 0.18), i * 170);
    });
  }

  // A laid-back A-minor bass loop with a soft pad, scheduled ahead so it
  // never stutters. 100 BPM, eight steps per bar.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteTime = this.now() + 0.1;
    const bassNotes = [55, 55, 65.41, 55, 49, 49, 58.27, 65.41];
    const stepDur = 60 / 100 / 2;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      while (this.nextNoteTime < this.now() + 0.25) {
        const t = this.nextNoteTime;
        const step = this.musicStep % 8;
        const bar = Math.floor(this.musicStep / 8);
        // Bass note.
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = bassNotes[step];
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.11, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + stepDur);
        // Soft hat on off-beats.
        if (step % 2 === 1) {
          const hat = this.ctx.createBufferSource();
          hat.buffer = this.noiseBuffer(0.04);
          const hf = this.ctx.createBiquadFilter();
          hf.type = 'highpass';
          hf.frequency.value = 6000;
          const hg = this.ctx.createGain();
          hg.gain.setValueAtTime(0.03, t);
          hg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          hat.connect(hf);
          hf.connect(hg);
          hg.connect(this.master);
          hat.start(t);
        }
        // Pad chord at the top of every second bar.
        if (step === 0 && bar % 2 === 0) {
          for (const f of [220, 261.63, 329.63]) {
            const p = this.ctx.createOscillator();
            p.type = 'sine';
            p.frequency.value = f;
            const pg = this.ctx.createGain();
            pg.gain.setValueAtTime(0.0001, t);
            pg.gain.linearRampToValueAtTime(0.028, t + 0.6);
            pg.gain.linearRampToValueAtTime(0.0001, t + stepDur * 16);
            p.connect(pg);
            pg.connect(this.master);
            p.start(t);
            p.stop(t + stepDur * 16);
          }
        }
        this.nextNoteTime += stepDur;
        this.musicStep++;
      }
    }, 100);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }
}
