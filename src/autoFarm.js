import * as THREE from 'three';

/**
 * AutoFarm — Tự động trảm yêu (chỉ chế độ PvE).
 *
 * - Tự chọn quái gần nhất (ưu tiên Tiểu/Cự Yêu, Đại Boss chỉ khi không còn quái nào khác gần đó).
 * - Tự di chuyển tới tầm đánh (cận chiến áp sát, đánh xa giữ khoảng cách), tự quay mặt về mục tiêu.
 * - Tự đánh thường và tung chiêu 1-3 khi hết hồi chiêu & đủ Linh Lực; Tuyệt Kỹ (4) để dành cho Boss
 *   hoặc khi bị nhiều quái vây.
 * - Người chơi vẫn cầm lái được: đẩy cần gạt / WASD thì nhân vật đi theo tay người chơi,
 *   vuốt camera thì tạm ngưng tự quay mặt trong chốc lát. Auto vẫn tiếp tục đánh.
 * - Tử trận thì chờ hồi sinh rồi tự chạy tiếp.
 */

const RETARGET_INTERVAL = 0.5;    // giây giữa các lần chọn lại mục tiêu
const SKILL_CHECK_INTERVAL = 0.35;
const MAX_TARGET_DIST = 70;       // không đuổi quái ở quá xa
const BOSS_PENALTY = 28;          // Boss bị "đẩy xa" thêm khi xếp hạng mục tiêu
const SKILL_CAST_RANGE = 15;      // chiêu rơi tối đa ~14m phía trước
const TURN_SPEED = 7.0;           // rad/s
const MANUAL_CAMERA_GRACE = 1200; // ms: tạm ngưng tự quay khi người chơi vừa vuốt camera

export class AutoFarm {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.target = null;
    this.retargetTimer = 0;
    this.skillTimer = 0;
    this.isCasting = false; // để main.js tắt bớt thông báo khi auto tung chiêu

    // Phát hiện kẹt địa hình
    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.strafeTimer = 0;
    this.strafeSign = 1;
  }

  get controller() { return this.game.controller; }
  get character() { return this.game.character; }

  setEnabled(on) {
    this.enabled = Boolean(on) && this.game.gameMode === 'pve';
    this.target = null;
    this.retargetTimer = 0;
    this.controller.autoMoveWorld.set(0, 0, 0);
    this.controller.autoSprint = false;
    return this.enabled;
  }

  toggle() {
    return this.setEnabled(!this.enabled);
  }

  isRanged() {
    return Boolean(this.character.sectStats?.isRangedBasic);
  }

  // Tầm muốn đứng cách tâm quái
  desiredRange(monster) {
    const r = monster.hitRadius || 1.0;
    return this.isRanged() ? 10 + r : 2.2 + r;
  }

  pickTarget() {
    const pos = this.character.position;
    let best = null;
    let bestScore = Infinity;
    for (const m of this.game.monsters) {
      if (!m || m.isDead) continue;
      const d = Math.hypot(m.position.x - pos.x, m.position.z - pos.z);
      if (d > MAX_TARGET_DIST) continue;
      const score = d + (m.isBoss ? BOSS_PENALTY : 0);
      if (score < bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  countMonstersNear(radius) {
    const pos = this.character.position;
    let n = 0;
    for (const m of this.game.monsters) {
      if (m && !m.isDead && Math.hypot(m.position.x - pos.x, m.position.z - pos.z) < radius) n++;
    }
    return n;
  }

  // Góc chênh lệch ngắn nhất giữa hai góc (-PI..PI)
  static angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  update(delta) {
    const ctrl = this.controller;
    ctrl.autoMoveWorld.set(0, 0, 0);
    ctrl.autoSprint = false;

    if (!this.enabled) return;
    if (this.game.gameMode !== 'pve') {
      this.setEnabled(false);
      this.game.updateAutoFarmButton?.();
      return;
    }

    const ch = this.character;
    if (ch.isDead || ch.isFloatingUlt) {
      this.target = null;
      return;
    }

    // 1. Chọn / làm mới mục tiêu
    this.retargetTimer -= delta;
    if (!this.target || this.target.isDead || this.retargetTimer <= 0) {
      this.target = this.pickTarget();
      this.retargetTimer = RETARGET_INTERVAL;
    }
    const target = this.target;
    if (!target) return; // không còn quái trong tầm: đứng chờ quái hồi sinh

    const toTarget = new THREE.Vector3(target.position.x - ch.position.x, 0, target.position.z - ch.position.z);
    const dist = toTarget.length();
    if (dist < 0.001) return;
    const dir = toTarget.clone().divideScalar(dist);

    // 2. Quay mặt (xoay camera) về phía mục tiêu, trừ khi người chơi vừa tự vuốt camera
    const desiredYaw = Math.atan2(-dir.x, -dir.z);
    const yawDiff = AutoFarm.angleDiff(desiredYaw, ctrl.yaw);
    const manualCam = ctrl.cameraTouchActive ||
      performance.now() - (ctrl.lastManualCameraTime || 0) < MANUAL_CAMERA_GRACE;
    if (!manualCam) {
      const step = Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), TURN_SPEED * delta);
      ctrl.yaw += step;
    }
    const facing = Math.abs(AutoFarm.angleDiff(desiredYaw, ctrl.yaw)) < 0.45;

    // 3. Di chuyển tới tầm đánh (nếu người chơi tự điều khiển thì nhường quyền)
    const range = this.desiredRange(target);
    const manualMove = ctrl.hasManualMoveInput();
    if (!manualMove) {
      const move = new THREE.Vector3();
      if (dist > range) {
        move.copy(dir);
        ctrl.autoSprint = dist > range + 8;
      } else if (this.isRanged() && dist < range - 4) {
        move.copy(dir).negate(); // đánh xa: lùi lại giữ khoảng cách
      }

      // Thoát kẹt: nếu đang muốn đi mà gần như đứng yên thì nhảy & đi tạt ngang
      if (move.lengthSq() > 0) {
        if (this.strafeTimer > 0) {
          this.strafeTimer -= delta;
          move.add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeSign * 0.9)).normalize();
        }
        this.stuckTimer += delta;
        if (this.stuckTimer > 1.0) {
          if (ch.position.distanceTo(this.lastPos) < 0.6) {
            ch.jump?.();
            this.strafeTimer = 0.8;
            this.strafeSign = Math.random() < 0.5 ? -1 : 1;
          }
          this.stuckTimer = 0;
          this.lastPos.copy(ch.position);
        }
      } else {
        this.stuckTimer = 0;
        this.lastPos.copy(ch.position);
      }
      ctrl.autoMoveWorld.copy(move);
    }

    // 4. Đánh thường khi trong tầm & đã quay mặt
    const attackReach = this.isRanged() ? range + 6 : range + 1.2;
    if (facing && dist <= attackReach && !ctrl.isAttackHeld) {
      ctrl.triggerShoot(); // tự có hồi chiêu & combo 3 nhát
    }

    // 5. Tung chiêu
    this.skillTimer -= delta;
    if (this.skillTimer <= 0 && facing && dist <= SKILL_CAST_RANGE) {
      this.skillTimer = SKILL_CHECK_INTERVAL;
      this.tryCastSkill(target, dist);
    }
  }

  tryCastSkill(target, dist) {
    const fx = this.game.pixelFX;
    if (!fx?.cooldowns) return;

    const crowd = this.countMonstersNear(12);
    const order = [];
    if (fx.cooldowns[4] && (target.isBoss || target.isLarge || crowd >= 3)) order.push(4);
    order.push(3, 2, 1);

    for (const n of order) {
      const meta = fx.cooldowns[n];
      if (!meta || fx.isSkillOnCooldown(n)) continue;
      const cost = meta.mana || 0;
      // Chừa lại Linh Lực cho Tuyệt Kỹ khi đang đánh Boss
      const reserve = target.isBoss && n !== 4 && fx.cooldowns[4] && !fx.isSkillOnCooldown(4)
        ? (fx.cooldowns[4].mana || 0) : 0;
      if (cost > 0 && this.game.playerMp < cost + reserve) continue;

      // Ngắm chiêu vào ngay vị trí mục tiêu (tối đa 14m phía trước)
      const aim = target.position.clone();
      const ch = this.character.position;
      const flat = new THREE.Vector3(aim.x - ch.x, 0, aim.z - ch.z);
      if (flat.length() > 14) aim.copy(ch).addScaledVector(flat.normalize(), 14);

      this.isCasting = true;
      try {
        this.controller.triggerSkill(n, aim);
      } finally {
        this.isCasting = false;
      }
      return; // mỗi lần kiểm tra chỉ tung 1 chiêu cho tự nhiên
    }
  }
}
