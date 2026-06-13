import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { EnemyManager } from './enemies.js';
import { SentryManager } from './sentries.js';
import { WaveManager } from './waves.js';
import { Effects } from './effects.js';
import { AudioFX } from './audio.js';
import { HUD } from './hud.js';

const RENDER_SCALE = 0.45; // low internal res, upscaled with pixelated CSS

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth * RENDER_SCALE, innerHeight * RENDER_SCALE, false);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 250);
scene.add(camera); // viewmodel renders as a child of the camera

addEventListener('resize', () => {
  renderer.setSize(innerWidth * RENDER_SCALE, innerHeight * RENDER_SCALE, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const world = buildWorld(scene);
const input = new Input();
const audio = new AudioFX();
const hud = new HUD();
const effects = new Effects(scene);
const player = new Player(camera, input, audio, hud, effects);
const enemies = new EnemyManager(scene, effects, audio);
const sentries = new SentryManager(scene, effects, audio, enemies);
const weapons = new WeaponSystem(camera, input, audio, effects, enemies, world.solids);
const waves = new WaveManager(enemies, world.spawnPoints, audio, hud);
enemies.onAmmo = () => weapons.addAmmo();
enemies.onWeapon = (name) => weapons.addWeapon(name);
enemies.onSentryKit = () => sentries.addKit();

let state = 'menu'; // menu | playing | paused | dead
hud.showOverlay('menu');

function resetGame() {
  enemies.clear();
  sentries.clear();
  waves.reset();
  player.reset();
  weapons.reset();
  effects.trauma = 0;
  effects.shakeOffset.set(0, 0, 0);
}

function requestLock() {
  renderer.domElement.requestPointerLock();
}

document.getElementById('menu').addEventListener('click', () => {
  audio.unlock();
  resetGame();
  requestLock();
});
document.getElementById('pause').addEventListener('click', () => {
  audio.unlock();
  requestLock();
});
document.getElementById('gameover').addEventListener('click', () => {
  audio.unlock();
  resetGame();
  requestLock();
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    state = 'playing';
    player.enabled = true;
    weapons.cooldown = Math.max(weapons.cooldown, 0.3); // swallow the unlock click
    hud.showOverlay(null);
  } else {
    player.enabled = false;
    if (state === 'playing') {
      state = 'paused';
      hud.showOverlay('pause');
    }
  }
});

function die() {
  state = 'dead';
  audio.gameOver();
  hud.setGameOver(waves.wave, waves.kills, waves.score);
  hud.showOverlay('gameover');
  document.exitPointerLock();
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  world.update(t);

  if (state === 'menu') {
    // Slow idle pan behind the title screen
    camera.position.set(0, 6, 24);
    camera.rotation.set(-0.15, Math.sin(t * 0.1) * 0.4, 0);
  } else if (state === 'playing') {
    player.update(dt, world.colliders);
    if (input.pressed('KeyF')) sentries.deploy(player);
    weapons.update(dt, player, t);
    enemies.update(dt, player, world.colliders, t, sentries);
    sentries.update(dt);
    waves.update(dt, player);
    effects.update(dt, camera);
    hud.update(dt, {
      health: player.health,
      ammoText: weapons.ammoText,
      weaponName: weapons.current.name,
      wave: waves.wave,
      kills: waves.kills,
      dashFrac: player.dashFrac,
      sentryCount: sentries.carried,
      reloading: weapons.reloading,
    });
    if (!player.alive) die();
  }

  input.endFrame();
  renderer.render(scene, camera);
}

frame();
