import * as THREE from 'three';
import { sound } from './audio.js';
import { getTerrainHeight } from './world.js';
import { getRoleCounterMultiplier } from './character.js';

// Ánh xạ chủng loại quái PvE sang Vai Trò Chiến Đấu để hệ thống Khắc Chế hoạt động cả PvP lẫn PvE
export function getMonsterRoleIndex(monster) {
  if (!monster) return -1;
  switch (monster.type) {
    case 'golem':
    case 'jade_guardian':
      return 0; // Hộ Vệ (Tank giáp dày)
    case 'sword_wraith':
    case 'chomper':
      return 1; // Sát Thủ (Áp sát nhanh)
    case 'fox_mage':
      return 2; // Pháp Sư (Phép thuật tầm xa)
    case 'slime':
      return 3; // Đấu Sĩ (Cận chiến bền bỉ)
    case 'flame_scorpion':
      return 4; // Xạ Thủ (Bắn tỉa tầm xa)
    default:
      return -1;
  }
}

// Kiểu đòn cận chiến: chém ngang (nhát 1, 2 combo) và đòn kết thúc (nhát 3)
const MELEE_STYLES = {
  sweep: { damage: 38, range: 3.6, halfAngle: Math.PI / 2.8, knockback: 0, color: 0xc8ffe0 },  // cung ~128°
  thrust: { damage: 72, range: 5.2, halfAngle: Math.PI / 5.5, knockback: 10, color: 0xffffff }, // đòn kết thúc combo 3
  // Nhát chém của Phân Thân: cung rộng 144°, kèm vệt chém hoàng kim
  goldSlash: { damage: 42, range: 4.8, halfAngle: Math.PI / 2.5, knockback: 0, color: 0xffc107, gold: true },
};
const QI_MIN_DAMAGE = 32;  // kiếm khí vừa bắt đầu tụ
const QI_MAX_DAMAGE = 125; // kiếm khí tụ đầy lực
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

    // Vệt chém hoàng kim / song nhận: cung trăng khuyết đứng
    this.goldCrescentGeo = new THREE.RingGeometry(2.5, 3.5, 24, 1, Math.PI / 2 - 0.85, 1.7);

    // Kiếm khí / xung kích năng lượng (Chuột phải tụ lực)
    this.qiGeo = new THREE.RingGeometry(0.75, 1.15, 14, 1, -Math.PI / 3, (Math.PI * 2) / 3);
    this.qiGeo.rotateX(-Math.PI / 2);
    this.qiMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.qiFullMat = this.qiMat.clone();
    this.qiFullMat.color.setHex(0xffd700);

    // Tiễn Vũ Năng Lượng của Thần Tiễn Xạ Thủ (Role 4)
    this.featherCoreGeo = new THREE.ConeGeometry(0.085, 1.05, 4);
    this.featherCoreGeo.rotateX(Math.PI / 2);
    this.featherWingGeo = new THREE.PlaneGeometry(0.34, 0.9);

    this.featherCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.featherWingMat = new THREE.MeshBasicMaterial({
      color: 0x2ed573,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.featherLightningMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Cầu Pháp Thuật Băng Tinh của Nguyên Tố Pháp Sư (Role 2)
    this.arcaneCoreGeo = new THREE.OctahedronGeometry(0.24, 1);
    this.arcaneRingGeo = new THREE.RingGeometry(0.28, 0.42, 16);
    this.arcaneRingGeo.rotateX(-Math.PI / 2);
    this.arcaneCoreMat = new THREE.MeshBasicMaterial({
      color: 0xe0ffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.arcaneAuraMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.arcaneNovaMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Đạn súng trường quân đội (NAMCAM - Role 5)
    this.bulletGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.45, 6);
    this.bulletGeo.rotateX(Math.PI / 2);
    this.bulletMat = new THREE.MeshBasicMaterial({
      color: 0xffd32a,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  // Tạo mesh đạn súng trường
  createBulletMesh() {
    return new THREE.Mesh(this.bulletGeo, this.bulletMat);
  }

  // Tạo mesh mũi tên ánh sáng của Thần Tiễn Xạ Thủ
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

  // Tạo mesh cầu pháp thuật của Nguyên Tố Pháp Sư
  createArcaneOrbMesh(isFinisher = false) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(this.arcaneCoreGeo, this.arcaneCoreMat);
    const ringMat = isFinisher ? this.arcaneNovaMat : this.arcaneAuraMat;
    const ring1 = new THREE.Mesh(this.arcaneRingGeo, ringMat);
    const ring2 = new THREE.Mesh(this.arcaneRingGeo, ringMat);
    ring2.rotation.x = Math.PI / 2;
    if (isFinisher) {
      group.scale.setScalar(1.25);
    }
    group.add(core, ring1, ring2);
    return group;
  }

  // Góc xoay quanh trục Y để đưa hướng +x của hình cung về hướng dir
  static yawFor(dir) {
    return Math.atan2(-dir.z, dir.x);
  }

  // Đòn cận chiến trước mặt theo Vai Trò (Hộ Vệ, Sát Thủ, Đấu Sĩ)
  slash(center, direction, monsters, styleName = 'sweep', remotePlayers = [], onHitPlayer = null, sectStats = null, sourceCharacter = null) {
    const style = MELEE_STYLES[styleName];
    const dir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const roleId = sectStats?.id ?? -1;

    // Tinh chỉnh tầm đánh & góc quét theo đặc trưng từng Vai Trò cận chiến
    let effectiveRange = style.range;
    let effectiveHalfAngle = style.halfAngle;
    let effectiveKnockback = style.knockback;

    if (roleId === 0) {
      // 🛡️ Thiết Giáp Hộ Vệ: Khiên + Trọng Kiếm quét rộng, đòn 3 đẩy lùi mạnh
      effectiveRange = styleName === 'thrust' ? 5.0 : 3.9;
      effectiveHalfAngle = styleName === 'thrust' ? Math.PI / 4.2 : Math.PI / 2.5;
      if (styleName === 'thrust') effectiveKnockback = 14;
    } else if (roleId === 1) {
      // 🗡️ Ám Ảnh Sát Thủ: Song Đoản Đao chém cực nhanh, đòn 3 xoay 360° quanh thân
      effectiveRange = styleName === 'thrust' ? 4.4 : 3.4;
      effectiveHalfAngle = styleName === 'thrust' ? Math.PI * 0.85 : Math.PI / 3.0;
      if (styleName === 'thrust') effectiveKnockback = 4;
    } else if (roleId === 3) {
      // 🔥 Cuồng Chiến Đấu Sĩ: Chiến Phủ bổ nặng nề, đòn 3 bổ dọc chấn địa tầm xa
      effectiveRange = styleName === 'thrust' ? 5.5 : 4.0;
      effectiveHalfAngle = styleName === 'thrust' ? Math.PI / 4.5 : Math.PI / 2.6;
      if (styleName === 'thrust') effectiveKnockback = 12;
    }

    const arcCos = Math.cos(effectiveHalfAngle);
    const slashColor = sectStats?.slashColor || style.color;
    const dmgMult = sectStats?.damageMult || 1.0;
    const baseDamage = Math.round(style.damage * dmgMult);

    const arcMat = this.slashArcMat.clone();
    arcMat.color.setHex(slashColor);
    if (style.gold) arcMat.blending = THREE.NormalBlending;
    const arc = new THREE.Mesh(this.slashGeos[styleName], arcMat);
    arc.position.set(center.x, center.y - 0.3, center.z);
    arc.rotation.y = ProjectileSystem.yawFor(dir);
    this.scene.add(arc);
    this.slashArcs.push({ mesh: arc, life: 0.22, maxLife: 0.22 });

    // Hoạt ảnh vệt chém đặc trưng cho từng Vai Trò ở đòn kết thúc (Combo Step 2 - thrust)
    if (style.gold) {
      this.spawnGoldSlashFx(center, dir, 0xffc107, 0xffd54a);
    } else if (styleName === 'thrust') {
      if (roleId === 1) {
        // Sát Thủ: Vệt chém chữ X song đao tím huyền ảo
        this.spawnGoldSlashFx(center, dir, 0xc084fc, 0x9333ea);
        if (this.particles) this.particles.emitShockwave(center, 0xc084fc, 3.8, 0.26);
      } else if (roleId === 3) {
        // Đấu Sĩ: Bổ rìu chấn địa bùng nổ dung nham
        this.spawnGoldSlashFx(center, dir, 0xff5252, 0xff793f);
        if (this.particles) {
          this.particles.emitShockwave(center.clone().addScaledVector(dir, 2.2), 0xff5252, 4.5, 0.32);
          this.particles.emitElementalParticles(center.clone().addScaledVector(dir, 2.2), 16, [0xff5252, 0xff793f, 0xffd32a], [2, 6], 0.4, 1, 0.6);
        }
      } else if (roleId === 0) {
        // Hộ Vệ: Xung kích khiên hoàng kim
        if (this.particles) {
          this.particles.emitShockwave(center.clone().addScaledVector(dir, 1.6), 0xf6b93b, 4.2, 0.3);
        }
      }
    }

    let hitAny = false;
    for (const monster of monsters || []) {
      if (monster.isDead) continue;
      const dx = monster.position.x - center.x;
      const dz = monster.position.z - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist - monster.hitRadius > effectiveRange) continue;
      if (center.y < monster.position.y - 1.0 || center.y > monster.position.y + monster.hitHeight) continue;
      if (dist > monster.hitRadius && (dx * dir.x + dz * dir.z) / dist < arcCos) continue;

      const hitPos = new THREE.Vector3(
        monster.position.x - (dx / Math.max(dist, 0.001)) * Math.min(dist, monster.hitRadius),
        center.y,
        monster.position.z - (dz / Math.max(dist, 0.001)) * Math.min(dist, monster.hitRadius)
      );

      // Tính hệ số Khắc Chế Vai Trò + Chí Mạng Sau Lưng của Sát Thủ
      const monsterRole = getMonsterRoleIndex(monster);
      const counterMult = getRoleCounterMultiplier(roleId, monsterRole);
      let backstabMult = 1.0;
      if (sectStats?.backstabBonus && monster.group) {
        const mFwdX = Math.sin(monster.group.rotation.y);
        const mFwdZ = Math.cos(monster.group.rotation.y);
        if (dir.x * mFwdX + dir.z * mFwdZ > 0.2) {
          backstabMult = sectStats.backstabBonus;
        }
      }

      const finalDamage = Math.round(baseDamage * counterMult * backstabMult);
      monster.takeDamage(finalDamage, hitPos);
      if (effectiveKnockback > 0) monster.knockback(center, effectiveKnockback);

      if (this.particles) {
        this.particles.emitHitSparkles(hitPos, backstabMult > 1 ? 22 : 14);
        this.particles.emitShockwave(hitPos, backstabMult > 1 ? 0xff00ff : slashColor, backstabMult > 1 ? 3.4 : 2.5, 0.25);
      }
      hitAny = true;
    }

    // PvP: người chơi khác trong cùng hình quạt
    for (const rp of remotePlayers) {
      if (rp.isDead) continue;
      const dx = rp.position.x - center.x;
      const dz = rp.position.z - center.z;
      const dist = Math.hypot(dx, dz);
      if (dist - PLAYER_HIT_RADIUS > effectiveRange) continue;
      if (dist > PLAYER_HIT_RADIUS && (dx * dir.x + dz * dir.z) / dist < arcCos) continue;

      const hitPos = rp.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      const targetRole = rp.outfitIndex ?? -1;
      const counterMult = getRoleCounterMultiplier(roleId, targetRole);

      let backstabMult = 1.0;
      if (sectStats?.backstabBonus && rp.group) {
        const rpFwdX = Math.sin(rp.group.rotation.y);
        const rpFwdZ = Math.cos(rp.group.rotation.y);
        if (dir.x * rpFwdX + dir.z * rpFwdZ > 0.2) {
          backstabMult = sectStats.backstabBonus;
        }
      }

      const finalDamage = Math.round(baseDamage * counterMult * backstabMult);
      if (onHitPlayer) onHitPlayer(rp.id, finalDamage, hitPos, 'sword', counterMult > 1.05, backstabMult > 1.0);
      if (this.particles) {
        this.particles.emitHitSparkles(hitPos, backstabMult > 1 ? 22 : 14);
        this.particles.emitShockwave(hitPos, backstabMult > 1 ? 0xff00ff : slashColor, backstabMult > 1 ? 3.4 : 2.5, 0.25);
      }
      hitAny = true;
    }

    // Chém vỡ vật thể môi trường phía trước
    if (this.world) {
      const worldHitPos = center.clone().addScaledVector(dir, effectiveRange * 0.6);
      const hitWorldObj = this.world.checkBulletCollision(worldHitPos, 1.4, baseDamage);
      if (hitWorldObj && hitWorldObj.hit) hitAny = true;
    }

    if (hitAny) {
      sound.playHit();
      // 🔥 Cuồng Chiến Đấu Sĩ: Hút máu mỗi đòn cận chiến (Nhân đôi khi máu < 50%)
      if (sectStats?.lifesteal > 0 && sourceCharacter) {
        const lowHpBonus = (sourceCharacter.hp < sourceCharacter.maxHp * 0.5) ? 2.0 : 1.0;
        sourceCharacter.heal(Math.round(sectStats.lifesteal * lowHpBonus));
      }
      // 🛡️ Thiết Giáp Hộ Vệ: Đòn kết thúc combo 3 hồi giáp máu
      if (sectStats?.shieldOnComboFinisher > 0 && styleName === 'thrust' && sourceCharacter) {
        sourceCharacter.heal(sectStats.shieldOnComboFinisher);
      }
    }
    return hitAny;
  }

  // Vệt chém chữ X sáng chói trước mặt
  spawnGoldSlashFx(center, dir, color1 = 0xffc107, color2 = 0xffd54a) {
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dir.x, dir.z));
    const tilts = [(Math.random() - 0.5) * 0.8 + 0.65, (Math.random() - 0.5) * 0.8 - 0.65];

    tilts.forEach((tilt, k) => {
      const mat = new THREE.MeshBasicMaterial({
        color: k === 0 ? color1 : color2,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const crescent = new THREE.Mesh(this.goldCrescentGeo, mat);
      crescent.position.set(center.x + dir.x * (1.4 + k * 0.5), center.y - 2.6, center.z + dir.z * (1.4 + k * 0.5));
      crescent.quaternion.copy(yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
      this.scene.add(crescent);
      this.slashArcs.push({ mesh: crescent, life: 0.3, maxLife: 0.3 });
    });

    if (this.particles) {
      const spark = center.clone().addScaledVector(dir, 2.2);
      this.particles.emitElementalParticles(spark, 10, [color1, color2, 0xffffff], [3, 9], 0.3, 0, 0.5);
    }
  }

  // Phóng kiếm khí / xung kích tụ lực (Chuột phải)
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

  // ❄️ Đòn đánh thường tầm xa của Nguyên Tố Pháp Sư (Role 2): Cầu Pháp Thuật Băng Tinh
  // comboStep 0: 1 cầu băng tinh (40 ST, làm chậm)
  // comboStep 1: 1 cầu băng tinh cường hóa (44 ST, làm chậm)
  // comboStep 2 (Finisher): Tam Tinh Băng Phá (3 cầu tỏa quạt, mỗi cầu 36 ST, nổ lan khi chạm đích)
  spawnArcaneOrb(origin, direction, comboStep = 0, isLocal = true, sectStats = null, sourceCharacter = null) {
    const baseDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const dmgMult = sectStats?.damageMult || 1.0;
    const speed = sectStats?.projectileSpeed || 38;
    const isFinisher = comboStep === 2;

    const angles = isFinisher ? [-0.14, 0, 0.14] : [0];
    const baseDamage = isFinisher ? 36 : (comboStep === 1 ? 44 : 40);
    const actualDamage = Math.round(baseDamage * dmgMult);

    for (let i = 0; i < angles.length; i++) {
      const ang = angles[i];
      const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      const mesh = this.createArcaneOrbMesh(isFinisher);

      mesh.position.copy(origin);
      if (isFinisher && angles.length > 1) {
        const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(ang * 1.2);
        mesh.position.add(perp);
      }
      this.scene.add(mesh);

      const life = 0.62; // Tầm bay ~23.5m
      this.projectiles.push({
        mesh,
        dir,
        velocity: dir.clone().multiplyScalar(speed),
        life,
        maxLife: life,
        size: isFinisher ? 1.25 : 1.0,
        radius: isFinisher ? 0.72 : 0.58,
        damage: actualDamage,
        pierce: false,
        hitMonsters: new Set(),
        hitPlayers: new Set(),
        isLocal,
        color: isFinisher ? 0xa855f7 : 0x38bdf8,
        trailTimer: 0,
        sectStats,
        sourceCharacter,
        isArcaneOrb: true,
        isArcaneFinisher: isFinisher,
        spinSpeed: 8,
        leadOffset: 0.35,
        growWithLife: false,
      });
    }

    if (this.particles) {
      const colors = isFinisher ? [0xe0ffff, 0x38bdf8, 0xa855f7] : [0xe0ffff, 0x38bdf8];
      this.particles.emitElementalParticles(origin, isFinisher ? 9 : 5, colors, [0.8, 2.0], 0.22, 0, 0.38);
    }
  }

  // 🏹 Đòn đánh thường tầm xa của Thần Tiễn Xạ Thủ (Role 4): Tiễn Vũ Quang Ảnh
  // comboStep 0: 1 mũi tên chuẩn xác (42 ST)
  // comboStep 1: 1 mũi tên truy phong (45 ST)
  // comboStep 2 (Finisher): 3 mũi tên xuyên phá tỏa hình quạt (mỗi tia 36 ST, đâm xuyên mục tiêu)
  spawnFeatherDart(origin, direction, comboStep = 0, isLocal = true, sectStats = null, sourceCharacter = null) {
    const baseDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const dmgMult = sectStats?.damageMult || 1.0;
    const speed = sectStats?.projectileSpeed || 52;
    const isFinisher = comboStep === 2;

    const angles = isFinisher ? [-0.12, 0, 0.12] : [0];
    const baseDamage = isFinisher ? 36 : (comboStep === 1 ? 45 : 42);
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

      const life = 0.54; // Tầm bay ~28m (52 m/s * 0.54s)
      this.projectiles.push({
        mesh,
        dir,
        velocity: dir.clone().multiplyScalar(speed),
        life,
        maxLife: life,
        size: isFinisher ? 1.25 : 1.0,
        radius: isFinisher ? 0.62 : 0.52,
        damage: actualDamage,
        pierce: isFinisher, // Phát bắn thứ 3 xuyên qua hàng ngũ địch
        hitMonsters: new Set(),
        hitPlayers: new Set(),
        isLocal,
        color: isFinisher ? 0xf1c40f : 0x2ed573,
        trailTimer: 0,
        sectStats,
        sourceCharacter,
        isFeather: true,
        isLightning: isFinisher,
        spinSpeed: 18,
        leadOffset: 0.4,
        growWithLife: false,
      });
    }

    if (this.particles) {
      const colors = isFinisher ? [0xffffff, 0x2ed573, 0xf1c40f] : [0xffffff, 0x2ed573];
      this.particles.emitElementalParticles(origin, isFinisher ? 8 : 4, colors, [0.8, 1.8], 0.2, 0, 0.35);
    }
  }

  // ⭐ Đạn súng trường quân đội của Chiến Sĩ NAMCAM (Role 5)
  spawnBullet(origin, direction, comboStep = 0, isLocal = true, sectStats = null, sourceCharacter = null) {
    const baseDir = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const dmgMult = sectStats?.damageMult || 1.0;
    const speed = sectStats?.projectileSpeed || 68;
    const isBurst = comboStep === 2;

    const count = isBurst ? 3 : 1;
    const baseDamage = isBurst ? 35 : (comboStep === 1 ? 48 : 45);
    const actualDamage = Math.round(baseDamage * dmgMult);

    for (let i = 0; i < count; i++) {
      const angleSpread = isBurst ? (i - 1) * 0.035 : 0;
      const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angleSpread);
      const mesh = this.createBulletMesh();
      mesh.position.copy(origin);
      if (isBurst && i > 0) {
        mesh.position.addScaledVector(dir, -i * 0.7);
      }
      mesh.lookAt(mesh.position.clone().add(dir));
      this.scene.add(mesh);

      const life = 0.44;
      this.projectiles.push({
        mesh,
        dir,
        velocity: dir.clone().multiplyScalar(speed),
        life,
        maxLife: life,
        size: 0.8,
        radius: 0.45,
        damage: actualDamage,
        pierce: false,
        hitMonsters: new Set(),
        hitPlayers: new Set(),
        isLocal,
        color: 0xffd32a,
        trailTimer: 0,
        sectStats,
        sourceCharacter,
        isBullet: true,
        growWithLife: false,
        leadOffset: 0.3,
      });
    }

    if (this.particles) {
      this.particles.emitElementalParticles(origin, isBurst ? 8 : 4, [0xffd32a, 0xff9f1a, 0xffffff], [0.5, 1.2], 0.2, 0, 0.25);
      this.particles.emitShockwave(origin, 0xffa502, 1.0, 0.1);
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

      // Di chuyển đạn / cầu phép / tiễn vũ
      p.mesh.position.addScaledVector(p.velocity, delta);

      if (p.growWithLife !== false) {
        p.mesh.scale.setScalar(p.size * (1.0 + (p.maxLife - p.life) * 0.4));
      }

      if (p.spinSpeed) {
        if (p.isArcaneOrb) {
          p.mesh.rotation.y += p.spinSpeed * delta;
          p.mesh.rotation.x += p.spinSpeed * 0.6 * delta;
        } else {
          p.mesh.rotateZ(p.spinSpeed * delta);
        }
      }

      const lead = p.leadOffset !== undefined ? p.leadOffset : 0.95 * p.size;
      const pos = p.mesh.position.clone().addScaledVector(p.dir, lead);

      // Hạt đuôi năng lượng
      if (p.trailTimer > 0.035 && this.particles) {
        p.trailTimer = 0;
        if (p.isBullet) {
          this.particles.emitElementalParticles(pos, 1, [0xffd32a, 0xff9f1a, 0xffffff], [0.1, 0.25], 0.12, 0, 0.2);
        } else if (p.isArcaneOrb) {
          const colors = p.isArcaneFinisher ? [0xe0ffff, 0x38bdf8, 0xa855f7] : [0xe0ffff, 0x38bdf8];
          this.particles.emitElementalParticles(pos, 2, colors, [0.15, 0.45], 0.18, 0, 0.35);
        } else if (p.isFeather) {
          const colors = p.isLightning ? [0xffffff, 0x2ed573, 0xf1c40f] : [0xffffff, 0x2ed573, 0x7bed9f];
          this.particles.emitElementalParticles(pos, p.isLightning ? 2 : 1, colors, [0.15, 0.45], 0.15, 0, 0.35);
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
      const attackerRole = p.sectStats?.id ?? -1;

      // 1. Kiểm tra va chạm PvP với người chơi khác
      if (p.isLocal && remotePlayers && remotePlayers.length > 0) {
        for (const rp of remotePlayers) {
          if (rp.isDead || p.hitPlayers.has(rp.id)) continue;
          if (rp.checkBulletCollision(pos, p.radius)) {
            p.hitPlayers.add(rp.id);
            const targetRole = rp.outfitIndex ?? -1;
            const counterMult = getRoleCounterMultiplier(attackerRole, targetRole);
            const finalDmg = Math.round(p.damage * counterMult);

            if (onHitPlayer) {
              const src = p.isBullet
                ? 'rifle_bullet'
                : p.isArcaneOrb
                  ? 'arcane_orb'
                  : p.isFeather
                    ? 'feather_dart'
                    : 'sword_qi';
              onHitPlayer(rp.id, finalDmg, pos, src, counterMult > 1.05, false);
            }
            if (this.particles) {
              if (p.isBullet) {
                this.particles.emitHitSparkles(pos, 10);
                this.particles.emitShockwave(pos, 0xffa502, 1.8, 0.2);
              } else if (p.isArcaneOrb) {
                this.particles.emitElementalParticles(pos, 14, [0xe0ffff, 0x38bdf8, 0xa855f7], [1, 3], 0.3, 1, 0.45);
                this.particles.emitShockwave(pos, p.color, p.isArcaneFinisher ? 3.2 : 2.2, 0.25);
              } else if (p.isFeather) {
                this.particles.emitElementalParticles(pos, 10, [0xffffff, 0x2ed573, 0xf1c40f], [0.8, 1.8], 0.25, 1, 0.4);
                if (p.isLightning) {
                  this.particles.emitShockwave(pos, 0xf1c40f, 2.8, 0.25);
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

      // 2. Kiểm tra va chạm với Quái vật PvE
      if (!hit && monsters && monsters.length > 0) {
        for (const monster of monsters) {
          if (monster.isDead || p.hitMonsters.has(monster)) continue;
          if (monster.checkCollision(pos, p.radius)) {
            const monsterRole = getMonsterRoleIndex(monster);
            const counterMult = getRoleCounterMultiplier(attackerRole, monsterRole);
            const finalDmg = Math.round(p.damage * counterMult);

            monster.takeDamage(finalDmg, pos);
            p.hitMonsters.add(monster);

            // Pháp Sư đánh thường làm chậm nhẹ mục tiêu
            if (p.isArcaneOrb && p.sectStats?.slowOnHit) {
              monster.knockback(pos, -0.4);
            }

            if (this.particles) {
              if (p.isBullet) {
                this.particles.emitHitSparkles(pos, 10);
                this.particles.emitShockwave(pos, 0xffa502, 1.8, 0.2);
              } else if (p.isArcaneOrb) {
                this.particles.emitElementalParticles(pos, 14, [0xe0ffff, 0x38bdf8, 0xa855f7], [1, 3], 0.3, 1, 0.45);
                this.particles.emitShockwave(pos, p.color, p.isArcaneFinisher ? 3.2 : 2.2, 0.25);
              } else if (p.isFeather) {
                this.particles.emitElementalParticles(pos, 10, [0xffffff, 0x2ed573, 0xf1c40f], [0.8, 1.8], 0.25, 1, 0.4);
                if (p.isLightning) {
                  this.particles.emitShockwave(pos, 0xf1c40f, 2.8, 0.25);
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

      // 3. Kiểm tra va chạm với Vật thể môi trường & Công trình kiến trúc
      if (!hit && this.world) {
        const hitWorldObj = this.world.checkBulletCollision(pos, p.radius, p.damage);
        if (hitWorldObj && hitWorldObj.hit) {
          hit = true;
        }
      }

      // 4. Kiểm tra va chạm mặt đất
      const groundY = getTerrainHeight(pos.x, pos.z);
      if (!hit && pos.y <= groundY + 0.18) {
        if (this.particles) {
          if (p.isBullet) {
            this.particles.emitHitSparkles(pos, 6);
            this.particles.emitShockwave(pos, 0xffa502, 1.5, 0.2);
          } else if (p.isArcaneOrb) {
            this.particles.emitElementalParticles(pos, 8, [0xe0ffff, 0x38bdf8], [0.5, 1.2], 0.22, 0, 0.35);
          } else if (p.isFeather) {
            this.particles.emitElementalParticles(pos, 6, [0xffffff, 0x2ed573], [0.4, 1.0], 0.2, 0, 0.3);
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
