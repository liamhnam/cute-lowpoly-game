import * as THREE from 'three';
import { sound } from './audio.js';
import { getTerrainHeight } from './world.js';

// Kiểu đòn cận chiến: chém ngang (nhát 1, 2 combo) và đâm tới (nhát 3)
const MELEE_STYLES = {
  sweep: { damage: 35, range: 3.4, halfAngle: Math.PI / 3, knockback: 0, color: 0xc8ffe0 },  // cung 120°
  thrust: { damage: 70, range: 5.2, halfAngle: Math.PI / 7, knockback: 10, color: 0xffffff }, // mũi đâm ~50°
};
const QI_MIN_DAMAGE = 30;  // kiếm khí vừa bắt đầu tụ
const QI_MAX_DAMAGE = 120; // kiếm khí tụ đầy lực

export class ProjectileSystem {
  constructor(scene, particles, world = null) {
    this.scene = scene;
    this.particles = particles;
    this.world = world;
    this.projectiles = [];
    this.slashArcs = [];
    // Hình quạt vệt chém của từng kiểu đòn (nằm ngang, hướng về +x trước khi xoay)
    this.slashGeos = {};
    for (const [name, s] of Object.entries(MELEE_STYLES)) {
      const geo = new THREE.RingGeometry(name === 'thrust' ? 0.8 : 1.0, s.range, 18, 1, -s.halfAngle, s.halfAngle * 2);
      geo.rotateX(-Math.PI / 2);
      this.slashGeos[name] = geo;
    }
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
    this.qiFullMat = this.qiMat.clone();
    this.qiFullMat.color.setHex(0xffd700); // Kiếm khí đầy lực màu hoàng kim
  }

  // Góc xoay quanh trục Y để đưa hướng +x của hình cung về hướng dir
  static yawFor(dir) {
    return Math.atan2(-dir.z, dir.x);
  }

  // Đòn cận chiến trước mặt: trúng mọi quái trong hình quạt của kiểu đòn styleName
  slash(center, direction, monsters, styleName = 'sweep') {
    const style = MELEE_STYLES[styleName];
    const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const arcCos = Math.cos(style.halfAngle);

    const arcMat = this.slashArcMat.clone();
    arcMat.color.setHex(style.color);
    const arc = new THREE.Mesh(this.slashGeos[styleName], arcMat);
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
      if (dist - monster.hitRadius > style.range) continue;
      if (center.y < monster.position.y - 1.0 || center.y > monster.position.y + monster.hitHeight) continue;
      // Đứng sát (trong thân quái) thì luôn trúng, còn lại phải nằm trong hình quạt
      if (dist > monster.hitRadius && (dx * dir.x + dz * dir.z) / dist < arcCos) continue;

      const hitPos = new THREE.Vector3(
        monster.position.x - (dx / Math.max(dist, 0.001)) * Math.min(dist, monster.hitRadius),
        center.y,
        monster.position.z - (dz / Math.max(dist, 0.001)) * Math.min(dist, monster.hitRadius)
      );
      monster.takeDamage(style.damage, hitPos);
      if (style.knockback > 0) monster.knockback(center, style.knockback);      if (this.particles) {
        this.particles.emitHitSparkles(hitPos, 14);
        this.particles.emitShockwave(hitPos, style.color, 2.5, 0.25);
      }
      hitAny = true;
    }

    // Chém vỡ vật thể môi trường phía trước
    if (this.world) {
      const worldHitPos = center.clone().addScaledVector(dir, style.range * 0.6);
      const hitWorldObj = this.world.checkBulletCollision(worldHitPos, 1.4, style.damage);
      if (hitWorldObj && hitWorldObj.hit) hitAny = true;
    }

    if (hitAny) sound.playHit();
    return hitAny;
  }

  // Phóng kiếm khí bay ngang theo hướng direction; power 0..1 là lực tụ
  spawnSwordQi(origin, direction, power = 0) {
    const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const isFull = power >= 1;
    const size = 1.0 + power * 1.5;
    const life = 0.9 + power * 0.3;

    const qi = new THREE.Mesh(this.qiGeo, isFull ? this.qiFullMat : this.qiMat);
    qi.position.copy(origin);
    qi.rotation.y = ProjectileSystem.yawFor(dir);
    qi.scale.setScalar(size);
    this.scene.add(qi);

    this.projectiles.push({
      mesh: qi,
      dir,
      velocity: dir.clone().multiplyScalar(32),
      life,
      maxLife: life,
      size,
      radius: 0.9 * size,
      damage: Math.round(QI_MIN_DAMAGE + (QI_MAX_DAMAGE - QI_MIN_DAMAGE) * power),
      // Đầy lực: xuyên qua quái, mỗi con chỉ trúng một lần
      pierce: isFull,
      hitMonsters: new Set(),
      color: isFull ? 0xffd700 : 0x00f2fe,
      trailTimer: 0,
    });

    if (this.particles) {
      const colors = isFull ? [0xffd700, 0xffffff] : [0x00f2fe, 0xffffff];
      this.particles.emitElementalParticles(origin, 4 + Math.round(power * 10), colors, [1, 3], 0.25, 0, 0.4);
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
      p.mesh.scale.setScalar(p.size * (1.0 + (p.maxLife - p.life) * 0.4));

      // Điểm va chạm nằm ở mép cung phía trước
      const pos = p.mesh.position.clone().addScaledVector(p.dir, 0.95 * p.size);

      // Hạt đuôi năng lượng (Qi Trail)
      if (p.trailTimer > 0.035 && this.particles) {
        p.trailTimer = 0;
        this.particles.emitElementalParticles(
          pos,
          p.pierce ? 3 : 1,
          p.pierce ? [0xffd700, 0xffa502, 0xffffff] : [0x00f2fe, 0x4facfe, 0xffffff],
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
          if (monster.isDead || p.hitMonsters.has(monster)) continue;
          if (monster.checkCollision(pos, p.radius)) {
            monster.takeDamage(p.damage, pos);
            p.hitMonsters.add(monster);            if (this.particles) {
              this.particles.emitHitSparkles(pos, 12);
              this.particles.emitShockwave(pos, p.color, 2.5 * p.size, 0.25);
            }
            sound.playHit();
            if (!p.pierce) {
              hit = true;
              break;
            }
          }
        }
      }

      // 2. Kiểm tra va chạm với Vật thể môi trường & Công trình kiến trúc
      if (!hit && this.world) {
        const hitWorldObj = this.world.checkBulletCollision(pos, p.radius, p.damage);
        if (hitWorldObj && hitWorldObj.hit) {
          hit = true;
        }
      }

      // 3. Kiểm tra va chạm mặt đất
      const groundY = getTerrainHeight(pos.x, pos.z);
      if (!hit && pos.y <= groundY + 0.18) {
        if (this.particles) {
          this.particles.emitHitSparkles(pos, 8);
          this.particles.emitShockwave(pos, p.color, 2.0, 0.25);
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
