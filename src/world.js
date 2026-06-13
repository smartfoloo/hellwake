import * as THREE from 'three';

export const ARENA = 38; // half-extent of the playable square

// Procedural pixel-art texture: tiled panels with grime, NearestFilter for crunch.
function makeTexture({ base, line, grime, tiles = 4, size = 64 }) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // grime noise
  for (let i = 0; i < size * size * 0.25; i++) {
    g.fillStyle = Math.random() < 0.5 ? grime : base;
    g.globalAlpha = 0.18 + Math.random() * 0.2;
    g.fillRect((Math.random() * size) | 0, (Math.random() * size) | 0, 1, 1);
  }
  g.globalAlpha = 1;
  // panel lines
  g.fillStyle = line;
  const step = size / tiles;
  for (let i = 0; i <= tiles; i++) {
    g.fillRect(0, i * step, size, 1);
    g.fillRect(i * step, 0, 1, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x070304);
  scene.fog = new THREE.FogExp2(0x0d0505, 0.024);

  const colliders = []; // THREE.Box3 list for movement
  const solids = [];    // meshes for bullet occlusion

  const floorTex = makeTexture({ base: '#2a201c', line: '#15100d', grime: '#3a2418', tiles: 2 });
  floorTex.repeat.set(ARENA / 2, ARENA / 2);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  solids.push(floor);

  const wallTex = makeTexture({ base: '#3b2a22', line: '#1c120c', grime: '#52301c', tiles: 4 });
  wallTex.repeat.set(10, 1.2);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 });
  const wallH = 9;
  const wallGeo = new THREE.BoxGeometry(ARENA * 2 + 4, wallH, 2);
  for (const [x, z, ry] of [
    [0, -ARENA - 1, 0], [0, ARENA + 1, 0],
    [-ARENA - 1, 0, Math.PI / 2], [ARENA + 1, 0, Math.PI / 2],
  ]) {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(x, wallH / 2, z);
    wall.rotation.y = ry;
    scene.add(wall);
    solids.push(wall);
    colliders.push(new THREE.Box3().setFromObject(wall));
  }

  // Lava trim glowing at the base of each wall
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5a14 });
  const trimGeo = new THREE.BoxGeometry(ARENA * 2, 0.25, 0.5);
  for (const [x, z, ry] of [
    [0, -ARENA + 0.2, 0], [0, ARENA - 0.2, 0],
    [-ARENA + 0.2, 0, Math.PI / 2], [ARENA - 0.2, 0, Math.PI / 2],
  ]) {
    const trim = new THREE.Mesh(trimGeo, lavaMat);
    trim.position.set(x, 0.12, z);
    trim.rotation.y = ry;
    scene.add(trim);
  }

  // Obstacles: pillars and crates, placed symmetrically with jitter
  const pillarTex = makeTexture({ base: '#33241e', line: '#170e09', grime: '#4a2a16', tiles: 3 });
  const pillarMat = new THREE.MeshStandardMaterial({ map: pillarTex, roughness: 1 });
  const crateTex = makeTexture({ base: '#4a3520', line: '#241608', grime: '#5c4426', tiles: 2 });
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 1 });

  function addBox(x, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    scene.add(m);
    solids.push(m);
    colliders.push(new THREE.Box3().setFromObject(m));
  }

  for (const [px, pz] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) {
    addBox(px, pz, 3.4, 8, 3.4, pillarMat);
  }
  addBox(0, -12, 5, 2.2, 2.4, crateMat);
  addBox(0, 12, 5, 2.2, 2.4, crateMat);
  addBox(-12, 0, 2.4, 2.2, 5, crateMat);
  addBox(12, 0, 2.4, 2.2, 5, crateMat);
  addBox(-26, 8, 2.2, 1.4, 2.2, crateMat);
  addBox(26, -8, 2.2, 1.4, 2.2, crateMat);
  addBox(8, 26, 2.2, 1.4, 2.2, crateMat);
  addBox(-8, -26, 2.2, 1.4, 2.2, crateMat);

  // Central altar — a low platform you can hop onto
  addBox(0, 0, 6, 1.1, 6, pillarMat);

  // Lighting: dim ambience plus flickering ember points
  scene.add(new THREE.HemisphereLight(0x3a2026, 0x100604, 1.2));
  const moon = new THREE.DirectionalLight(0x66303a, 0.5);
  moon.position.set(20, 40, 10);
  scene.add(moon);

  const flickers = [];
  for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18], [0, 0]]) {
    const light = new THREE.PointLight(0xff6a1a, 60, 36, 1.8);
    light.position.set(x, 6.5, z);
    scene.add(light);
    flickers.push({ light, base: 60, seed: Math.random() * 100 });
    // ember cap on pillars
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), lavaMat);
    cap.position.set(x, x === 0 && z === 0 ? 1.35 : 8.2, z);
    scene.add(cap);
  }

  // Spawn points around the perimeter for enemies
  const spawnPoints = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    spawnPoints.push(new THREE.Vector3(Math.cos(a) * (ARENA - 5), 0, Math.sin(a) * (ARENA - 5)));
  }

  function update(t) {
    for (const f of flickers) {
      f.light.intensity = f.base * (0.78 + 0.22 * Math.abs(Math.sin(t * 9 + f.seed) * Math.sin(t * 3.7 + f.seed * 2)));
    }
  }

  return { colliders, solids, spawnPoints, update };
}
