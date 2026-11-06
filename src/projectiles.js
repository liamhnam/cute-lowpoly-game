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
const PLAYER_HIT_RADIUS = 0.85; // bán kính thân người chơi khác khi tính trúng đòn

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

    // Phi vũ / Lôi vũ tiễn của Bạch Hạc Chân Nhân
    this.featherCoreGeo = new THREE.ConeGeometry(0.08, 0.95, 4);
    this.featherCoreGeo.rotateX(Math.PI / 2);
    this.featherWingGeo = new THREE.PlaneGeometry(0.32, 0.85);

    this.featherCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.featherWingMat = new THREE.MeshBasicMaterial({
      color: 0x00d2d3,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.featherLightningMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  // Tạo mesh lông vũ tiễn tiên đạo
  createFeatherMesh(isLightning = false) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(this.featherCoreGeo, this.featherCoreMat);
    const wingMat = isLightning ? this.featherLightningMat : this.featherWingMat;
    const wing1 = new THREE.Mesh(this.featherWingGeo, wingMat);
    const wing2 = new THREE.Mesh(this.featherWingGeo, wingMat);
    wing2.rotation.z = Math.PI / 2;
    group.add(core);
    group.add(wing1);
    group.add(wing2);
    return group;
  }

  // Góc xoay quanh trục Y để đưa hướng +x của hình cung về hướng dir
  static yawFor(dir) {
    return Math.atan2(-dir.z, dir.x);
  }

  // Đòn cận chiến trước mặt: trúng mọi quái trong hình quạt của kiểu đòn styleName.
  // remotePlayers/onHitPlayer chỉ truyền cho đòn của chính mình, để mỗi đòn PvP chỉ được báo một lần.
  slash(center, direction, monsters, styleName = 'sweep', remotePlayers = [], onHitPlayer = null, sectStats = null, sourceCharacter = null) {
    const style = MELEE_STYLES[styleName];
    const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const arcCos = Math.cos(style.halfAngle);

    const slashColor = sectStats?.slashColor || style.color;
    const dmgMult = sectStats?.damageMult || 1.0;
    const actualDamage = Math.round(style.damage * dmgMult);

    const arcMat = this.slashArcMat.clone();
    arcMat.color.setHex(slashColor);
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
      monster.takeDamage(actualDamage, hitPos);
      if (style.knockback > 0) monster.knockback(center, style.knockback);

      // Thanh Vân Tiên Tông: 35% tỉ lệ chém băng làm chậm
      if (sectStats?.slowOnHit && Math.random() < 0.35) {
        monster.knockback(center, -0.6);
        if (this.particles) {
          this.particles.emitElementalParticles(hitPos, 8, [0x00d2d3, 0xffffff], [1, 3], 0.3, 1, 0.4);
        }
      }

      if (this.particles) {
        this.particles.emitHitSparkles(hitPos, 14);
        this.particles.emitShockwave(hitPos, slashColor, 2.5, 0.25);
      }
      hitAny = true;
    }

    // PvP: người chơi khác trong cùng hình quạt
    for (const rp of remotePlayers) {
      if (rp.isDead) continue;
      const dx = rp.position.x - center.x;
      const dz = rp.position.z - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist - PLAYER_HIT_RADIUS > style.range) continue;
      if (dist > PLAYER_HIT_RADIUS && (dx * dir.x + dz * dir.z) / dist < arcCos) continue;
      const hitPos = rp.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      if (onHitPlayer) onHitPlayer(rp.id, actualDamage, hitPos, 'sword');
      if (this.particles) {
        this.particles.emitHitSparkles(hitPos, 14);
        this.particles.emitShockwave(hitPos, slashColor, 2.5, 0.25);
      }
      hitAny = true;
    }

    // Chém vỡ vật thể môi trường phía trước
    if (this.world) {
      const worldHitPos = center.clone().addScaledVector(dir, style.range * 0.6);
      const hitWorldObj = this.world.checkBulletCollision(worldHitPos, 1.4, actualDamage);
      if (hitWorldObj && hitWorldObj.hit) hitAny = true;
    }

    if (hitAny) {
      sound.playHit();
      // Hồng Trần Ma Tu: Nội tại chém thường hút máu
      if (sectStats?.lifesteal > 0 && sourceCharacter) {
        sourceCharacter.heal(sectStats.lifesteal);
      }
      // Bạch Hạc Chân Nhân: Nhát đâm thứ 3 tạo tia sét giật xung kích
      if (sectStats?.id === 4 && styleName === 'thrust' && this.particles) {
        this.particles.emitShockwave(center, 0xffffff, 4.0, 0.3);
      }
    }
    return hitAny;
  }

  // Phóng kiếm khí bay ngang theo hướng direction; power 0..1 là lực tụ.
  // isLocal = kiếm khí của chính mình (chỉ loại này mới báo sát thương PvP)
  spawnSwordQi(origin, direction, power = 0, isLocal = true, sectStats = null, sourceCharacter = null) {
    const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const isFull = power >= 1;
    const size = 1.0 + power * 1.5;
    const life = 0.9 + power * 0.3;

    const qiColor = sectStats?.slashColor || (isFull ? 0xffd700 : 0x00f2fe);
    const projSpeed = sectStats?.projectileSpeed || 32;

    const qiMat = this.qiMat.clone();
    qiMat.color.setHex(qiColor);
    const qi = new THREE.Mesh(this.qiGeo, qiMat);
    qi.position.copy(origin);
    qi.rotation.y = ProjectileSystem.yawFor(dir);
    qi.scale.setScalar(size);
    this.scene.add(qi);

    const dmgMult = sectStats?.damageMult || 1.0;
    const damage = Math.round((QI_MIN_DAMAGE + (QI_MAX_DAMAGE - QI_MIN_DAMAGE) * power) * dmgMult);

    this.projectiles.push({
      mesh: qi,
      dir,
      velocity: dir.clone().multiplyScalar(projSpeed),
      life,
      maxLife: life,
      size,
      radius: 0.9 * size,
      damage,
      // Đầy lực: xuyên qua quái, mỗi con chỉ trúng một lần
      pierce: isFull,
      hitMonsters: new Set(),
      hitPlayers: new Set(),
      isLocal,
      color: qiColor,
      trailTimer: 0,
      sectStats,
      sourceCharacter,
    });

    if (this.particles) {
      const colors = [qiColor, 0xffffff];
      this.particles.emitElementalParticles(origin, 4 + Math.round(power * 10), colors, [1, 3], 0.25, 0, 0.4);
    }
  }

  // Bắn phi vũ / lôi vũ tiễn tầm xa của Bạch Hạc Chân Nhân
  // comboStep 0: 1 lông vũ đơn (38 ST)
  // comboStep 1: 1 lông vũ tăng tốc (40 ST)
  // comboStep 2 (Finisher): 3 lông vũ tỏa hình quạt (mỗi tia 34 ST, xuyên phá)
  spawnFeatherDart(origin, direction, comboStep = 0, isLocal = true, sectStats = null, sourceCharacter = null) {
    const baseDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const dmgMult = sectStats?.damageMult || 1.0;
    const speed = sectStats?.projectileSpeed || 46;
    const isFinisher = comboStep === 2;

    const angles = isFinisher ? [-0.14, 0, 0.14] : [0];
    const baseDamage = isFinisher ? 34 : (comboStep === 1 ? 40 : 38);
    const actualDamage = Math.round(baseDamage * dmgMult);

    for (let i = 0; i < angles.length; i++) {
      const ang = angles[i];
      const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      const mesh = this.createFeatherMesh(isFinisher);

      mesh.position.copy(origin);
      if (isFinisher && angles.length > 1) {
        const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(ang * 1.2);
        mesh.position.add(perp);
      }
      mesh.lookAt(mesh.position.clone().add(dir));
      this.scene.add(mesh);

      const life = 0.54; // Tầm bay ~25m (46 m/s * 0.54s)
      this.projectiles.push({
        mesh,
        dir,
        velocity: dir.clone().multiplyScalar(speed),
        life,
        maxLife: life,
        size: isFinisher ? 1.25 : 1.0,
        radius: isFinisher ? 0.6 : 0.5,
        damage: actualDamage,
        pierce: isFinisher, // Phát bắn kết liễu đâm xuyên qua mục tiêu
        hitMonsters: new Set(),
        hitPlayers: new Set(),
        isLocal,
        color: isFinisher ? 0xf1c40f : 0x00d2d3,
        trailTimer: 0,
        sectStats,
        sourceCharacter,
        isFeather: true,
        isLightning: isFinisher,
        spinSpeed: 16,
        leadOffset: 0.4,
        growWithLife: false,
      });
    }

    if (this.particles) {
      const colors = isFinisher ? [0xffffff, 0x00d2d3, 0xf1c40f] : [0xffffff, 0x00d2d3];
      this.particles.emitElementalParticles(origin, isFinisher ? 8 : 4, colors, [0.8, 1.8], 0.2, 0, 0.35);
    }
  }

  update(delta, monsters, remotePlayers = [], onHitPlayer = null) {
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

      // Di chuyển kiếm khí / phi vũ
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Kiếm khí nở rộng dần theo tầm bay (phi vũ giữ kích thước ổn định)
      if (p.growWithLife !== false) {
        p.mesh.scale.setScalar(p.size * (1.0 + (p.maxLife - p.life) * 0.4));
      }

      // Xoay xoắn quanh trục bay (nòng phi tiêu)
      if (p.spinSpeed) {
        p.mesh.rotateZ(p.spinSpeed * delta);
      }

      // Điểm va chạm nằm ở mép cung phía trước
      const lead = p.leadOffset !== undefined ? p.leadOffset : 0.95 * p.size;
      const pos = p.mesh.position.clone().addScaledVector(p.dir, lead);

      // Hạt đuôi năng lượng (Qi Trail / Feather Trail)
      if (p.trailTimer > 0.035 && this.particles) {
        p.trailTimer = 0;
        if (p.isFeather) {
          const colors = p.isLightning ? [0xffffff, 0x00d2d3, 0xf1c40f] : [0xffffff, 0x00d2d3, 0x74b9ff];
          this.particles.emitElementalParticles(
            pos,
            p.isLightning ? 2 : 1,
            colors,
            [0.15, 0.45],
            0.15,
            0,
            0.35
          );
        } else {
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
      }

      let hit = false;

      // 1. Kiểm tra va chạm PvP với các người chơi khác (chỉ kiếm khí của chính mình mới báo sát thương)
      if (p.isLocal && remotePlayers && remotePlayers.length > 0) {
        for (const rp of remotePlayers) {
          if (rp.isDead || p.hitPlayers.has(rp.id)) continue;
          if (rp.checkBulletCollision(pos, p.radius)) {
            p.hitPlayers.add(rp.id);
            if (onHitPlayer) {
              onHitPlayer(rp.id, p.damage, pos, p.isFeather ? 'feather_dart' : 'sword_qi');
            }
            if (this.particles) {
              if (p.isFeather) {
                this.particles.emitElementalParticles(pos, 10, [0xffffff, 0x00d2d3, 0x74b9ff], [0.8, 1.8], 0.25, 1, 0.4);
                if (p.isLightning) {
                  this.particles.emitShockwave(pos, 0x00d2d3, 2.8, 0.25);
                }
              } else {
                this.particles.emitHitSparkles(pos, 14);
                this.particles.emitShockwave(pos, p.color, 2.5 * p.size, 0.25);
              }
            }
            sound.playHit();
            if (p.sectStats?.lifesteal && p.sourceCharacter) {
              p.sourceCharacter.heal(p.sectStats.lifesteal);
            }
            if (!p.pierce) {
              hit = true;
              break;
            }
          }
        }
      }

      // 2. Kiểm tra va chạm với Quái vật
      if (!hit && monsters && monsters.length > 0) {
        for (const monster of monsters) {
          if (monster.isDead || p.hitMonsters.has(monster)) continue;
          if (monster.checkCollision(pos, p.radius)) {
            monster.takeDamage(p.damage, pos);
            p.hitMonsters.add(monster);
            if (this.particles) {
              if (p.isFeather) {
                this.particles.emitElementalParticles(pos, 10, [0xffffff, 0x00d2d3, 0x74b9ff], [0.8, 1.8], 0.25, 1, 0.4);
                if (p.isLightning) {
                  this.particles.emitShockwave(pos, 0x00d2d3, 2.8, 0.25);
                }
              } else {
                this.particles.emitHitSparkles(pos, 12);
                this.particles.emitShockwave(pos, p.color, 2.5 * p.size, 0.25);
              }
            }
            sound.playHit();
            if (p.sectStats?.lifesteal && p.sourceCharacter) {
              p.sourceCharacter.heal(p.sectStats.lifesteal);
            }
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
          if (p.isFeather) {
            this.particles.emitElementalParticles(pos, 6, [0xffffff, 0x00d2d3], [0.4, 1.0], 0.2, 0, 0.3);
          } else {
            this.particles.emitHitSparkles(pos, 8);
            this.particles.emitShockwave(pos, p.color, 2.0, 0.25);
          }
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
