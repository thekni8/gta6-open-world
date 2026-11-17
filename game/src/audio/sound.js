// Sound — everything synthesized with WebAudio, no audio files: an engine hum
// that follows speed, two-tone sirens, gunshots, footsteps, a cash register
// and a simple late-afternoon music loop.
export function createSound() {
  const ctx = window.AudioContext ? new AudioContext() : null;
  const sound = {
    ctx,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    musicTimer: 0,
    musicStep: 0,
    enabled: true,
  };
  if (!ctx) return sound;
  sound.master = ctx.createGain();
  sound.master.gain.value = 0.5;
  sound.master.connect(ctx.destination);
  // Engine: a low sawtooth whose pitch follows the car's speed.
  sound.engineOsc = ctx.createOscillator();
  sound.engineOsc.type = 'sawtooth';
  sound.engineOsc.frequency.value = 55;
  sound.engineGain = ctx.createGain();
  sound.engineGain.gain.value = 0;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 500;
  sound.engineOsc.connect(engineFilter);
  engineFilter.connect(sound.engineGain);
  sound.engineGain.connect(sound.master);
  sound.engineOsc.start();
  // Siren: a sine that wails between two tones.
  sound.sirenOsc = ctx.createOscillator();
  sound.sirenOsc.type = 'sine';
  sound.sirenOsc.frequency.value = 700;
  sound.sirenGain = ctx.createGain();
  sound.sirenGain.gain.value = 0;
  sound.sirenOsc.connect(sound.sirenGain);
  sound.sirenGain.connect(sound.master);
  sound.sirenOsc.start();
  return sound;
}

/** Resume the audio context after the first user gesture (autoplay policy). */
export function unlockAudio(sound) {
  if (sound.ctx && sound.ctx.state === 'suspended') sound.ctx.resume();
}

function blip(sound, freq, dur, type = 'square', vol = 0.15, slideTo = null) {
  if (!sound.ctx || !sound.enabled) return;
  const t = sound.ctx.currentTime;
  const osc = sound.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const gain = sound.ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(sound.master);
  osc.start(t);
  osc.stop(t + dur);
}

function noiseBurst(sound, dur, vol, filterFreq) {
  if (!sound.ctx || !sound.enabled) return;
  const t = sound.ctx.currentTime;
  const len = Math.floor(sound.ctx.sampleRate * dur);
  const buffer = sound.ctx.createBuffer(1, len, sound.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = sound.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = sound.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = sound.ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(sound.master);
  src.start(t);
}

export const soundFx = {
  gunshot(sound) {
    noiseBurst(sound, 0.18, 0.5, 1800);
    blip(sound, 180, 0.08, 'square', 0.2, 60);
  },
  hitMarker(sound) {
    blip(sound, 1200, 0.05, 'sine', 0.12);
  },
  crash(sound) {
    noiseBurst(sound, 0.3, 0.4, 700);
  },
  cash(sound) {
    blip(sound, 880, 0.09, 'sine', 0.15);
    setTimeout(() => blip(sound, 1320, 0.14, 'sine', 0.15), 90);
  },
  missionStart(sound) {
    blip(sound, 523, 0.12, 'triangle', 0.18);
    setTimeout(() => blip(sound, 784, 0.2, 'triangle', 0.18), 120);
  },
  missionComplete(sound) {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(sound, f, 0.18, 'triangle', 0.18), i * 110));
  },
  fail(sound) {
    blip(sound, 220, 0.4, 'sawtooth', 0.15, 110);
  },
  footstep(sound) {
    noiseBurst(sound, 0.06, 0.08, 400);
  },
  steal(sound) {
    blip(sound, 300, 0.1, 'square', 0.12, 500);
  },
};

/** Per-frame audio: engine pitch, siren wail, and the music loop. */
export function updateSound(sound, dt, speed, wantedStars, playing) {
  if (!sound.ctx) return;
  const t = sound.ctx.currentTime;
  if (sound.engineGain) {
    const target = playing && Math.abs(speed) > 0.5 ? 0.05 + Math.abs(speed) * 0.002 : 0;
    sound.engineGain.gain.setTargetAtTime(target, t, 0.1);
    sound.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 4, t, 0.1);
  }
  if (sound.sirenGain) {
    const target = wantedStars > 0 && playing ? 0.045 : 0;
    sound.sirenGain.gain.setTargetAtTime(target, t, 0.2);
    if (target > 0) {
      sound.sirenOsc.frequency.setTargetAtTime(Math.sin(t * 2.4) > 0 ? 720 : 960, t, 0.05);
    }
  }
  // Music: a slow 8-step bassline loop, A minor, late-afternoon mood.
  if (!playing) return;
  sound.musicTimer += dt;
  if (sound.musicTimer < 0.42) return;
  sound.musicTimer = 0;
  const bass = [110, 0, 130.8, 0, 98, 0, 146.8, 164.8];
  const note = bass[sound.musicStep % bass.length];
  sound.musicStep += 1;
  if (note > 0) blip(sound, note, 0.38, 'triangle', 0.07);
  if (sound.musicStep % 4 === 0) blip(sound, 440, 0.2, 'sine', 0.03);
}
