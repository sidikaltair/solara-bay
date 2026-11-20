// Mara Voss missions: 5 chained jobs. Each mission has a waypoint beam
// (tall glowing cylinder + ground ring) so the player always knows where to
// go. Completing one pays out and unlocks the next.
import * as THREE from 'three';
import { G, dist2D } from './state.js';
import { addWanted } from './police.js';

const MISSIONS = [
  {
    title: 'First Job',
    obj: 'Head to the docks — Mara is waiting at the beach.',
    type: 'reach',
    target: { x: -40, z: 285 },
    radius: 10,
    reward: 200,
  },
  {
    title: 'Borrowed Wheels',
    obj: 'Steal a car (E next to one) and bring it to the garage up north.',
    type: 'steal',
    target: { x: 55, z: -260 },
    radius: 12,
    reward: 350,
  },
  {
    title: 'The Drop',
    obj: 'Drive the car down to the beach drop point. Don’t lose it.',
    type: 'deliver',
    target: { x: 180, z: 285 },
    radius: 12,
    reward: 400,
  },
  {
    title: 'Loose Ends',
    obj: 'Mara’s tail is on you. Disable 2 police cars — shoot them (3 hits each).',
    type: 'eliminate',
    target: { x: 0, z: 0 },
    radius: 9999,
    reward: 600,
    need: 2,
  },
  {
    title: 'Getaway',
    obj: 'Lose the heat (0 stars), then reach the safehouse.',
    type: 'escape',
    target: { x: -220, z: -220 },
    radius: 12,
    reward: 1000,
  },
];

let beam = null;
let beamRing = null;
let beamLight = null;
let killed = 0;          // police cars disabled during mission 4
let bannerT = 0;

export function initMissions() {
  G.missions = MISSIONS.map(m => ({ ...m, done: false }));
  G.missionIndex = 0;

  beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 70, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.32,
      side: THREE.DoubleSide, depthWrite: false }));
  beam.visible = false;
  beam.name = 'waypoint-beam';
  G.scene.add(beam);
  G._beam = beam;

  beamRing = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 4.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  beamRing.rotation.x = -Math.PI / 2;
  beamRing.visible = false;
  G.scene.add(beamRing);

  beamLight = new THREE.PointLight(0xffd23e, 30, 40);
  beamLight.visible = false;
  G.scene.add(beamLight);

  placeBeam();
  return G.missions;
}

function placeBeam() {
  const m = G.missions[G.missionIndex];
  if (!m) { beam.visible = false; beamRing.visible = false; beamLight.visible = false; return; }
  beam.position.set(m.target.x, 35, m.target.z);
  beamRing.position.set(m.target.x, 0.15, m.target.z);
  beamLight.position.set(m.target.x, 8, m.target.z);
  beam.visible = true; beamRing.visible = true; beamLight.visible = true;
}

export function currentMission() {
  return G.missions[G.missionIndex] || null;
}

export function missionProgressText() {
  const m = currentMission();
  if (!m) return 'All jobs done — Solara Bay is yours.';
  if (m.type === 'eliminate') return `${m.obj}  (${killed}/${m.need} disabled)`;
  return m.obj;
}

function playerPos() {
  const p = G.player;
  if (!p) return { x: 0, z: 0 };
  return p.car ? { x: p.car.x, z: p.car.z } : { x: p.x, z: p.z };
}

export function notePoliceDisabled() {
  const m = currentMission();
  if (m && m.type === 'eliminate') killed += 1;
}

function completeMission() {
  const m = currentMission();
  if (!m) return;
  m.done = true;
  G.money += m.reward;
  G.missionIndex += 1;
  killed = 0;
  showBanner(`Job done — +$${m.reward}`);
  if (typeof window !== 'undefined' && window.__sfx) window.__sfx('mission');
  if (G.missionIndex >= G.missions.length) {
    beam.visible = false; beamRing.visible = false; beamLight.visible = false;
    showBanner('All jobs done — Solara Bay is yours, kid.');
  } else {
    placeBeam();
  }
}

export function showBanner(text) {
  const el = document.getElementById('banner');
  if (!el) return;
  el.textContent = text;
  el.style.opacity = '1';
  bannerT = 3.2;
}

export function updateMissions(dt) {
  if (bannerT > 0) {
    bannerT -= dt;
    if (bannerT <= 0) {
      const el = document.getElementById('banner');
      if (el) el.style.opacity = '0';
    }
  }
  const m = currentMission();
  if (!m) return;
  // Beam pulse.
  if (beam.visible) {
    const s = 1 + Math.sin(G.time * 3) * 0.12;
    beam.scale.set(s, 1, s);
    beamRing.scale.setScalar(1 + Math.sin(G.time * 3) * 0.15);
  }
  const pos = playerPos();
  const d = dist2D(pos.x, pos.z, m.target.x, m.target.z);
  switch (m.type) {
    case 'reach':
      if (d < m.radius) completeMission();
      break;
    case 'steal':
      // Needs the player IN a car (any car) inside the garage radius.
      if (G.mode === 'drive' && d < m.radius) completeMission();
      break;
    case 'deliver':
      if (G.mode === 'drive' && d < m.radius) completeMission();
      break;
    case 'eliminate': {
      // Count disabled police cars since this mission started.
      const disabledNow = G.police.filter(c => c.disabled).length;
      if (disabledNow >= m.need) completeMission();
      break;
    }
    case 'escape':
      if (G.wanted === 0 && d < m.radius) completeMission();
      break;
    default:
      break;
  }
}

// Jump the mission pointer (used by screenshot staging).
export function setMissionIndex(i) {
  G.missionIndex = Math.max(0, Math.min(G.missions.length - 1, i));
  killed = 0;
  placeBeam();
}
