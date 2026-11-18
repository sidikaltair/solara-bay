// Audio: tiny WebAudio synth — engine hum, siren, gunshot, pickup blips.
// No audio files. All sounds are generated; mute with M.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* no audio */ }
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  function blip(freq, dur, type, vol) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }

  return {
    unlock,
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    mission() { blip(660, 0.12, 'triangle', 0.14); setTimeout(() => blip(880, 0.16, 'triangle', 0.14), 120); },
    payday() { blip(880, 0.1, 'square', 0.1); setTimeout(() => blip(1174, 0.18, 'square', 0.1), 100); },
    shot() {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      const buf = c.createBuffer(1, c.sampleRate * 0.09, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = 0.25;
      src.connect(g).connect(c.destination);
      src.start();
    },
    siren() {
      if (muted) return;
      const c = ensure();
      if (!c || sirenOsc) return;
      sirenOsc = c.createOscillator();
      sirenGain = c.createGain();
      sirenOsc.type = 'sine';
      sirenGain.gain.value = 0.05;
      sirenOsc.connect(sirenGain).connect(c.destination);
      sirenOsc.start();
      let hi = false;
      sirenTimer = setInterval(() => {
        if (!sirenOsc) return;
        hi = !hi;
        sirenOsc.frequency.setValueAtTime(hi ? 950 : 700, c.currentTime);
      }, 380);
      setTimeout(() => {
        if (sirenTimer) clearInterval(sirenTimer);
        if (sirenOsc) { try { sirenOsc.stop(); } catch (e) {} sirenOsc = null; }
      }, 6000);
    },
    setEngine(speed01) {
      if (muted) { if (engineOsc) { try { engineOsc.stop(); } catch (e) {} engineOsc = null; } return; }
      const c = ensure();
      if (!c) return;
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineGain = c.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0.02;
        engineOsc.connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 140;
      engineGain.gain.value = 0.015 + speed01 * 0.03;
    },
    stopEngine() {
      if (engineOsc) { try { engineOsc.stop(); } catch (e) {} engineOsc = null; }
    },
  };
}
