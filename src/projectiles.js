import * as THREE from 'three';
import { sound } from './audio.js';
import { getTerrainHeight } from './world.js';

const MELEE_DAMAGE = 40;
const MELEE_RANGE = 3.4;
const MELEE_ARC_COS = Math.cos(Math.PI / 3); // nửa góc 60° → cung chém 120°
const QI_DAMAGE = 20;

export class ProjectileSystem {
  constructor(scene, particles, world = null) {
    this.scene = scene;
    this.particles = particles;
    this.world = world;
    this.projectiles = [];
    this.slashArcs = [];

    // Vòng cung chém cận chiến (nằm ngang, cung 120° hướng về +x trước khi xoay)
    this.slashArcGeo = new THREE.RingGeometry(1.0, MELEE_RANGE, 18, 1, -Math.PI / 3, (Math.PI * 2) / 3);
    this.slashArcGeo.rotateX(-Math.PI / 2);
    this.slashArcMat = new THREE.MeshBasicMaterial({
      color: 0xe0fbfc,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Kiếm khí trăng lưỡi liềm
    this.qiGeo = new THREE.RingGeometry(0.75, 1.15, 14, 1, -Math.PI / 3, (Math.PI * 2) / 3);
    this.qiGeo.rotateX(-Math.PI / 2);
    this.qiMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe, // Xanh băng năng lượng phát sáng rực rỡ
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  // Góc xoay quanh trục Y để đưa hướng +x của hình cung về hướng dir
  static yawFor(dir) {
    return Math.atan2(-dir.z, dir.x);
  }

  // Chém vòng cung trước mặt: trúng mọi quái trong hình quạt 120°, tầm MELEE_RANGE
  slash(center, direction, monsters) {
    const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();

    const arc = new THREE.Mesh(this.slashArcGeo, this.slashArcMat.clone());
    arc.position.set(center.x, center.y - 0.3, center.z);
    arc.rotation.y = ProjectileSystem.yawFor(dir);
    this.scene.add(arc);
    this.slashArcs.push({ mesh: arc, life: 0.2, maxLife: 0.2 });

    let hitAny = false;
    for (const monster of monsters || []) {
      if (monster.isDead) continue;
      const dx = monster.position.x - center.x;
      const dz = monster.position.z - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist - monster.hitRadius > MELEE_RANGE) continue;
      if (center.y < monster.position.y - 1.0 || center.y > monster.position.y + monster.hitHeight) continue;
      // Đứng sát (trong thân quái) thì luôn trúng, còn lại phải nằm trong cung chém
      if (dist > monster.hitRadius && (dx * dir.x + dz * dir.z) / dist < MELEE_ARC_COS) continue;

      const hitPos = new THREE.Vector3(
        monster.position.x - (dx / Math.max(dist, 0.001)) * Math.min(dist, monster.hitRadius),
        center.y,
        monster.position.z - (dz / Math.max(dist, 0.001)) * Math.min(dist, monster.hitRadius)
      );
      monster.takeDamage(MELEE_DAMAGE, hitPos);
      if (this.particles) {
        this.particles.emitHitSparkles(hitPos, 14);
        this.particles.emitShockwave(hitPos, 0xe0fbfc, 2.5, 0.25);
      }
      hitAny = true;
    }

    // Chém vỡ vật thể môi trường phía trước
    if (this.world) {
      const worldHitPos = center.clone().addScaledVector(dir, MELEE_RANGE * 0.6);
      const hitWorldObj = this.world.checkBulletCollision(worldHitPos, 1.4, MELEE_DAMAGE);
      if (hitWorldObj && hitWorldObj.hit) hitAny = true;
    }

    if (hitAny) sound.playHit();
    return hitAny;
  }

  // Phóng kiếm khí bay ngang theo hướng direction
  spawnSwordQi(origin, direction) {
    const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();

    const qi = new THREE.Mesh(this.qiGeo, this.qiMat);
    qi.position.copy(origin);
    qi.rotation.y = ProjectileSystem.yawFor(dir);
    this.scene.add(qi);

    this.projectiles.push({
      mesh: qi,
      dir,
      velocity: dir.clone().multiplyScalar(32),
      life: 0.9,
      radius: 0.9,
      trailTimer: 0,
    });

    if (this.particles) {
      this.particles.emitElementalParticles(origin, 4, [0x00f2fe, 0xffffff], [1, 3], 0.25, 0, 0.4);
    }
  }

  update(delta, monsters) {
    for (let i = this.slashArcs.length - 1; i >= 0; i--) {
      const s = this.slashArcs[i];
      s.life -= delta;
      const t = 1.0 - Math.max(0, s.life) / s.maxLife;
      s.mesh.scale.setScalar(0.8 + t * 0.35);
      s.mesh.material.opacity = 0.85 * (1.0 - t);
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.material.dispose();
        this.slashArcs.splice(i, 1);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;
      p.trailTimer += delta;

      // Di chuyển kiếm khí
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Kiếm khí nở rộng dần theo tầm bay
      p.mesh.scale.setScalar(1.0 + (0.9 - p.life) * 0.4);

      // Điểm va chạm nằm ở mép cung phía trước
      const pos = p.mesh.position.clone().addScaledVector(p.dir, 0.95);

      // Hạt đuôi năng lượng (Qi Trail)
      if (p.trailTimer > 0.035 && this.particles) {
        p.trailTimer = 0;
        this.particles.emitElementalParticles(
          pos,
          1,
          [0x00f2fe, 0x4facfe, 0xffffff],
          [0.2, 0.8],
          0.3,
          0,
          0.45
        );
      }

      let hit = false;

      // 1. Kiểm tra va chạm với Quái vật
      if (monsters && monsters.length > 0) {
        for (const monster of monsters) {
          if (!monster.isDead && monster.checkCollision(pos, p.radius)) {
            monster.takeDamage(QI_DAMAGE, pos);
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
        const hitWorldObj = this.world.checkBulletCollision(pos, p.radius, QI_DAMAGE);
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
