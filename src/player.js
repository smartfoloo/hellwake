import * as THREE from 'three';
import { ARENA } from './world.js';

const EYE_HEIGHT = 1.6;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.45;
const WALK_SPEED = 6.2;
const SPRINT_SPEED = 9.4;
const JUMP_VEL = 7.5;
const GRAVITY = 22;
const DASH_SPEED = 19;
const DASH_TIME = 0.16;
const DASH_COOLDOWN = 2.0;

export class Player {
  constructor(camera, input, audio, hud, effects) {
    this.camera = camera;
    this.input = input;
    this.audio = audio;
    this.hud = hud;
    this.effects = effects;

    camera.rotation.order = 'YXZ';
    this.position = new THREE.Vector3(0, 0, 20); // feet
    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.bobPhase = 0;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.alive = true;

    this.enabled = false; // pointer lock mouselook gate
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      camera.rotation.y -= e.movementX * 0.0023;
      camera.rotation.x -= e.movementY * 0.0023;
      camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
    });
  }

  reset() {
    this.position.set(0, 0, 20);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.alive = true;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.camera.rotation.set(0, 0, 0); // yaw 0 faces -Z, toward the arena center
  }

  get dashFrac() {
    return 1 - this.dashCooldown / DASH_COOLDOWN;
  }

  get eye() {
    return new THREE.Vector3(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health = Math.max(0, Math.round(this.health - amount));
    this.audio.hurt();
    this.hud.damageFlash();
    this.effects.shake(0.45);
    if (this.health <= 0) this.alive = false;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  update(dt, colliders) {
    const { input, camera } = this;

    // Wish direction in camera-yaw space
    let fwd = 0, side = 0;
    if (input.down('KeyW')) fwd += 1;
    if (input.down('KeyS')) fwd -= 1;
    if (input.down('KeyD')) side += 1;
    if (input.down('KeyA')) side -= 1;
    // forward = (-sin yaw, 0, -cos yaw), right = (cos yaw, 0, -sin yaw)
    const yaw = camera.rotation.y;
    const dir = new THREE.Vector3(
      -Math.sin(yaw) * fwd + Math.cos(yaw) * side, 0,
      -Math.cos(yaw) * fwd - Math.sin(yaw) * side
    );
    if (dir.lengthSq() > 0) dir.normalize();

    const sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;

    // Dash
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (input.pressed('KeyQ') && this.dashCooldown <= 0 && this.alive) {
      const dashDir = dir.lengthSq() > 0
        ? dir.clone()
        : new THREE.Vector3(Math.sin(-yaw), 0, -Math.cos(-yaw)); // forward if standing still
      this.velocity.x = dashDir.x * DASH_SPEED;
      this.velocity.z = dashDir.z * DASH_SPEED;
      this.dashTimer = DASH_TIME;
      this.dashCooldown = DASH_COOLDOWN;
      this.audio.dash();
      this.effects.shake(0.18);
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
    } else {
      // Snappy approach toward wish velocity
      const accel = this.onGround ? 14 : 4;
      const t = Math.min(1, accel * dt);
      this.velocity.x += (dir.x * speed - this.velocity.x) * t;
      this.velocity.z += (dir.z * speed - this.velocity.z) * t;
    }

    // Jump + gravity
    if (input.pressed('Space') && this.onGround && this.alive) {
      this.velocity.y = JUMP_VEL;
      this.onGround = false;
    }
    this.velocity.y -= GRAVITY * dt;

    this.moveWithCollisions(dt, colliders);

    // Camera placement with head-bob while grounded and moving
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && hSpeed > 1) {
      this.bobPhase += dt * hSpeed * 1.55;
    }
    const bob = Math.sin(this.bobPhase) * 0.045 * Math.min(1, hSpeed / WALK_SPEED);
    camera.position.set(this.position.x, this.position.y + EYE_HEIGHT + bob, this.position.z);

    // FOV kick when sprinting/dashing
    const targetFov = this.dashTimer > 0 ? 96 : (sprinting && hSpeed > 5 ? 84 : 78);
    camera.fov += (targetFov - camera.fov) * Math.min(1, 10 * dt);
    camera.updateProjectionMatrix();
  }

  moveWithCollisions(dt, colliders) {
    const p = this.position;
    const r = PLAYER_RADIUS;

    const overlaps = (box) =>
      p.x + r > box.min.x && p.x - r < box.max.x &&
      p.z + r > box.min.z && p.z - r < box.max.z &&
      p.y + PLAYER_HEIGHT > box.min.y && p.y < box.max.y;

    // X axis
    p.x += this.velocity.x * dt;
    for (const box of colliders) {
      if (!overlaps(box)) continue;
      p.x = this.velocity.x > 0 ? box.min.x - r : box.max.x + r;
      this.velocity.x = 0;
    }
    p.x = Math.max(-ARENA + r, Math.min(ARENA - r, p.x));

    // Z axis
    p.z += this.velocity.z * dt;
    for (const box of colliders) {
      if (!overlaps(box)) continue;
      p.z = this.velocity.z > 0 ? box.min.z - r : box.max.z + r;
      this.velocity.z = 0;
    }
    p.z = Math.max(-ARENA + r, Math.min(ARENA - r, p.z));

    // Y axis
    this.onGround = false;
    p.y += this.velocity.y * dt;
    for (const box of colliders) {
      if (!overlaps(box)) continue;
      if (this.velocity.y <= 0) {
        p.y = box.max.y;
        this.onGround = true;
      } else {
        p.y = box.min.y - PLAYER_HEIGHT;
      }
      this.velocity.y = 0;
    }
    if (p.y <= 0) {
      p.y = 0;
      this.velocity.y = 0;
      this.onGround = true;
    }
  }
}
