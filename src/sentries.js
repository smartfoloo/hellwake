import * as THREE from 'three';
import { ARENA } from './world.js';

const STEEL = () => new THREE.MeshStandardMaterial({ color: 0x5a5a64, roughness: 0.5, metalness: 0.6 });
const DARK = () => new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.8 });
const GLOW = () => new THREE.MeshStandardMaterial({
  color: 0x2a6cff, emissive: 0x3a7cff, emissiveIntensity: 0.9, roughness: 0.4,
});

const SENTRY = {
  health: 90, range: 26, fireCooldown: 0.16, damage: 10, turnRate: 6,
};
const MAX_CARRIED = 3;

// Wrap an angle delta into (-PI, PI] so the head turns the short way.
function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function makeSentryMesh() {
  const g = new THREE.Group();
  const legMat = DARK();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.72, 6), legMat);
    leg.position.set(Math.cos(a) * 0.22, 0.34, Math.sin(a) * 0.22);
    leg.rotation.z = Math.cos(a) * 0.42;
    leg.rotation.x = -Math.sin(a) * 0.42;
    g.add(leg);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 8), STEEL());
  base.position.y = 0.68;
  g.add(base);

  const head = new THREE.Group();
  head.position.y = 0.84;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.34), STEEL());
  head.add(housing);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), GLOW());
  eye.position.set(0, 0.03, 0.19);
  head.add(eye);
  for (const s of [-1, 1]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), DARK());
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.07 * s, -0.02, -0.26);
    head.add(barrel);
  }
  g.add(head);
  g.userData.head = head;
  g.userData.eye = eye;
  return g;
}

export class SentryManager {
  constructor(scene, effects, audio, enemyManager) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.enemyManager = enemyManager;
    this.sentries = [];
    this.carried = 0;
  }

  addKit() { this.carried = Math.min(MAX_CARRIED, this.carried + 1); }

  // Drop a turret on the ground a couple metres ahead of the player.
  deploy(player) {
    if (this.carried <= 0) return false;
    const cam = player.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    const pos = player.position.clone().addScaledVector(fwd, 2.2);
    pos.y = 0;
    pos.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, pos.x));
    pos.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, pos.z));

    this.carried--;
    const mesh = makeSentryMesh();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const muzzle = new THREE.PointLight(0xbcd8ff, 0, 7, 2);
    muzzle.position.set(0, 0.84, 0);
    mesh.add(muzzle);
    this.sentries.push({
      mesh, head: mesh.userData.head, eye: mesh.userData.eye, muzzle,
      health: SENTRY.health, maxHealth: SENTRY.health,
      yaw: cam.rotation.y, cooldown: 0.3, recoil: 0, hitFlash: 0, alive: true,
    });
    this.audio.sentryDeploy();
    return true;
  }

  // Called by enemies that reach a turret.
  damage(sentry, amount) {
    if (!sentry.alive) return;
    sentry.health -= amount;
    sentry.hitFlash = 0.12;
    this.effects.sparks(sentry.mesh.position.clone().setY(0.8), 3, 0xbcd8ff);
    if (sentry.health <= 0) {
      sentry.alive = false;
      const c = sentry.mesh.position.clone().setY(0.7);
      this.effects.sparks(c, 16, 0xbcd8ff);
      this.effects.gibs(c, 6);
      this.scene.remove(sentry.mesh);
      this.audio.sentryDown();
    }
  }

  get list() { return this.sentries.filter((s) => s.alive); }

  update(dt) {
    const enemies = this.enemyManager.enemies;
    for (const s of this.sentries) {
      if (!s.alive) continue;

      s.recoil = Math.max(0, s.recoil - dt * 5);
      s.muzzle.intensity = Math.max(0, s.muzzle.intensity - dt * 70);

      // Acquire the nearest living demon within range
      let best = null, bestD = SENTRY.range;
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = s.mesh.position.distanceTo(e.mesh.position);
        if (d < bestD) { bestD = d; best = e; }
      }

      if (best) {
        const tp = best.mesh.position;
        const desired = Math.atan2(tp.x - s.mesh.position.x, tp.z - s.mesh.position.z);
        const turn = angleDiff(s.yaw, desired);
        s.yaw += Math.max(-SENTRY.turnRate * dt, Math.min(SENTRY.turnRate * dt, turn));
        s.cooldown -= dt;
        if (Math.abs(turn) < 0.22 && s.cooldown <= 0) {
          s.cooldown = SENTRY.fireCooldown;
          this.fire(s, best);
        }
      } else {
        s.yaw += dt * 0.6; // idle scan
      }
      s.head.rotation.y = s.yaw;
      s.head.position.z = s.recoil * 0.06;

      // Flash the eye red when struck, otherwise hold its blue glow
      if (s.hitFlash > 0) {
        s.hitFlash -= dt;
        s.eye.material.emissive.setHex(0xff3020);
      } else {
        s.eye.material.emissive.setHex(0x3a7cff);
      }
    }
    this.sentries = this.sentries.filter((s) => s.alive);
  }

  fire(sentry, enemy) {
    sentry.recoil = 1;
    sentry.muzzle.intensity = 10;
    const muzzle = new THREE.Vector3();
    sentry.head.getWorldPosition(muzzle);
    const target = enemy.mesh.position.clone().setY(1.2);
    this.effects.tracer(muzzle, target, 0xbcd8ff);
    this.enemyManager.damage(enemy, SENTRY.damage, target);
    this.audio.sentryShot();
  }

  clear() {
    for (const s of this.sentries) this.scene.remove(s.mesh);
    this.sentries = [];
    this.carried = 0;
  }
}
