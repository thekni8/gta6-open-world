// WebAudio-synthesized sound: no audio files, no network. Engine hum that
// follows speed, two-tone police sirens, gunshots, punches, UI blips, and
// a simple bass-and-hats groove loop. Everything starts on first input.
export function createSound() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  let musicTimer = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Engine: sawtooth through a lowpass, pitch follows speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
    // Siren: triangle wave wobbling between two tones.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 750;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'square';
    sirenLfo.frequency.value = 1.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    sirenLfo.start();
    started = true;
    startMusic();
    return true;
  }

  function blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  // A laid-back groove: root-note bass + off-beat hats, scheduled ahead.
  const BASS = [55, 55, 65.4, 49];
  let beat = 0;
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const bar = Math.floor(beat / 4) % 4;
      if (beat % 2 === 0) blip(BASS[bar], 0.34, 'triangle', 0.16);
      if (beat % 2 === 1) noiseBurst(0.05, 0.05, 6000);
      beat = (beat + 1) % 16;
    }, 240);
  }

  return {
    ensure,
    get started() { return started; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    setEngine(speedKmh, driving) {
      if (!ctx || muted) return;
      const target = driving ? 0.05 + Math.min(0.11, speedKmh / 900) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speedKmh * 1.6, ctx.currentTime, 0.1);
    },
    setSiren(on, dist) {
      if (!ctx || muted) return;
      const vol = on ? Math.max(0.015, 0.09 - dist * 0.001) : 0;
      sirenGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.2);
    },
    gunshot() { noiseBurst(0.14, 0.5, 1800); blip(160, 0.09, 'square', 0.22, 60); },
    enemyShot(dist) { noiseBurst(0.1, Math.max(0.05, 0.3 - dist * 0.005), 1400); },
    punch() { noiseBurst(0.08, 0.3, 500); },
    hitMarker() { blip(1200, 0.06, 'sine', 0.14); },
    enemyDown() { blip(320, 0.25, 'triangle', 0.2, 90); },
    reload() { blip(700, 0.07, 'square', 0.1); setTimeout(() => blip(950, 0.07, 'square', 0.1), 180); },
    crash() { noiseBurst(0.3, 0.5, 700); },
    enterCar() { blip(240, 0.12, 'sine', 0.2, 320); },
    cash() { blip(880, 0.1, 'sine', 0.18); setTimeout(() => blip(1320, 0.16, 'sine', 0.18), 90); },
    missionStart() { blip(440, 0.18, 'triangle', 0.2); setTimeout(() => blip(660, 0.24, 'triangle', 0.2), 150); },
    missionComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.2), i * 130)); },
    missionFail() { [400, 300, 200].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sawtooth', 0.12), i * 160)); },
    uiClick() { blip(700, 0.06, 'sine', 0.12); },
    busted() { blip(300, 0.5, 'sawtooth', 0.18, 120); },
  };
}
