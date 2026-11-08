import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';

/**
 * ĐẠI BOSS — 9 boss mới (cùng Hắc Long Ma Đế là 10).
 *
 * Mỗi boss là một "BossKit" gắn vào Monster (monsters.js):
 *   - buildMesh(): tạo hình riêng (dựng bằng khối low-poly)
 *   - basic(): đòn đánh thường riêng
 *   - skills(): 3 tuyệt kỹ riêng (luôn có vòng/vệt cảnh báo để người chơi né)
 *   - cơ chế đặc biệt qua các hook: onUpdate / modifyDamage / onDealDamage / onLethal / onEnrage
 *
 * Monster cung cấp sẵn: spawnTelegraphAOE, spawnTelegraphLine, isPointInLine, spawnMonsterProjectile,
 * spawnExpandingShockwave, spawnPoisonPool, spawnSlashArc, spawnCustomEffect, schedule, inflictDamageToPlayer.
 */

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;

// =========================================================================
// CẤU HÌNH CHỈ SỐ
// roleIndex dùng cho vòng khắc chế: 0 Hộ Vệ, 1 Sát Thủ, 2 Pháp Sư, 3 Đấu Sĩ, 4 Xạ Thủ
// =========================================================================
const base = { isBoss: true, sizeCategory: 'boss', modelScale: 1.0, flankOffset: 0, respawnTime: 9999, xpMpReward: 100, healReward: 600 };

export const BOSS_CONFIGS = {
  boss_fox_empress: {
    ...base, name: 'CỬU VĨ YÊU HẬU', icon: '🦊', maxHp: 3400, speed: 4.2, hitRadius: 3.0, hitHeight: 9.4,
    barColor: 0xff7eb3, roleIndex: 2,
    enrageText: '🦊 HỒ MỊ CUỒNG HOẢ (PHASE 2)!',
    hint: 'Pháp sư thả diều. Mỗi khi mất 1/9 máu sẽ rụng 1 đuôi và bộc phát hồ hoả 360° — đừng đứng sát lúc đó!',
  },
  boss_stone_king: {
    ...base, name: 'BÀN CỔ THẠCH VƯƠNG', icon: '🗿', maxHp: 5200, speed: 1.9, hitRadius: 4.4, hitHeight: 11.2,
    barColor: 0xc8a165, roleIndex: 0,
    enrageText: '🗿 THẠCH VƯƠNG NỘ ĐỊA (PHASE 2)!',
    hint: 'Giáp trước gần như bất hoại (chỉ nhận 35%). Vòng ra SAU LƯNG đánh vào Lõi Dung Nham (x1.7 sát thương) — hắn xoay người rất chậm!',
  },
  boss_blood_demon: {
    ...base, name: 'HUYẾT ẢNH KIẾM QUỶ', icon: '👺', maxHp: 3000, speed: 5.6, hitRadius: 2.6, hitHeight: 8.2,
    barColor: 0xd63031, roleIndex: 1,
    enrageText: '👺 HUYẾT MA NHẬP THỂ (PHASE 2)!',
    hint: 'Hút máu: mỗi đòn trúng ngươi hắn hồi 50% sát thương & nhanh dần lên. Né đòn là cách duy nhất!',
  },
  boss_fire_demon: {
    ...base, name: 'HOẢ DIỆM MA THẦN', icon: '🔥', maxHp: 4400, speed: 3.0, hitRadius: 3.8, hitHeight: 10.6,
    barColor: 0xff6b1a, roleIndex: 3,
    enrageText: '🔥 LIỆT HOẢ PHẦN THIÊN (PHASE 2)!',
    hint: 'Hào quang thiêu đốt: đứng trong vòng lửa 9m quanh hắn liên tục mất máu. Nhảy (Space) để vượt qua Vòng Lửa lan toả!',
  },
  boss_frost_maiden: {
    ...base, name: 'BĂNG PHÁCH TUYẾT NỮ', icon: '❄️', maxHp: 3600, speed: 3.6, hitRadius: 3.0, hitHeight: 9.6,
    barColor: 0x74b9ff, roleIndex: 2,
    enrageText: '❄️ VẠN LÝ BĂNG PHONG (PHASE 2)!',
    hint: 'Định kỳ khoác Băng Tinh Giáp (hút 500 sát thương). Phá vỡ giáp để làm nàng choáng 3s & nhận thêm 30% sát thương!',
  },
  boss_spider_queen: {
    ...base, name: 'ĐỘC CHU MẪU HOÀNG', icon: '🕷️', maxHp: 4000, speed: 4.4, hitRadius: 4.0, hitHeight: 7.6,
    barColor: 0x9b59b6, roleIndex: 4,
    enrageText: '🕷️ VẠN ĐỘC QUY TÔNG (PHASE 2)!',
    hint: 'Mỗi đòn trúng cộng 1 tầng Kịch Độc (rút máu liên tục). Đủ 5 tầng sẽ BỘC PHÁT 220 sát thương — giữ khoảng cách!',
  },
  boss_thunder_general: {
    ...base, name: 'LÔI THẦN CHIẾN TƯỚNG', icon: '⚡', maxHp: 4200, speed: 3.8, hitRadius: 3.2, hitHeight: 10.2,
    barColor: 0x48dbfb, roleIndex: 4,
    enrageText: '⚡ CỬU THIÊN LÔI ĐỘNG (PHASE 2)!',
    hint: 'Tích điện liên tục. Khi đầy 100% sẽ giáng LÔI BẠO TOÀN TRƯỜNG — chạy vào VÒNG XANH an toàn trước khi sét đánh!',
  },
  boss_ghost_king: {
    ...base, name: 'U MINH QUỶ VƯƠNG', icon: '💀', maxHp: 4000, speed: 3.2, hitRadius: 3.2, hitHeight: 10.0,
    barColor: 0x55efc4, roleIndex: 2,
    enrageText: '💀 U MINH QUỶ HOẢ (PHASE 2)!',
    hint: 'Bất tử lần đầu: hạ gục sẽ sống lại với 45% máu ở dạng Hồn Thể nhanh hơn, mỗi nhát liềm phóng thêm hồn ma truy đuổi!',
  },
  boss_wind_eagle: {
    ...base, name: 'THIÊN ƯNG PHONG VƯƠNG', icon: '🦅', maxHp: 3800, speed: 5.0, hitRadius: 3.4, hitHeight: 9.2,
    barColor: 0xf6e58d, roleIndex: 4,
    enrageText: '🦅 CUỒNG PHONG THIÊN KHÔNG (PHASE 2)!',
    hint: 'Định kỳ bay lên trời (bất khả xâm phạm) và thả bom lông vũ. Hạ cánh xong sẽ KIỆT SỨC 4s nhận thêm 50% sát thương — dồn sát thương lúc đó!',
  },
};

// Thứ tự Đại Boss giáng thế (luân phiên, lượt sau mạnh hơn)
export const BOSS_ORDER = [
  'boss_dragon_emperor',
  'boss_fox_empress',
  'boss_stone_king',
  'boss_blood_demon',
  'boss_fire_demon',
  'boss_frost_maiden',
  'boss_spider_queen',
  'boss_thunder_general',
  'boss_ghost_king',
  'boss_wind_eagle',
];

// =========================================================================
// BOSS KIT NỀN TẢNG
// =========================================================================
class BossKit {
  constructor(m) {
    this.m = m;
    this.action = null;
    this.skillCd = 3.2;
    this.basicCd = 1.4;
    this.lastSkill = null;
    this.stunTimer = 0;
    this.moving = false;

    // Tham số mặc định (mỗi boss chỉnh lại)
    this.basicRange = 7;
    this.preferredRange = 4.5;
    this.kite = false;           // boss đánh xa: lùi lại khi bị áp sát
    this.turnRate = 5.0;         // rad/s
    this.basicInterval = 1.7;
    this.skillInterval = 4.4;
    this.cdMult = 1.0;           // cơ chế riêng có thể làm hồi chiêu nhanh hơn
    this.moveMult = 1.0;
  }

  get pos() { return this.m.position; }
  get scene() { return this.m.scene; }
  get particles() { return this.m.particles; }

  // --- Tạo hình ---
  mat(color, opts = {}) {
    const mt = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: opts.r ?? 0.6,
      metalness: opts.m ?? 0.1,
      transparent: opts.o !== undefined,
      opacity: opts.o ?? 1,
      side: opts.side ?? THREE.FrontSide,
    });
    this.m.damageableMaterials.push(mt); // nháy đỏ khi trúng đòn
    return mt;
  }

  glow(color, opacity = 1) {
    return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  }

  add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = false) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (shadow) mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  group(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  // --- Tiện ích chiến đấu ---
  idleName() {
    return this.m.isEnraged ? (this.m.config.enrageText || '🔥 Cuồng Nộ') : '⚡ Sẵn sàng chiến đấu';
  }

  say(text) { this.m.currentSkillName = text; }

  angleTo(p) { return Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }

  distTo(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }

  forward() { return new V3(Math.sin(this.m.rotationY), 0, Math.cos(this.m.rotationY)); }

  dirTo(p) {
    const d = new V3(p.x - this.pos.x, 0, p.z - this.pos.z);
    if (d.lengthSq() < 1e-4) return this.forward();
    return d.normalize();
  }

  setYaw(a) {
    this.m.rotationY = a;
    this.m.model.rotation.y = a;
  }

  faceNow(p) { this.setYaw(this.angleTo(p)); }

  turnTo(p, delta, rate = this.turnRate) {
    let diff = this.angleTo(p) - this.m.rotationY;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), rate * delta);
    this.setYaw(this.m.rotationY + step);
  }

  moveAlong(dir, speedMult, delta) {
    const sp = this.m.speed * speedMult * this.moveMult * delta;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x + dir.x * sp, -115, 115);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z + dir.z * sp, -115, 115);
  }

  ground(p) {
    const v = p.clone();
    v.x = THREE.MathUtils.clamp(v.x, -115, 115);
    v.z = THREE.MathUtils.clamp(v.z, -115, 115);
    v.y = getTerrainHeight(v.x, v.z);
    return v;
  }

  hit(player, dmg, label, color = '#ff4757', status = null, kb = 0) {
    this.m.inflictDamageToPlayer(player, dmg, `-${dmg} ${label}`, color, status, kb);
  }

  inRange(player, r) { return player && !player.isDead && this.distTo(player.position) <= r; }

  // Người chơi nằm trong hình quạt phía trước boss
  inCone(player, range, halfAngle) {
    if (!player || player.isDead) return false;
    const d = this.distTo(player.position);
    if (d > range) return false;
    if (d < this.m.hitRadius * 0.6) return true;
    const to = this.dirTo(player.position);
    return to.dot(this.forward()) >= Math.cos(halfAngle);
  }

  // Vòng sáng nổ tại điểm (hiệu ứng thuần hình ảnh)
  burst(p, color, radius = 6, count = 20) {
    if (!this.particles) return;
    this.particles.emitShockwave(p.clone().add(new V3(0, 0.4, 0)), color, radius, 0.5);
    this.particles.emitElementalParticles(p.clone().add(new V3(0, 1.4, 0)), count, [color, 0xffffff], [2, 7], 0.8, 6, 0.9);
  }

  // Cột sáng thẳng đứng (sét, cột băng...) tồn tại ngắn
  pillarFlash(p, color, height = 18, radius = 0.6, duration = 0.35) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.6, height, 6), mat);
    mesh.position.set(p.x, getTerrainHeight(p.x, p.z) + height / 2, p.z);
    this.m.spawnCustomEffect(duration, (ef, dt, pl, t) => {
      mat.opacity = 0.95 * (1 - t);
      mesh.scale.x = mesh.scale.z = 1 + t;
    }, () => { mesh.geometry.dispose(); mat.dispose(); }, mesh);
  }

  // Điểm xuất phát của đạn: ngang tầm người chơi (đạn chỉ trúng khi bay ngang người), nhô ra trước thân boss
  shotOrigin() {
    return this.pos.clone().add(new V3(0, 1.5, 0)).addScaledVector(this.forward(), this.m.hitRadius * 0.6);
  }

  // --- Hành động có mốc ra đòn (impact) ---
  act(name, dur, impacts = [], opts = {}) {
    this.action = { name, t: 0, dur, impacts: impacts.map(([at, fn]) => ({ at, fn, done: false })), ...opts };
  }

  actP() { return this.action ? Math.min(1, this.action.t / this.action.dur) : 0; }

  stepAction(delta, player) {
    const a = this.action;
    a.t += delta;
    const p = Math.min(1, a.t / a.dur);
    for (const imp of a.impacts) {
      if (!imp.done && p >= imp.at) {
        imp.done = true;
        imp.fn(player);
      }
    }
    if (a.update) a.update(delta, player, p);
    if (a.t >= a.dur && this.action === a) {
      this.action = null;
      if (a.onEnd) a.onEnd(player);
      if (!this.action) this.say(this.idleName());
    }
  }

  // --- Vòng lặp AI chung ---
  update(delta, player, dist) {
    if (!player) return;
    const m = this.m;
    const rate = (m.isEnraged ? 1.3 : 1.0) * this.cdMult;
    this.skillCd -= delta * rate;
    this.basicCd -= delta * rate;

    if (this.onUpdate) this.onUpdate(delta, player);
    if (player.isDead) { this.moving = false; return; }

    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      this.moving = false;
      if (this.stunTimer <= 0) this.say(this.idleName());
      return;
    }

    if (this.action) {
      this.moving = false;
      if (!this.action.lockTurn) this.turnTo(player.position, delta, this.turnRate * 0.35);
      this.stepAction(delta, player);
      return;
    }

    if (this.blockAI && this.blockAI(delta, player)) return;

    this.turnTo(player.position, delta);
    const d = this.distTo(player.position);

    if (this.skillCd <= 0) {
      const list = this.skills(d).filter((s) => s.id !== this.lastSkill && (s.w ?? 1) > 0);
      if (list.length) {
        let total = list.reduce((a, s) => a + (s.w ?? 1), 0);
        let r = Math.random() * total;
        let pick = list[0];
        for (const s of list) { r -= (s.w ?? 1); if (r <= 0) { pick = s; break; } }
        this.lastSkill = pick.id;
        this.skillCd = this.skillInterval;
        this.say(pick.name);
        pick.fn(player, d);
        return;
      }
    }

    if (this.basicCd <= 0 && d <= this.basicRange) {
      this.basicCd = this.basicInterval;
      this.basic(player, d);
      return;
    }

    // Di chuyển về tầm đánh ưa thích
    this.moving = false;
    if (d > this.preferredRange + 0.8) {
      this.moveAlong(this.dirTo(player.position), 1, delta);
      this.moving = true;
    } else if (this.kite && d < this.preferredRange - 5) {
      this.moveAlong(this.dirTo(player.position).negate(), 0.85, delta);
      this.moving = true;
    }
  }

  // --- Hook mặc định ---
  modifyDamage(amount) { return amount; }
  onDealDamage() {}
  onLethal() { return false; }
  onEnrage() {}
  skills() { return []; }
  basic() {}

  // Nhịp bước chân / thở mặc định
  walkSwing(amp = 0.5) {
    return this.moving ? Math.sin(this.m.walkAnimTime * 2.2) * amp : 0;
  }

  lerpRot(obj, axis, target, delta, speed = 10) {
    if (!obj) return;
    obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], target, Math.min(1, delta * speed));
  }
}

// =========================================================================
// 🦊 1. CỬU VĨ YÊU HẬU — Pháp sư thả diều, cơ chế 9 đuôi
// =========================================================================
class FoxEmpressKit extends BossKit {
  constructor(m) {
    super(m);
    this.basicRange = 26;
    this.preferredRange = 15;
    this.kite = true;
    this.basicInterval = 1.5;
    this.tailsLeft = 9;
  }

  buildMesh() {
    const M = this.m.model;
    const white = this.mat(0xfdf6f0);
    const robe = this.mat(0xc0392b, { r: 0.5 });
    const gold = this.mat(0xf1c40f, { r: 0.3, m: 0.7 });
    const fur = this.mat(0xff9f43);
    const tip = this.mat(0xffffff);

    this.add(M, new THREE.ConeGeometry(2.3, 5.6, 9), robe, 0, 2.8, 0, true);
    this.add(M, new THREE.TorusGeometry(1.55, 0.18, 6, 14), gold, 0, 4.3, 0).rotation.x = Math.PI / 2;

    this.torso = this.group(M, 0, 5.4, 0);
    this.add(this.torso, new THREE.CylinderGeometry(0.85, 1.25, 2.2, 8), white, 0, 0.9, 0, true);
    this.add(this.torso, new THREE.BoxGeometry(1.9, 0.35, 1.3), gold, 0, 1.9, 0);

    this.head = this.group(this.torso, 0, 2.9, 0);
    this.add(this.head, new THREE.SphereGeometry(0.95, 8, 6), white);
    this.add(this.head, new THREE.ConeGeometry(0.42, 1.1, 6), white, 0, -0.15, 0.95).rotation.x = Math.PI / 2;
    this.add(this.head, new THREE.SphereGeometry(0.12, 5, 4), this.glow(0x111111), 0, -0.12, 1.5);
    for (const sx of [-1, 1]) {
      const ear = this.add(this.head, new THREE.ConeGeometry(0.32, 1.0, 4), fur, sx * 0.55, 0.95, -0.05);
      ear.rotation.z = -sx * 0.25;
      this.add(this.head, new THREE.SphereGeometry(0.13, 5, 4), this.glow(0xff2d55), sx * 0.36, 0.15, 0.82);
    }
    this.add(this.head, new THREE.ConeGeometry(0.5, 0.5, 5), gold, 0, 0.95, 0.1);

    this.armL = this.group(this.torso, -1.25, 1.6, 0);
    this.armR = this.group(this.torso, 1.25, 1.6, 0);
    for (const arm of [this.armL, this.armR]) {
      this.add(arm, new THREE.CylinderGeometry(0.3, 0.45, 2.2, 6), robe, 0, -1.0, 0);
    }
    this.orb = this.add(this.armR, new THREE.IcosahedronGeometry(0.55, 0), this.glow(0x00e5ff), 0, -2.4, 0.3);

    // 9 đuôi xoè sau lưng
    this.tailRoot = this.group(M, 0, 3.4, -1.3);
    this.tails = [];
    for (let i = 0; i < 9; i++) {
      const g = this.group(this.tailRoot);
      const a = (i - 4) * 0.3;
      g.rotation.set(-0.95, 0, a);
      this.add(g, new THREE.ConeGeometry(0.5, 4.4, 6), fur, 0, 2.2, 0, i === 4);
      this.add(g, new THREE.SphereGeometry(0.42, 6, 5), tip, 0, 4.3, 0);
      g.userData.baseZ = a;
      this.tails.push(g);
    }
  }

  foxOrb(origin, dir, dmg, homing = 0.6) {
    this.m.spawnMonsterProjectile(origin, dir, 18, 0.65, dmg, 0xff7eb3, 3.2, null, false, { homing, label: '🦊 HỒ HOẢ', textColor: '#ff7eb3' });
  }

  basic(player) {
    const n = this.tailsLeft <= 3 ? 5 : 3;
    this.act('cast', 0.6, [[0.55, () => {
      const origin = this.shotOrigin();
      const baseA = this.angleTo(player.position);
      for (let i = 0; i < n; i++) {
        const a = baseA + (i - (n - 1) / 2) * 0.22;
        this.foxOrb(origin, new V3(Math.sin(a), 0, Math.cos(a)), 45);
      }
      sound.playFeatherShoot?.();
    }]]);
  }

  skills(d) {
    return [
      { id: 'ice', name: '❄️ Băng Hồ Trận!', w: 1.2, fn: (pl) => this.castIceFormation(pl) },
      { id: 'blink', name: '🌀 Hồ Ảnh Độn Thuật!', w: d < 10 ? 2.5 : 0.6, fn: (pl) => this.castShadowStep(pl) },
      { id: 'lotus', name: '🌸 Cửu Vĩ Liên Hoa!', w: 1.0, fn: () => this.castLotus() },
    ];
  }

  castIceFormation(player) {
    this.act('nova', 1.0, [[0.3, () => {
      const c = this.m.predictPlayerPosition(player, 0.6);
      const pts = [c];
      for (let i = 0; i < (this.m.isEnraged ? 6 : 4); i++) {
        const a = Math.random() * TAU;
        pts.push(this.ground(c.clone().add(new V3(Math.sin(a) * (4 + Math.random() * 5), 0, Math.cos(a) * (4 + Math.random() * 5)))));
      }
      pts.forEach((p, i) => {
        this.m.spawnTelegraphAOE(p, 3.6, 1.1 + i * 0.08, 0x74b9ff, (pl) => {
          this.pillarFlash(p, 0xa5f3ff, 6, 1.2, 0.5);
          this.burst(p, 0x74b9ff, 4.5, 12);
          if (pl && !pl.isDead && Math.hypot(pl.position.x - p.x, pl.position.z - p.z) <= 3.6) {
            this.hit(pl, 85, '❄️ BĂNG HỒ TRẬN', '#74b9ff', 'freeze');
          }
        });
      });
    }]]);
  }

  castShadowStep(player) {
    const old = this.pos.clone();
    this.m.spawnTelegraphAOE(old, 6, 1.0, 0xff7eb3, (pl) => {
      this.burst(old, 0xff7eb3, 7, 26);
      if (pl && !pl.isDead && Math.hypot(pl.position.x - old.x, pl.position.z - old.z) <= 6) {
        this.hit(pl, 120, '🌀 HỒ ẢNH BỘC PHÁ', '#ff7eb3', null, 12);
      }
    });
    this.burst(old, 0xff7eb3, 4, 18);
    const away = this.dirTo(player.position).negate();
    const side = new V3(-away.z, 0, away.x).multiplyScalar((Math.random() - 0.5) * 12);
    const target = this.ground(player.position.clone().addScaledVector(away, 17).add(side));
    this.m.model.visible = false;
    this.act('vanish', 0.45, [], {
      onEnd: (pl) => {
        this.pos.copy(target);
        this.m.group.position.copy(this.pos);
        this.m.model.visible = true;
        if (pl) this.faceNow(pl.position);
        this.burst(this.pos, 0xff7eb3, 4, 14);
      },
    });
  }

  castLotus() {
    this.act('nova', 1.1, [[0.45, () => this.radialBurst(16, 0)], [0.8, () => this.radialBurst(16, Math.PI / 16)]]);
  }

  radialBurst(n, offset, dmg = 65) {
    const origin = this.shotOrigin();
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * TAU;
      this.m.spawnMonsterProjectile(origin, new V3(Math.sin(a), 0, Math.cos(a)), 13, 0.6, dmg, 0xff7eb3, 2.6, null, false, { label: '🌸 LIÊN HOA', textColor: '#ff7eb3' });
    }
    sound.playFeatherShoot?.();
  }

  // Cơ chế 9 đuôi: mỗi 1/9 máu mất đi rụng 1 đuôi & bộc phát hồ hoả
  onUpdate() {
    const shouldHave = Math.max(0, Math.ceil((this.m.hp / this.m.maxHp) * 9));
    while (this.tailsLeft > shouldHave && this.tailsLeft > 0) {
      this.tailsLeft--;
      const t = this.tails[this.tailsLeft];
      if (t) t.visible = false;
      if (this.m.hp > 0) {
        this.say(`🦊 Rụng 1 đuôi (còn ${this.tailsLeft}) — HỒ HOẢ BỘC PHÁT!`);
        this.radialBurst(10, Math.random(), 55);
      }
    }
  }

  animate(delta) {
    const tt = this.m.walkAnimTime;
    this.torso.position.y = 5.4 + Math.sin(tt * 0.8) * 0.15;
    this.tails.forEach((g, i) => {
      g.rotation.z = g.userData.baseZ + Math.sin(tt * 1.2 + i * 0.7) * 0.12;
    });
    this.orb.rotation.y += delta * 4;
    const a = this.action?.name;
    const p = this.actP();
    if (a === 'cast') {
      this.lerpRot(this.armR, 'x', p < 0.5 ? -2.2 : -1.2, delta, 14);
    } else if (a === 'nova') {
      this.lerpRot(this.armR, 'x', -2.8, delta, 10);
      this.lerpRot(this.armL, 'x', -2.8, delta, 10);
    } else {
      this.lerpRot(this.armR, 'x', -0.3, delta, 6);
      this.lerpRot(this.armL, 'x', 0.2, delta, 6);
    }
  }
}

// =========================================================================
// 🗿 2. BÀN CỔ THẠCH VƯƠNG — Hộ vệ khổng lồ, giáp trước / lõi sau lưng
// =========================================================================
class StoneKingKit extends BossKit {
  constructor(m) {
    super(m);
    this.basicRange = 9;
    this.preferredRange = 6.5;
    this.turnRate = 1.1; // xoay người rất chậm -> người chơi có cơ hội vòng ra sau
    this.basicInterval = 2.2;
    this.skillInterval = 5.0;
    this._lastWeakText = 0;
  }

  buildMesh() {
    const M = this.m.model;
    const rock = this.mat(0x8d7b68, { r: 0.95 });
    const dark = this.mat(0x5d4e3f, { r: 0.95 });
    const moss = this.mat(0x6ab04c, { r: 0.9 });
    const gold = this.mat(0xf9ca24, { r: 0.3, m: 0.7 });

    this.legL = this.group(M, -1.5, 3.2, 0);
    this.legR = this.group(M, 1.5, 3.2, 0);
    for (const leg of [this.legL, this.legR]) {
      this.add(leg, new THREE.BoxGeometry(1.8, 3.2, 1.9), dark, 0, -1.6, 0, true);
    }

    this.torso = this.group(M, 0, 3.4, 0);
    this.add(this.torso, new THREE.BoxGeometry(5.2, 4.4, 3.6), rock, 0, 2.2, 0, true);
    this.add(this.torso, new THREE.BoxGeometry(5.6, 1.0, 3.9), dark, 0, 4.6, 0);
    this.add(this.torso, new THREE.BoxGeometry(1.6, 0.5, 1.2), moss, -1.4, 4.5, 1.4);
    this.add(this.torso, new THREE.BoxGeometry(1.2, 0.4, 0.9), moss, 1.8, 1.4, 1.6);
    // Lõi dung nham sau lưng: điểm yếu
    this.core = this.add(this.torso, new THREE.OctahedronGeometry(1.0, 0), this.glow(0xff7a00), 0, 2.6, -1.95);
    this.coreRing = this.add(this.torso, new THREE.TorusGeometry(1.35, 0.14, 6, 14), this.glow(0xffb142), 0, 2.6, -1.9);
    // Vết nứt phát sáng mặt trước (chỉ trang trí)
    this.add(this.torso, new THREE.BoxGeometry(0.15, 2.4, 0.1), this.glow(0xffa502), 0.6, 2.1, 1.82).rotation.z = 0.3;

    this.head = this.group(this.torso, 0, 5.6, 0.3);
    this.add(this.head, new THREE.BoxGeometry(1.9, 1.6, 1.8), rock, 0, 0.6, 0);
    for (const sx of [-1, 1]) this.add(this.head, new THREE.BoxGeometry(0.35, 0.22, 0.1), this.glow(0xffa502), sx * 0.45, 0.75, 0.92);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      this.add(this.head, new THREE.ConeGeometry(0.28, 0.9, 4), gold, Math.sin(a) * 0.75, 1.75, Math.cos(a) * 0.75);
    }

    this.armL = this.group(this.torso, -3.2, 4.0, 0);
    this.armR = this.group(this.torso, 3.2, 4.0, 0);
    for (const arm of [this.armL, this.armR]) {
      this.add(arm, new THREE.BoxGeometry(1.6, 3.0, 1.6), rock, 0, -1.5, 0, true);
      this.add(arm, new THREE.DodecahedronGeometry(1.45, 0), dark, 0, -3.6, 0.2, true);
    }
  }

  basic(player) {
    this.act('slam', 1.25, [[0.0, () => {
      const c = this.ground(this.pos.clone().addScaledVector(this.dirTo(player.position), 5.2));
      this.slamCenter = c;
      this.m.spawnTelegraphAOE(c, 5, 0.9, 0xffa502, (pl) => {
        this.m.emitHeavyGroundImpact(c, 5.5, 0xffa502, 4, pl);
        if (pl && !pl.isDead && Math.hypot(pl.position.x - c.x, pl.position.z - c.z) <= 5) {
          this.hit(pl, 165, '🗿 THẠCH QUYỀN GIÁNG THẾ', '#ffa502', null, 14);
        }
      });
    }]], { lockTurn: true });
  }

  skills(d) {
    return [
      { id: 'fissure', name: '⛰️ Địa Liệt Tam Đoạn!', w: 1.2, fn: (pl) => this.castFissure(pl) },
      { id: 'prison', name: '🪨 Thạch Trụ Lao Ngục!', w: 1.0, fn: (pl) => this.castPrison(pl) },
      { id: 'boulder', name: '☄️ Ngự Thạch Phi Nham!', w: d > 12 ? 2.2 : 0.7, fn: (pl) => this.castBoulder(pl) },
    ];
  }

  castFissure(player) {
    this.act('slam', 1.4, [[0.35, () => {
      const baseA = this.angleTo(player.position);
      const offsets = this.m.isEnraged ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.35, 0, 0.35];
      offsets.forEach((o, i) => {
        const dir = new V3(Math.sin(baseA + o), 0, Math.cos(baseA + o));
        const origin = this.pos.clone();
        this.m.spawnTelegraphLine(origin, dir, 26, 3.2, 0.8 + i * 0.25, 0xffa502, (pl) => {
          for (let k = 1; k <= 5; k++) {
            this.m.emitHeavyGroundImpact(origin.clone().addScaledVector(dir, k * 5), 2.5, 0xb87333, 1, null);
          }
          if (pl && !pl.isDead && this.m.isPointInLine(pl.position, origin, dir, 26, 3.2)) {
            this.hit(pl, 140, '⛰️ ĐỊA LIỆT', '#ffa502', 'slow', 10);
          }
        });
      });
    }]], { lockTurn: true });
  }

  castPrison(player) {
    const c = player.position.clone();
    const ringN = 8;
    const ringR = 7;
    this.act('slam', 1.0, [[0.4, () => {
      for (let i = 0; i < ringN; i++) {
        const a = (i / ringN) * TAU;
        const p = this.ground(c.clone().add(new V3(Math.sin(a) * ringR, 0, Math.cos(a) * ringR)));
        this.m.spawnTelegraphAOE(p, 2.2, 0.9, 0xb87333, (pl) => {
          this.raisePillar(p);
          if (pl && !pl.isDead && Math.hypot(pl.position.x - p.x, pl.position.z - p.z) <= 2.2) {
            this.hit(pl, 80, '🪨 THẠCH TRỤ', '#c8a165', null, 10);
          }
        });
      }
      // Tâm lao ngục sụp xuống sau khi cột đá dựng lên -> phải thoát ra qua khe hở
      this.m.spawnTelegraphAOE(this.ground(c), ringR - 1.2, 2.1, 0xff4757, (pl) => {
        this.m.emitHeavyGroundImpact(c, 6, 0xff4757, 5, pl);
        if (pl && !pl.isDead && Math.hypot(pl.position.x - c.x, pl.position.z - c.z) <= ringR - 1.2) {
          this.hit(pl, 190, '🪨 LAO NGỤC SỤP ĐỔ', '#ff4757', null, 12);
        }
      });
    }]]);
  }

  raisePillar(p) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8d7b68, flatShading: true, roughness: 0.95 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 5, 6), mat);
    mesh.position.set(p.x, getTerrainHeight(p.x, p.z) - 2.5, p.z);
    mesh.castShadow = true;
    const baseY = getTerrainHeight(p.x, p.z);
    this.m.spawnCustomEffect(2.6, (ef, dt, pl, t) => {
      const rise = Math.min(1, ef.elapsed / 0.2);
      const sink = t > 0.8 ? (t - 0.8) / 0.2 : 0;
      mesh.position.y = baseY - 2.5 + 5 * rise - 5 * sink;
    }, () => { mesh.geometry.dispose(); mat.dispose(); }, mesh);
  }

  castBoulder(player) {
    const n = this.m.isEnraged ? 3 : 1;
    this.act('throw', 1.1, [[0.6, () => {
      const origin = this.shotOrigin();
      const baseA = this.angleTo(this.m.predictPlayerPosition(player, 0.5));
      for (let i = 0; i < n; i++) {
        const a = baseA + (i - (n - 1) / 2) * 0.3;
        this.m.spawnMonsterProjectile(origin, new V3(Math.sin(a), 0, Math.cos(a)), 17, 1.9, 175, 0x8d7b68, 3.2, null, false, { label: '☄️ PHI NHAM', textColor: '#c8a165', knockback: 14 });
      }
    }]], { lockTurn: true });
  }

  // Cơ chế Thạch Giáp: phía trước giảm 65% sát thương, lõi sau lưng nhận x1.7
  modifyDamage(amount, hitPos) {
    if (!hitPos) return amount;
    const to = new V3(hitPos.x - this.pos.x, 0, hitPos.z - this.pos.z);
    if (to.lengthSq() < 0.01) return amount;
    to.normalize();
    const dot = to.dot(this.forward());
    const now = performance.now();
    if (dot < -0.35) {
      if (this.particles) this.particles.emitHitSparkles(this.pos.clone().add(new V3(0, 6, 0)).addScaledVector(this.forward(), -2), 8);
      if (now - this._lastWeakText > 1500) {
        this._lastWeakText = now;
        this.say('💥 TRÚNG LÕI DUNG NHAM! (x1.7 sát thương)');
      }
      return Math.round(amount * 1.7);
    }
    if (dot > 0.2) return Math.max(1, Math.round(amount * 0.35));
    return amount;
  }

  animate(delta) {
    const sw = this.walkSwing(0.35);
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.core.rotation.y += delta * 2;
    this.coreRing.rotation.z += delta * 1.2;
    this.torso.rotation.z = this.moving ? Math.sin(this.m.walkAnimTime * 2.2) * 0.06 : 0;
    const a = this.action?.name;
    const p = this.actP();
    if (a === 'slam') {
      const up = p < 0.6 ? -3.0 : -0.4;
      this.lerpRot(this.armL, 'x', up, delta, p < 0.6 ? 5 : 18);
      this.lerpRot(this.armR, 'x', up, delta, p < 0.6 ? 5 : 18);
      this.lerpRot(this.torso, 'x', p < 0.6 ? -0.2 : 0.35, delta, 10);
    } else if (a === 'throw') {
      this.lerpRot(this.armR, 'x', p < 0.55 ? -3.1 : -0.8, delta, p < 0.55 ? 6 : 20);
      this.lerpRot(this.armL, 'x', -0.4, delta, 6);
      this.lerpRot(this.torso, 'x', 0, delta, 6);
    } else {
      this.lerpRot(this.armL, 'x', -sw * 0.6, delta, 6);
      this.lerpRot(this.armR, 'x', sw * 0.6, delta, 6);
      this.lerpRot(this.torso, 'x', 0, delta, 6);
    }
  }
}

// =========================================================================
// 👺 3. HUYẾT ẢNH KIẾM QUỶ — Sát thủ song kiếm, hút máu & cuồng huyết
// =========================================================================
class BloodDemonKit extends BossKit {
  constructor(m) {
    super(m);
    this.basicRange = 6.5;
    this.preferredRange = 3.5;
    this.turnRate = 8;
    this.basicInterval = 1.3;
    this.skillInterval = 4.0;
    this.frenzy = 0;
    this.frenzyTimer = 0;
  }

  buildMesh() {
    const M = this.m.model;
    const body = this.mat(0x2d1b2e);
    const cloth = this.mat(0x5c1018, { side: THREE.DoubleSide });
    const mask = this.mat(0xd63031, { r: 0.4 });
    const bone = this.mat(0xf5f6fa);
    const steel = this.mat(0xdfe6e9, { r: 0.2, m: 0.85 });

    this.legL = this.group(M, -0.55, 3.0, 0);
    this.legR = this.group(M, 0.55, 3.0, 0);
    for (const leg of [this.legL, this.legR]) this.add(leg, new THREE.BoxGeometry(0.6, 3.0, 0.7), body, 0, -1.5, 0, true);

    this.torso = this.group(M, 0, 3.0, 0);
    this.add(this.torso, new THREE.BoxGeometry(1.9, 2.8, 1.1), body, 0, 1.4, 0, true);
    this.add(this.torso, new THREE.BoxGeometry(2.0, 0.4, 1.2), mask, 0, 0.3, 0);
    this.cloak = this.add(this.torso, new THREE.PlaneGeometry(2.4, 4.2, 1, 3), cloth, 0, 0.8, -0.7);
    this.scarf = this.add(this.torso, new THREE.BoxGeometry(0.4, 0.15, 3.2), mask, 0.5, 2.7, -1.6);

    this.head = this.group(this.torso, 0, 3.4, 0);
    this.add(this.head, new THREE.BoxGeometry(1.0, 1.1, 1.0), body, 0, 0.4, 0);
    this.add(this.head, new THREE.BoxGeometry(1.05, 0.9, 0.2), mask, 0, 0.45, 0.55);
    for (const sx of [-1, 1]) {
      this.add(this.head, new THREE.ConeGeometry(0.16, 0.9, 4), bone, sx * 0.4, 1.3, 0.2).rotation.z = -sx * 0.35;
      this.add(this.head, new THREE.BoxGeometry(0.22, 0.08, 0.05), this.glow(0xfff200), sx * 0.24, 0.55, 0.67);
    }

    this.armL = this.group(this.torso, -1.15, 2.5, 0);
    this.armR = this.group(this.torso, 1.15, 2.5, 0);
    for (const arm of [this.armL, this.armR]) {
      this.add(arm, new THREE.BoxGeometry(0.5, 2.2, 0.5), body, 0, -1.0, 0);
      const sword = this.group(arm, 0, -2.2, 0.2);
      this.add(sword, new THREE.BoxGeometry(0.16, 0.2, 0.6), mask, 0, 0, 0);
      this.add(sword, new THREE.BoxGeometry(0.1, 0.3, 3.6), steel, 0, 0, 2.0);
      this.add(sword, new THREE.BoxGeometry(0.06, 0.06, 3.4), this.glow(0xff4757), 0, 0.17, 2.0);
    }
  }

  basic(player) {
    // Tam liên trảm: mỗi nhát lướt tới 2.5m
    const strike = (dmg, k) => () => {
      const dir = this.dirTo(player.position);
      this.pos.addScaledVector(dir, Math.min(2.5, Math.max(0, this.distTo(player.position) - 2.5)));
      this.m.spawnSlashArc(5.2, 0xff4757, k === 1 ? Math.PI / 2 : (k === 2 ? -0.3 : 0.25), 2.4, 0.22);
      sound.playSwordSlash?.();
      if (this.inCone(player, 5.8, Math.PI / 2.4)) this.hit(player, dmg, '👺 HUYẾT ẢNH TRẢM', '#ff4757');
    };
    this.act('combo', 1.0, [[0.2, strike(55, 0)], [0.48, strike(55, 1)], [0.8, strike(85, 2)]]);
  }

  skills(d) {
    return [
      { id: 'blink', name: '🗡️ Thuấn Sát Bối Tâm!', w: d > 8 ? 2.2 : 1.0, fn: (pl) => this.castBlink(pl) },
      { id: 'clones', name: '👥 Huyết Ảnh Tam Phân!', w: 1.0, fn: (pl) => this.castClones(pl) },
      { id: 'rain', name: '⚔️ Vạn Kiếm Quy Tông!', w: 1.0, fn: (pl) => this.castSwordRain(pl) },
    ];
  }

  castBlink(player) {
    const rotY = player.rotationY || 0;
    const behind = this.ground(new V3(player.position.x - Math.sin(rotY) * 3.5, 0, player.position.z - Math.cos(rotY) * 3.5));
    this.burst(this.pos, 0xd63031, 4, 16);
    this.m.model.visible = false;
    this.m.spawnTelegraphAOE(behind, 5, 0.5, 0xd63031, null);
    this.act('vanish', 0.5, [], {
      lockTurn: true,
      onEnd: (pl) => {
        this.pos.copy(behind);
        this.m.group.position.copy(this.pos);
        this.m.model.visible = true;
        if (pl) this.faceNow(pl.position);
        this.act('combo', 0.45, [[0.35, () => {
          this.m.spawnSlashArc(5.5, 0xd63031, 0.1, 2.4, 0.25);
          sound.playSwordSlash?.();
          if (pl && this.inRange(pl, 5.2)) this.hit(pl, 125, '🗡️ THUẤN SÁT', '#d63031', null, 8);
        }]]);
      },
    });
  }

  castClones(player) {
    const c = player.position.clone();
    const baseA = Math.random() * TAU;
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x8b0000, transparent: true, opacity: 0.55, depthWrite: false });
    this.m.model.visible = false;
    let lastEnd = null;
    for (let i = 0; i < 3; i++) {
      const a = baseA + (i / 3) * TAU;
      const start = this.ground(c.clone().add(new V3(Math.sin(a) * 10, 0, Math.cos(a) * 10)));
      const dir = new V3(c.x - start.x, 0, c.z - start.z).normalize();
      const len = 20;
      const delay = 0.9 + i * 0.3;
      lastEnd = this.ground(start.clone().addScaledVector(dir, len));
      const clone = this.m.model.clone(true);
      clone.visible = true;
      clone.traverse((o) => { if (o.isMesh) o.material = shadowMat; });
      clone.position.copy(start);
      clone.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
      const end = lastEnd.clone();
      this.m.spawnCustomEffect(delay + 0.5, (ef) => {
        if (ef.elapsed > delay) clone.position.lerpVectors(start, end, Math.min(1, (ef.elapsed - delay) / 0.2));
      }, null, clone);
      this.m.spawnTelegraphLine(start, dir, len, 2.6, delay, 0xd63031, (pl) => {
        sound.playSwordSlash?.();
        if (pl && !pl.isDead && this.m.isPointInLine(pl.position, start, dir, len, 2.6)) this.hit(pl, 85, '👥 HUYẾT ẢNH', '#ff7675', null, 8);
      });
    }
    // Bản thể thật xuất hiện ở cuối đường lướt cuối cùng
    this.act('vanish', 0.9 + 2 * 0.3 + 0.25, [], {
      lockTurn: true,
      onEnd: (pl) => {
        this.pos.copy(lastEnd);
        this.m.group.position.copy(this.pos);
        this.m.model.visible = true;
        if (pl) this.faceNow(pl.position);
      },
    });
  }

  castSwordRain(player) {
    this.act('cast', 0.9, [[0.4, () => {
      const c = player.position.clone();
      const n = this.m.isEnraged ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI + Math.random() * 0.4;
        const dir = new V3(Math.sin(a), 0, Math.cos(a));
        const origin = this.ground(c.clone().addScaledVector(dir, -13));
        this.m.spawnTelegraphLine(origin, dir, 26, 2.2, 1.0 + i * 0.12, 0xff4757, (pl) => {
          for (let k = 0; k < 4; k++) this.pillarFlash(origin.clone().addScaledVector(dir, 4 + k * 6), 0xff7675, 7, 0.25, 0.25);
          if (pl && !pl.isDead && this.m.isPointInLine(pl.position, origin, dir, 26, 2.2)) this.hit(pl, 90, '⚔️ VẠN KIẾM', '#ff4757');
        });
      }
    }]]);
  }

  // Cơ chế Huyết Khát: hút 50% sát thương gây ra & cộng tầng cuồng huyết
  onDealDamage(amount) {
    const heal = Math.round(amount * 0.5);
    this.m.hp = Math.min(this.m.maxHp, this.m.hp + heal);
    this.frenzy = Math.min(5, this.frenzy + 1);
    this.frenzyTimer = 5;
    this.cdMult = 1 + this.frenzy * 0.08;
    this.moveMult = 1 + this.frenzy * 0.06;
    if (this.particles) this.particles.emitElementalParticles(this.pos.clone().add(new V3(0, 5, 0)), 8, [0xff0000, 0x8b0000], [1, 3], 0.6, -2, 0.6);
    this.say(`🩸 Hút máu +${heal} · Cuồng huyết x${this.frenzy}`);
  }

  onUpdate(delta) {
    if (this.frenzyTimer > 0) {
      this.frenzyTimer -= delta;
      if (this.frenzyTimer <= 0) {
        this.frenzy = 0;
        this.cdMult = 1;
        this.moveMult = 1;
      }
    }
  }

  animate(delta) {
    const sw = this.walkSwing(0.7);
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.cloak.rotation.x = 0.25 + (this.moving ? 0.35 : 0) + Math.sin(this.m.walkAnimTime * 3) * 0.06;
    this.scarf.rotation.y = Math.sin(this.m.walkAnimTime * 2.4) * 0.3;
    const a = this.action?.name;
    const p = this.actP();
    if (a === 'combo') {
      const ph = Math.floor(p * 3);
      this.lerpRot(this.armR, 'x', ph === 1 ? -0.4 : -2.3, delta, 22);
      this.lerpRot(this.armL, 'x', ph === 1 ? -2.3 : -0.4, delta, 22);
      this.lerpRot(this.torso, 'y', ph === 1 ? 0.5 : -0.5, delta, 18);
    } else if (a === 'cast') {
      this.lerpRot(this.armR, 'x', -3.0, delta, 10);
      this.lerpRot(this.armL, 'x', -3.0, delta, 10);
    } else {
      this.lerpRot(this.armR, 'x', -0.6 - sw * 0.3, delta, 8);
      this.lerpRot(this.armL, 'x', -0.6 + sw * 0.3, delta, 8);
      this.lerpRot(this.torso, 'y', 0, delta, 8);
    }
  }
}

// =========================================================================
// 🔥 4. HOẢ DIỆM MA THẦN — Đấu sĩ rìu lửa, hào quang thiêu đốt
// =========================================================================
class FireDemonKit extends BossKit {
  constructor(m) {
    super(m);
    this.basicRange = 8.5;
    this.preferredRange = 5.5;
    this.turnRate = 3.5;
    this.basicInterval = 1.9;
    this.auraTick = 0;
  }

  buildMesh() {
    const M = this.m.model;
    const skin = this.mat(0x3d0c02, { r: 0.7 });
    const armor = this.mat(0x2d3436, { r: 0.4, m: 0.6 });
    const horn = this.mat(0x1e1e1e);
    const wood = this.mat(0x5d3a1a);
    const blade = this.mat(0x636e72, { r: 0.3, m: 0.8 });
    const magma = this.glow(0xff6b1a);
    const fire = this.glow(0xffc312, 0.9);

    this.legL = this.group(M, -1.2, 3.4, 0);
    this.legR = this.group(M, 1.2, 3.4, 0);
    for (const leg of [this.legL, this.legR]) {
      this.add(leg, new THREE.BoxGeometry(1.4, 3.4, 1.5), skin, 0, -1.7, 0, true);
      this.add(leg, new THREE.BoxGeometry(1.6, 0.6, 1.9), armor, 0, -3.1, 0.15);
    }
    this.torso = this.group(M, 0, 3.4, 0);
    this.add(this.torso, new THREE.BoxGeometry(4.0, 3.8, 2.6), skin, 0, 1.9, 0, true);
    this.add(this.torso, new THREE.BoxGeometry(4.3, 1.0, 2.9), armor, 0, 0.3, 0);
    for (const [x, y, rz] of [[-0.9, 2.2, 0.5], [0.8, 1.6, -0.4], [0.2, 3.0, 0.2], [-0.3, 1.0, -0.6]]) {
      this.add(this.torso, new THREE.BoxGeometry(0.16, 1.4, 0.1), magma, x, y, 1.32).rotation.z = rz;
    }
    for (const sx of [-1, 1]) this.add(this.torso, new THREE.SphereGeometry(0.95, 6, 5), armor, sx * 2.3, 3.6, 0);

    this.head = this.group(this.torso, 0, 4.2, 0.2);
    this.add(this.head, new THREE.BoxGeometry(1.5, 1.4, 1.4), skin, 0, 0.6, 0);
    for (const sx of [-1, 1]) {
      this.add(this.head, new THREE.ConeGeometry(0.28, 1.5, 5), horn, sx * 0.8, 1.6, 0).rotation.z = -sx * 0.7;
      this.add(this.head, new THREE.BoxGeometry(0.3, 0.12, 0.05), this.glow(0xfff200), sx * 0.33, 0.8, 0.72);
    }
    this.flames = [];
    for (let i = 0; i < 5; i++) {
      const f = this.add(this.head, new THREE.ConeGeometry(0.32, 1.4, 5), i % 2 ? fire : magma, (i - 2) * 0.32, 1.8, -0.1);
      this.flames.push(f);
    }

    this.armL = this.group(this.torso, -2.6, 3.4, 0);
    this.armR = this.group(this.torso, 2.6, 3.4, 0);
    for (const arm of [this.armL, this.armR]) this.add(arm, new THREE.BoxGeometry(1.1, 3.0, 1.1), skin, 0, -1.4, 0, true);
    // Đại phủ hai lưỡi
    this.axe = this.group(this.armR, 0, -2.8, 0.3);
    this.add(this.axe, new THREE.CylinderGeometry(0.15, 0.15, 6.2, 6), wood, 0, 0, 1.6).rotation.x = Math.PI / 2;
    const bladeL = this.add(this.axe, new THREE.CylinderGeometry(1.5, 1.5, 0.2, 6, 1, false, 0, Math.PI), blade, 0, 0, 4.2);
    bladeL.rotation.z = Math.PI / 2;
    this.add(this.axe, new THREE.BoxGeometry(0.08, 2.6, 0.5), magma, 0, 0, 4.2);

    // Vòng hào quang thiêu đốt 9m dưới chân (cho người chơi thấy phạm vi)
    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(8.6, 9.0, 40),
      new THREE.MeshBasicMaterial({ color: 0xff6b1a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = 0.12;
    this.m.group.add(this.aura);
  }

  firePool(p, r = 3, dur = 4.5) {
    this.m.spawnPoisonPool(this.ground(p), r, dur, 22, {
      color: 0xff6b1a, label: '🔥 THIÊU ĐỐT', textColor: '#ff9f43', status: null, interval: 0.5,
      particleColors: [0xff6b1a, 0xffc312, 0x2d3436],
    });
  }

  basic(player) {
    this.act('cleave', 1.05, [[0.6, () => {
      this.m.spawnSlashArc(7.5, 0xff6b1a, 0.15, 2.6, 0.3);
      sound.playSwordSlash?.();
      if (this.inCone(player, 8, Math.PI / 2.3)) this.hit(player, 130, '🪓 LIỆT DIỆM PHỦ', '#ff6b1a', null, 10);
      this.firePool(this.pos.clone().addScaledVector(this.forward(), 4.5), 3.2);
    }]]);
  }

  skills(d) {
    return [
      { id: 'charge', name: '🐂 Liệt Diệm Xung Phong!', w: d > 9 ? 2.0 : 0.8, fn: (pl) => this.castCharge(pl) },
      { id: 'meteor', name: '☄️ Hoả Vũ Thiên Giáng!', w: 1.0, fn: (pl) => this.castMeteors(pl) },
      { id: 'rings', name: '⭕ Liệt Hoả Luân Hồi! (NHẢY ĐỂ NÉ)', w: d < 12 ? 1.6 : 0.5, fn: () => this.castFireRings() },
    ];
  }

  castCharge(player) {
    const dir = this.dirTo(this.m.predictPlayerPosition(player, 0.3));
    const len = Math.min(32, this.distTo(player.position) + 8);
    const origin = this.pos.clone();
    this.setYaw(Math.atan2(dir.x, dir.z));
    this.m.spawnTelegraphLine(origin, dir, len, 4.2, 0.85, 0xff6b1a, null);
    let hitDone = false;
    this.act('windup', 0.85, [], {
      lockTurn: true,
      onEnd: () => {
        this.act('charge', 0.55, [], {
          lockTurn: true,
          update: (dt, pl, p) => {
            const target = origin.clone().addScaledVector(dir, len * p);
            this.pos.x = THREE.MathUtils.clamp(target.x, -115, 115);
            this.pos.z = THREE.MathUtils.clamp(target.z, -115, 115);
            if (!hitDone && pl && this.inRange(pl, 4.2)) {
              hitDone = true;
              this.hit(pl, 175, '🐂 XUNG PHONG', '#ff6b1a', null, 18);
            }
          },
          onEnd: () => {
            for (let k = 1; k <= 4; k++) this.firePool(origin.clone().addScaledVector(dir, (k / 4) * len), 2.4, 5);
            this.m.emitHeavyGroundImpact(this.pos.clone(), 5, 0xff6b1a, 3, null);
          },
        });
      },
    });
  }

  castMeteors(player) {
    this.act('cast', 1.0, [[0.35, () => {
      const n = this.m.isEnraged ? 10 : 7;
      for (let i = 0; i < n; i++) {
        const p = i === 0 ? this.m.predictPlayerPosition(player, 0.7)
          : this.ground(player.position.clone().add(new V3((Math.random() - 0.5) * 22, 0, (Math.random() - 0.5) * 22)));
        this.m.spawnTelegraphAOE(p, 3.6, 1.0 + i * 0.16, 0xff6b1a, (pl) => {
          this.pillarFlash(p, 0xffc312, 16, 0.9, 0.3);
          this.burst(p, 0xff6b1a, 5, 16);
          this.firePool(p, 2.6, 3.5);
          if (pl && !pl.isDead && Math.hypot(pl.position.x - p.x, pl.position.z - p.z) <= 3.6) this.hit(pl, 120, '☄️ HOẢ VŨ', '#ff6b1a', null, 8);
        });
      }
    }]]);
  }

  castFireRings() {
    const n = this.m.isEnraged ? 4 : 3;
    const impacts = [];
    for (let i = 0; i < n; i++) {
      impacts.push([0.25 + i * 0.22, () => {
        this.m.spawnExpandingShockwave(this.pos.clone(), 22, 1.25, 95, 0xff6b1a);
        this.m.emitHeavyGroundImpact(this.pos.clone(), 4, 0xff6b1a, 2, null);
      }]);
    }
    this.act('stomp', 0.4 + n * 0.22 + 0.3, impacts, { lockTurn: true });
  }

  // Cơ chế hào quang thiêu đốt: đứng trong 9m mất máu mỗi giây
  onUpdate(delta, player) {
    this.auraTick += delta;
    if (this.auraTick >= 1.0) {
      this.auraTick = 0;
      if (player && !player.isDead && this.distTo(player.position) <= 9) {
        this.hit(player, this.m.isEnraged ? 36 : 20, '🔥 HÀO QUANG THIÊU ĐỐT', '#ff9f43');
      }
    }
  }

  animate(delta) {
    const tt = this.m.walkAnimTime;
    const sw = this.walkSwing(0.4);
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.flames.forEach((f, i) => { f.scale.y = 0.8 + Math.abs(Math.sin(tt * 6 + i)) * 0.6; });
    this.aura.rotation.z += delta * 0.6;
    this.aura.material.opacity = 0.4 + Math.sin(tt * 3) * 0.15;
    const a = this.action?.name;
    const p = this.actP();
    if (a === 'cleave') {
      this.lerpRot(this.armR, 'x', p < 0.55 ? -2.9 : -0.2, delta, p < 0.55 ? 6 : 22);
      this.lerpRot(this.torso, 'y', p < 0.55 ? 0.6 : -0.5, delta, 12);
    } else if (a === 'windup') {
      this.lerpRot(this.torso, 'x', 0.45, delta, 8);
      this.lerpRot(this.armR, 'x', -0.6, delta, 8);
    } else if (a === 'charge') {
      this.lerpRot(this.torso, 'x', 0.6, delta, 12);
      this.legL.rotation.x = Math.sin(tt * 14) * 0.8;
      this.legR.rotation.x = -Math.sin(tt * 14) * 0.8;
    } else if (a === 'cast') {
      this.lerpRot(this.armR, 'x', -3.0, delta, 8);
      this.lerpRot(this.armL, 'x', -3.0, delta, 8);
    } else if (a === 'stomp') {
      this.lerpRot(this.torso, 'x', Math.sin(p * Math.PI * 6) * 0.25, delta, 20);
    } else {
      this.lerpRot(this.armR, 'x', -0.5 + sw * 0.4, delta, 6);
      this.lerpRot(this.armL, 'x', -sw * 0.4, delta, 6);
      this.lerpRot(this.torso, 'x', 0, delta, 6);
      this.lerpRot(this.torso, 'y', 0, delta, 6);
    }
  }
}

// =========================================================================
// ❄️ 5. BĂNG PHÁCH TUYẾT NỮ — Khống chế băng, Băng Tinh Giáp
// =========================================================================
class FrostMaidenKit extends BossKit {
  constructor(m) {
    super(m);
    this.basicRange = 26;
    this.preferredRange = 13;
    this.kite = true;
    this.basicInterval = 1.4;
    this.shield = 0;
    this.shieldTimer = 8; // giáp đầu tiên sau 8s
    this.shieldMesh = null;
  }

  buildMesh() {
    const M = this.m.model;
    const dress = this.mat(0x74b9ff, { r: 0.35 });
    const white = this.mat(0xf5f6fa);
    const hair = this.mat(0xdff9fb);
    const silver = this.mat(0xc7ecee, { r: 0.2, m: 0.8 });
    const ice = this.glow(0xa5f3ff, 0.85);

    this.add(M, new THREE.ConeGeometry(2.4, 5.8, 10), dress, 0, 2.9, 0, true);
    this.add(M, new THREE.ConeGeometry(2.7, 1.2, 10), white, 0, 0.6, 0);
    this.torso = this.group(M, 0, 5.6, 0);
    this.add(this.torso, new THREE.CylinderGeometry(0.75, 1.1, 2.2, 8), dress, 0, 0.9, 0, true);
    this.head = this.group(this.torso, 0, 2.7, 0);
    this.add(this.head, new THREE.SphereGeometry(0.85, 8, 6), white);
    this.add(this.head, new THREE.BoxGeometry(1.5, 2.6, 0.4), hair, 0, -0.7, -0.6);
    for (const sx of [-1, 1]) this.add(this.head, new THREE.SphereGeometry(0.11, 5, 4), this.glow(0x0984e3), sx * 0.3, 0.05, 0.76);
    for (let i = 0; i < 7; i++) {
      const a = (i - 3) * 0.32;
      const spike = this.add(this.head, new THREE.ConeGeometry(0.14, 0.9 + (i === 3 ? 0.6 : 0), 4), ice, Math.sin(a) * 0.75, 0.95, Math.cos(a) * 0.3 - 0.05);
      spike.rotation.z = -a * 0.6;
    }
    this.armL = this.group(this.torso, -1.1, 1.6, 0);
    this.armR = this.group(this.torso, 1.1, 1.6, 0);
    for (const arm of [this.armL, this.armR]) this.add(arm, new THREE.CylinderGeometry(0.22, 0.35, 2.2, 6), white, 0, -1.0, 0);
    this.staff = this.group(this.armR, 0, -2.0, 0.2);
    this.add(this.staff, new THREE.CylinderGeometry(0.1, 0.1, 6, 6), silver, 0, 1.0, 0);
    this.crystal = this.add(this.staff, new THREE.OctahedronGeometry(0.7, 0), ice, 0, 4.3, 0);

    this.shards = this.group(M, 0, 5.2, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      this.add(this.shards, new THREE.OctahedronGeometry(0.42, 0), ice, Math.sin(a) * 3.0, Math.sin(a * 2) * 0.4, Math.cos(a) * 3.0);
    }
  }

  basic(player) {
    const n = this.m.isEnraged ? 2 : 1;
    this.act('cast', 0.55, [[0.5, () => {
      const origin = this.shotOrigin();
      const baseA = this.angleTo(this.m.predictPlayerPosition(player, 0.4));
      for (let i = 0; i < n; i++) {
        const a = baseA + (i - (n - 1) / 2) * 0.18;
        this.m.spawnMonsterProjectile(origin, new V3(Math.sin(a), 0, Math.cos(a)), 26, 0.6, 75, 0xa5f3ff, 2.4, 'slow', false, { label: '❄️ BĂNG THƯƠNG', textColor: '#74b9ff' });
      }
    }]]);
  }

  skills(d) {
    return [
      { id: 'prison', name: '🧊 Băng Lao Ngục!', w: 1.2, fn: (pl) => this.castPrison(pl) },
      { id: 'spikes', name: '🗡️ Băng Truỳ Đột Thứ!', w: 1.0, fn: (pl) => this.castSpikes(pl) },
      { id: 'blizzard', name: '🌨️ Bạo Tuyết Lĩnh Vực!', w: 0.9, fn: (pl) => this.castBlizzard(pl) },
    ];
  }

  castPrison(player) {
    this.act('cast', 0.8, [[0.3, () => {
      const pts = [this.m.predictPlayerPosition(player, 0.5)];
      if (this.m.isEnraged) pts.push(this.m.predictPlayerPosition(player, 1.2));
      pts.forEach((p, i) => {
        this.m.spawnTelegraphAOE(p, 4, 1.1 + i * 0.5, 0x74b9ff, (pl) => {
          this.pillarFlash(p, 0xdff9fb, 7, 2.2, 0.6);
          this.burst(p, 0xa5f3ff, 5, 18);
          if (pl && !pl.isDead && Math.hypot(pl.position.x - p.x, pl.position.z - p.z) <= 4) this.hit(pl, 90, '🧊 BĂNG LAO', '#74b9ff', 'freeze');
        });
      });
    }]]);
  }

  castSpikes(player) {
    this.act('cast', 0.9, [[0.35, () => {
      const dirs = this.m.isEnraged ? [-0.3, 0, 0.3] : [0];
      const baseA = this.angleTo(player.position);
      dirs.forEach((o) => {
        const dir = new V3(Math.sin(baseA + o), 0, Math.cos(baseA + o));
        const origin = this.pos.clone();
        this.m.spawnTelegraphLine(origin, dir, 32, 3.2, 1.0, 0x74b9ff, (pl) => {
          for (let k = 1; k <= 8; k++) this.iceSpike(origin.clone().addScaledVector(dir, k * 4));
          if (pl && !pl.isDead && this.m.isPointInLine(pl.position, origin, dir, 32, 3.2)) this.hit(pl, 140, '🗡️ BĂNG TRUỲ', '#74b9ff', 'slow', 10);
        });
      });
    }]]);
  }

  iceSpike(p) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xa5f3ff, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 5), mat);
    const gy = getTerrainHeight(p.x, p.z);
    mesh.position.set(p.x, gy - 1.7, p.z);
    mesh.rotation.z = (Math.random() - 0.5) * 0.4;
    this.m.spawnCustomEffect(1.3, (ef, dt, pl, t) => {
      mesh.position.y = gy - 1.7 + Math.min(1, ef.elapsed / 0.12) * 3.4;
      mat.opacity = t > 0.6 ? 0.9 * (1 - (t - 0.6) / 0.4) : 0.9;
    }, () => { mesh.geometry.dispose(); mat.dispose(); }, mesh);
  }

  castBlizzard(player) {
    this.act('nova', 1.0, [[0.4, () => {
      const c = this.ground(player.position.clone());
      this.m.spawnPoisonPool(c, 9, 5.5, 22, {
        color: 0xdff9fb, label: '🌨️ BẠO TUYẾT', textColor: '#74b9ff', status: 'slow', interval: 0.6,
        particleColors: [0xffffff, 0xa5f3ff],
      });
    }]]);
  }

  // Cơ chế Băng Tinh Giáp
  raiseShield() {
    this.shield = 500 * (this.m.damageMult || 1);
    this.say('💎 BĂNG TINH GIÁP! (phá 500 sát thương để làm choáng)');
    if (!this.shieldMesh) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xa5f3ff, transparent: true, opacity: 0.35, depthWrite: false });
      this.shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 1), mat);
      this.shieldMesh.position.y = 4.8;
      this.m.group.add(this.shieldMesh);
    }
    this.shieldMesh.visible = true;
  }

  modifyDamage(amount) {
    if (this.stunTimer > 0) return Math.round(amount * 1.3);
    if (this.shield > 0) {
      this.shield -= amount;
      if (this.particles) this.particles.emitHitSparkles(this.pos.clone().add(new V3(0, 5, 0)), 4);
      if (this.shield <= 0) {
        this.shield = 0;
        if (this.shieldMesh) this.shieldMesh.visible = false;
        this.stunTimer = 3.0;
        this.action = null;
        this.m.model.visible = true;
        this.burst(this.pos, 0xa5f3ff, 9, 40);
        this.say('💥 VỠ GIÁP! Tuyết Nữ choáng 3s (+30% sát thương)');
        sound.playExplosion?.();
      }
      return 0;
    }
    return amount;
  }

  onUpdate(delta) {
    if (this.shield <= 0 && this.stunTimer <= 0) {
      this.shieldTimer -= delta;
      if (this.shieldTimer <= 0) {
        this.shieldTimer = this.m.isEnraged ? 14 : 18;
        this.raiseShield();
      }
    }
    if (this.shieldMesh && this.shieldMesh.visible) {
      this.shieldMesh.rotation.y += delta * 0.8;
      this.shieldMesh.material.opacity = 0.2 + 0.25 * Math.min(1, this.shield / 500);
    }
  }

  animate(delta) {
    const tt = this.m.walkAnimTime;
    this.torso.position.y = 5.6 + Math.sin(tt * 0.9) * 0.12;
    this.shards.rotation.y += delta * (this.shield > 0 ? 2.5 : 1.0);
    this.crystal.rotation.y += delta * 3;
    if (this.stunTimer > 0) {
      this.lerpRot(this.torso, 'x', 0.4, delta, 6);
      this.lerpRot(this.armR, 'x', 0.2, delta, 6);
      return;
    }
    this.lerpRot(this.torso, 'x', 0, delta, 6);
    const a = this.action?.name;
    if (a === 'cast') {
      this.lerpRot(this.armR, 'x', -2.0, delta, 12);
      this.lerpRot(this.armL, 'x', -0.6, delta, 8);
    } else if (a === 'nova') {
      this.lerpRot(this.armR, 'x', -2.9, delta, 8);
      this.lerpRot(this.armL, 'x', -2.9, delta, 8);
    } else {
      this.lerpRot(this.armR, 'x', -0.4, delta, 5);
      this.lerpRot(this.armL, 'x', 0.15, delta, 5);
    }
  }
}

// =========================================================================
// 🕷️ 6. ĐỘC CHU MẪU HOÀNG — Nhện độc, tích tầng kịch độc
// =========================================================================
class SpiderQueenKit extends BossKit {
  constructor(m) {
    super(m);
    this.basicRange = 22;
    this.preferredRange = 9;
    this.turnRate = 4;
    this.basicInterval = 1.35;
    this.poison = 0;
    this.poisonDecay = 0;
    this.poisonTick = 0;
  }

  buildMesh() {
    const M = this.m.model;
    const shell = this.mat(0x3c1a5b, { r: 0.4 });
    const dark = this.mat(0x1e0f2e);
    const skin = this.mat(0xa29bfe);
    const gold = this.mat(0xf1c40f, { r: 0.3, m: 0.7 });
    const venom = this.glow(0x7bed9f);

    const body = this.group(M, 0, 0, 0);
    this.abdomen = this.add(body, new THREE.SphereGeometry(1, 10, 8), shell, 0, 3.4, -3.0, true);
    this.abdomen.scale.set(2.8, 2.2, 3.3);
    for (const [x, y, z] of [[0, 5.5, -2.6], [-1.3, 4.6, -4.3], [1.3, 4.6, -4.3], [0, 4.0, -5.9]]) {
      this.add(body, new THREE.SphereGeometry(0.42, 6, 5), venom, x, y, z);
    }
    this.add(body, new THREE.SphereGeometry(1.6, 8, 6), dark, 0, 2.9, 0.4, true);

    // Thân người gắn trên đầu ngực nhện (đặt trong khung riêng để không bị kéo về tâm)
    const front = this.group(M, 0, 0, 1.3);
    this.torso = this.group(front, 0, 3.6, 0);
    this.add(this.torso, new THREE.CylinderGeometry(0.7, 1.0, 2.4, 8), skin, 0, 1.2, 0, true);
    this.head = this.group(this.torso, 0, 3.0, 0);
    this.add(this.head, new THREE.SphereGeometry(0.8, 8, 6), skin);
    for (let i = 0; i < 6; i++) {
      const x = (i % 3 - 1) * 0.28;
      const y = i < 3 ? 0.18 : -0.08;
      this.add(this.head, new THREE.SphereGeometry(0.1, 4, 3), this.glow(0xff0000), x, y, 0.72);
    }
    for (const sx of [-1, 1]) this.add(this.head, new THREE.ConeGeometry(0.1, 0.5, 4), dark, sx * 0.2, -0.65, 0.55).rotation.x = Math.PI;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      this.add(this.head, new THREE.ConeGeometry(0.15, 0.6, 4), gold, Math.sin(a) * 0.55, 0.85, Math.cos(a) * 0.55);
    }
    this.armL = this.group(this.torso, -0.95, 2.0, 0);
    this.armR = this.group(this.torso, 0.95, 2.0, 0);
    for (const arm of [this.armL, this.armR]) this.add(arm, new THREE.CylinderGeometry(0.18, 0.28, 2.0, 6), skin, 0, -0.9, 0);

    // 8 chân nhện 2 đốt
    this.legs = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const k = i % 4;
      const g = this.group(M, side * 1.4, 3.0, 1.2 - k * 0.9);
      // Chân trước chĩa về phía trước, chân sau chĩa ra sau
      g.rotation.y = -side * (0.6 - k * 0.4);
      const upper = this.group(g);
      upper.rotation.z = -side * 0.9;   // đốt trên vươn lên & ra ngoài
      this.add(upper, new THREE.CylinderGeometry(0.18, 0.24, 3.2, 5), dark, 0, 1.6, 0);
      const lower = this.group(upper, 0, 3.2, 0);
      lower.rotation.z = -side * 1.7;   // đốt dưới gập xuống chạm đất
      this.add(lower, new THREE.CylinderGeometry(0.1, 0.18, 5.4, 5), shell, 0, 2.7, 0);
      g.userData = { upper, side, phase: k * 1.3 + (side > 0 ? Math.PI : 0) };
      this.legs.push(g);
    }
  }

  basic(player) {
    this.act('spit', 0.55, [[0.5, () => {
      const origin = this.shotOrigin();
      const dir = this.dirTo(this.m.predictPlayerPosition(player, 0.35));
      this.m.spawnMonsterProjectile(origin, dir, 21, 0.7, 50, 0x7bed9f, 2.6, null, false, {
        label: '🕷️ ĐỘC CHÂM', textColor: '#7bed9f',
        onHit: () => {},
      });
    }]]);
  }

  skills(d) {
    return [
      { id: 'web', name: '🕸️ Thiên La Địa Võng!', w: 1.1, fn: (pl) => this.castWeb(pl) },
      { id: 'mist', name: '☁️ Độc Vụ Lan Tràn!', w: 1.0, fn: (pl) => this.castMist(pl) },
      { id: 'pounce', name: '🕷️ Độc Chu Phi Phác!', w: d > 10 ? 2.0 : 0.8, fn: (pl) => this.castPounce(pl) },
    ];
  }

  castWeb(player) {
    this.act('spit', 0.8, [[0.4, () => {
      const n = this.m.isEnraged ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const p = i === 0 ? this.m.predictPlayerPosition(player, 0.6)
          : this.ground(player.position.clone().add(new V3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14)));
        this.m.spawnTelegraphAOE(p, 4.5, 1.1 + i * 0.15, 0xdfe6e9, (pl) => {
          this.webMesh(p);
          if (pl && !pl.isDead && Math.hypot(pl.position.x - p.x, pl.position.z - p.z) <= 4.5) this.hit(pl, 45, '🕸️ BỊ TƠ TRÓI', '#dfe6e9', 'freeze');
        });
      }
    }]]);
  }

  webMesh(p) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, wireframe: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(4.5, 10, 0, TAU), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, getTerrainHeight(p.x, p.z) + 0.15, p.z);
    this.m.spawnCustomEffect(2.5, (ef, dt, pl, t) => { mat.opacity = 0.7 * (1 - t); }, () => { mesh.geometry.dispose(); mat.dispose(); }, mesh);
  }

  castMist(player) {
    this.act('spit', 0.9, [[0.45, () => {
      const n = this.m.isEnraged ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random() * 0.5;
        const r = i === 0 ? 0 : 6 + Math.random() * 5;
        this.m.spawnPoisonPool(this.ground(player.position.clone().add(new V3(Math.sin(a) * r, 0, Math.cos(a) * r))), 4, 7, 20, {
          label: '☣️ ĐỘC VỤ', status: 'slow', interval: 0.7,
        });
      }
    }]]);
  }

  castPounce(player) {
    const start = this.pos.clone();
    const target = this.m.predictPlayerPosition(player, 0.6);
    this.m.spawnTelegraphAOE(target, 6, 1.0, 0x9b59b6, null);
    this.act('pounce', 1.0, [], {
      lockTurn: true,
      update: (dt, pl, p) => {
        this.pos.x = THREE.MathUtils.lerp(start.x, target.x, p);
        this.pos.z = THREE.MathUtils.lerp(start.z, target.z, p);
        this.pos.y = getTerrainHeight(this.pos.x, this.pos.z) + Math.sin(p * Math.PI) * 9;
      },
      onEnd: (pl) => {
        this.pos.y = getTerrainHeight(this.pos.x, this.pos.z);
        this.m.emitHeavyGroundImpact(this.pos.clone(), 6, 0x9b59b6, 4, pl);
        if (pl && this.inRange(pl, 6)) this.hit(pl, 150, '🕷️ PHI PHÁC', '#9b59b6', null, 16);
        this.m.spawnPoisonPool(this.pos.clone(), 5, 5, 22, { label: '☣️ ĐỘC DỊCH' });
      },
    });
  }

  // Cơ chế Kịch Độc tích tầng
  onDealDamage(amount, player) {
    if (this._bursting) return;
    this.poison = Math.min(5, this.poison + 1);
    this.poisonDecay = 4;
    if (player?.pixelFX?.damageTexts) {
      player.pixelFX.damageTexts.spawn(`☠️ KỊCH ĐỘC x${this.poison}`, player.position.clone().add(new V3(0, 3, 0)), '#7bed9f');
    }
    this.say(`☠️ Kịch Độc trên ngươi: ${this.poison}/5`);
    if (this.poison >= 5) {
      this.poison = 0;
      this._bursting = true;
      this.hit(player, 220, '☠️ ĐỘC BỘC PHÁT!', '#2ed573');
      this._bursting = false;
      if (this.particles) this.particles.emitElementalParticles(player.position.clone().add(new V3(0, 1.5, 0)), 30, [0x2ed573, 0x7bed9f], [3, 8], 0.9, 4, 1.0);
    }
  }

  onUpdate(delta, player) {
    if (this.poison > 0) {
      this.poisonTick += delta;
      if (this.poisonTick >= 1.0) {
        this.poisonTick = 0;
        this._bursting = true; // tick độc không cộng thêm tầng
        if (player && !player.isDead) this.hit(player, 7 * this.poison, `☠️ ĐỘC x${this.poison}`, '#7bed9f');
        this._bursting = false;
      }
      this.poisonDecay -= delta;
      if (this.poisonDecay <= 0) {
        this.poison--;
        this.poisonDecay = 4;
      }
    }
  }

  animate(delta) {
    const tt = this.m.walkAnimTime;
    const speed = this.moving ? 3.2 : 0.8;
    this.legs.forEach((g) => {
      const ph = tt * speed + g.userData.phase;
      g.userData.upper.rotation.z = -g.userData.side * (0.9 + Math.max(0, Math.sin(ph)) * 0.35);
      g.rotation.x = Math.sin(ph) * 0.15;
    });
    this.abdomen.position.y = 3.4 + Math.sin(tt * 1.4) * 0.12;
    const a = this.action?.name;
    if (a === 'spit') {
      this.lerpRot(this.torso, 'x', -0.35, delta, 10);
      this.lerpRot(this.armR, 'x', -2.0, delta, 10);
      this.lerpRot(this.armL, 'x', -2.0, delta, 10);
    } else if (a === 'pounce') {
      this.lerpRot(this.torso, 'x', 0.4, delta, 10);
    } else {
      this.lerpRot(this.torso, 'x', 0, delta, 6);
      this.lerpRot(this.armR, 'x', -0.3, delta, 6);
      this.lerpRot(this.armL, 'x', -0.3, delta, 6);
    }
  }
}

// =========================================================================
// ⚡ 7. LÔI THẦN CHIẾN TƯỚNG — Xạ thủ sét, tích điện & vòng an toàn
// =========================================================================
class ThunderGeneralKit extends BossKit {
  constructor(m) {
    super(m);
    this.basicRange = 28;
    this.preferredRange = 10;
    this.basicInterval = 1.6;
    this.charge = 0;
  }

  buildMesh() {
    const M = this.m.model;
    const gold = this.mat(0xf9ca24, { r: 0.3, m: 0.7 });
    const blue = this.mat(0x22a6b3, { r: 0.4, m: 0.4 });
    const dark = this.mat(0x2c3e50);
    const red = this.mat(0xc0392b, { side: THREE.DoubleSide });
    const bolt = this.glow(0x48dbfb);

    this.legL = this.group(M, -0.8, 3.4, 0);
    this.legR = this.group(M, 0.8, 3.4, 0);
    for (const leg of [this.legL, this.legR]) {
      this.add(leg, new THREE.BoxGeometry(0.95, 3.4, 1.1), dark, 0, -1.7, 0, true);
      this.add(leg, new THREE.BoxGeometry(1.05, 1.4, 1.2), gold, 0, -2.6, 0.05);
    }
    this.torso = this.group(M, 0, 3.4, 0);
    this.add(this.torso, new THREE.BoxGeometry(2.8, 3.2, 1.6), blue, 0, 1.6, 0, true);
    this.add(this.torso, new THREE.BoxGeometry(2.0, 2.0, 0.2), gold, 0, 1.9, 0.82);
    this.add(this.torso, new THREE.OctahedronGeometry(0.4, 0), bolt, 0, 1.9, 0.98);
    for (const sx of [-1, 1]) {
      const pad = this.add(this.torso, new THREE.SphereGeometry(0.9, 6, 4, 0, TAU, 0, Math.PI / 2), gold, sx * 1.75, 3.0, 0);
      pad.rotation.z = -sx * 0.3;
    }
    this.cape = this.add(this.torso, new THREE.PlaneGeometry(2.6, 4.0), red, 0, 1.0, -0.85);

    this.head = this.group(this.torso, 0, 3.5, 0);
    this.add(this.head, new THREE.BoxGeometry(1.1, 1.2, 1.1), dark, 0, 0.5, 0);
    this.add(this.head, new THREE.CylinderGeometry(0.75, 0.85, 0.9, 8), gold, 0, 1.0, 0);
    this.add(this.head, new THREE.ConeGeometry(0.3, 1.6, 5), red, 0, 2.1, -0.2).rotation.x = -0.4;
    for (const sx of [-1, 1]) this.add(this.head, new THREE.BoxGeometry(0.25, 0.1, 0.05), bolt, sx * 0.26, 0.55, 0.57);

    this.armL = this.group(this.torso, -1.75, 2.6, 0);
    this.armR = this.group(this.torso, 1.75, 2.6, 0);
    for (const arm of [this.armL, this.armR]) this.add(arm, new THREE.BoxGeometry(0.75, 2.6, 0.8), blue, 0, -1.2, 0);
    this.spear = this.group(this.armR, 0, -2.4, 0.2);
    this.add(this.spear, new THREE.CylinderGeometry(0.12, 0.12, 7.5, 6), dark, 0, 0, 1.2).rotation.x = Math.PI / 2;
    this.add(this.spear, new THREE.ConeGeometry(0.35, 1.4, 4), bolt, 0, 0, 5.4).rotation.x = Math.PI / 2;

    // Vòng trống sấm sau lưng
    this.drums = this.group(this.torso, 0, 3.0, -1.4);
    this.add(this.drums, new THREE.TorusGeometry(2.6, 0.12, 6, 24), gold);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const d = this.add(this.drums, new THREE.CylinderGeometry(0.45, 0.45, 0.4, 8), red, Math.sin(a) * 2.6, Math.cos(a) * 2.6, 0);
      d.rotation.x = Math.PI / 2;
    }
  }

  bolt(p, dmg, radius = 3) {
    this.pillarFlash(p, 0x48dbfb, 24, 0.35, 0.3);
    this.burst(p, 0x48dbfb, radius + 1.5, 12);
    sound.playThunder?.();
    return (pl) => pl && !pl.isDead && Math.hypot(pl.position.x - p.x, pl.position.z - p.z) <= radius;
  }

  basic(player, d) {
    if (d < 7) {
      this.act('thrust', 0.7, [[0.5, () => {
        this.m.spawnSlashArc(6.2, 0x48dbfb, 0, 2.6, 0.25);
        if (this.inCone(player, 7, Math.PI / 4)) this.hit(player, 110, '⚡ LÔI THƯƠNG ĐÂM', '#48dbfb', null, 10);
      }]]);
      return;
    }
    this.act('throw', 0.7, [[0.6, () => {
      const origin = this.shotOrigin();
      const dir = this.dirTo(this.m.predictPlayerPosition(player, 0.3));
      this.m.spawnMonsterProjectile(origin, dir, 34, 0.9, 90, 0x48dbfb, 1.8, null, false, { label: '⚡ LÔI THƯƠNG', textColor: '#48dbfb' });
    }]]);
  }

  skills(d) {
    return [
      { id: 'chase', name: '🌩️ Thiên Lôi Truy Kích!', w: 1.2, fn: (pl) => this.castChase(pl) },
      { id: 'cross', name: '✚ Lôi Võng Thập Tự!', w: d < 18 ? 1.4 : 0.7, fn: () => this.castCross() },
      { id: 'dash', name: '💨 Lôi Bộ Tam Liên!', w: d > 10 ? 1.6 : 0.8, fn: (pl) => this.castDash(pl, 3) },
    ];
  }

  castChase(player) {
    const n = this.m.isEnraged ? 8 : 6;
    this.act('cast', 0.6 + n * 0.42, Array.from({ length: n }, (_, i) => [((0.3 + i * 0.42) / (0.6 + n * 0.42)), (pl) => {
      if (!pl) return;
      const p = this.ground(pl.position.clone());
      this.m.spawnTelegraphAOE(p, 3, 0.7, 0x48dbfb, (pl2) => {
        if (this.bolt(p, 85)(pl2)) this.hit(pl2, 85, '🌩️ THIÊN LÔI', '#48dbfb');
      });
    }]), { lockTurn: false });
  }

  castCross() {
    const fire = (offset, delay) => {
      for (let k = 0; k < 4; k++) {
        const a = offset + (k / 4) * TAU;
        const dir = new V3(Math.sin(a), 0, Math.cos(a));
        const origin = this.pos.clone();
        this.m.spawnTelegraphLine(origin, dir, 36, 2.8, delay, 0x48dbfb, (pl) => {
          for (let s = 1; s <= 6; s++) this.pillarFlash(origin.clone().addScaledVector(dir, s * 6), 0x48dbfb, 10, 0.25, 0.2);
          if (pl && !pl.isDead && this.m.isPointInLine(pl.position, origin, dir, 36, 2.8)) this.hit(pl, 120, '✚ LÔI VÕNG', '#48dbfb', 'slow');
        });
      }
    };
    const base = this.m.rotationY;
    this.act('cast', 2.0, [[0.05, () => fire(base, 1.0)], [0.4, () => fire(base + Math.PI / 4, 1.0)]], { lockTurn: true });
    sound.playThunder?.();
  }

  castDash(player, left) {
    if (left <= 0 || !player || player.isDead) return;
    const dir = this.dirTo(this.m.predictPlayerPosition(player, 0.25));
    const len = Math.min(26, this.distTo(player.position) + 6);
    const origin = this.pos.clone();
    this.setYaw(Math.atan2(dir.x, dir.z));
    this.m.spawnTelegraphLine(origin, dir, len, 3.4, 0.5, 0x48dbfb, null);
    let hitDone = false;
    this.act('windup', 0.5, [], {
      lockTurn: true,
      onEnd: () => {
        this.act('dash', 0.22, [], {
          lockTurn: true,
          update: (dt, pl, p) => {
            const t = origin.clone().addScaledVector(dir, len * p);
            this.pos.x = THREE.MathUtils.clamp(t.x, -115, 115);
            this.pos.z = THREE.MathUtils.clamp(t.z, -115, 115);
            if (!hitDone && pl && this.inRange(pl, 3.6)) {
              hitDone = true;
              this.hit(pl, 100, '💨 LÔI BỘ', '#48dbfb', null, 12);
            }
          },
          onEnd: (pl) => {
            this.burst(this.pos, 0x48dbfb, 5, 14);
            this.castDash(pl, left - 1);
          },
        });
      },
    });
  }

  onDealDamage() {
    this.charge = Math.min(100, this.charge + 6);
  }

  // Cơ chế Tích Điện -> Lôi Bạo Toàn Trường (chỉ vòng xanh là an toàn)
  onUpdate(delta, player) {
    if (this.action?.name === 'storm') return;
    this.charge = Math.min(100, this.charge + delta * (this.m.isEnraged ? 7.5 : 5.5));
    if (!this.action) this.say(`⚡ Tích điện ${Math.floor(this.charge)}%`);
    if (this.charge >= 100 && player && !player.isDead && !this.action) {
      this.charge = 0;
      this.castStorm(player);
    }
  }

  castStorm(player) {
    this.say('⛈️ LÔI BẠO TOÀN TRƯỜNG! CHẠY VÀO VÒNG XANH!');
    const a = Math.random() * TAU;
    const r = 11 + Math.random() * 5;
    const safe = this.ground(player.position.clone().add(new V3(Math.sin(a) * r, 0, Math.cos(a) * r)));
    const safeR = 4.5;
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(safeR - 0.5, safeR, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(safe.x, safe.y + 0.2, safe.z);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(safeR, 32), fillMat);
    fill.rotation.x = -Math.PI / 2;
    ring.add(fill);
    fill.rotation.x = 0;
    const DUR = 3.2;
    this.m.spawnCustomEffect(DUR, (ef, dt, pl, t) => {
      ringMat.opacity = 0.6 + Math.sin(ef.elapsed * 14) * 0.3;
    }, () => {
      ring.geometry.dispose(); ringMat.dispose(); fill.geometry.dispose(); fillMat.dispose();
    }, ring);
    this.m.spawnTelegraphAOE(this.pos.clone(), 40, DUR, 0x0984e3, null);
    this.act('storm', DUR + 0.2, [[DUR / (DUR + 0.2), (pl) => {
      for (let i = 0; i < 14; i++) {
        const b = Math.random() * TAU;
        const rr = 5 + Math.random() * 30;
        this.pillarFlash(this.ground(this.pos.clone().add(new V3(Math.sin(b) * rr, 0, Math.cos(b) * rr))), 0x48dbfb, 26, 0.5, 0.4);
      }
      sound.playThunder?.();
      sound.playExplosion?.();
      if (pl && !pl.isDead) {
        const inSafe = Math.hypot(pl.position.x - safe.x, pl.position.z - safe.z) <= safeR;
        if (!inSafe) this.hit(pl, 320, '⛈️ LÔI BẠO TOÀN TRƯỜNG', '#0984e3', 'slow');
      }
    }]], { lockTurn: true });
  }

  animate(delta) {
    const tt = this.m.walkAnimTime;
    const sw = this.walkSwing(0.5);
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.drums.rotation.z += delta * (0.6 + this.charge / 40);
    this.cape.rotation.x = 0.2 + (this.moving ? 0.3 : 0) + Math.sin(tt * 2.5) * 0.05;
    const a = this.action?.name;
    const p = this.actP();
    if (a === 'throw') {
      this.lerpRot(this.armR, 'x', p < 0.55 ? -2.8 : -0.6, delta, p < 0.55 ? 8 : 24);
    } else if (a === 'thrust') {
      this.lerpRot(this.armR, 'x', p < 0.45 ? -0.2 : -1.6, delta, 18);
      this.lerpRot(this.torso, 'x', p < 0.45 ? -0.1 : 0.25, delta, 14);
    } else if (a === 'cast' || a === 'storm') {
      this.lerpRot(this.armR, 'x', -3.0, delta, 8);
      this.lerpRot(this.armL, 'x', -3.0, delta, 8);
    } else if (a === 'dash' || a === 'windup') {
      this.lerpRot(this.torso, 'x', 0.5, delta, 14);
      this.lerpRot(this.armR, 'x', -1.6, delta, 14);
    } else {
      this.lerpRot(this.armR, 'x', -0.5 + sw * 0.3, delta, 6);
      this.lerpRot(this.armL, 'x', -sw * 0.4, delta, 6);
      this.lerpRot(this.torso, 'x', 0, delta, 6);
    }
  }
}

// =========================================================================
// 💀 8. U MINH QUỶ VƯƠNG — Quỷ vương lưỡi hái, bất tử lần đầu
// =========================================================================
class GhostKingKit extends BossKit {
  constructor(m) {
    super(m);
    this.basicRange = 8.5;
    this.preferredRange = 5.5;
    this.basicInterval = 1.8;
    this.revived = false;
    this.floatBase = 1.6;
  }

  buildMesh() {
    const M = this.m.model;
    this.robeMat = this.mat(0x4b4b6e, { r: 0.8, o: 1 });
    const bone = this.mat(0xf5f6fa);
    const gold = this.mat(0xb7950b, { r: 0.4, m: 0.6 });
    const wood = this.mat(0x2d1e12);
    const blade = this.mat(0xb2bec3, { r: 0.25, m: 0.85 });
    const soul = this.glow(0x55efc4, 0.9);

    this.body = this.group(M, 0, 0, 0);
    const robe = this.add(this.body, new THREE.ConeGeometry(2.4, 6.2, 9), this.robeMat, 0, 3.6, 0, true);
    robe.rotation.x = Math.PI;
    this.add(this.body, new THREE.ConeGeometry(0.8, 1.4, 6), soul, 0, 0.2, 0).rotation.x = Math.PI;
    // Viền hồn quang quanh vạt áo
    this.add(this.body, new THREE.TorusGeometry(2.3, 0.1, 5, 18), soul, 0, 6.5, 0).rotation.x = Math.PI / 2;

    this.torso = this.group(this.body, 0, 6.2, 0);
    this.add(this.torso, new THREE.BoxGeometry(2.6, 1.6, 1.4), this.robeMat, 0, 0.6, 0);
    for (let i = 0; i < 3; i++) this.add(this.torso, new THREE.BoxGeometry(1.3 - i * 0.2, 0.12, 0.1), bone, 0, 0.2 + i * 0.35, 0.72);
    for (const sx of [-1, 1]) {
      this.add(this.torso, new THREE.ConeGeometry(0.45, 1.3, 5), soul, sx * 1.4, 1.8, 0);
    }
    this.head = this.group(this.torso, 0, 2.0, 0);
    this.add(this.head, new THREE.SphereGeometry(0.85, 8, 6), bone, 0, 0.3, 0);
    this.add(this.head, new THREE.BoxGeometry(0.9, 0.4, 0.7), bone, 0, -0.35, 0.15);
    for (const sx of [-1, 1]) this.add(this.head, new THREE.SphereGeometry(0.18, 5, 4), soul, sx * 0.3, 0.35, 0.72);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      this.add(this.head, new THREE.ConeGeometry(0.16, 0.8, 4), gold, Math.sin(a) * 0.6, 1.15, Math.cos(a) * 0.6);
    }
    this.armL = this.group(this.torso, -1.45, 1.1, 0);
    this.armR = this.group(this.torso, 1.45, 1.1, 0);
    for (const arm of [this.armL, this.armR]) {
      this.add(arm, new THREE.CylinderGeometry(0.35, 0.55, 2.4, 6), this.robeMat, 0, -1.1, 0);
      this.add(arm, new THREE.BoxGeometry(0.4, 0.5, 0.4), bone, 0, -2.4, 0);
    }
    // Lưỡi hái tử thần
    this.scythe = this.group(this.armR, 0, -2.4, 0.1);
    this.add(this.scythe, new THREE.CylinderGeometry(0.12, 0.12, 8, 6), wood, 0, 1.2, 0);
    const bladeG = this.group(this.scythe, 0, 5.1, 0);
    for (let i = 0; i < 4; i++) {
      const seg = this.add(bladeG, new THREE.BoxGeometry(0.12, 0.5, 1.2), blade, 0, -i * 0.35, 0.55 + i * 1.0);
      seg.rotation.x = -0.25 * i;
    }
    this.add(bladeG, new THREE.BoxGeometry(0.06, 0.12, 3.8), soul, 0, 0.18, 2.0);
  }

  basic(player) {
    this.act('reap', 1.0, [[0.55, () => {
      this.m.spawnSlashArc(8.5, 0x55efc4, 0.0, 2.2, 0.32);
      sound.playSwordSlash?.();
      if (this.inCone(player, 8.5, Math.PI * 0.6)) this.hit(player, 110, '💀 TỬ THẦN LIÊM', '#55efc4', null, 9);
      if (this.revived) this.souls(player, 1);
    }]]);
  }

  souls(player, n) {
    const origin = this.shotOrigin();
    for (let i = 0; i < n; i++) {
      const a = this.m.rotationY + (i - (n - 1) / 2) * 0.7 + (n === 1 ? 0 : 0);
      this.m.spawnMonsterProjectile(origin, new V3(Math.sin(a), 0, Math.cos(a)), 10.5, 0.75, 70, 0x55efc4, 5.0, null, false, {
        homing: 2.2, label: '👻 HỒN PHÁCH', textColor: '#55efc4',
      });
    }
  }

  skills(d) {
    return [
      { id: 'souls', name: '👻 Hồn Phách Truy Kích!', w: 1.2, fn: (pl) => this.act('cast', 0.8, [[0.4, () => this.souls(pl, this.m.isEnraged || this.revived ? 7 : 5)]]) },
      { id: 'gate', name: '🌀 Quỷ Môn Thôn Hồn!', w: d < 15 ? 1.3 : 0.6, fn: () => this.castGate() },
      { id: 'boomerang', name: '🪃 Liêm Đao Hồi Toàn!', w: d > 8 ? 1.4 : 0.7, fn: (pl) => this.castBoomerang(pl) },
    ];
  }

  castGate() {
    const c = this.pos.clone();
    const R = 9;
    this.m.spawnTelegraphAOE(c, R, 1.9, 0x55efc4, (pl) => {
      this.burst(c, 0x55efc4, 11, 40);
      if (pl && !pl.isDead && Math.hypot(pl.position.x - c.x, pl.position.z - c.z) <= R) this.hit(pl, 180, '🌀 QUỶ MÔN THÔN HỒN', '#55efc4', null, 16);
    });
    this.act('gate', 1.95, [], {
      lockTurn: true,
      update: (dt, pl) => {
        if (pl && !pl.isDead && !pl.isInvulnerable && this.distTo(pl.position) < 17) {
          const pull = this.dirTo(pl.position).negate();
          pl.position.x += pull.x * 4.2 * dt;
          pl.position.z += pull.z * 4.2 * dt;
        }
        if (this.particles && Math.random() < 0.5) {
          const b = Math.random() * TAU;
          this.particles.emitElementalParticles(c.clone().add(new V3(Math.sin(b) * 12, 1, Math.cos(b) * 12)), 2, [0x55efc4, 0x2d3436], [2, 4], 0.4, -3, 0.5);
        }
      },
    });
  }

  castBoomerang(player) {
    const dir = this.dirTo(player.position);
    const len = 28;
    const origin = this.pos.clone();
    this.setYaw(Math.atan2(dir.x, dir.z));
    const lineHit = (label) => (pl) => {
      if (pl && !pl.isDead && this.m.isPointInLine(pl.position, origin, dir, len, 3.2)) this.hit(pl, 115, label, '#55efc4', null, 8);
    };
    this.m.spawnTelegraphLine(origin, dir, len, 3.2, 0.9, 0x55efc4, lineHit('🪃 LIÊM ĐAO (ĐI)'));
    this.m.spawnTelegraphLine(origin, dir, len, 3.2, 1.9, 0x00b894, lineHit('🪃 LIÊM ĐAO (VỀ)'));
    // Lưỡi hái bay đi và quay về
    const mat = new THREE.MeshBasicMaterial({ color: 0x55efc4, transparent: true, opacity: 0.9 });
    const spin = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 4, 12, Math.PI * 1.3), mat);
    spin.rotation.x = Math.PI / 2;
    this.scythe.visible = false;
    this.m.spawnCustomEffect(2.0, (ef) => {
      const e = ef.elapsed;
      let k = 0;
      if (e > 0.9 && e <= 1.4) k = (e - 0.9) / 0.5;
      else if (e > 1.4 && e <= 1.9) k = 1 - (e - 1.4) / 0.5;
      spin.position.set(origin.x + dir.x * len * k, getTerrainHeight(origin.x, origin.z) + 3, origin.z + dir.z * len * k);
      spin.rotation.z += 0.5;
    }, () => { this.scythe.visible = true; spin.geometry.dispose(); mat.dispose(); }, spin);
    this.act('throw', 2.0, [], { lockTurn: true });
  }

  // Cơ chế Bất Tử lần đầu -> Hồn Thể
  onLethal() {
    if (this.revived) return false;
    this.revived = true;
    const m = this.m;
    m.hp = Math.round(m.maxHp * 0.45);
    m.barMesh.scale.x = 0.45;
    m.barMesh.position.x = -(1 - 0.45) * (m.barInnerWidth * 0.5);
    this.action = null;
    this.stunTimer = 1.2; // khựng lại khi hồi sinh
    this.cdMult = 1.35;
    this.moveMult = 1.3;
    this.robeMat.transparent = true;
    this.robeMat.opacity = 0.55;
    this.burst(this.pos, 0x55efc4, 14, 60);
    this.say('💀 BẤT TỬ CHI THÂN! Quỷ Vương hoá HỒN THỂ (45% máu)');
    sound.playMonsterRoar?.();
    return true;
  }

  animate(delta) {
    const tt = this.m.walkAnimTime;
    this.body.position.y = this.floatBase + Math.sin(tt * 0.9) * 0.35;
    this.body.rotation.x = this.moving ? 0.15 : 0;
    const a = this.action?.name;
    const p = this.actP();
    if (a === 'reap') {
      this.lerpRot(this.armR, 'z', p < 0.5 ? 1.2 : -1.0, delta, p < 0.5 ? 6 : 22);
      this.lerpRot(this.armR, 'x', -1.2, delta, 10);
      this.lerpRot(this.torso, 'y', p < 0.5 ? 0.7 : -0.6, delta, 14);
    } else if (a === 'cast' || a === 'gate') {
      this.lerpRot(this.armR, 'x', -2.8, delta, 8);
      this.lerpRot(this.armL, 'x', -2.8, delta, 8);
      this.lerpRot(this.armR, 'z', 0, delta, 8);
    } else if (a === 'throw') {
      this.lerpRot(this.armR, 'x', -1.8, delta, 12);
    } else {
      this.lerpRot(this.armR, 'x', -0.5, delta, 6);
      this.lerpRot(this.armR, 'z', 0, delta, 6);
      this.lerpRot(this.armL, 'x', -0.2, delta, 6);
      this.lerpRot(this.torso, 'y', 0, delta, 6);
    }
  }
}

// =========================================================================
// 🦅 9. THIÊN ƯNG PHONG VƯƠNG — Bay lượn bất khả xâm phạm, rồi Kiệt Sức
// =========================================================================
class WindEagleKit extends BossKit {
  constructor(m) {
    super(m);
    this.basicRange = 24;
    this.preferredRange = 11;
    this.basicInterval = 1.5;
    this.flightTimer = 14;    // lần bay đầu tiên
    this.flying = 0;
    this.exhausted = 0;
    this.bombTimer = 0;
    this.altitude = 0;
  }

  buildMesh() {
    const M = this.m.model;
    const brown = this.mat(0x8e5b2e);
    const white = this.mat(0xf5f6fa);
    const yellow = this.mat(0xf9ca24, { r: 0.4 });
    const dark = this.mat(0x4a3220);

    this.legL = this.group(M, -0.7, 2.6, 0);
    this.legR = this.group(M, 0.7, 2.6, 0);
    for (const leg of [this.legL, this.legR]) {
      this.add(leg, new THREE.CylinderGeometry(0.25, 0.3, 2.6, 5), yellow, 0, -1.3, 0);
      for (const o of [-0.35, 0, 0.35]) this.add(leg, new THREE.ConeGeometry(0.12, 0.7, 4), dark, o, -2.55, 0.35).rotation.x = Math.PI / 2;
    }
    this.torso = this.group(M, 0, 2.6, 0);
    const chest = this.add(this.torso, new THREE.SphereGeometry(1.6, 8, 7), brown, 0, 1.9, 0, true);
    chest.scale.set(1.0, 1.4, 0.9);
    this.add(this.torso, new THREE.SphereGeometry(1.1, 8, 6), white, 0, 1.8, 0.6).scale.set(1, 1.3, 0.6);
    this.head = this.group(this.torso, 0, 4.3, 0.2);
    this.add(this.head, new THREE.SphereGeometry(0.95, 8, 6), white);
    this.add(this.head, new THREE.ConeGeometry(0.35, 1.1, 5), yellow, 0, -0.15, 1.15).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) this.add(this.head, new THREE.SphereGeometry(0.13, 5, 4), this.glow(0xff9f1a), sx * 0.42, 0.15, 0.75);
    for (let i = 0; i < 3; i++) this.add(this.head, new THREE.BoxGeometry(0.12, 0.12, 1.2), brown, 0, 0.6 - i * 0.2, -0.9 - i * 0.2).rotation.x = 0.5;

    this.wingL = this.group(this.torso, -1.2, 3.0, -0.3);
    this.wingR = this.group(this.torso, 1.2, 3.0, -0.3);
    for (const [wing, sx] of [[this.wingL, -1], [this.wingR, 1]]) {
      for (let i = 0; i < 6; i++) {
        const len = 2.0 + i * 0.7;
        const f = this.add(wing, new THREE.BoxGeometry(len, 0.15, 0.85), i > 3 ? white : brown, sx * (len / 2 + i * 0.45), -i * 0.15, -i * 0.25);
        f.rotation.z = sx * -0.06 * i;
      }
    }
    this.armL = this.wingL;
    this.armR = this.wingR;
    this.tail = this.group(this.torso, 0, 0.6, -1.2);
    for (let i = 0; i < 5; i++) {
      const f = this.add(this.tail, new THREE.BoxGeometry(0.5, 0.12, 2.2), i % 2 ? white : brown, (i - 2) * 0.35, 0, -1.0);
      f.rotation.y = (i - 2) * 0.18;
    }
  }

  windBlade(origin, a, dmg = 70) {
    this.m.spawnMonsterProjectile(origin, new V3(Math.sin(a), 0, Math.cos(a)), 24, 1.1, dmg, 0xf6e58d, 2.2, null, true, { label: '🌪️ PHONG NHẬN', textColor: '#f6e58d' });
  }

  basic(player) {
    this.act('flap', 0.6, [[0.5, () => {
      const origin = this.shotOrigin();
      const a = this.angleTo(this.m.predictPlayerPosition(player, 0.3));
      this.windBlade(origin, a - 0.12);
      this.windBlade(origin, a + 0.12);
    }]]);
  }

  skills(d) {
    return [
      { id: 'tornado', name: '🌪️ Cuồng Phong Long Quyển!', w: 1.1, fn: (pl) => this.castTornado(pl) },
      { id: 'dive', name: '🦅 Thiên Ưng Bổ Kích!', w: d > 8 ? 1.6 : 0.8, fn: (pl) => this.castDive(pl) },
      { id: 'feathers', name: '🪶 Vạn Vũ Phi Đao!', w: 1.0, fn: (pl) => this.castFeathers(pl) },
    ];
  }

  castTornado(player) {
    this.act('flap', 0.8, [[0.5, () => {
      const n = this.m.isEnraged ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const start = this.ground(this.pos.clone().addScaledVector(this.forward(), 4).add(new V3((i - (n - 1) / 2) * 6, 0, 0)));
        const g = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color: 0xdff9fb, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
        for (let k = 0; k < 5; k++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8 + k * 0.55, 0.12, 4, 14), mat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = k * 1.4;
          g.add(ring);
        }
        g.position.copy(start);
        let tick = 0;
        this.m.spawnCustomEffect(6.0, (ef, dt, pl) => {
          if (pl && !pl.isDead) {
            const to = new V3(pl.position.x - g.position.x, 0, pl.position.z - g.position.z);
            if (to.lengthSq() > 0.1) g.position.addScaledVector(to.normalize(), 5.2 * dt);
            g.position.y = getTerrainHeight(g.position.x, g.position.z);
            tick -= dt;
            if (tick <= 0 && Math.hypot(pl.position.x - g.position.x, pl.position.z - g.position.z) < 3.0) {
              tick = 0.5;
              this.m.inflictDamageToPlayer(pl, 40, '-40 🌪️ LONG QUYỂN', '#dff9fb', null, 10);
            }
          }
          g.rotation.y += dt * 9;
        }, () => { mat.dispose(); g.children.forEach((c) => c.geometry.dispose()); }, g);
      }
    }]]);
  }

  castDive(player) {
    const start = this.pos.clone();
    this.act('rise', 0.7, [], {
      lockTurn: true,
      update: (dt, pl, p) => { this.pos.y = getTerrainHeight(this.pos.x, this.pos.z) + p * 10; },
      onEnd: (pl) => {
        const target = pl ? this.m.predictPlayerPosition(pl, 0.5) : start;
        this.m.spawnTelegraphAOE(target, 6, 0.7, 0xf6e58d, null);
        const from = this.pos.clone();
        this.act('dive', 0.7, [], {
          lockTurn: true,
          update: (dt2, pl2, p2) => {
            this.pos.x = THREE.MathUtils.lerp(from.x, target.x, p2);
            this.pos.z = THREE.MathUtils.lerp(from.z, target.z, p2);
            this.pos.y = getTerrainHeight(this.pos.x, this.pos.z) + 10 * (1 - p2 * p2);
          },
          onEnd: (pl2) => {
            this.pos.y = getTerrainHeight(this.pos.x, this.pos.z);
            this.m.emitHeavyGroundImpact(this.pos.clone(), 6, 0xf6e58d, 3, pl2);
            if (pl2 && this.inRange(pl2, 6)) this.hit(pl2, 170, '🦅 THIÊN ƯNG BỔ KÍCH', '#f6e58d', null, 18);
          },
        });
      },
    });
  }

  castFeathers() {
    this.act('flap', 1.1, [[0.35, () => this.featherFan(0)], [0.75, () => this.featherFan(0.09)]]);
  }

  featherFan(offset) {
    const origin = this.shotOrigin();
    const n = this.m.isEnraged ? 11 : 9;
    for (let i = 0; i < n; i++) {
      const a = this.m.rotationY + offset + (i - (n - 1) / 2) * 0.16;
      this.m.spawnMonsterProjectile(origin, new V3(Math.sin(a), 0, Math.cos(a)), 22, 0.55, 55, 0xffffff, 2.0, null, false, { label: '🪶 PHI ĐAO', textColor: '#f6e58d' });
    }
  }

  // Cơ chế Bay Lượn (bất khả xâm phạm) -> Kiệt Sức (+50% sát thương nhận)
  blockAI(delta, player) {
    if (this.flying > 0) {
      this.flying -= delta;
      this.altitude = Math.min(9, this.altitude + delta * 12);
      this.turnTo(player.position, delta, 3);
      // Lượn vòng quanh người chơi
      const to = new V3(player.position.x - this.pos.x, 0, player.position.z - this.pos.z);
      const d = to.length();
      if (d > 0.1) {
        to.normalize();
        const tangent = new V3(-to.z, 0, to.x);
        const move = tangent.multiplyScalar(0.9).addScaledVector(to, d > 12 ? 0.8 : -0.3);
        this.moveAlong(move.normalize(), 1.1, delta);
      }
      this.pos.y = getTerrainHeight(this.pos.x, this.pos.z) + this.altitude;
      this.moving = true;
      this.bombTimer -= delta;
      if (this.bombTimer <= 0) {
        this.bombTimer = this.m.isEnraged ? 0.6 : 0.85;
        const p = this.m.predictPlayerPosition(player, 0.4);
        this.m.spawnTelegraphAOE(p, 3.2, 0.9, 0xf6e58d, (pl) => {
          this.burst(p, 0xf6e58d, 4, 12);
          if (pl && !pl.isDead && Math.hypot(pl.position.x - p.x, pl.position.z - p.z) <= 3.2) this.hit(pl, 75, '🪶 BOM LÔNG VŨ', '#f6e58d', null, 8);
        });
      }
      if (this.flying <= 0) {
        this.flying = 0;
        this.altitude = 0;
        this.pos.y = getTerrainHeight(this.pos.x, this.pos.z);
        this.m.emitHeavyGroundImpact(this.pos.clone(), 5, 0xf6e58d, 3, null);
        this.exhausted = 4.0;
        this.say('😮‍💨 KIỆT SỨC! (nhận +50% sát thương trong 4s) — DỒN SÁT THƯƠNG!');
      }
      return true;
    }
    if (this.exhausted > 0) {
      this.exhausted -= delta;
      this.moving = false;
      if (this.exhausted <= 0) this.say(this.idleName());
      return true;
    }
    this.flightTimer -= delta;
    if (this.flightTimer <= 0) {
      this.flightTimer = this.m.isEnraged ? 18 : 22;
      this.flying = 6.0;
      this.bombTimer = 1.0;
      this.say('🦅 BAY LƯỢN THIÊN KHÔNG! (bất khả xâm phạm)');
      return true;
    }
    return false;
  }

  modifyDamage(amount) {
    if (this.flying > 0) {
      if (this.particles) this.particles.emitHitSparkles(this.pos.clone().add(new V3(0, 3, 0)), 3);
      return 0;
    }
    if (this.exhausted > 0) return Math.round(amount * 1.5);
    return amount;
  }

  animate(delta) {
    const tt = this.m.walkAnimTime;
    const sw = this.walkSwing(0.5);
    const a = this.action?.name;
    const flapping = this.flying > 0 || a === 'flap' || a === 'rise' || a === 'dive';
    const flap = flapping ? Math.sin(tt * (this.flying > 0 ? 5 : 7)) * 0.7 : Math.sin(tt * 0.8) * 0.08;
    this.wingL.rotation.z = -0.25 + flap;
    this.wingR.rotation.z = 0.25 - flap;
    this.wingL.rotation.y = 0.2;
    this.wingR.rotation.y = -0.2;
    if (this.exhausted > 0) {
      this.lerpRot(this.torso, 'x', 0.55, delta, 6);
      this.wingL.rotation.z = 0.9;
      this.wingR.rotation.z = -0.9;
    } else if (a === 'dive') {
      this.lerpRot(this.torso, 'x', 1.0, delta, 12);
    } else {
      this.lerpRot(this.torso, 'x', this.flying > 0 ? 0.3 : 0, delta, 6);
    }
    this.legL.rotation.x = this.flying > 0 ? 0.6 : sw;
    this.legR.rotation.x = this.flying > 0 ? 0.6 : -sw;
    this.tail.rotation.x = Math.sin(tt * 1.6) * 0.1;
  }
}

export const BOSS_KITS = {
  boss_fox_empress: FoxEmpressKit,
  boss_stone_king: StoneKingKit,
  boss_blood_demon: BloodDemonKit,
  boss_fire_demon: FireDemonKit,
  boss_frost_maiden: FrostMaidenKit,
  boss_spider_queen: SpiderQueenKit,
  boss_thunder_general: ThunderGeneralKit,
  boss_ghost_king: GhostKingKit,
  boss_wind_eagle: WindEagleKit,
};
