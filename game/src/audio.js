// WebAudio synth sound: no audio files, everything is oscillators + noise.
// Engine hum follows your speed, sirens wail while wanted, and every action
// (shot, crash, pickup, payday) is a tiny synthesised blip. All calls are
// safe before the first user gesture — the context is created lazily and
// every method no-ops when audio is unavailable or muted.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a triangle wave wobbling up and down.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'sine';
      sirenLfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 320;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      startMusic();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  // A simple bass line loop: root notes of a minor groove, one note per beat.
  const BASS = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const note = BASS[musicStep % BASS.length];
      musicStep += 1;
      if (!note) return;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = note;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }, 300);
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* audio is cosmetic; never break the game */ }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
    } catch { /* cosmetic */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    engine(speed01) {
      if (!ensure() || muted) return;
      try {
        engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.06, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(45 + speed01 * 110, ctx.currentTime, 0.08);
      } catch { /* cosmetic */ }
    },
    engineOff() {
      if (!ctx) return;
      try { engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } catch { /* cosmetic */ }
    },
    siren(on) {
      if (!ensure()) return;
      try { sirenGain.gain.setTargetAtTime(on && !muted ? 0.05 : 0, ctx.currentTime, 0.3); } catch { /* cosmetic */ }
    },
    shot() { noise(0.14, 0.5, 3200); },
    thud() { noise(0.12, 0.35, 300); blip(90, 0.12, 'sine', 0.3, 50); },
    crash() { noise(0.3, 0.45, 500); },
    pickup() { blip(660, 0.09, 'sine', 0.22); blip(990, 0.12, 'sine', 0.22); },
    mission() { blip(523, 0.12, 'triangle', 0.22); blip(659, 0.12, 'triangle', 0.22); blip(784, 0.2, 'triangle', 0.22); },
    payday() { blip(784, 0.1, 'triangle', 0.25); blip(988, 0.1, 'triangle', 0.25); blip(1175, 0.25, 'triangle', 0.25); },
  };
}
