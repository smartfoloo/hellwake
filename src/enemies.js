import * as THREE from 'three';
import { ARENA } from './world.js';

const GRUNT = {
  name: 'grunt', health: 50, speed: 4.4, damage: 12, attackRange: 1.9,
  attackCooldown: 1.0, score: 100,
};
const SPITTER = {
  name: 'spitter', health: 35, speed: 3.2, damage: 10, preferredRange: 13,
  fireCooldown: 2.1, score: 150,
};

function makeGruntMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7a1410, roughness: 0.9, flatShading: true });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.8, flatShading: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffb300 });

  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62), bodyMat);
  body.position.y = 1.0;
  body.scale.set(1, 1.25, 0.9);
  g.add(body);
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34), bodyMat);
  head.position.y = 1.85;
  g.add(head);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 5), hornMat);
    horn.position.set(0.2 * s, 2.12, 0);
    horn.rotation.z = -0.5 * s;
    g.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeMat);
    eye.position.set(0.13 * s, 1.88, 0.28);
    g.add(eye);
    const arm = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.9, 5), bodyMat);
    arm.position.set(0.68 * s, 1.05, 0.15);
    arm.rotation.x = 1.2;
    g.add(arm);
  }
  return g;
}

function makeSpitterMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d5c14, roughness: 0.9, flatShading: true });
  const sacMat = new THREE.MeshStandardMaterial({
    color: 0x6a8c1e, emissive: 0x9dff42, emissiveIntensity: 0.45, roughness: 0.7, flatShading: true,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9dff42 });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55), bodyMat);
  body.position.y = 1.5;
  g.add(body);
  const sac = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), sacMat);
  sac.position.set(0, 1.25, 0.3);
  g.add(sac);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeMat);
  eye.position.set(0, 1.68, 0.42);
  g.add(eye);
  for (const s of [-1, 1]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 5), bodyMat);
    spike.position.set(0.5 * s, 1.9, -0.1);
    spike.rotation.z = -0.9 * s;
    g.add(spike);
  }
  return g;
}

export class EnemyManager {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.onKill = null; // set by WaveManager

    this.onAmmo = null;       // set by main: generic ammo pickup
    this.onWeapon = null;     // set by main: dropped weapon pickup
    this.onSentryKit = null;  // set by main: deployable sentry pickup

    this.projGeo = new THREE.SphereGeometry(0.18, 8, 8);
    this.projMat = new THREE.MeshBasicMaterial({ color: 0x9dff42 });
    this.healthMat = new THREE.MeshBasicMaterial({ color: 0x35e02f });
    this.ammoMat = new THREE.MeshBasicMaterial({ color: 0xffc400 });
    this.sentryMat = new THREE.MeshStandardMaterial({
      color: 0x2a6cff, emissive: 0x1b4ed8, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.4,
    });
    this.weaponMat = new THREE.MeshStandardMaterial({ color: 0x6a6a74, roughness: 0.5, metalness: 0.6 });
  }

  spawn(type, pos, wave) {
    const def = type === 'spitter' ? SPITTER : GRUNT;
    const mesh = type === 'spitter' ? makeSpitterMesh() : makeGruntMesh();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const enemy = {
      def, type,
      health: def.health + wave * 4,
      mesh,
      cooldown: 1 + Math.random(),
      hitFlash: 0,
      bob: Math.random() * 10,
      alive: true,
    };
    mesh.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.enemy = enemy;
      if (o.material.emissive !== undefined) {
        o.material.userData.baseEmissive = o.material.emissive.clone();
        o.material.userData.baseIntensity = o.material.emissiveIntensity;
      }
    });
    this.enemies.push(enemy);
    return enemy;
  }

  get hittables() {
    return this.enemies.filter((e) => e.alive).map((e) => e.mesh);
  }

  damage(enemy, amount, hitPoint) {
    if (!enemy.alive) return;
    enemy.health -= amount;
    enemy.hitFlash = 0.12;
    this.effects.sparks(hitPoint, 4, 0xc81e1e);
    if (enemy.health <= 0) {
      enemy.alive = false;
      this.scene.remove(enemy.mesh);
      this.audio.enemyDie();
      const center = enemy.mesh.position.clone().setY(1.2);
      this.effects.gibs(center);
      this.maybeDrop(enemy.mesh.position);
      if (this.onKill) this.onKill(enemy);
    } else {
      this.audio.enemyHit();
    }
  }

  maybeDrop(pos) {
    const roll = Math.random();
    let kind = null;
    if (roll < 0.14) kind = 'health';
    else if (roll < 0.34) kind = 'ammo';
    else if (roll < 0.43) kind = 'sentry';
    else if (roll < 0.51) kind = 'weapon';
    if (!kind) return;
    const group = new THREE.Group();
    if (kind === 'health') {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.16), this.healthMat);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), this.healthMat);
      group.add(a, b);
    } else if (kind === 'ammo') {
      group.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.25), this.ammoMat));
    } else if (kind === 'sentry') {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), this.sentryMat);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 6), this.weaponMat);
      cap.position.y = 0.24;
      group.add(crate, cap);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.14), this.weaponMat);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), this.weaponMat);
      mag.position.set(0.06, -0.16, 0);
      group.add(body, mag);
    }
    group.position.set(pos.x, 0.6, pos.z);
    this.scene.add(group);
    this.pickups.push({ kind, mesh: group, life: kind === 'health' || kind === 'ammo' ? 20 : 28 });
  }

  get aliveCount() {
    return this.enemies.filter((e) => e.alive).length;
  }

  update(dt, player, colliders, t, sentries) {
    const playerPos = player.position;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const def = e.def;
      const pos = e.mesh.position;
      const distToPlayer = pos.distanceTo(playerPos);

      // Target selection: chase the player, unless a deployed sentry is
      // clearly closer — turrets draw aggro and can be torn down.
      let targetPos = playerPos;
      let targetSentry = null;
      if (sentries) {
        let bd = Infinity;
        for (const s of sentries.list) {
          const d = pos.distanceTo(s.mesh.position);
          if (d < bd) { bd = d; targetSentry = s; }
        }
        if (targetSentry && bd < distToPlayer - 1 && bd < 22) targetPos = targetSentry.mesh.position;
        else targetSentry = null;
      }
      const canHit = targetSentry ? targetSentry.alive : player.alive;

      const toTarget = new THREE.Vector3().subVectors(targetPos, pos);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist > 0.01) toTarget.normalize();

      // Face the target
      e.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.z);

      // Steering: chase (grunt) or hold preferred range (spitter)
      let move = 0;
      if (e.type === 'grunt') {
        move = dist > def.attackRange * 0.8 ? 1 : 0;
      } else {
        if (dist > def.preferredRange + 2) move = 1;
        else if (dist < def.preferredRange - 3) move = -1;
      }

      // Separation from other enemies so they don't stack
      const sep = new THREE.Vector3();
      for (const o of this.enemies) {
        if (o === e || !o.alive) continue;
        const d = pos.distanceTo(o.mesh.position);
        if (d < 1.6 && d > 0.01) {
          sep.add(new THREE.Vector3().subVectors(pos, o.mesh.position).divideScalar(d * d));
        }
      }

      const vel = toTarget.clone().multiplyScalar(move * def.speed).addScaledVector(sep, 2.5);
      pos.addScaledVector(vel, dt);

      // Push out of obstacles (horizontal AABB resolve) and clamp to arena
      for (const box of colliders) {
        if (pos.x > box.min.x - 0.5 && pos.x < box.max.x + 0.5 &&
            pos.z > box.min.z - 0.5 && pos.z < box.max.z + 0.5 && box.min.y < 1) {
          const dxMin = pos.x - (box.min.x - 0.5), dxMax = (box.max.x + 0.5) - pos.x;
          const dzMin = pos.z - (box.min.z - 0.5), dzMax = (box.max.z + 0.5) - pos.z;
          const m = Math.min(dxMin, dxMax, dzMin, dzMax);
          if (m === dxMin) pos.x = box.min.x - 0.5;
          else if (m === dxMax) pos.x = box.max.x + 0.5;
          else if (m === dzMin) pos.z = box.min.z - 0.5;
          else pos.z = box.max.z + 0.5;
        }
      }
      pos.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, pos.x));
      pos.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, pos.z));

      // Idle animation: grunts hop, spitters hover
      e.bob += dt * (e.type === 'grunt' ? 9 : 3);
      pos.y = e.type === 'grunt'
        ? Math.abs(Math.sin(e.bob)) * 0.18 * (move !== 0 ? 1 : 0.3)
        : 0.35 + Math.sin(e.bob) * 0.15;

      // Attacks — strike the player or claw down a turret, whichever is targeted
      e.cooldown -= dt;
      if (e.type === 'grunt') {
        if (dist < def.attackRange && e.cooldown <= 0 && canHit) {
          e.cooldown = def.attackCooldown;
          if (targetSentry) sentries.damage(targetSentry, def.damage);
          else player.takeDamage(def.damage);
        }
      } else if (e.cooldown <= 0 && dist < 30 && canHit) {
        e.cooldown = def.fireCooldown;
        const origin = pos.clone().add(new THREE.Vector3(0, 1.4, 0));
        const target = targetSentry
          ? targetSentry.mesh.position.clone().setY(0.84)
          : player.eye.clone().add(new THREE.Vector3(0, -0.25, 0));
        const dir = target.sub(origin).normalize();
        const proj = new THREE.Mesh(this.projGeo, this.projMat);
        proj.position.copy(origin);
        this.scene.add(proj);
        this.projectiles.push({ mesh: proj, vel: dir.multiplyScalar(13), life: 4, damage: def.damage });
        this.audio.spit();
      }

      // Hit flash: blast all materials white briefly, then restore
      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        const on = e.hitFlash > 0;
        e.mesh.traverse((o) => {
          if (!o.isMesh || o.material.emissive === undefined) return;
          if (on) {
            o.material.emissive.set(0xffffff);
            o.material.emissiveIntensity = 0.9;
          } else {
            o.material.emissive.copy(o.material.userData.baseEmissive);
            o.material.emissiveIntensity = o.material.userData.baseIntensity;
          }
        });
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const hitPlayer = player.alive &&
        p.mesh.position.distanceTo(player.eye) < 0.9;
      let hitSentry = null;
      if (!hitPlayer && sentries) {
        for (const s of sentries.list) {
          if (p.mesh.position.distanceTo(s.mesh.position.clone().setY(0.84)) < 0.7) { hitSentry = s; break; }
        }
      }
      let hitWall = p.mesh.position.y < 0 || Math.abs(p.mesh.position.x) > ARENA || Math.abs(p.mesh.position.z) > ARENA;
      if (!hitWall) {
        for (const box of colliders) {
          if (box.containsPoint(p.mesh.position)) { hitWall = true; break; }
        }
      }
      if (hitPlayer) player.takeDamage(p.damage);
      else if (hitSentry) sentries.damage(hitSentry, p.damage);
      if (hitPlayer || hitSentry || hitWall || p.life <= 0) {
        this.effects.sparks(p.mesh.position, 4, 0x9dff42);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Pickups: spin, bob, collect
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt;
      pk.mesh.rotation.y += dt * 3;
      pk.mesh.position.y = 0.6 + Math.sin(t * 3 + i) * 0.12;
      const taken = player.alive && pk.mesh.position.distanceTo(playerPos.clone().setY(0.6)) < 1.2;
      if (taken) {
        if (pk.kind === 'health') player.heal(25);
        else if (pk.kind === 'ammo') { if (this.onAmmo) this.onAmmo(); }
        else if (pk.kind === 'sentry') { if (this.onSentryKit) this.onSentryKit(); }
        else if (pk.kind === 'weapon') { if (this.onWeapon) this.onWeapon('AR'); }
        this.audio.pickup(pk.kind);
      }
      if (taken || pk.life <= 0) {
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  clear() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const pk of this.pickups) this.scene.remove(pk.mesh);
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
  }
}
