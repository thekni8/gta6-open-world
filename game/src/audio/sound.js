/* WebAudio-synthesized sound: no audio files, no network.
   Engine hum, two-tone sirens, gunshots, footsteps, UI blips, and a
   simple bass-and-hat music loop. Everything starts on first gesture. */
(function () {
  let ctx = null, master = null;
  let engineOsc = null, engineGain = null, engineOsc2 = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0;
  let musicTimer = null, musicStep = 0;
  let noiseBuf = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Shared white-noise buffer for shots, skids, and footsteps.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      startEngine();
      startMusic();
    } catch (e) { return false; }
    return true;
  }

  function startEngine() {
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 28;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    engineOsc.connect(lp); engineOsc2.connect(lp); lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); engineOsc2.start();
  }

  // Bassline + hats, scheduled a bar ahead. Key of A minor, 100 BPM.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0];
  function startMusic() {
    if (musicTimer) return;
    const stepDur = 60 / 100 / 2; // eighth notes at 100 BPM
    musicTimer = setInterval(function () {
      if (!ctx || MB.S.muted || MB.S.mode !== 'playing') { musicStep = (musicStep + 1) % 16; return; }
      const t = ctx.currentTime + 0.02;
      const bass = BASS[musicStep];
      if (bass) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = bass;
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + stepDur);
      }
      if (musicStep % 2 === 0) { // hat
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.06);
      }
      musicStep = (musicStep + 1) % 16;
    }, 300);
  }

  function burst(freq, dur, vol, type) {
    if (!ctx || MB.S.muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
  function noiseBurst(dur, vol, filterFreq, type) {
    if (!ctx || MB.S.muted) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }

  MB.Sound = {
    unlock: ensure,
    setEngine: function (speed01, driving) {
      if (!ctx || !engineGain) return;
      const target = driving ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(MB.S.muted ? 0 : target, ctx.currentTime, 0.1);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, ctx.currentTime, 0.1);
      if (engineOsc2) engineOsc2.frequency.setTargetAtTime(25 + speed01 * 65, ctx.currentTime, 0.1);
    },
    updateSiren: function (dt, wanted) {
      if (!ctx) return;
      if (wanted > 0 && MB.S.mode === 'playing') {
        if (!sirenOsc) {
          sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
          sirenGain = ctx.createGain(); sirenGain.gain.value = 0.0;
          sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
        }
        sirenTimer += dt;
        sirenOsc.frequency.value = (Math.floor(sirenTimer * 1.6) % 2 === 0) ? 720 : 960;
        sirenGain.gain.setTargetAtTime(MB.S.muted ? 0 : 0.045, ctx.currentTime, 0.1);
      } else if (sirenGain) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    },
    shoot: function () { noiseBurst(0.16, 0.5, 2400); burst(160, 0.1, 0.3, 'square'); },
    punch: function () { noiseBurst(0.08, 0.35, 700); },
    crash: function (hard) { noiseBurst(hard ? 0.35 : 0.15, hard ? 0.6 : 0.3, 500); },
    skid: function () { noiseBurst(0.18, 0.12, 3000, 'bandpass'); },
    step: function () { noiseBurst(0.05, 0.07, 400); },
    horn: function () { burst(370, 0.35, 0.25, 'square'); burst(466, 0.35, 0.2, 'square'); },
    pickup: function () { burst(660, 0.12, 0.25); setTimeout(function () { burst(990, 0.18, 0.25); }, 90); },
    missionWin: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { burst(f, 0.25, 0.3, 'triangle'); }, i * 130); }); },
    missionFail: function () { [392, 330, 262].forEach(function (f, i) { setTimeout(function () { burst(f, 0.3, 0.3, 'triangle'); }, i * 160); }); },
    click: function () { burst(880, 0.06, 0.15); },
  };
})();
