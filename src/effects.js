import * as THREE from 'three';

// Short-lived visual effects: tracers, sparks, gibs, screenshake.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = []; // { mesh, vel?, life, maxLife, gravity?, spin? }
    this.trauma = 0;
    this.shakeOffset = new THREE.Euler();

    this.sparkGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffc14d });
    this.gibMat = new THREE.MeshBasicMaterial({ color: 0x8f1212 });
    this.gibGeo = new THREE.TetrahedronGeometry(0.16);
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  tracer(from, to, color = 0xffd27a) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.5) return;
    const geo = new THREE.BoxGeometry(0.03, 0.03, len);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.lookAt(to);
    this.scene.add(mesh);
    this.items.push({ mesh, life: 0.07, maxLife: 0.07, fade: true });
  }

  sparks(pos, count = 6, color = null) {
    const mat = color ? new THREE.MeshBasicMaterial({ color }) : this.sparkMat;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6
      );
      this.scene.add(mesh);
      this.items.push({ mesh, vel, life: 0.35, maxLife: 0.35, gravity: 14 });
    }
  }

  gibs(pos, count = 9) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.gibGeo, this.gibMat);
      mesh.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8, 2 + Math.random() * 6, (Math.random() - 0.5) * 8
      );
      this.scene.add(mesh);
      this.items.push({
        mesh, vel, life: 0.9, maxLife: 0.9, gravity: 18,
        spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
      });
    }
  }

  update(dt, camera) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.scene.remove(it.mesh);
        it.mesh.geometry !== this.sparkGeo && it.mesh.geometry !== this.gibGeo && it.mesh.geometry.dispose();
        this.items.splice(i, 1);
        continue;
      }
      if (it.vel) {
        if (it.gravity) it.vel.y -= it.gravity * dt;
        it.mesh.position.addScaledVector(it.vel, dt);
        if (it.mesh.position.y < 0.05) { it.mesh.position.y = 0.05; it.vel.y *= -0.4; it.vel.x *= 0.7; it.vel.z *= 0.7; }
      }
      if (it.spin) {
        it.mesh.rotation.x += it.spin.x * dt;
        it.mesh.rotation.y += it.spin.y * dt;
      }
      if (it.fade) it.mesh.material.opacity = 0.85 * (it.life / it.maxLife);
    }

    // Screenshake: random rotational jitter scaled by trauma^2, applied as a
    // delta so it stacks on top of mouselook without fighting it.
    camera.rotation.x -= this.shakeOffset.x;
    camera.rotation.y -= this.shakeOffset.y;
    camera.rotation.z -= this.shakeOffset.z;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const s = this.trauma * this.trauma * 0.05;
    this.shakeOffset.set(
      (Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 2
    );
    camera.rotation.x += this.shakeOffset.x;
    camera.rotation.y += this.shakeOffset.y;
    camera.rotation.z += this.shakeOffset.z;
  }
}
