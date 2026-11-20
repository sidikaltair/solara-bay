// Solara Bay city: procedural low-poly world. No external assets — every
// texture is painted on a canvas at runtime, every mesh is built from
// Three.js primitives. Layout is seeded so it is identical on every load.
import * as THREE from 'three';
import { G, mulberry32, clamp } from './state.js';

const ROAD_HALF = 9;          // half width of a road
const BLOCK = 110;            // road centre-line spacing
const ROAD_LINES = [-275, -165, -55, 55, 165, 275];

function facadeTexture(rand, base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  // Window grid.
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const on = rand() < lit;
      g.fillStyle = on ? '#ffd98a' : '#1c2733';
      g.fillRect(x, y, 12, 14);
    }
  }
  // Roof edge.
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, 128, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2e3138'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#3a3e46';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 64, Math.random() * 256, 2, 2);
  // Edge lines + dashed centre.
  g.fillStyle = '#d8d8d8'; g.fillRect(3, 0, 2, 256); g.fillRect(59, 0, 2, 256);
  g.fillStyle = '#e8c33a';
  for (let y = 0; y < 256; y += 32) g.fillRect(30, y, 4, 16);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makePalm(rand) {
  const palm = new THREE.Group();
  const h = 7 + rand() * 3;
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, h, 6), trunkMat);
  trunk.position.y = h / 2;
  trunk.rotation.z = (rand() - 0.5) * 0.16;
  trunk.castShadow = true;
  palm.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.2, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, h + 0.4, Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    leaf.castShadow = true;
    palm.add(leaf);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x3aa655 }));
  crown.position.y = h + 0.5;
  palm.add(crown);
  return palm;
}

export function buildWorld() {
  const rand = mulberry32(1337);
  const scene = G.scene;
  const buildings = [];
  const palms = [];

  // --- ground, beach, water ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(660, 660),
    new THREE.MeshLambertMaterial({ color: 0x4d7a3a }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(660, 44),
    new THREE.MeshLambertMaterial({ color: 0xd9c28a }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, 308);
  sand.receiveShadow = true;
  scene.add(sand);

  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x1e6f9e, transparent: true, opacity: 0.88 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 320), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.12, 490);
  scene.add(water);

  // --- roads ---
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const x of ROAD_LINES) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 660), roadMat.clone());
    r.material.map = roadTex.clone();
    r.material.map.repeat.set(1, 12);
    r.material.map.needsUpdate = true;
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.05, 0);
    r.receiveShadow = true;
    scene.add(r);
  }
  for (const z of ROAD_LINES) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(660, ROAD_HALF * 2), roadMat.clone());
    r.material.map = roadTex.clone();
    r.material.map.repeat.set(12, 1);
    r.material.map.needsUpdate = true;
    r.rotation.x = -Math.PI / 2;
    r.rotation.z = Math.PI / 2;
    r.position.set(0, 0.05, z);
    r.receiveShadow = true;
    scene.add(r);
  }

  // --- buildings (skip centre plaza + beach row) ---
  const palette = ['#7d8aa0', '#a08a7d', '#8a9a7d', '#9a7d8a', '#6f7f96', '#b09a6a'];
  const blockCentres = [-220, -110, 0, 110, 220];
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      if (bx === 0 && bz === 0) continue;      // central plaza / spawn
      if (bz === 220) continue;                // beach row stays open
      if (rand() < 0.12) continue;             // occasional park lot
      const n = rand() < 0.45 ? 1 : 4;         // one tower or four small blocks
      for (let i = 0; i < n; i++) {
        const w = n === 1 ? 34 + rand() * 22 : 18 + rand() * 8;
        const d = n === 1 ? 34 + rand() * 22 : 18 + rand() * 8;
        const h = 12 + rand() * rand() * 34;
        const ox = n === 1 ? 0 : (i % 2 === 0 ? -22 : 22);
        const oz = n === 1 ? 0 : (i < 2 ? -22 : 22);
        const x = bx + ox, z = bz + oz;
        const tex = facadeTexture(rand, palette[Math.floor(rand() * palette.length)], 0.55);
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshLambertMaterial({ map: tex }));
        b.position.set(x, h / 2, z);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        // Flat roof cap.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x3c4250 }));
        roof.position.set(x, h + 0.4, z);
        scene.add(roof);
        buildings.push(b);
        G.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // --- palms: beach line + plaza + a few park lots ---
  for (let x = -300; x <= 300; x += 24) {
    if (rand() < 0.3) continue;
    const p = makePalm(rand);
    p.position.set(x + (rand() - 0.5) * 8, 0, 296 + rand() * 8);
    scene.add(p); palms.push(p);
  }
  for (let i = 0; i < 8; i++) {
    const p = makePalm(rand);
    const a = (i / 8) * Math.PI * 2;
    p.position.set(Math.cos(a) * 34, 0, Math.sin(a) * 34);
    scene.add(p); palms.push(p);
  }

  // --- plaza fountain (spawn area) ---
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 7, 1.2, 16),
    new THREE.MeshLambertMaterial({ color: 0x9aa5b5 }));
  fountain.position.set(0, 0.6, -14);
  fountain.castShadow = true;
  scene.add(fountain);
  const fwater = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.2, 0.5, 16),
    new THREE.MeshLambertMaterial({ color: 0x2f8fc9 }));
  fwater.position.set(0, 1.1, -14);
  scene.add(fwater);

  // --- lights + sky ---
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3d5a34, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -360; sun.shadow.camera.right = 360;
  sun.shadow.camera.top = 360; sun.shadow.camera.bottom = -360;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x87b5e0, 420, 900);

  G.world = { buildings, palms, water, waterMat, sun, hemi };
  return G.world;
}

export function setDusk(on) {
  const w = G.world;
  if (!w) return;
  G.dusk = on;
  if (on) {
    w.sun.position.set(-220, 90, 260);
    w.sun.color.setHex(0xff9a4d);
    w.sun.intensity = 1.15;
    w.hemi.intensity = 0.45;
    w.hemi.color.setHex(0x8a6a9a);
    G.scene.background.setHex(0x2c1e3e);
    G.scene.fog.color.setHex(0x2c1e3e);
    G.scene.fog.near = 300; G.scene.fog.far = 750;
    w.waterMat.color.setHex(0x274a6e);
  } else {
    w.sun.position.set(180, 260, 120);
    w.sun.color.setHex(0xfff2d0);
    w.sun.intensity = 1.6;
    w.hemi.intensity = 0.85;
    w.hemi.color.setHex(0xbfd9ff);
    G.scene.background.setHex(0x87b5e0);
    G.scene.fog.color.setHex(0x87b5e0);
    G.scene.fog.near = 420; G.scene.fog.far = 900;
    w.waterMat.color.setHex(0x1e6f9e);
  }
}
