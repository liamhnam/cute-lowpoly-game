import * as THREE from 'three';
import { Character, ROLE_STATS } from './character.js';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';
import { GiantRobot } from './giantRobot.js';

// ============================================================================
// BINH ĐOÀN 10 PHÂN THÂN TỰ ĐỘNG CHIẾN ĐẤU & BIẾN HÌNH ROBOT (NAMCAM SQUAD)
// ============================================================================
// Chiêu 3: Triệu hồi 10 Chiến Sĩ NAMCAM tự động tác chiến toàn diện:
// - Tự động tìm mục tiêu (Quái vật, Đại Boss, Bia tập đánh ở Học Viện, Người chơi khác)
// - Bắn súng trường liên thanh từ xa (tầm bắn 30m), vừa di chuyển vừa nã đạn
// - Sử dụng Kỹ Năng 1 (Thả Rắm Độc Stun 2.5s) khi bị áp sát
// - Sử dụng Kỹ Năng 2 (Gọi Kiosk Dịch Vụ Công từ trên trời giáng xuống)
// - ĐẶC BIỆT: Khi kích hoạt Chiêu 4, TẤT CẢ 10 PHÂN THÂN SẼ ĐỒNG LOẠT BIẾN THÀNH
//   10 ROBOT KHỔNG LỒ X20 TỰ ĐỘNG SẢI BƯỚC ĐẠP & NỆN ĐẠI ĐỊA CÀN QUÉT BẢN ĐỒ!
// ============================================================================

export class NamcamSquad {
  constructor(scene, world, particles, projectiles, damageTexts, controller, pixelFX) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;
    this.projectiles = projectiles;
    this.damageTexts = damageTexts;
    this.controller = controller;
    this.pixelFX = pixelFX;

    this.clones = [];
    this.duration = 28.0; // Duy trì 28s
  }

  hasActiveClones() {
    return this.clones.length > 0;
  }

  // ==========================================================================
  // THU THẬP MỌI MỤC TIÊU CÓ THỂ ĐÁNH (QUÁI, BOSS, BIA ĐÁNH, NGƯỜI CHƠI)
  // ==========================================================================
  collectEnemies(pos, maxRange = 70.0, monstersList = null) {
    const list = [];

    // 1. Quái vật & Boss (PvE)
    const monsters = monstersList || this.pixelFX?.monsters || [];
    for (const m of monsters) {
      if (!m || m.isDead) continue;
      const d = pos.distanceTo(m.position);
      if (d <= maxRange) {
        list.push({
          entity: m,
          position: m.position,
          radius: m.hitRadius || 1.6,
          isMonster: true,
          dist: d,
        });
      }
    }

    // 2. Người chơi khác / Bot (PvP)
    const remotePlayers = this.pixelFX?.remotePlayers || [];
    for (const rp of remotePlayers) {
      if (!rp || rp.isDead) continue;
      const d = pos.distanceTo(rp.position);
      if (d <= maxRange) {
        list.push({
          entity: rp,
          position: rp.position,
          radius: 1.0,
          isPlayer: true,
          dist: d,
        });
      }
    }

    // 3. Bia tập đánh ở Học Viện (Training Dummies)
    if (this.world?.fences) {
      for (const f of this.world.fences) {
        if (f && !f.isBroken && f.hp > 0 && f.pos) {
          const d = pos.distanceTo(f.pos);
          if (d <= maxRange) {
            list.push({
              entity: f,
              position: f.pos,
              radius: f.radius || 1.2,
              isDummy: true,
              dist: d,
            });
          }
        }
      }
    }

    // Sắp xếp theo khoảng cách gần nhất
    list.sort((a, b) => a.dist - b.dist);
    return list;
  }

  // ==========================================================================
  // TRIỆU HỒI 10 PHÂN THÂN CHIẾN SĨ
  // ==========================================================================
  spawnSquad(owner, monsters) {
    this.clearSquad();

    const count = 10;
    const center = owner.position.clone();
    const ownerIsMecha = Boolean(owner.isMechaActive || owner.giantRobot?.isActive);

    this.damageTexts.spawn('🇻🇳 BINH ĐOÀN 10 CHIẾN SĨ NAMCAM XUẤT TRẬN!', center.clone().add(new THREE.Vector3(0, 4.0, 0)), '#2ed573');
    if (sound.playThunder) sound.playThunder();

    for (let i = 0; i < count; i++) {
      // Đội hình vòng tròn 360 độ xung quanh chủ nhân
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const radius = 3.6 + (i % 2) * 2.4;
      const offset = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      const spawnPos = center.clone().add(offset);
      spawnPos.y = getTerrainHeight(spawnPos.x, spawnPos.z);

      // Tạo nhân vật Chiến Sĩ NAMCAM chuẩn
      const body = new Character(this.scene, this.particles);
      body.setOutfit(5); // Outfit 5: Bộ Đội Cụ Hồ mũ cối sao vàng, súng trường tác chiến
      body.setName(`Chiến Sĩ #${i + 1}`);
      body.maxHp = 1200;
      body.hp = 1200;
      body.updateBillboard();

      // Hiệu ứng khói rằn ri quân sự và tia sáng khi xuất hiện
      if (this.particles) {
        this.particles.emitElementalParticles(
          spawnPos.clone().add(new THREE.Vector3(0, 1.0, 0)),
          12,
          [0x244222, 0xffd700, 0xffffff],
          [1, 3],
          0.3,
          0,
          0.5
        );
        this.particles.emitShockwave(spawnPos, 0x2ed573, 2.8, 0.3);
      }

      body.position.copy(spawnPos);
      body.group.position.copy(spawnPos);

      const cloneItem = {
        id: i,
        body,
        giantRobot: null,
        isRobot: false,
        life: this.duration,
        shootCooldown: 0.1 + i * 0.05, // Bắn liên tục dồn dập
        skill1Cooldown: 1.5 + i * 0.7, // Chiêu 1: Thả rắm độc
        skill2Cooldown: 3.0 + i * 0.9, // Chiêu 2: Kiosk DVC
        comboStep: 0,
        formationOffset: offset,
        target: null,
        retargetTimer: Math.random() * 0.2,
      };

      this.clones.push(cloneItem);
    }

    // Nếu người chơi đang ở trong trạng thái Robot: biến 10 phân thân thành 10 Robot ngay!
    if (ownerIsMecha) {
      this.transformAllToRobots(monsters);
    }
  }

  // ==========================================================================
  // BIẾN TOÀN BỘ PHÂN THÂN THÀNH ROBOT KHỔNG LỒ X20
  // ==========================================================================
  transformAllToRobots(monsters) {
    if (!this.hasActiveClones()) return;

    this.damageTexts.spawn('🤖 BINH ĐOÀN 10 GUNDAM CHIẾN THẦN HỢP THỂ XUNG KÍCH!', this.clones[0].body.position.clone().add(new THREE.Vector3(0, 10.0, 0)), '#ffd700');

    for (const clone of this.clones) {
      if (clone.isRobot || clone.giantRobot) continue;
      clone.isRobot = true;

      const robot = new GiantRobot(
        this.scene,
        this.world,
        this.particles,
        this.damageTexts,
        this.controller,
        this.pixelFX
      );
      robot.isCloneRobot = true;
      clone.giantRobot = robot;

      if (this.pixelFX?.activeEffects) {
        this.pixelFX.activeEffects.push(robot);
      }

      robot.startAssembly(clone.body.position, clone.body, monsters);
    }
  }

  // ==========================================================================
  // CẬP NHẬT AI TỰ ĐỘNG TÁC CHIẾN MỖI FRAME (UPDATE LOOP)
  // ==========================================================================
  update(delta, owner, monsters) {
    if (!this.hasActiveClones() || !owner) return;

    if (!this.projectiles && this.pixelFX?.projectiles) {
      this.projectiles = this.pixelFX.projectiles;
    }

    const deadClones = [];

    for (let i = 0; i < this.clones.length; i++) {
      const clone = this.clones[i];
      clone.life -= delta;

      // Hết thời gian sống hoặc bị tiêu diệt
      if (clone.life <= 0 || clone.body.isDead || clone.body.hp <= 0) {
        deadClones.push(clone);
        continue;
      }

      // TRƯỜNG HỢP A: PHÂN THÂN ĐANG LÁI ROBOT KHỔNG LỒ (MECHA AI)
      if (clone.isRobot && clone.giantRobot) {
        this.updateRobotAI(clone, delta, owner, monsters);
      }
      // TRƯỜNG HỢP B: PHÂN THÂN CHIẾN SĨ BẮN SÚNG & DÙNG SKILL (INFANTRY AI)
      else {
        this.updateSoldierAI(clone, delta, owner, monsters);
      }
    }

    // Dọn dẹp các phân thân hết hạn / tử trận
    for (const dead of deadClones) {
      this.destroyClone(dead);
      const idx = this.clones.indexOf(dead);
      if (idx !== -1) this.clones.splice(idx, 1);
    }
  }

  // ==========================================================================
  // AI CHIẾN SĨ: BẮN SÚNG LIÊN THANH, DÙNG KỸ NĂNG THẢ RẮM & KIOSK DVC
  // ==========================================================================
  updateSoldierAI(clone, delta, owner, monsters) {
    const body = clone.body;

    if (body.gunGroup && !body.gunGroup.visible) {
      body.gunGroup.visible = true;
    }

    // 1. Quét tìm mọi mục tiêu khả dụng (Quái, Boss, Bia tập đánh, Người chơi khác)
    const targetEntity = clone.target?.entity;
    const isTargetDead = !targetEntity || targetEntity.isDead || targetEntity.isBroken || (targetEntity.hp !== undefined && targetEntity.hp <= 0);
    clone.retargetTimer -= delta;
    if (clone.retargetTimer <= 0 || !clone.target || isTargetDead) {
      clone.retargetTimer = 0.35 + Math.random() * 0.2;
      const enemies = this.collectEnemies(body.position, 65.0, monsters);
      clone.target = enemies.length > 0 ? enemies[0] : null;
    }

    // 2. Tác chiến chủ động khi phát hiện mục tiêu
    if (clone.target) {
      const targetPos = clone.target.position;
      const d = body.position.distanceTo(targetPos);
      const dx = targetPos.x - body.position.x;
      const dz = targetPos.z - body.position.z;
      const facing = Math.atan2(dx, dz);

      body.rotationY = facing;
      body.model.rotation.y = facing;
      body.slashFacing = facing;
      body.targetRotationY = facing;

      // --- KỸ NĂNG 1: THẢ RẮM DIỆT THẾ (Khi địch áp sát <= 8m) ---
      clone.skill1Cooldown -= delta;
      if (d <= 8.0 && clone.skill1Cooldown <= 0) {
        clone.skill1Cooldown = 9.0 + Math.random() * 5.0;

        if (sound.playFart) sound.playFart();
        if (this.particles) {
          this.particles.emitElementalParticles(
            body.position,
            16,
            [0xf1c40f, 0xbadc58, 0x2ed573],
            [1, 4],
            0.4,
            0,
            0.7
          );
        }
        if (this.pixelFX?.dealDamageAOE) {
          this.pixelFX.dealDamageAOE(
            body.position,
            8.5,
            130,
            '💨 -130 RẮM PHÂN THÂN!',
            '#f1c40f',
            monsters,
            'freeze',
            'poison',
            null,
            body
          );
        }
        this.damageTexts.spawn('💨 PHÂN THÂN THẢ RẮM!', body.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#badc58');
      }

      // --- KỸ NĂNG 2: GỌI KIOSK DỊCH VỤ CÔNG (Tầm trung 8m - 26m) ---
      clone.skill2Cooldown -= delta;
      if (d >= 7.0 && d <= 26.0 && clone.skill2Cooldown <= 0) {
        clone.skill2Cooldown = 13.0 + Math.random() * 6.0;
        if (this.pixelFX?.castKioskStrike) {
          this.pixelFX.castKioskStrike(targetPos, body, monsters);
          this.damageTexts.spawn('🖥️ PHÂN THÂN GỌI KIOSK DVC!', body.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#00d2d3');
        }
      }

      // --- ĐÒN ĐÁNH THƯỜNG: NÃ ĐẠN SÚNG TRƯỜNG LIÊN THANH (TẦM BẮN 36M) ---
      clone.shootCooldown -= delta;
      if (d <= 36.0 && clone.shootCooldown <= 0) {
        clone.shootCooldown = 0.28 + Math.random() * 0.16; // Nhịp bắn dồn dập
        clone.comboStep = ((clone.comboStep || 0) + 1) % 3;

        // Kích hoạt hoạt ảnh bắn súng & giật nòng của nhân vật
        body.triggerSlashAnimation(facing, clone.comboStep);

        const origin = body.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        const shootDir = targetPos.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(origin).normalize();

        // Muzzle flash particle effect ngay họng súng
        if (this.particles) {
          const muzzlePos = origin.clone().addScaledVector(shootDir, 0.7);
          this.particles.emitElementalParticles(muzzlePos, 4, [0xffd32a, 0xff9f1a, 0xffffff], [0.3, 0.8], 0.15, 0, 0.2);
        }

        // Âm thanh bắn súng quân đội (có tỉ lệ phân bổ để âm thanh dày dặn mà không gắt)
        if (sound.playGunshot && Math.random() < 0.5) {
          sound.playGunshot();
        }

        const proj = this.projectiles || this.pixelFX?.projectiles;
        if (proj) {
          proj.spawnBullet(origin, shootDir, clone.comboStep, true, ROLE_STATS[5], body);
        }

        // Xử lý sát thương bia tập đánh nếu là Dummy ở học viện
        if (clone.target.isDummy && clone.target.entity.hp > 0) {
          clone.target.entity.hp -= 30;
          this.damageTexts.spawn('🎯 -30 BẮN BIA', targetPos.clone().add(new THREE.Vector3(0, 1.5, 0)), '#ffd32a');
          if (this.particles) this.particles.emitHitSparkles(targetPos, 8);
          if (clone.target.entity.hp <= 0) {
            clone.target.entity.isBroken = true;
          }
        }
      }

      // --- ĐIỀU KHIỂN DI CHUYỂN CHIẾN THUẬT ---
      // Nếu địch ở xa (> 10m): Vừa chạy áp sát vừa xả đạn
      if (d > 10.0) {
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        body.update(delta, dir, true);
      }
      // Nếu địch quá gần (< 3.5m): Vừa lùi vừa nã đạn
      else if (d < 3.5) {
        const backDir = new THREE.Vector3(-dx, 0, -dz).normalize();
        body.update(delta, backDir, false);
      }
      // Cự ly lý tưởng (3.5m - 10m): Dừng chân ngắm bắn tập trung
      else {
        body.update(delta, new THREE.Vector3(0, 0, 0), false);
      }
      body.rotationY = facing;
      body.model.rotation.y = facing;
    }
    // Không có mục tiêu: Bám theo chủ nhân trong cự ly đội hình
    else {
      const followDest = owner.position.clone().add(clone.formationOffset);
      const distToOwner = body.position.distanceTo(followDest);

      if (distToOwner > 2.8) {
        const dir = followDest.sub(body.position).normalize();
        body.update(delta, dir, distToOwner > 6.0);
      } else {
        body.update(delta, new THREE.Vector3(0, 0, 0), false);
        body.rotationY = owner.rotationY || 0;
        body.model.rotation.y = owner.rotationY || 0;
      }
    }
  }

  // ==========================================================================
  // AI ROBOT KHỔNG LỒ X20: SẢI BƯỚC CÀN QUÉT, ĐẠP ĐẤT & CÚI NỆN THIẾT QUYỀN
  // ==========================================================================
  updateRobotAI(clone, delta, owner, monsters) {
    const robot = clone.giantRobot;
    const body = clone.body;

    if (!robot.isActive) return;

    // 1. Quét tìm mọi mục tiêu khả dụng trong phạm vi 85m
    const targetEntity = clone.target?.entity;
    const isTargetDead = !targetEntity || targetEntity.isDead || targetEntity.isBroken || (targetEntity.hp !== undefined && targetEntity.hp <= 0);
    clone.retargetTimer -= delta;
    if (clone.retargetTimer <= 0 || !clone.target || isTargetDead) {
      clone.retargetTimer = 0.4 + Math.random() * 0.25;
      const enemies = this.collectEnemies(body.position, 85.0, monsters);
      clone.target = enemies.length > 0 ? enemies[0] : null;
    }

    // 2. Di chuyển sải bước và dậm nện mặt đất
    if (clone.target) {
      const targetPos = clone.target.position;
      const d = body.position.distanceTo(targetPos);
      const dx = targetPos.x - body.position.x;
      const dz = targetPos.z - body.position.z;
      const facing = Math.atan2(dx, dz);
      const dir = new THREE.Vector3(dx, 0, dz).normalize();

      body.rotationY = facing;

      // Tính tầm nện dựa trên độ lớn của kẻ địch
      const targetRadius = clone.target.radius || 1.6;
      const attackRange = 11.0 + targetRadius;

      // Nếu quái ở ngoài tầm nện (> attackRange): Sải bước khổng lồ tiến tới
      if (d > attackRange) {
        const speed = 8.5;
        body.position.addScaledVector(dir, speed * delta);
        body.position.y = getTerrainHeight(body.position.x, body.position.z);
        // Truyền dir vào body.update để kích hoạt hoạt ảnh sải bước chân robot!
        body.update(delta, dir, true);
      }
      // Đã vào tầm đạp & nện đất (<= attackRange): Dừng lại nện thẳng xuống đất
      else {
        body.update(delta, new THREE.Vector3(0, 0, 0), false);

        // Tự động tung đòn đạp đất hoặc cúi gập người nện thiết quyền
        if (!robot.isAttacking && robot.attackCooldown <= 0) {
          robot.triggerAttack(monsters);
        }
      }
    }
    // Không có quái: Sải bước đi theo bảo vệ robot của người chơi
    else {
      const spreadOffset = clone.formationOffset.clone().multiplyScalar(3.2);
      const followDest = owner.position.clone().add(spreadOffset);
      const distToOwner = body.position.distanceTo(followDest);

      if (distToOwner > 12.0) {
        const dir = followDest.sub(body.position).normalize();
        const speed = 7.5;
        body.position.addScaledVector(dir, speed * delta);
        body.position.y = getTerrainHeight(body.position.x, body.position.z);
        body.update(delta, dir, true);
      } else {
        body.update(delta, new THREE.Vector3(0, 0, 0), false);
        body.rotationY = owner.rotationY || 0;
      }
    }
  }

  destroyClone(clone) {
    if (clone.giantRobot) {
      if (clone.giantRobot.isActive) {
        clone.giantRobot.disengage();
      } else {
        clone.giantRobot.destroy();
      }
      clone.giantRobot = null;
    }

    if (this.particles) {
      this.particles.emitElementalParticles(
        clone.body.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
        10,
        [0x244222, 0xffd700, 0xffffff],
        [1, 3],
        0.3,
        0,
        0.4
      );
    }

    this.scene.remove(clone.body.group);
    if (clone.body.contactShadow) {
      this.scene.remove(clone.body.contactShadow);
    }
    if (clone.body.bbTexture) {
      clone.body.bbTexture.dispose();
    }
  }

  clearSquad() {
    for (const clone of this.clones) {
      this.destroyClone(clone);
    }
    this.clones = [];
  }
}
