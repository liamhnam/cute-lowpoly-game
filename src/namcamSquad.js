import * as THREE from 'three';
import { Character, ROLE_STATS } from './character.js';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';
import { GiantRobot } from './giantRobot.js';

// ============================================================================
// BINH ĐOÀN 10 PHÂN THÂN TỰ ĐỘNG CHIẾN ĐẤU & BIẾN HÌNH ROBOT (NAMCAM SQUAD)
// ============================================================================
// Chiêu 3: Triệu hồi 10 Chiến Sĩ NAMCAM tự động tác chiến (bắn súng, rượt đuổi,
// giữ khoảng cách và tiêu diệt quái/boss).
// ĐẶC BIỆT: Nếu kích hoạt Chiêu 4 (Chiến Thần Robot), TẤT CẢ 10 phân thân sẽ
// ĐỒNG LOẠT BIẾN THÀNH 10 ROBOT KHỔNG LỒ X20 và tự động đạp đất, nện búa càn quét!
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
    this.duration = 28.0; // Thời gian duy trì 28s
  }

  hasActiveClones() {
    return this.clones.length > 0;
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
        shootCooldown: 0.15 + i * 0.08, // Bắn sole nhau tạo làn đạn liên tục
        comboStep: 0,
        formationOffset: offset,
        target: null,
        retargetTimer: Math.random() * 0.3,
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

    this.damageTexts.spawn('🤖 BINH ĐOÀN 10 ROBOT KHỔNG LỒ HỢP THỂ CHIẾN ĐẤU!', this.clones[0].body.position.clone().add(new THREE.Vector3(0, 10.0, 0)), '#ffd700');

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
      // TRƯỜNG HỢP B: PHÂN THÂN CHIẾN SĨ BẮN SÚNG TRƯỜNG (INFANTRY AI)
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

  // AI CHIẾN SĨ BẮN SÚNG TRƯỜNG TỰ ĐỘNG
  updateSoldierAI(clone, delta, owner, monsters) {
    const body = clone.body;

    // 1. Tìm mục tiêu quái gần nhất
    clone.retargetTimer -= delta;
    if (clone.retargetTimer <= 0 || !clone.target || clone.target.isDead) {
      clone.retargetTimer = 0.4 + Math.random() * 0.25;
      clone.target = this.findNearestMonster(body.position, monsters, 60.0);
    }

    // 2. Di chuyển và tấn công
    if (clone.target && !clone.target.isDead) {
      const targetPos = clone.target.position;
      const d = body.position.distanceTo(targetPos);
      const dx = targetPos.x - body.position.x;
      const dz = targetPos.z - body.position.z;
      const facing = Math.atan2(dx, dz);

      // Nếu quái ở xa (> 13.5m): Chạy nước rút áp sát
      if (d > 13.5) {
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        body.update(delta, dir, true);
      }
      // Nếu quái quá gần (< 4.0m): Lùi lại vừa bắn vừa giữ cự ly an toàn
      else if (d < 4.0) {
        const backDir = new THREE.Vector3(-dx, 0, -dz).normalize();
        body.update(delta, backDir, false);
      }
      // Cự ly lý tưởng (4.0m - 13.5m): Đứng ngắm bắn súng trường liên thanh
      else {
        body.update(delta, new THREE.Vector3(0, 0, 0), false);
        body.rotationY = facing;
        body.model.rotation.y = facing;

        // Bắn súng trường
        clone.shootCooldown -= delta;
        if (clone.shootCooldown <= 0) {
          clone.shootCooldown = 0.38 + Math.random() * 0.22;
          clone.comboStep = ((clone.comboStep || 0) + 1) % 3;

          body.triggerSlash(facing, clone.comboStep);

          const origin = body.position.clone().add(new THREE.Vector3(0, 1.1, 0));
          const shootDir = targetPos.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(origin).normalize();

          if (this.projectiles) {
            this.projectiles.spawnBullet(origin, shootDir, clone.comboStep, true, ROLE_STATS[5], body);
          }
        }
      }
    }
    // Không có quái: Bám theo sau lưng người chơi theo đội hình
    else {
      const followDest = owner.position.clone().add(clone.formationOffset);
      const distToOwner = body.position.distanceTo(followDest);

      if (distToOwner > 3.5) {
        const dir = followDest.sub(body.position).normalize();
        body.update(delta, dir, distToOwner > 7.0);
      } else {
        body.update(delta, new THREE.Vector3(0, 0, 0), false);
        body.rotationY = owner.rotationY || 0;
        body.model.rotation.y = owner.rotationY || 0;
      }
    }
  }

  // AI ROBOT KHỔNG LỒ TỰ ĐỘNG CÀN QUÉT
  updateRobotAI(clone, delta, owner, monsters) {
    const robot = clone.giantRobot;
    const body = clone.body;

    if (!robot.isActive) return;

    // 1. Tìm mục tiêu quái gần nhất
    clone.retargetTimer -= delta;
    if (clone.retargetTimer <= 0 || !clone.target || clone.target.isDead) {
      clone.retargetTimer = 0.5 + Math.random() * 0.3;
      clone.target = this.findNearestMonster(body.position, monsters, 75.0);
    }

    // 2. Di chuyển sải bước và đấm/đạp quái
    if (clone.target && !clone.target.isDead) {
      const targetPos = clone.target.position;
      const d = body.position.distanceTo(targetPos);
      const dx = targetPos.x - body.position.x;
      const dz = targetPos.z - body.position.z;
      const facing = Math.atan2(dx, dz);

      body.rotationY = facing;

      // Nếu quái ở ngoài tầm nện (> 10.0m): Sải bước khổng lồ tiến tới
      if (d > 10.0) {
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        const speed = 7.8;
        body.position.addScaledVector(dir, speed * delta);
        body.position.y = getTerrainHeight(body.position.x, body.position.z);
        body.speed = speed;
        body.isMoving = true;
      }
      // Đã vào tầm đạp & nện đất (<= 10.0m)
      else {
        body.speed = 0;
        body.isMoving = false;

        // Tự động tung đòn đạp đất hoặc nện thiết quyền
        if (!robot.isAttacking && robot.attackCooldown <= 0) {
          robot.triggerAttack(monsters);
        }
      }
    }
    // Không có quái: Đi theo bảo vệ robot của người chơi
    else {
      const spreadOffset = clone.formationOffset.clone().multiplyScalar(3.5);
      const followDest = owner.position.clone().add(spreadOffset);
      const distToOwner = body.position.distanceTo(followDest);

      if (distToOwner > 14.0) {
        const dir = followDest.sub(body.position).normalize();
        const speed = 7.2;
        body.position.addScaledVector(dir, speed * delta);
        body.position.y = getTerrainHeight(body.position.x, body.position.z);
        body.speed = speed;
        body.isMoving = true;
        body.rotationY = Math.atan2(dir.x, dir.z);
      } else {
        body.speed = 0;
        body.isMoving = false;
        body.rotationY = owner.rotationY || 0;
      }
    }

    // Cập nhật vị trí buồng lái cho nhân vật ngồi bên trong robot
    body.update(delta, new THREE.Vector3(0, 0, 0), false);
  }

  findNearestMonster(pos, monsters, maxRange = 60.0) {
    let best = null;
    let bestDist = maxRange;
    for (const m of monsters || []) {
      if (!m || m.isDead) continue;
      const d = pos.distanceTo(m.position);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  }

  destroyClone(clone) {
    if (clone.giantRobot) {
      if (clone.giantRobot.isActive) {
        clone.giantRobot.disengage();
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
