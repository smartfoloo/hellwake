import * as THREE from 'three';

const STEEL = () => new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.6, metalness: 0.5 });
const DARK = () => new THREE.MeshStandardMaterial({ color: 0x26262c, roughness: 0.8 });
const WOOD = () => new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.95 });

function pistolMesh() {
  const g = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.34), STEEL());
  slide.position.set(0, 0.02, -0.1);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8), DARK());
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.31);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.18, 0.09), WOOD());
  grip.position.set(0, -0.1, 0.02);
  grip.rotation.x = 0.25;
  g.add(slide, barrel, grip);
  return g;
}

function shotgunMesh() {
  const g = new THREE.Group();
  const barrelMat = DARK();
  for (const s of [-1, 1]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.038 * s, 0.03, -0.3);
    g.add(barrel);
  }
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.26), STEEL());
  receiver.position.set(0, 0, 0.05);
  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.18), WOOD());
  pump.position.set(0, -0.02, -0.28);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.22), WOOD());
  stock.position.set(0, -0.05, 0.25);
  stock.rotation.x = -0.2;
  g.add(receiver, pump, stock);
  return g;
}

function ripperMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.4), STEEL());
  body.position.set(0, 0, -0.05);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.3, 8), DARK());
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.025, -0.38);
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 8), STEEL());
  shroud.rotation.x = Math.PI / 2;
  shroud.position.set(0, 0.025, -0.3);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.08), DARK());
  mag.position.set(0, -0.15, -0.05);
  mag.rotation.x = 0.15;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), WOOD());
  grip.position.set(0, -0.11, 0.12);
  grip.rotation.x = 0.3;
  g.add(body, barrel, shroud, mag, grip);
  return g;
}

function arMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), STEEL());
  body.position.set(0, 0, -0.05);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.36, 8), DARK());
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.42);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.24), DARK());
  handguard.position.set(0, 0.01, -0.28);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.1), DARK());
  mag.position.set(0, -0.16, -0.02);
  mag.rotation.x = -0.2;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.2), DARK());
  stock.position.set(0, -0.02, 0.22);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.07), DARK());
  grip.position.set(0, -0.1, 0.1);
  grip.rotation.x = 0.35;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.06), STEEL());
  sight.position.set(0, 0.08, 0.0);
  g.add(body, barrel, handguard, mag, stock, grip, sight);
  g.userData.mag = mag; // animated during reload
  return g;
}

const WEAPON_DEFS = [
  {
    name: 'PISTOL', auto: false, rate: 0.26, damage: 26, pellets: 1, spread: 0.012,
    ammo: Infinity, kick: 0.05, mesh: pistolMesh,
  },
  {
    name: 'SHOTGUN', auto: false, rate: 0.85, damage: 11, pellets: 8, spread: 0.07,
    ammo: 24, maxAmmo: 64, pickupAmmo: 12, kick: 0.14, mesh: shotgunMesh,
  },
  {
    name: 'RIPPER', auto: true, rate: 0.085, damage: 11, pellets: 1, spread: 0.038,
    ammo: 120, maxAmmo: 360, pickupAmmo: 60, kick: 0.03, mesh: ripperMesh,
  },
  {
    // Dropped by demons — locked until you grab one off a corpse.
    name: 'AR', auto: true, rate: 0.1, damage: 19, pellets: 1, spread: 0.02,
    kick: 0.045, mesh: arMesh, locked: true,
    magSize: 30, mag: 30, reserve: 90, reserveMax: 240, pickupReserve: 60, reloadTime: 1.5,
  },
];

export class WeaponSystem {
  constructor(camera, input, audio, effects, enemyManager, solids) {
    this.camera = camera;
    this.input = input;
    this.audio = audio;
    this.effects = effects;
    this.enemyManager = enemyManager;
    this.solids = solids;

    this.raycaster = new THREE.Raycaster();
    this.cooldown = 0;
    this.switchAnim = 0;
    this.recoil = 0;
    this.swayPhase = 0;
    this.reloadTimer = 0;

    this.holder = new THREE.Group();
    this.holder.position.set(0.32, -0.3, -0.62);
    camera.add(this.holder);

    this.weapons = WEAPON_DEFS.map((def) => ({ ...def, model: def.mesh() }));
    for (const w of this.weapons) {
      w.model.visible = false;
      this.holder.add(w.model);
    }
    this.index = 0;
    this.weapons[0].model.visible = true;

    this.flash = new THREE.PointLight(0xffa030, 0, 8, 2);
    this.flash.position.set(0, 0.05, -0.5);
    this.holder.add(this.flash);
    const flashQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0, depthTest: false })
    );
    flashQuad.position.set(0, 0.04, -0.55);
    this.flashQuad = flashQuad;
    this.holder.add(flashQuad);
  }

  get current() { return this.weapons[this.index]; }

  reset() {
    for (const w of this.weapons) {
      const def = WEAPON_DEFS.find((d) => d.name === w.name);
      if (w.maxAmmo) w.ammo = def.ammo;
      if (w.magSize) { w.mag = def.mag; w.reserve = def.reserve; }
      w.locked = !!def.locked;
    }
    this.reloadTimer = 0;
    this.setWeapon(0, true);
    this.cooldown = 0;
  }

  setWeapon(i, silent = false) {
    if (this.weapons[i].locked) return;
    if (i === this.index && !silent) return;
    this.current.model.visible = false;
    this.index = i;
    this.current.model.visible = true;
    this.switchAnim = 0.22;
    this.reloadTimer = 0; // switching cancels a reload
    if (!silent) this.audio.switchWeapon();
  }

  // Unlock + restock a dropped weapon, then equip it. Returns true the first time.
  addWeapon(name) {
    const i = this.weapons.findIndex((w) => w.name === name);
    if (i < 0) return false;
    const w = this.weapons[i];
    const def = WEAPON_DEFS.find((d) => d.name === name);
    const firstTime = w.locked;
    w.locked = false;
    if (w.magSize) {
      if (firstTime) { w.mag = def.magSize; w.reserve = def.reserve; }
      else w.reserve = Math.min(w.reserveMax, w.reserve + def.pickupReserve);
    } else if (w.maxAmmo) {
      w.ammo = Math.min(w.maxAmmo, w.ammo + (def.pickupAmmo || 0));
    }
    this.setWeapon(i);
    return firstTime;
  }

  addAmmo() {
    for (const w of this.weapons) {
      if (w.locked) continue;
      if (w.maxAmmo) w.ammo = Math.min(w.maxAmmo, w.ammo + w.pickupAmmo);
      else if (w.magSize) w.reserve = Math.min(w.reserveMax, w.reserve + w.pickupReserve);
    }
  }

  get reloading() { return this.reloadTimer > 0; }

  startReload() {
    const w = this.current;
    if (!w.magSize || this.reloadTimer > 0) return;
    if (w.mag >= w.magSize || w.reserve <= 0) return;
    this.reloadTimer = w.reloadTime;
    this.audio.reload();
  }

  finishReload() {
    const w = this.current;
    const take = Math.min(w.magSize - w.mag, w.reserve);
    w.mag += take;
    w.reserve -= take;
  }

  get ammoText() {
    const w = this.current;
    if (w.magSize) return this.reloading ? `·· / ${w.reserve}` : `${w.mag} / ${w.reserve}`;
    return w.ammo === Infinity ? '∞' : String(w.ammo);
  }

  update(dt, player, t) {
    const { input } = this;

    // Switching: number keys + scroll wheel (locked weapons are skipped)
    if (input.pressed('Digit1')) this.setWeapon(0);
    if (input.pressed('Digit2')) this.setWeapon(1);
    if (input.pressed('Digit3')) this.setWeapon(2);
    if (input.pressed('Digit4')) this.setWeapon(3);
    const wheel = input.consumeWheel();
    if (wheel !== 0) {
      let n = this.index;
      for (let k = 0; k < this.weapons.length; k++) {
        n = (n + (wheel > 0 ? 1 : -1) + this.weapons.length) % this.weapons.length;
        if (!this.weapons[n].locked) break;
      }
      this.setWeapon(n);
    }

    this.cooldown -= dt;
    this.switchAnim = Math.max(0, this.switchAnim - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);

    // Reload (manual R, or auto when the magazine runs dry on the trigger)
    if (input.pressed('KeyR')) this.startReload();
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }

    // Hold-to-fire for everything; per-weapon rate keeps semi-autos honest
    if (input.mouseDown && this.cooldown <= 0 && this.switchAnim <= 0
        && this.reloadTimer <= 0 && player.alive) {
      this.fire();
    }

    // Viewmodel motion: sway with movement, kick with recoil, dip on switch
    const hSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    this.swayPhase += dt * (2 + hSpeed * 1.3);
    const sway = Math.min(1, hSpeed / 6);
    // Reload dip: tuck the gun down and rock it while swapping mags
    let reloadDip = 0, reloadRock = 0;
    if (this.reloading) {
      const f = 1 - this.reloadTimer / this.current.reloadTime;
      reloadDip = Math.sin(f * Math.PI) * 0.16;
      reloadRock = Math.sin(f * Math.PI) * 0.5;
      const mag = this.current.model.userData.mag;
      if (mag) mag.position.y = -0.16 - Math.sin(f * Math.PI) * 0.12;
    }
    this.holder.position.x = 0.32 + Math.sin(this.swayPhase) * 0.012 * sway;
    this.holder.position.y = -0.3 + Math.abs(Math.cos(this.swayPhase)) * 0.014 * sway
      - (this.switchAnim > 0 ? this.switchAnim * 1.2 : 0) - reloadDip;
    this.holder.position.z = -0.62 + this.recoil * 0.12;
    this.holder.rotation.x = this.recoil * 0.5 + reloadRock;

    // Muzzle flash decay
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 220);
    this.flashQuad.material.opacity = Math.max(0, this.flashQuad.material.opacity - dt * 14);
    this.flashQuad.rotation.z = t * 20;
  }

  fire() {
    const w = this.current;
    if (w.magSize) {
      if (w.mag <= 0) {
        if (w.reserve > 0) this.startReload();
        else { this.audio.dryFire(); this.cooldown = 0.3; }
        return;
      }
      w.mag--;
    } else {
      if (w.ammo <= 0) {
        this.audio.dryFire();
        this.cooldown = 0.3;
        return;
      }
      if (w.ammo !== Infinity) w.ammo--;
    }
    this.cooldown = w.rate;
    this.recoil = Math.min(1, this.recoil + w.kick * 6);
    this.camera.rotation.x += w.kick * 0.25;
    this.audio.shot(w.name);
    this.effects.shake(w.kick * 1.4);
    this.flash.intensity = 30;
    this.flashQuad.material.opacity = 0.9;

    const muzzle = new THREE.Vector3();
    this.flash.getWorldPosition(muzzle);
    const targets = [...this.enemyManager.hittables, ...this.solids];

    for (let p = 0; p < w.pellets; p++) {
      const dir = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(this.camera.quaternion);
      dir.x += (Math.random() - 0.5) * 2 * w.spread;
      dir.y += (Math.random() - 0.5) * 2 * w.spread;
      dir.z += (Math.random() - 0.5) * 2 * w.spread;
      dir.normalize();

      this.raycaster.set(this.camera.getWorldPosition(new THREE.Vector3()), dir);
      this.raycaster.far = 120;
      const hits = this.raycaster.intersectObjects(targets, true);
      const hit = hits.find((h) => h.object.visible);

      const end = hit ? hit.point : this.raycaster.ray.at(60, new THREE.Vector3());
      this.effects.tracer(muzzle, end);

      if (hit) {
        let node = hit.object;
        let enemy = null;
        while (node) {
          if (node.userData.enemy) { enemy = node.userData.enemy; break; }
          node = node.parent;
        }
        if (enemy) {
          this.enemyManager.damage(enemy, w.damage, hit.point);
        } else {
          this.effects.sparks(hit.point, 3);
        }
      }
    }
  }
}
