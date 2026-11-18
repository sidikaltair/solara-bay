// Solara Bay 3D — the city. One painted ground texture (roads, sidewalks,
// beach, water) + 3D buildings with procedural window facades, palms, and
// day/dusk lighting. Collision is a list of building AABBs.
//
// Ground texture maps x ∈ [-410, 410], z ∈ [-330, 490] (820x820) so the
// beach (z 330-372) and water (z > 372) fit inside the same texture.
import * as THREE from '../vendor/three.module.js';
import { WORLD } from './config.js';
import { clamp } from './util.js';

const TEX = 2048; // ground texture size
const GX0 = -410, GX1 = 410, GZ0 = -330, GZ1 = 490; // ground texture bounds

function makeGroundTexture(rng, parks) {
  const c = document.createElement('canvas');
  c.width = TEX; c.height = TEX;
  const g = c.getContext('2d');
  const px = (u) => ((u - GX0) / (GX1 - GX0)) * TEX;   // world x -> canvas x
  const pz = (u) => ((u - GZ0) / (GZ1 - GZ0)) * TEX;   // world z -> canvas y (north at top)
  const w = (u) => (u / (GX1 - GX0)) * TEX;

  // Base: sidewalk / block colour.
  g.fillStyle = '#8a8f7a'; g.fillRect(0, 0, TEX, TEX);
  // Block fill: warm concrete with slight variation per block; parks green.
  const centers = WORLD.roadCenters;
  for (let i = 0; i < centers.length - 1; i += 1) {
    for (let j = 0; j < centers.length - 1; j += 1) {
      const x0 = px(centers[i] + WORLD.roadWidth / 2);
      const z0 = pz(centers[j] + WORLD.roadWidth / 2);
      const bw = w(centers[i + 1] - centers[i] - WORLD.roadWidth);
      const bh = w(centers[j + 1] - centers[j] - WORLD.roadWidth);
      if (parks.has(`${i},${j}`)) {
        g.fillStyle = '#5d8a4a';
      } else {
        const shade = 132 + Math.floor(rng() * 22);
        g.fillStyle = `rgb(${shade},${shade - 4},${shade - 18})`;
      }
      g.fillRect(x0, z0, bw, bh);
    }
  }
  // Roads: asphalt.
  g.fillStyle = '#33373d';
  for (const c0 of centers) {
    g.fillRect(px(c0 - WORLD.roadWidth / 2), 0, w(WORLD.roadWidth), TEX);
    g.fillRect(0, pz(c0 - WORLD.roadWidth / 2), TEX, w(WORLD.roadWidth));
  }
  // Lane dashes.
  g.fillStyle = '#d8c95a';
  const dash = 14, gap = 18;
  for (const c0 of centers) {
    for (let d = 0; d < TEX; d += dash + gap) {
      g.fillRect(px(c0) - 2, d, 4, dash);
      g.fillRect(d, pz(c0) - 2, dash, 4);
    }
  }
  // Beach sand + water at the south edge (z > beachZ).
  const sandY = pz(WORLD.beachZ);
  g.fillStyle = '#e0c98f';
  g.fillRect(0, sandY, TEX, pz(WORLD.waterZ) - sandY);
  const grad = g.createLinearGradient(0, pz(WORLD.waterZ), 0, TEX);
  grad.addColorStop(0, '#2f7fb8');
  grad.addColorStop(1, '#1c5a8a');
  g.fillStyle = grad;
  g.fillRect(0, pz(WORLD.waterZ), TEX, TEX - pz(WORLD.waterZ));
  // Foam line.
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(0, pz(WORLD.waterZ) - 3, TEX, 6);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeFacadeTextures() {
  // Three window layouts on a light facade; building tint comes from material.color.
  const variants = [];
  for (let v = 0; v < 3; v += 1) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#b9b4aa'; g.fillRect(0, 0, 128, 256);
    const cols = v === 0 ? 4 : v === 1 ? 3 : 5;
    const rows = v === 0 ? 8 : v === 1 ? 6 : 10;
    for (let r = 0; r < rows; r += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = 10 + col * ((128 - 20) / cols);
        const y = 12 + r * ((256 - 24) / rows);
        const lit = Math.random() < 0.28;
        g.fillStyle = lit ? '#ffd97a' : '#2c3542';
        g.fillRect(x, y, (128 - 20) / cols - 8, (256 - 24) / rows - 8);
      }
    }
    // Ground-floor shopfront band.
    g.fillStyle = '#3a3f46';
    g.fillRect(0, 232, 128, 24);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    variants.push(tex);
  }
  return variants;
}

export function createCity(rng, scene) {
  const group = new THREE.Group();
  const colliders = []; // {minX, maxX, minZ, maxZ}
  const buildings = [];

  // Decide park blocks ONCE so texture and buildings agree.
  const centers = WORLD.roadCenters;
  const parks = new Set();
  for (let i = 0; i < centers.length - 1; i += 1) {
    for (let j = 0; j < centers.length - 1; j += 1) {
      if (rng() < 0.16) parks.add(`${i},${j}`);
    }
  }

  // --- Ground (820x820, centred z = 80 so it spans z -330..490) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GX1 - GX0, GZ1 - GZ0),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng, parks) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (GZ0 + GZ1) / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // --- Water (animated, translucent) ---
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(GX1 - GX0, GZ1 - WORLD.waterZ),
    new THREE.MeshLambertMaterial({ color: 0x2a7ab5, transparent: true, opacity: 0.85 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.15, (WORLD.waterZ + GZ1) / 2);
  group.add(water);

  // --- Buildings ---
  const facades = makeFacadeTextures();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4d52 });
  const tints = [0xd8c9b0, 0xc9b8a8, 0xb0b8c4, 0xd8b8a0, 0xa8b8a0, 0xc4b8d0];
  for (let i = 0; i < centers.length - 1; i += 1) {
    for (let j = 0; j < centers.length - 1; j += 1) {
      if (parks.has(`${i},${j}`)) continue; // park block stays empty
      const x0 = centers[i] + WORLD.roadWidth / 2 + 4;
      const z0 = centers[j] + WORLD.roadWidth / 2 + 4;
      const bw = centers[i + 1] - centers[i] - WORLD.roadWidth - 8;
      const bh = centers[j + 1] - centers[j] - WORLD.roadWidth - 8;
      if (bw < 14 || bh < 14) continue;
      const n = 1 + Math.floor(rng() * 3); // 1-3 buildings per block
      for (let k = 0; k < n; k += 1) {
        const w = 12 + rng() * Math.max(8, bw - 16);
        const d = 12 + rng() * Math.max(8, bh - 16);
        const bx = x0 + w / 2 + rng() * Math.max(0, bw - w);
        const bz = z0 + d / 2 + rng() * Math.max(0, bh - d);
        const h = 10 + rng() * rng() * 42; // mostly low, a few towers
        const facade = facades[Math.floor(rng() * facades.length)];
        const side = new THREE.MeshLambertMaterial({
          map: facade, color: tints[Math.floor(rng() * tints.length)],
        });
        const mesh = new THREE.Mesh(boxGeo, [side, side, roofMat, roofMat, side, side]);
        mesh.scale.set(w, h, d);
        mesh.position.set(bx, h / 2, bz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        buildings.push(mesh);
        colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      }
    }
  }

  // --- Palms along the beach + a few on sidewalks ---
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const frondGeo = new THREE.ConeGeometry(2.6, 1.2, 5);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3f });
  const palms = [];
  for (let i = 0; i < 28; i += 1) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.5;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let f = 0; f < 4; f += 1) {
      const frond = new THREE.Mesh(frondGeo, frondMat);
      const a = (f / 4) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      palm.add(frond);
    }
    const onBeach = i < 18;
    const c0 = centers[Math.floor(rng() * centers.length)];
    palm.position.set(
      -WORLD.size / 2 + 20 + rng() * (WORLD.size - 40),
      0,
      onBeach ? WORLD.beachZ + 6 + rng() * 26 : c0 + (rng() < 0.5 ? 12 : -12),
    );
    group.add(palm);
    palms.push(palm);
  }

  // --- Lighting ---
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.85);
  group.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.28);
  group.add(amb);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.0006;
  group.add(sun);
  group.add(sun.target);

  scene.add(group);
  scene.fog = new THREE.Fog(0xbfd8e8, 320, 900);

  const city = {
    group, colliders, buildings, water, sun, hemi, amb,
    // Push a circle (x,z,r) out of every building AABB it overlaps.
    collideCircle(x, z, r) {
      let nx = x; let nz = z;
      for (const b of colliders) {
        const cx = clamp(x, b.minX, b.maxX);
        const cz = clamp(z, b.minZ, b.maxZ);
        const dx = x - cx; const dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            nx = cx + (dx / d) * r;
            nz = cz + (dz / d) * r;
          } else {
            // Centre inside the box: push out along the smallest penetration.
            const pl = x - (b.minX - r); const pr = (b.maxX + r) - x;
            const pt = z - (b.minZ - r); const pb = (b.maxZ + r) - z;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) nx = b.minX - r;
            else if (m === pr) nx = b.maxX + r;
            else if (m === pt) nz = b.minZ - r;
            else nz = b.maxZ + r;
          }
          x = nx; z = nz;
        }
      }
      // World bounds + water edge.
      const lim = WORLD.size / 2 - 4;
      nx = clamp(x, -lim, lim);
      nz = clamp(z, -lim, WORLD.waterZ - 6);
      return { x: nx, z: nz };
    },
    nearestRoadPoint(x, z) {
      // Snap to the closest road centre-line.
      let bx = centers[0]; let bd = Infinity;
      for (const c0 of centers) { const d = Math.abs(x - c0); if (d < bd) { bd = d; bx = c0; } }
      let bz = centers[0]; bd = Infinity;
      for (const c0 of centers) { const d = Math.abs(z - c0); if (d < bd) { bd = d; bz = c0; } }
      return (Math.abs(x - bx) < Math.abs(z - bz)) ? { x: bx, z } : { x, z: bz };
    },
    randomRoadPoint(rng2) {
      const c0 = centers[Math.floor(rng2() * centers.length)];
      const along = -WORLD.size / 2 + 20 + rng2() * (WORLD.size - 40);
      return rng2() < 0.5 ? { x: c0, z: along } : { x: along, z: c0 };
    },
    setTimeOfDay(mode) {
      if (mode === 'dusk') {
        scene.background = new THREE.Color(0x2c1e3a);
        scene.fog.color.set(0x8a5a4a);
        sun.color.set(0xff9a4d);
        sun.intensity = 1.35;
        sun.position.set(-220, 90, 260);
        hemi.color.set(0x8a6a9a);
        hemi.groundColor.set(0x5a4a3a);
        hemi.intensity = 0.75;
        amb.intensity = 0.42;
      } else {
        scene.background = new THREE.Color(0x9fc8e8);
        scene.fog.color.set(0xbfd8e8);
        sun.color.set(0xfff2d0);
        sun.intensity = 1.6;
        sun.position.set(180, 260, 120);
        hemi.color.set(0xbfd8ff);
        hemi.groundColor.set(0x8a7a5a);
        hemi.intensity = 0.85;
        amb.intensity = 0.28;
      }
    },
  };
  city.setTimeOfDay('day');
  return city;
}
