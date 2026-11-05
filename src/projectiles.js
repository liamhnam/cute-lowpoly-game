import * as THREE from 'three';
import { sound } from './audio.js';
import { getTerrainHeight } from './world.js';

export class ProjectileSystem {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.projectiles = [];

    // Tái sử dụng hình học và vật liệu
    this.bulletGeo = new THREE.DodecahedronGeometry(0.22, 1);
    this.bulletMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe, // Xanh băng năng lượng phát sáng
    });
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x4facfe,
      transparent: true,
      opacity: 0.5,
    });
  }

  spawnBullet(origin, direction) {
    const bulletGroup = new THREE.Group();
    bulletGroup.position.copy(origin);

    const core = new THREE.Mesh(this.bulletGeo, this.bulletMat);
    bulletGroup.add(core);

    const glow = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 1), this.glowMat);
    bulletGroup.add(glow);

    this.scene.add(bulletGroup);

    this.projectiles.push({
      mesh: bulletGroup,
      velocity: direction.clone().normalize().multiplyScalar(42), // 42 m/s
      life: 2.2, // Tồn tại tối đa 2.2 giây
      radius: 0.6,
    });
  }

  update(delta, monsters) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;

      // Di chuyển viên đạn
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Xoay nhẹ viên đạn năng lượng
      p.mesh.rotation.x += 8 * delta;
      p.mesh.rotation.y += 8 * delta;

      const pos = p.mesh.position;
      let hit = false;

      // 1. Kiểm tra va chạm với Quái vật
      if (monsters && monsters.length > 0) {
        for (const monster of monsters) {
          if (!monster.isDead && monster.checkCollision(pos, p.radius)) {
            monster.takeDamage(25, pos);
            this.particles.emitHitSparkles(pos, 10);
            sound.playHit();
            hit = true;
            break;
          }
        }
      }

      // 2. Kiểm tra va chạm mặt đất
      const groundY = getTerrainHeight(pos.x, pos.z);
      if (!hit && pos.y <= groundY + 0.15) {
        this.particles.emitHitSparkles(pos, 5);
        sound.playHit();
        hit = true;
      }

      // Hết thời gian hoặc đã bắn trúng
      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }
}
