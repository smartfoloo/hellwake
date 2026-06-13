import * as THREE from 'three';

const INTERMISSION = 4.5;

export class WaveManager {
  constructor(enemyManager, spawnPoints, audio, hud) {
    this.enemyManager = enemyManager;
    this.spawnPoints = spawnPoints;
    this.audio = audio;
    this.hud = hud;
    this.reset();

    enemyManager.onKill = (enemy) => {
      this.kills++;
      this.score += enemy.def.score;
    };
  }

  reset() {
    this.wave = 0;
    this.kills = 0;
    this.score = 0;
    this.state = 'intermission';
    this.timer = 2.5; // short ramp into wave 1
    this.spawnQueue = [];
    this.spawnTimer = 0;
  }

  startNextWave() {
    this.wave++;
    this.state = 'active';
    const count = Math.min(4 + this.wave * 2, 34);
    const spitterShare = Math.min(0.45, 0.08 + this.wave * 0.06);
    this.spawnQueue = [];
    for (let i = 0; i < count; i++) {
      this.spawnQueue.push(Math.random() < spitterShare ? 'spitter' : 'grunt');
    }
    this.spawnTimer = 0;
    this.audio.waveHorn();
    this.hud.banner(`WAVE ${this.wave}`);
  }

  update(dt, player) {
    if (this.state === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) this.startNextWave();
      return;
    }

    // Stagger spawns so the wave pours in rather than appearing at once
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.55;
        const type = this.spawnQueue.pop();
        const pos = this.pickSpawn(player.position);
        this.enemyManager.spawn(type, pos, this.wave);
      }
    } else if (this.enemyManager.aliveCount === 0) {
      this.state = 'intermission';
      this.timer = INTERMISSION;
      this.hud.banner(`WAVE ${this.wave} CLEARED`);
    }
  }

  pickSpawn(playerPos) {
    // Prefer spawn points the player isn't looking at / standing near
    const far = this.spawnPoints.filter((p) => p.distanceTo(playerPos) > 16);
    const pool = far.length > 0 ? far : this.spawnPoints;
    const base = pool[(Math.random() * pool.length) | 0];
    return new THREE.Vector3(
      base.x + (Math.random() - 0.5) * 4, 0, base.z + (Math.random() - 0.5) * 4
    );
  }
}
