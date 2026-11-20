// Sound: everything is synthesized with WebAudio — no audio files.
// Engine hum, gunshot, siren, pickup blips, mission jingle. All calls are
// guarded so the game runs fine with no audio device or no user gesture.
import { G } from './state.js';

let ctx = null;
let engineOsc = null;
let engineOsc2 = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenT = 0;

export function initAudio() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // Engine: two detuned saws through a lowpass, gain follows speed.
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth'; engineOsc2.frequency.value = 90;
    engineOsc.connect(lp); engineOsc2.connect(lp);
    lp.connect(engineGain); engineGain.connect(ctx.destination);
    engineOsc.start(); engineOsc2.start();
    // Siren: a sine that alternates between two tones.
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine'; sirenOsc.frequency.value = 750;
    sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
    sirenOsc.start();
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

function resume() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setEngine(rpm01) {
  if (!ctx || !engineOsc) return;
  resume();
  const f = 55 + rpm01 * 130;
  engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
  engineOsc2.frequency.setTargetAtTime(f * 1.5 + 4, ctx.currentTime, 0.05);
  engineGain.gain.setTargetAtTime(0.03 + rpm01 * 0.05, ctx.currentTime, 0.08);
}

export function setSiren(on) {
  if (!ctx || !sirenOsc) return;
  resume();
  sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.1);
}

export function updateAudio(dt) {
  if (!ctx) return;
  // Siren wail: alternate tone twice a second while any cop is active.
  const anyCop = G.police.some(c => !c.disabled);
  setSiren(anyCop && G.wanted > 0);
  if (anyCop && G.wanted > 0) {
    sirenT += dt;
    sirenOsc.frequency.setTargetAtTime(
      Math.floor(sirenT * 2) % 2 === 0 ? 720 : 980, ctx.currentTime, 0.03);
  }
  const p = G.player;
  const spd = p && p.car ? Math.abs(p.car.speed) / 26 : 0;
  setEngine(spd);
}

function blip(freq, dur, type, vol) {
  if (!ctx) return;
  resume();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.06, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + dur);
}

export function sfx(name) {
  if (!ctx) return;
  try {
    if (name === 'shot') {
      // Noise burst through a lowpass = gunshot crack.
      const len = Math.floor(ctx.sampleRate * 0.14);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(lp); lp.connect(g); g.connect(ctx.destination);
      src.start();
      blip(140, 0.08, 'sine', 0.2);
    } else if (name === 'pickup') {
      blip(660, 0.09, 'square', 0.06);
      setTimeout(() => blip(990, 0.12, 'square', 0.06), 90);
    } else if (name === 'mission') {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.09), i * 110));
    } else if (name === 'hit') {
      blip(220, 0.07, 'sawtooth', 0.08);
    } else if (name === 'click') {
      blip(440, 0.05, 'square', 0.04);
    }
  } catch (e) {
    // Audio must never break the game.
  }
}

// Exposed for missions.js (window.__sfx) without a circular import.
if (typeof window !== 'undefined') window.__sfx = sfx;
