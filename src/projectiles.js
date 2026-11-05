import * as THREE from 'three';
import { sound } from './audio.js';
import { getTerrainHeight } from './world.js';

export class ProjectileSystem {
  constructor(scene, particles, world = null) {
    this.scene = scene;
    this.particles = particles;
    this.world = world;
    this.projectiles = [];

    // Tái sử dụng hình học và vật liệu
    this.bulletGeo = new THREE.DodecahedronGeometry(0.24, 1);
    this.bulletMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe, // Xanh băng năng lượng phát sáng rực rỡ
    });
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x4facfe,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
  }

  spawnBullet(origin, direction) {
    const bulletGroup = new THREE.Group();
    bulletGroup.position.copy(origin);

    const core = new THREE.Mesh(this.bulletGeo, this.bulletMat);
    bulletGroup.add(core);

    const glow = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), this.glowMat);
    bulletGroup.add(glow);

    // Điểm sáng đạn bay
    const light = new THREE.PointLight(0x00f2fe, 1.8, 6.0);
    bulletGroup.add(light);

    this.scene.add(bulletGroup);

    this.projectiles.push({
      mesh: bulletGroup,
      velocity: direction.clone().normalize().multiplyScalar(46), // 46 m/s cực kì nhanh và đầm
      life: 2.2,
      radius: 0.65,
      trailTimer: 0,
    });

    // Bụi lửa nòng súng khi bắn
    if (this.particles) {
      this.particles.emitElementalParticles(origin, 4, [0x00f2fe, 0xffffff], [1, 3], 0.25, 0, 0.4);
    }
  }

  update(delta, monsters) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;
      p.trailTimer += delta;

      // Di chuyển viên đạn
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Xoay nhẹ viên đạn năng lượng
      p.mesh.rotation.x += 10 * delta;
      p.mesh.rotation.y += 10 * delta;

      // Hạt đuôi năng lượng (Bullet Trail)
      if (p.trailTimer > 0.035 && this.particles) {
        p.trailTimer = 0;
        this.particles.emitElementalParticles(
          p.mesh.position,
          1,
          [0x00f2fe, 0x4facfe, 0xffffff],
          [0.2, 0.8],
          0.3,
          0,
          0.45
        );
      }

      const pos = p.mesh.position;
      let hit = false;

      // 1. Kiểm tra va chạm với Quái vật
      if (monsters && monsters.length > 0) {
        for (const monster of monsters) {
          if (!monster.isDead && monster.checkCollision(pos, p.radius)) {
            monster.takeDamage(25, pos);
            if (this.particles) {
              this.particles.emitHitSparkles(pos, 12);
              this.particles.emitShockwave(pos, 0x00f2fe, 2.5, 0.25);
            }
            sound.playHit();
            hit = true;
            break;
          }
        }
      }

      // 2. Kiểm tra va chạm với Vật thể môi trường & Công trình kiến trúc
      if (!hit && this.world) {
        const hitWorldObj = this.world.checkBulletCollision(pos, p.radius, 25);
        if (hitWorldObj && hitWorldObj.hit) {
          hit = true;
        }
      }

      // 3. Kiểm tra va chạm mặt đất
      const groundY = getTerrainHeight(pos.x, pos.z);
      if (!hit && pos.y <= groundY + 0.18) {
        if (this.particles) {
          this.particles.emitHitSparkles(pos, 8);
          this.particles.emitShockwave(pos, 0x00f2fe, 2.0, 0.25);
        }
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
