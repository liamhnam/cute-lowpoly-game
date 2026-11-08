import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';
import { createSword, createSheath, onSwordModelReady } from './sword.js';

// Combo 3 nhát chuẩn xác theo từng Vai Trò
const SLASH_DURATIONS = [0.24, 0.24, 0.32];
const SHEATHE_DELAY = 4.0;
const CHARGE_FULL_COLOR = new THREE.Color(0xffd700);

// ============================================================================
// HỆ THỐNG 5 VAI TRÒ CHIẾN THUẬT & VÒNG TRÒN KHẮC CHẾ (COUNTER SYSTEM)
// ============================================================================
// 0: 🛡️ Hộ Vệ (Tank)      -> Khắc chế: Sát Thủ (1), Xạ Thủ (4)  | Bị khắc chế: Pháp Sư (2), Đấu Sĩ (3)
// 1: 🗡️ Sát Thủ (Assassin)-> Khắc chế: Pháp Sư (2), Xạ Thủ (4)  | Bị khắc chế: Hộ Vệ (0), Đấu Sĩ (3)
// 2: ❄️ Pháp Sư (Mage)    -> Khắc chế: Hộ Vệ (0), Đấu Sĩ (3)    | Bị khắc chế: Sát Thủ (1), Xạ Thủ (4)
// 3: 🔥 Đấu Sĩ (Bruiser)  -> Khắc chế: Hộ Vệ (0), Sát Thủ (1)   | Bị khắc chế: Pháp Sư (2), Xạ Thủ (4)
// 4: 🏹 Xạ Thủ (Marksman) -> Khắc chế: Pháp Sư (2), Đấu Sĩ (3)  | Bị khắc chế: Hộ Vệ (0), Sát Thủ (1)
export const ROLE_STATS = [
  {
    id: 0,
    roleKey: 'tank',
    name: 'Thiết Giáp Hộ Vệ',
    roleTitle: '🛡️ HỘ VỆ (TANK)',
    icon: '🛡️',
    maxHp: 2600,
    speed: 4.8,
    sprintSpeed: 8.5,
    damageMult: 0.92,
    defenseMult: 0.80, // Giảm 20% sát thương nhận vào
    cdMult: 1.0,
    slashColor: 0xfbbf24,
    slashSpeedMult: 0.92,
    lifesteal: 0,
    shieldOnComboFinisher: 40, // Đòn thứ 3 trúng tạo giáp hồi 40 HP
    dashDist: 1.4,
    attackType: 'melee_shield',
    counters: [1, 4],     // Khắc chế Sát Thủ & Xạ Thủ
    counteredBy: [2, 3],  // Bị Pháp Sư & Đấu Sĩ khắc chế
    counterNames: '🗡️ Sát Thủ, 🏹 Xạ Thủ',
    weaknessNames: '❄️ Pháp Sư, 🔥 Đấu Sĩ',
    pro: 'Máu 2600 HP, giảm 20% ST nhận, Khiên Phản Chấn & Hút Gom khống chế vùng',
    con: 'Tốc chạy chậm (-12%), tầm đánh ngắn, dễ bị Pháp Sư thả diều & Đấu Sĩ phá giáp',
  },
  {
    id: 1,
    roleKey: 'assassin',
    name: 'Ám Ảnh Sát Thủ',
    roleTitle: '🗡️ SÁT THỦ (ASSASSIN)',
    icon: '🗡️',
    maxHp: 1750,
    speed: 6.2,
    sprintSpeed: 11.2,
    damageMult: 1.25, // Sát thương bạo kích cao
    defenseMult: 1.08,
    cdMult: 0.92,
    slashColor: 0xa855f7,
    slashSpeedMult: 1.38, // Vung song đao cực nhanh (+38%)
    backstabBonus: 1.35,  // Chém từ sau lưng mục tiêu +35% ST Chí Mạng
    dashDist: 2.4,
    attackType: 'melee_dual',
    counters: [2, 4],     // Khắc chế Pháp Sư & Xạ Thủ
    counteredBy: [0, 3],  // Bị Hộ Vệ & Đấu Sĩ khắc chế
    counterNames: '❄️ Pháp Sư, 🏹 Xạ Thủ',
    weaknessNames: '🛡️ Hộ Vệ, 🔥 Đấu Sĩ',
    pro: 'Tốc đánh +38%, Chí mạng sau lưng +35% ST, Tốc biến liên hoàn reset hồi chiêu',
    con: 'Máu mỏng (1750 HP), khó xuyên thủng Hộ Vệ và thua sức bền trước Đấu Sĩ',
  },
  {
    id: 2,
    roleKey: 'mage',
    name: 'Nguyên Tố Pháp Sư',
    roleTitle: '❄️ PHÁP SƯ (MAGE)',
    icon: '❄️',
    maxHp: 1700,
    speed: 5.5,
    sprintSpeed: 9.8,
    damageMult: 1.12,
    defenseMult: 1.05,
    cdMult: 0.95,
    slashColor: 0x38bdf8,
    slashSpeedMult: 1.05,
    projectileSpeed: 38,
    slowOnHit: true, // Cầu năng lượng làm chậm 25%
    isMageBasic: true,
    isRangedBasic: true,
    dashDist: 0.15,
    attackType: 'ranged_staff',
    counters: [0, 3],     // Khắc chế Hộ Vệ & Đấu Sĩ
    counteredBy: [1, 4],  // Bị Sát Thủ & Xạ Thủ khắc chế
    counterNames: '🛡️ Hộ Vệ, 🔥 Đấu Sĩ',
    weaknessNames: '🗡️ Sát Thủ, 🏹 Xạ Thủ',
    pro: 'Đánh thường phép tầm xa làm chậm, Đóng băng diện rộng & Hắc Động gom địch',
    con: 'Máu thấp (1700 HP), kỹ năng có độ trễ định hướng, sợ Sát Thủ áp sát',
  },
  {
    id: 3,
    roleKey: 'bruiser',
    name: 'Cuồng Chiến Đấu Sĩ',
    roleTitle: '🔥 ĐẤU SĨ (BRUISER)',
    icon: '🔥',
    maxHp: 2250,
    speed: 5.4,
    sprintSpeed: 9.7,
    damageMult: 1.15,
    defenseMult: 0.92, // Giảm 8% ST nhận vào
    cdMult: 1.0,
    slashColor: 0xf43f5e,
    slashSpeedMult: 1.05,
    lifesteal: 20, // Mỗi đòn trúng hút 20 HP (gấp đôi khi máu < 50%)
    armorShred: true,
    dashDist: 1.8,
    attackType: 'melee_axe',
    counters: [0, 1],     // Khắc chế Hộ Vệ & Sát Thủ
    counteredBy: [2, 4],  // Bị Pháp Sư & Xạ Thủ khắc chế
    counterNames: '🛡️ Hộ Vệ, 🗡️ Sát Thủ',
    weaknessNames: '❄️ Pháp Sư, 🏹 Xạ Thủ',
    pro: 'Máu 2250 HP, đánh thường hút máu mạnh, máu <50% hóa Cuồng Chiến tăng ST & hút máu',
    con: 'Thuần cận chiến tầm ngắn, dễ bị Pháp Sư đóng băng và Xạ Thủ bắn thả diều',
  },
  {
    id: 4,
    roleKey: 'marksman',
    name: 'Thần Tiễn Xạ Thủ',
    roleTitle: '🏹 XẠ THỦ (MARKSMAN)',
    icon: '🏹',
    maxHp: 1650,
    speed: 6.5, // Tốc chạy cơ bản cao nhất để thả diều
    sprintSpeed: 11.6,
    damageMult: 1.10,
    defenseMult: 1.15, // Kính pháo nhận thêm 15% ST
    cdMult: 0.94,
    slashColor: 0x10b981,
    slashSpeedMult: 1.22,
    projectileSpeed: 52, // Tên bay cực nhanh và xa
    dashDist: 0.1,
    isRangedBasic: true,
    isBowBasic: true,
    attackType: 'ranged_bow',
    counters: [2, 3],     // Khắc chế Pháp Sư & Đấu Sĩ
    counteredBy: [0, 1],  // Bị Hộ Vệ & Sát Thủ khắc chế
    counterNames: '❄️ Pháp Sư, 🔥 Đấu Sĩ',
    weaknessNames: '🛡️ Hộ Vệ, 🗡️ Sát Thủ',
    pro: 'Tầm bắn xa nhất (28m), tốc chạy +20%, Bẫy trói chân & Mưa tên cấu rỉa liên tục',
    con: 'Máu mỏng nhất (1650 HP), bị Khiên Hộ Vệ phản đạn và sợ Sát Thủ tốc biến bắt lẻ',
  },
  {
    id: 5,
    roleKey: 'special',
    name: 'Chiến Sĩ NAMCAM',
    roleTitle: '⭐ ĐẶC NHIỆM (PHÁI ẨN)',
    icon: '🇻🇳',
    maxHp: 2200,
    speed: 6.0,
    sprintSpeed: 10.8,
    damageMult: 1.15,
    defenseMult: 0.92,
    cdMult: 0.95,
    slashColor: 0xffd32a,
    slashSpeedMult: 1.25,
    projectileSpeed: 68,
    dashDist: 0.2,
    isGun: true,
    isRangedBasic: true,
    attackType: 'ranged_gun',
    counters: [0, 1, 2, 3, 4],
    counteredBy: [],
    counterNames: 'Mọi mục tiêu',
    weaknessNames: 'Không có',
    pro: 'Súng trường liên thanh, Khói độc 31.5m, Kiosk DVC tê liệt 5s, Binh Đoàn 10 Phân Thân Tự Động, Triệu Hồi Binh Đoàn Robot Khổng Lồ x20',
    con: 'Vai trò ẩn huyền thoại (chỉ mở khóa khi nhập danh hiệu NAMCAM)',
  },
];

// Giữ bí danh SECT_STATS để tương thích ngược với mọi module
export const SECT_STATS = ROLE_STATS;

/**
 * Tính hệ số khắc chế giữa 2 vai trò:
 * - Nếu attacker khắc chế target: 1.25 (+25% sát thương)
 * - Nếu attacker bị target khắc chế: 0.82 (-18% sát thương)
 * - Bình thường: 1.0
 */
export function getRoleCounterMultiplier(attackerRoleIndex, targetRoleIndex) {
  if (attackerRoleIndex === undefined || targetRoleIndex === undefined) return 1.0;
  const atk = ROLE_STATS[attackerRoleIndex];
  if (!atk) return 1.0;
  if (atk.counters && atk.counters.includes(targetRoleIndex)) return 1.25;
  if (atk.counteredBy && atk.counteredBy.includes(targetRoleIndex)) return 0.82;
  return 1.0;
}

export class Character {
  constructor(scene, particleSystem) {
    this.scene = scene;
    this.particles = particleSystem;

    this.group = new THREE.Group();
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.rotationY = 0;
    this.targetRotationY = 0;

    // Trạng thái vận động
    this.isGrounded = true;
    this.jumpVelocity = 0;
    this.gravity = -24;
    this.isSprinting = false;
    this.isMoving = false;
    this.speed = 0;

    // Procedural animation
    this.animTime = 0;
    this.footstepTimer = 0;
    this.squashFactor = 1.0;
    // Đòn đánh thường (Basic Attack)
    this.slashTimer = 0;
    this.slashDuration = SLASH_DURATIONS[0];
    this.slashStep = 0;
    this.slashSide = 1;
    this.slashFacing = 0;

    // Rút vũ khí / tra vũ khí
    this.isSwordDrawn = false;
    this.sheatheTimer = 0;
    this.isSwordThrown = false;

    // Quang ảnh vũ khí (0..1)
    this.auraIntensity = 0;

    // Lướt tới (Dash)
    this.dashDir = new THREE.Vector3();
    this.dashSpeed = 0;
    this.dashTime = 0;

    // Tụ lực đòn đánh mạnh (0..1)
    this.isCharging = false;
    this.chargeLevel = 0;

    // Kỹ năng & Thi triển phép thuật (Skill Casting)
    this.isCasting = false;
    this.castSkill = 0;
    this.castTime = 0;
    this.castDuration = 0.6;
    this.speedBoostTimer = 0;

    // Trạng thái kỹ năng đặc biệt & khống chế
    this.isParrying = false;
    this.parryTimer = 0;
    this.shieldReflectTimer = 0; // Khiên phản chấn của Hộ Vệ
    this.berserkTimer = 0;       // Huyết Cuồng Chiến Hống của Đấu Sĩ
    this.freezeTimer = 0;
    this.slowTimer = 0;
    this.slowAmount = 0;
    this.statusResistTimer = 0;
    this.lastResistTextTime = 0;
    this.isFloatingUlt = false;
    this.isInvulnerable = false;
    this._lastInvulText = 0;
    this.pixelFX = null;

    // Bảng 5 Vai Trò Chiến Đấu (+1 Vai trò ẩn NAMCAM)
    this.outfitIndex = 0;
    this.outfits = [
      { id: 'tank', name: 'Thiết Giáp Hộ Vệ (🛡️ Hộ Vệ)', sectName: 'Thiết Giáp Hộ Vệ', clothes: 0xf59e0b, hat: 0x1e293b, icon: '🛡️' },
      { id: 'assassin', name: 'Ám Ảnh Sát Thủ (🗡️ Sát Thủ)', sectName: 'Ám Ảnh Sát Thủ', clothes: 0x6d28d9, hat: 0x111827, icon: '🗡️' },
      { id: 'mage', name: 'Nguyên Tố Pháp Sư (❄️ Pháp Sư)', sectName: 'Nguyên Tố Pháp Sư', clothes: 0x0284c7, hat: 0x0ea5e9, icon: '❄️' },
      { id: 'bruiser', name: 'Cuồng Chiến Đấu Sĩ (🔥 Đấu Sĩ)', sectName: 'Cuồng Chiến Đấu Sĩ', clothes: 0xe11d48, hat: 0x27272a, icon: '🔥' },
      { id: 'marksman', name: 'Thần Tiễn Xạ Thủ (🏹 Xạ Thủ)', sectName: 'Thần Tiễn Xạ Thủ', clothes: 0x059669, hat: 0x065f46, icon: '🏹' },
      { id: 'namcam', name: 'Chiến Sĩ NAMCAM (Bộ Đội Cụ Hồ)', sectName: 'Chiến Sĩ NAMCAM', clothes: 0x2e4a2b, hat: 0x2e4a2b, icon: '🇻🇳' },
    ];

    this.name = 'Gấu Hiệp Sĩ';
    this.sectStats = ROLE_STATS[0];
    this.hp = this.sectStats.maxHp;
    this.maxHp = this.sectStats.maxHp;
    this.isDead = false;
    this.kills = 0;
    this.deaths = 0;
    this.hitFlashTimer = 0;
    this.lastHitTimer = 0;

    this.buildMesh();
    this.buildCastAura();
    this.buildContactShadow();
    this.buildBillboard();
    this.applyOutfit(0);
    this.scene.add(this.group);
  }

  buildContactShadow() {
    const geo = new THREE.CircleGeometry(0.55, 16);
    geo.rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(geo, this.shadowMat);
    this.scene.add(this.contactShadow);
  }

  buildBillboard() {
    this.bbCanvas = document.createElement('canvas');
    this.bbCanvas.width = 320;
    this.bbCanvas.height = 94;
    this.bbCtx = this.bbCanvas.getContext('2d');

    this.bbTexture = new THREE.CanvasTexture(this.bbCanvas);
    this.bbTexture.minFilter = THREE.LinearFilter;
    this.bbTexture.magFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.bbTexture,
      transparent: true,
      depthTest: false,
    });
    this.billboardSprite = new THREE.Sprite(spriteMat);
    this.billboardSprite.scale.set(2.5, 0.74, 1);
    this.billboardSprite.position.set(0, 2.38, 0);
    this.group.add(this.billboardSprite);

    this.updateBillboard();
  }

  updateBillboard() {
    if (!this.bbCtx) return;
    const ctx = this.bbCtx;
    const w = this.bbCanvas.width;
    const h = this.bbCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const roleIcon = this.sectStats?.icon || '🛡️';

    // 1. Khung nền nametag
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(10, 8, w - 20, h - 16, 12);
    ctx.fill();
    ctx.stroke();

    // 2. Tên người chơi + Biểu tượng Vai Trò
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(`${roleIcon} ${this.name}`, w / 2, 14);

    // 3. Thanh Máu (Health bar)
    const barX = 24;
    const barY = 46;
    const barW = w - 48;
    const barH = 20;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    let barColor = '#10b981';
    if (ratio < 0.3) {
      barColor = '#f43f5e';
    } else if (ratio < 0.6) {
      barColor = '#f59e0b';
    }

    ctx.fillStyle = barColor;
    ctx.fillRect(barX + 2, barY + 2, Math.max(0, (barW - 4) * ratio), barH - 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.round(this.hp)} / ${this.maxHp} HP`, w / 2, barY + barH / 2 + 1);

    this.bbTexture.needsUpdate = true;
  }

  setName(name) {
    this.name = (name || 'Gấu Hiệp Sĩ').trim().substring(0, 18);
    this.updateBillboard();
  }

  applyOutfit(index) {
    this.outfitIndex = ((index % this.outfits.length) + this.outfits.length) % this.outfits.length;
    const current = this.outfits[this.outfitIndex];
    this.clothesMat.color.setHex(current.clothes);
    this.hatMat.color.setHex(current.hat);
    this.sectStats = ROLE_STATS[this.outfitIndex] || ROLE_STATS[0];

    const isNamCam = this.outfitIndex === 5;
    if (this.boDoiHatGroup) this.boDoiHatGroup.visible = isNamCam;
    if (this.hatGroup) this.hatGroup.visible = !isNamCam;
    if (this.namCamFace) this.namCamFace.visible = isNamCam;
    if (this.snout) this.snout.visible = !isNamCam;
    if (this.nose) this.nose.visible = !isNamCam;
    if (this.blushL) this.blushL.visible = !isNamCam;
    if (this.blushR) this.blushR.visible = !isNamCam;

    // Ẩn/hiện Vũ Khí 3D Đặc Trưng Theo Vai Trò:
    // 0: Hộ Vệ (Khiên lớn tay trái + Trọng kiếm tay phải)
    // 1: Sát Thủ (Song Đoản Đao 2 tay)
    // 2: Pháp Sư (Quyền Trượng Thủy Tinh tay phải)
    // 3: Đấu Sĩ (Chiến Phủ Huyết Hỏa tay phải)
    // 4: Xạ Thủ (Thần Cung Ánh Sáng tay trái)
    // 5: NAMCAM (Súng trường tay phải)
    if (this.shieldGroup) this.shieldGroup.visible = this.outfitIndex === 0;
    if (this.daggerLGroup) this.daggerLGroup.visible = this.outfitIndex === 1;
    if (this.staffGroup) this.staffGroup.visible = this.outfitIndex === 2;
    if (this.axeGroup) this.axeGroup.visible = this.outfitIndex === 3;
    if (this.bowGroup) this.bowGroup.visible = this.outfitIndex === 4;
    if (this.gunGroup) this.gunGroup.visible = isNamCam;

    const usesSword = this.outfitIndex === 0 || this.outfitIndex === 1;
    if (this.swordModel) {
      this.swordModel.visible = usesSword && !this.isSwordThrown;
      // Sát thủ cầm đoản kiếm ngắn gọn hơn
      const sScale = this.outfitIndex === 1 ? 0.72 : 1.05;
      this.swordModel.scale.setScalar(sScale);
    }
    if (this.sheath) this.sheath.visible = usesSword;

    const prevMax = this.maxHp || 2000;
    const ratio = Math.max(0.1, this.hp / prevMax);
    this.maxHp = this.sectStats.maxHp;
    this.hp = Math.min(this.maxHp, Math.round(this.maxHp * ratio));
    this.updateBillboard();

    return current.name;
  }

  setOutfit(index) {
    return this.applyOutfit(index);
  }

  setMechaActive(active) {
    this.isMechaActive = Boolean(active);
    if (!active) {
      this.group.scale.set(1.0, 1.0, 1.0);
      if (this.contactShadow) this.contactShadow.visible = true;
      this.rightArm.rotation.set(0, 0, 0);
      this.leftArm.rotation.set(0, 0, 0);
      this.rightLeg.rotation.set(0, 0, 0);
      this.leftLeg.rotation.set(0, 0, 0);
      this.head.rotation.set(0, 0, 0);
    }
  }

  heal(amount) {
    if (this.isDead || amount <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateBillboard();
    if (this.particles) {
      this.particles.emitElementalParticles(
        this.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
        6,
        [0x10b981, 0x6ee7b7, 0xffffff],
        [1, 3],
        0.3,
        1.5,
        0.4
      );
    }
  }

  setParry(duration = 0.85) {
    this.isParrying = true;
    this.parryTimer = duration;
  }

  resistsStatus() {
    if (this.isInvulnerable) return true;
    if (this.statusResistTimer <= 0) return false;
    const now = performance.now();
    if (now - this.lastResistTextTime > 800) {
      this.lastResistTextTime = now;
      if (this.pixelFX?.damageTexts) {
        this.pixelFX.damageTexts.spawn('🛡️ MIỄN KHỐNG!', this.position.clone().add(new THREE.Vector3(0, 2.4, 0)), '#fbbf24');
      }
      if (this.particles) {
        this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 8, [0xfbbf24, 0xffffff], [1, 3], 0.3, 0, 0.4);
      }
    }
    return true;
  }

  freeze(duration = 2.0) {
    if (this.isDead || this.resistsStatus()) return;
    this.freezeTimer = Math.max(this.freezeTimer, duration);
    if (this.particles) {
      this.particles.emitElementalParticles(
        this.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
        12,
        [0x38bdf8, 0x7dd3fc, 0xffffff],
        [1, 4],
        0.4,
        2.5,
        0.6
      );
    }
  }

  slow(duration = 2.5, amount = 0.45) {
    if (this.isDead || this.resistsStatus()) return;
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowAmount = amount;
  }

  takeDamage(amount, attackerName = null, hitPos = null, attackerEntity = null) {
    if (this.isDead) return;

    if (this.isInvulnerable) {
      const now = performance.now();
      if (now - this._lastInvulText > 600) {
        this._lastInvulText = now;
        if (this.pixelFX?.damageTexts) {
          this.pixelFX.damageTexts.spawn('🛡️ BẤT TỬ!', (hitPos || this.position).clone().add(new THREE.Vector3(0, 2.0, 0)), '#ffd700');
        }
      }
      return;
    }

    // Hóa giải đòn đánh (PARRY / Khiên Phản Đòn hoàn hảo)
    if (this.isParrying) {
      this.isParrying = false;
      this.parryTimer = 0;
      this.heal(95);
      sound.playHit();
      const pos = hitPos || this.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      if (this.particles) {
        this.particles.emitShockwave(pos, 0xffd700, 6.0, 0.4);
        this.particles.emitElementalParticles(pos, 25, [0xffd700, 0xffffff, 0xa855f7], [2, 6], 0.5, 6, 0.8);
      }
      if (this.pixelFX?.damageTexts) {
        this.pixelFX.damageTexts.spawn('⚔️ PHẢN ĐÒN HOÀN HẢO! +95 HP', this.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#ffd700');
      }
      return;
    }

    let defMult = this.sectStats?.defenseMult || 1.0;
    // Hộ Vệ đang bật Thiết Giáp Phản Chấn: Giảm thêm 35% sát thương nhận vào
    if (this.shieldReflectTimer > 0) {
      defMult *= 0.65;
      if (attackerEntity && typeof attackerEntity.takeDamage === 'function' && !attackerEntity.isDead) {
        const reflected = Math.max(10, Math.round(amount * 0.35));
        attackerEntity.takeDamage(reflected, this.position);
        if (this.pixelFX?.damageTexts) {
          this.pixelFX.damageTexts.spawn(`🛡️⚡ -${reflected} PHẢN CHẤN!`, attackerEntity.position.clone().add(new THREE.Vector3(0, 1.8, 0)), '#fbbf24');
        }
      }
    }

    const actualDmg = Math.max(1, Math.round(amount * defMult));
    this.hp = Math.max(0, this.hp - actualDmg);
    this.lastHitTimer = 0;
    this.updateBillboard();

    this.hitFlashTimer = 0.25;
    this.furMat.color.setHex(0xff3838);
    this.clothesMat.color.setHex(0xff4757);

    if (this.particles) {
      const pos = hitPos || this.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      this.particles.emitHitSparkles(pos, 16);
    }

    sound.playHit();
  }

  respawn(spawnPos) {
    this.isDead = false;
    this.statusResistTimer = 0;
    this.shieldReflectTimer = 0;
    this.berserkTimer = 0;
    this.hp = this.maxHp;
    this.position.set(spawnPos.x, spawnPos.y || 0, spawnPos.z);
    this.group.position.copy(this.position);
    this.group.visible = true;
    this.updateBillboard();

    if (this.particles) {
      this.particles.emitShockwave(this.position, 0x00d2d3, 4.5, 0.45);
      this.particles.emitElementalParticles(this.position, 25, [0x00d2d3, 0xffd700, 0xffffff], [1, 5], 0.6, 6.0, 0.9);
    }
  }

  buildCastAura() {
    this.castAuraGroup = new THREE.Group();
    this.castAuraGroup.position.y = 0.08;

    const ringGeo = new THREE.RingGeometry(0.85, 1.45, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.castAuraMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, this.castAuraMat);
    this.castAuraGroup.add(ringMesh);

    const innerRingGeo = new THREE.RingGeometry(0.2, 0.45, 6);
    innerRingGeo.rotateX(-Math.PI / 2);
    const innerMesh = new THREE.Mesh(innerRingGeo, this.castAuraMat);
    this.castAuraGroup.add(innerMesh);

    this.castAuraGroup.visible = false;
    this.group.add(this.castAuraGroup);
  }

  // ============================================================================
  // DỰNG MÔ HÌNH 3D VŨ KHÍ ĐẶC TRƯNG CHO 5 VAI TRÒ
  // ============================================================================
  buildShieldModel() {
    const shield = new THREE.Group();
    shield.position.set(-0.18, -0.22, 0.24);
    shield.rotation.y = -0.35;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.7, flatShading: true });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5, flatShading: true });
    const gemMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Thân khiên lục giác dày dặn
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.36, 0.08, 6), plateMat);
    body.rotation.x = Math.PI / 2;
    body.scale.set(0.95, 1.0, 1.32);
    body.castShadow = true;
    shield.add(body);

    // Viền hoàng kim bọc quanh khiên
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.40, 0.06, 6), frameMat);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(0.95, 1.0, 1.32);
    shield.add(rim);

    // Lõi ngọc năng lượng giữa khiên
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), gemMat);
    core.position.z = 0.06;
    shield.add(core);

    shield.visible = false;
    return shield;
  }

  buildOffhandDaggerModel() {
    const daggerGroup = new THREE.Group();
    daggerGroup.position.set(-0.04, -0.28, 0.05);
    // Cầm ngược đoản đao kiểu Sát Thủ
    daggerGroup.rotation.x = -Math.PI / 2 + 0.2;

    const handleMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.3 });
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 6), handleMat);
    daggerGroup.add(grip);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.06), guardMat);
    guard.position.y = 0.11;
    daggerGroup.add(guard);

    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.62, 4), bladeMat);
    blade.scale.set(1.0, 1.0, 0.35);
    blade.position.y = 0.42;
    daggerGroup.add(blade);

    daggerGroup.visible = false;
    return daggerGroup;
  }

  buildStaffModel() {
    const staff = new THREE.Group();
    staff.position.set(0.02, -0.26, 0.10);
    staff.rotation.x = Math.PI / 2 - 0.35;

    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4, metalness: 0.4, flatShading: true });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.8, flatShading: true });
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 1.55, 6), shaftMat);
    shaft.position.y = 0.35;
    shaft.castShadow = true;
    staff.add(shaft);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 16), goldMat);
    ring.position.y = 1.22;
    staff.add(ring);

    this.staffCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), crystalMat);
    this.staffCrystal.position.y = 1.22;
    staff.add(this.staffCrystal);

    staff.visible = false;
    return staff;
  }

  buildAxeModel() {
    const axe = new THREE.Group();
    axe.position.set(0.02, -0.28, 0.08);
    axe.rotation.x = Math.PI / 2;

    const handleMat = new THREE.MeshStandardMaterial({ color: 0x3f2305, roughness: 0.7, flatShading: true });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.35, metalness: 0.75, flatShading: true });
    const magmaMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.38, 6), handleMat);
    shaft.position.y = 0.42;
    axe.add(shaft);

    // Đầu rìu chiến đôi khổng lồ
    const headCenter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), metalMat);
    headCenter.position.y = 0.96;
    axe.add(headCenter);

    for (const side of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.42, 4), metalMat);
      blade.rotation.z = side * (Math.PI / 2);
      blade.scale.set(1.1, 1.0, 0.25);
      blade.position.set(side * 0.22, 0.96, 0);
      axe.add(blade);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.04), magmaMat);
      edge.position.set(side * 0.40, 0.96, 0);
      axe.add(edge);
    }

    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 5), magmaMat);
    spike.position.y = 1.22;
    axe.add(spike);

    axe.visible = false;
    return axe;
  }

  buildBowModel() {
    const bow = new THREE.Group();
    bow.position.set(-0.08, -0.22, 0.25);
    bow.rotation.y = -0.2;

    const limbMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.35, roughness: 0.3, flatShading: true });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.3 });
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xa7f3d0 });

    // Cánh cung cong
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.042, 6, 16, Math.PI * 0.88), limbMat);
    arc.rotation.z = -Math.PI * 0.44;
    bow.add(arc);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 6), gripMat);
    grip.position.x = 0.56;
    bow.add(grip);

    // Dây cung năng lượng
    const stringMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.06, 4), stringMat);
    stringMesh.position.x = 0.14;
    bow.add(stringMesh);

    bow.visible = false;
    return bow;
  }

  buildMesh() {
    this.model = new THREE.Group();

    this.furMat = new THREE.MeshStandardMaterial({
      color: 0xdf9a57,
      roughness: 0.8,
      flatShading: true,
    });

    const snoutMat = new THREE.MeshStandardMaterial({
      color: 0xffedd8,
      roughness: 0.8,
      flatShading: true,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.2,
    });

    const eyeSparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.4,
    });

    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xff7b90,
      transparent: true,
      opacity: 0.65,
    });

    this.clothesMat = new THREE.MeshStandardMaterial({
      color: this.outfits[0].clothes,
      roughness: 0.7,
      flatShading: true,
    });

    const trimMat = new THREE.MeshStandardMaterial({ color: 0x8e2b2b, roughness: 0.6, flatShading: true });

    this.hatMat = new THREE.MeshStandardMaterial({
      color: this.outfits[0].hat,
      roughness: 0.6,
      flatShading: true,
    });

    const backpackMat = new THREE.MeshStandardMaterial({
      color: 0x8d5b4c,
      roughness: 0.8,
      flatShading: true,
    });

    // 1. THÂN GẤU
    this.body = new THREE.Group();
    const bodyMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), this.clothesMat);
    bodyMesh.scale.set(1.0, 1.2, 0.95);
    bodyMesh.position.y = 0.65;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.body.add(bodyMesh);

    const robeSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.64, 0.46, 10), this.clothesMat);
    robeSkirt.position.y = 0.33;
    robeSkirt.castShadow = true;
    this.body.add(robeSkirt);

    for (const side of [-1, 1]) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.05), trimMat);
      collar.position.set(side * 0.1, 0.93, 0.46);
      collar.rotation.z = -side * 0.5;
      collar.rotation.x = -0.25;
      this.body.add(collar);
    }

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.585, 0.585, 0.1, 10), trimMat);
    belt.position.y = 0.56;
    this.body.add(belt);
    const beltKnot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), trimMat);
    beltKnot.position.set(0.12, 0.54, 0.57);
    this.body.add(beltKnot);
    for (const side of [-1, 1]) {
      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.03), trimMat);
      sash.position.set(0.12 + side * 0.04, 0.4, 0.6);
      sash.rotation.z = side * 0.15;
      this.body.add(sash);
    }

    // 2. ĐẦU GẤU
    this.head = new THREE.Group();
    this.head.position.y = 1.35;

    const headMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 1), this.furMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    const snout = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), snoutMat);
    snout.scale.set(1.1, 0.85, 1.0);
    snout.position.set(0, -0.08, 0.48);
    this.head.add(snout);
    this.snout = snout;

    const nose = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), noseMat);
    nose.position.set(0, -0.02, 0.7);
    this.head.add(nose);
    this.nose = nose;

    const createEye = (side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeMat);
      eye.position.set(side * 0.22, 0.08, 0.49);
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeSparkleMat);
      sparkle.position.set(side * 0.24, 0.11, 0.56);
      this.head.add(eye);
      this.head.add(sparkle);
    };
    createEye(1);
    createEye(-1);

    const blushGeo = new THREE.CircleGeometry(0.09, 8);
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.34, -0.09, 0.42);
    blushL.rotation.y = -Math.PI / 6;
    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushR.position.set(0.34, -0.09, 0.42);
    blushR.rotation.y = Math.PI / 6;
    this.head.add(blushL);
    this.head.add(blushR);
    this.blushL = blushL;
    this.blushR = blushR;

    this.ears = [];
    const earGeo = new THREE.DodecahedronGeometry(0.18, 0);
    const earInnerMat = new THREE.MeshStandardMaterial({ color: 0xffa8ba, roughness: 0.8 });

    const createEar = (side) => {
      const earGroup = new THREE.Group();
      earGroup.position.set(side * 0.42, 0.45, 0.05);

      const earMesh = new THREE.Mesh(earGeo, this.furMat);
      earMesh.scale.set(0.9, 0.9, 0.5);
      earMesh.castShadow = true;
      earGroup.add(earMesh);

      const earInner = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), earInnerMat);
      earInner.position.set(0, 0, 0.05);
      earGroup.add(earInner);

      this.ears.push(earGroup);
      this.head.add(earGroup);
    };
    createEar(1);
    createEar(-1);

    // Mũ chiến binh cổ phong
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.5, -0.02);
    hatGroup.rotation.x = -0.12;

    const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.3, 8), this.hatMat);
    hatBase.castShadow = true;
    hatGroup.add(hatBase);

    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), this.hatMat);
    hatTop.position.y = 0.17;
    hatTop.rotation.y = Math.PI / 4;
    hatTop.castShadow = true;
    hatGroup.add(hatTop);

    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.05, 8), trimMat);
    hatBand.position.y = -0.12;
    hatGroup.add(hatBand);

    const taiji = new THREE.Group();
    taiji.position.set(0, 0.02, 0.335);
    taiji.rotation.x = 0.1;
    const yangMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const yinMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const yang = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16, Math.PI / 2, Math.PI), yangMat);
    const yin = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16, -Math.PI / 2, Math.PI), yinMat);
    taiji.add(yang, yin);
    const taijiRim = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.095, 16), new THREE.MeshBasicMaterial({ color: 0xf1c40f }));
    taiji.add(taijiRim);
    hatGroup.add(taiji);

    this.hatGroup = hatGroup;
    this.head.add(this.hatGroup);

    this.boDoiHatGroup = this.buildBoDoiHat();
    this.head.add(this.boDoiHatGroup);

    this.namCamFace = this.buildNamCamFace();
    this.head.add(this.namCamFace);

    this.body.add(this.head);

    // 3. BA LÔ & HỒ LÔ
    this.backpack = new THREE.Group();
    this.backpack.position.set(0, 0.72, -0.5);

    const bagMain = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.3), backpackMat);
    bagMain.castShadow = true;
    this.backpack.add(bagMain);

    const bagPocket = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.12), backpackMat);
    bagPocket.position.set(0, -0.12, -0.18);
    this.backpack.add(bagPocket);

    const bedrollMat = new THREE.MeshStandardMaterial({ color: 0x58b19f, roughness: 0.8 });
    const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.54, 6), bedrollMat);
    bedroll.rotation.z = Math.PI / 2;
    bedroll.position.set(0, 0.32, 0);
    this.backpack.add(bedroll);

    const gourdGroup = new THREE.Group();
    gourdGroup.position.set(0.28, 0.05, -0.05);
    gourdGroup.rotation.z = -0.3;
    const gourdMat = new THREE.MeshStandardMaterial({ color: 0xf5cd79, roughness: 0.5, flatShading: true });
    const gourdLower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 1), gourdMat);
    gourdGroup.add(gourdLower);
    const gourdUpper = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 1), gourdMat);
    gourdUpper.position.y = 0.16;
    gourdGroup.add(gourdUpper);
    const gourdCork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 5), new THREE.MeshStandardMaterial({ color: 0xd63031 }));
    gourdCork.position.y = 0.25;
    gourdGroup.add(gourdCork);
    this.backpack.add(gourdGroup);

    this.body.add(this.backpack);

    // 4. TAY TRÁI (+ Khiên Hộ Vệ / Đoản Đao Trái Sát Thủ / Cung Tên Xạ Thủ)
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.35, 6);
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.48, 0.85, 0);
    const armMeshL = new THREE.Mesh(armGeo, this.furMat);
    armMeshL.position.y = -0.16;
    armMeshL.castShadow = true;
    this.leftArm.add(armMeshL);

    const sleeveGeo = new THREE.CylinderGeometry(0.13, 0.21, 0.28, 8);
    const cuffGeo = new THREE.CylinderGeometry(0.215, 0.215, 0.045, 8);
    const addSleeve = (arm) => {
      const sleeve = new THREE.Mesh(sleeveGeo, this.clothesMat);
      sleeve.position.y = -0.12;
      sleeve.castShadow = true;
      arm.add(sleeve);
      const cuff = new THREE.Mesh(cuffGeo, trimMat);
      cuff.position.y = -0.27;
      arm.add(cuff);
    };
    addSleeve(this.leftArm);

    this.shieldGroup = this.buildShieldModel();
    this.leftArm.add(this.shieldGroup);

    this.daggerLGroup = this.buildOffhandDaggerModel();
    this.leftArm.add(this.daggerLGroup);

    this.bowGroup = this.buildBowModel();
    this.leftArm.add(this.bowGroup);

    this.body.add(this.leftArm);

    // 5. TAY PHẢI (+ Kiếm / Quyền Trượng Pháp Sư / Chiến Phủ Đấu Sĩ / Súng NAMCAM)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.48, 0.85, 0);
    const armMeshR = new THREE.Mesh(armGeo, this.furMat);
    armMeshR.position.y = -0.16;
    armMeshR.castShadow = true;
    this.rightArm.add(armMeshR);
    addSleeve(this.rightArm);

    this.sword = new THREE.Group();
    this.sword.position.set(0.02, -0.3, 0.06);
    this.sword.rotation.x = Math.PI / 2;

    this.bladeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffd54a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.bladeAura = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.08), this.bladeGlowMat);
    this.bladeAura.position.y = 0.64;
    this.bladeAura.visible = false;
    this.sword.add(this.bladeAura);

    this.staffGroup = this.buildStaffModel();
    this.rightArm.add(this.staffGroup);

    this.axeGroup = this.buildAxeModel();
    this.rightArm.add(this.axeGroup);

    this.gunGroup = this.buildGunModel();
    this.rightArm.add(this.gunGroup);

    this.rightArm.add(this.sword);
    this.body.add(this.rightArm);

    // Vỏ kiếm sau lưng
    this.sheath = createSheath();
    this.sheath.position.set(0.3, 1.22, -0.7);
    this.sheath.rotation.z = -0.7;
    this.body.add(this.sheath);

    this.sheathSlot = new THREE.Group();
    this.sheathSlot.position.y = 0.14;
    this.sheathSlot.rotation.x = Math.PI;
    this.sheath.add(this.sheathSlot);

    this.swordModel = createSword();
    this.sheathSlot.add(this.swordModel);

    onSwordModelReady(() => {
      const parent = this.swordModel.parent;
      const visible = this.swordModel.visible;
      parent.remove(this.swordModel);
      this.swordModel = createSword();
      this.swordModel.visible = visible;
      parent.add(this.swordModel);
    });

    // 6. CHÂN
    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 6);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9, flatShading: true });

    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.25, 0.32, 0);
    const legMeshL = new THREE.Mesh(legGeo, this.furMat);
    legMeshL.position.y = -0.12;
    legMeshL.castShadow = true;
    this.leftLeg.add(legMeshL);
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.26), shoeMat);
    shoeL.position.set(0, -0.22, 0.05);
    shoeL.castShadow = true;
    this.leftLeg.add(shoeL);
    this.body.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.25, 0.32, 0);
    const legMeshR = new THREE.Mesh(legGeo, this.furMat);
    legMeshR.position.y = -0.12;
    legMeshR.castShadow = true;
    this.rightLeg.add(legMeshR);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.26), shoeMat);
    shoeR.position.set(0, -0.22, 0.05);
    shoeR.castShadow = true;
    this.rightLeg.add(shoeR);
    this.body.add(this.rightLeg);

    this.model.add(this.body);
    this.group.add(this.model);
  }

  buildBoDoiHat() {
    const group = new THREE.Group();
    group.position.set(0, 0.42, 0.02);
    group.rotation.x = -0.08;

    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x2e4a2b,
      roughness: 0.65,
      flatShading: true,
    });

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
    dome.position.y = 0.05;
    dome.scale.set(1.0, 0.85, 1.15);
    dome.castShadow = true;
    group.add(dome);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.65), helmetMat);
    ridge.position.set(0, 0.28, 0);
    group.add(ridge);

    const brimGeo = new THREE.CylinderGeometry(0.56, 0.46, 0.08, 16, 1, true);
    const brim = new THREE.Mesh(brimGeo, helmetMat);
    brim.position.y = 0.02;
    brim.scale.set(1.0, 1.0, 1.18);
    group.add(brim);

    const strapMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.04, 16), strapMat);
    band.position.y = 0.08;
    band.scale.set(1.0, 1.0, 1.15);
    group.add(band);

    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0, 0.16, 0.44);
    badgeGroup.rotation.x = 0.22;

    const redBacking = new THREE.Mesh(
      new THREE.CircleGeometry(0.065, 16),
      new THREE.MeshBasicMaterial({ color: 0xd63031 })
    );
    badgeGroup.add(redBacking);

    const goldBorder = new THREE.Mesh(
      new THREE.RingGeometry(0.062, 0.072, 16),
      new THREE.MeshBasicMaterial({ color: 0xf1c40f })
    );
    badgeGroup.add(goldBorder);

    const starShape = new THREE.Shape();
    const outerR = 0.045;
    const innerR = 0.018;
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = -Math.sin(a) * r;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();
    const starGeo = new THREE.ShapeGeometry(starShape);
    const starMesh = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    starMesh.position.z = 0.002;
    badgeGroup.add(starMesh);

    group.add(badgeGroup);
    group.visible = false;
    return group;
  }

  buildNamCamFace() {
    const group = new THREE.Group();
    group.position.set(0, -0.02, 0.49);

    const loader = new THREE.TextureLoader();
    const texture = loader.load('./images/namcam_face.png');
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const faceGeo = new THREE.PlaneGeometry(0.64, 0.75);
    const faceMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    group.add(faceMesh);

    const borderMat = new THREE.MeshBasicMaterial({ color: 0x2e4a2b });
    const frame = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.35, 24), borderMat);
    group.add(frame);

    group.visible = false;
    return group;
  }

  buildGunModel() {
    const gun = new THREE.Group();
    gun.position.set(0.05, -0.15, 0.25);
    gun.rotation.x = -Math.PI / 2;

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      roughness: 0.4,
      metalness: 0.8,
      flatShading: true,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6e2c00,
      roughness: 0.7,
      flatShading: true,
    });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.42), metalMat);
    gun.add(receiver);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.14, 0.28), woodMat);
    stock.position.set(0, -0.04, -0.32);
    stock.rotation.x = -0.12;
    gun.add(stock);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.48, 6), metalMat);
    barrel.position.set(0, 0.03, 0.42);
    barrel.rotation.x = Math.PI / 2;
    gun.add(barrel);

    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6), woodMat);
    gasTube.position.set(0, 0.07, 0.35);
    gasTube.rotation.x = Math.PI / 2;
    gun.add(gasTube);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 6), metalMat);
    muzzle.position.set(0, 0.03, 0.68);
    muzzle.rotation.x = Math.PI / 2;
    gun.add(muzzle);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.24, 0.1), metalMat);
    mag.position.set(0, -0.16, 0.06);
    mag.rotation.x = 0.25;
    gun.add(mag);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), woodMat);
    grip.position.set(0, -0.11, -0.12);
    grip.rotation.x = -0.35;
    gun.add(grip);

    gun.visible = false;
    return gun;
  }

  jump() {
    if (this.isGrounded) {
      this.jumpVelocity = 9.8;
      this.isGrounded = false;
      this.squashFactor = 1.35;
      sound.playJump();
      if (this.particles) {
        this.particles.emitDust(this.position);
      }
    }
  }

  drawSword() {
    this.sheatheTimer = SHEATHE_DELAY;
    if (this.outfitIndex >= 2) {
      return;
    }
    if (this.isSwordDrawn) return;
    this.isSwordDrawn = true;
    this.sword.add(this.swordModel);
    this.bladeAura.visible = !this.isSwordThrown;
    if (this.particles) {
      this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 6, [0xffd54a, 0xffffff], [1, 3], 0.3, 0, 0.4);
    }
  }

  sheatheSword() {
    if (this.outfitIndex >= 2) return;
    if (!this.isSwordDrawn) return;
    this.isSwordDrawn = false;
    this.sheathSlot.add(this.swordModel);
    this.bladeAura.visible = false;
  }

  triggerFartAnimation() {
    this.isFarting = true;
    this.fartTimer = 0.55;
  }

  setSwordThrown(thrown) {
    this.isSwordThrown = thrown;
    if (this.outfitIndex <= 1) {
      this.swordModel.visible = !thrown;
      this.bladeAura.visible = !thrown && this.isSwordDrawn;
      if (!thrown) this.drawSword();
    }
  }

  startDash(dir, distance, duration) {
    this.dashDir.set(dir.x, 0, dir.z).normalize();
    this.dashSpeed = distance / duration;
    this.dashTime = duration;
  }

  flashBlade(color, intensity = 1.0) {
    this.bladeGlowMat.color.setHex(color);
    this.auraIntensity = Math.max(this.auraIntensity, intensity);
  }

  // Kích hoạt hoạt ảnh Đòn Đánh Thường riêng biệt cho từng Vai Trò
  triggerSlashAnimation(facing, step = 0) {
    this.drawSword();
    this.slashStep = step;
    const speedMult = (this.sectStats?.slashSpeedMult || 1.0) * (this.berserkTimer > 0 ? 1.22 : 1.0);
    this.slashDuration = SLASH_DURATIONS[step] / speedMult;
    this.slashTimer = this.slashDuration;
    this.slashSide = step === 1 ? -1 : 1;
    this.slashFacing = facing;
    this.targetRotationY = facing;

    const flashColor = this.sectStats?.slashColor || (step === 2 ? 0xffffff : 0xfff3b0);
    this.flashBlade(flashColor, step === 2 ? 1.0 : 0.7);
    if (this.sectStats?.isGun || this.outfitIndex === 5) {
      this.rightArm.rotation.x = -Math.PI / 2 + 0.15;
      this.rightArm.rotation.y = -0.15;
      if (sound.playGunshot) sound.playGunshot();
    } else if (this.sectStats?.isRangedBasic && sound.playFeatherShoot) {
      sound.playFeatherShoot();
    } else {
      sound.playSwordSlash();
    }
  }

  // Bí danh đồng bộ cho triggerSlash
  triggerSlash(facing, step = 0) {
    this.triggerSlashAnimation(facing, step);
  }

  setChargeLevel(level, charging, facing = this.slashFacing) {
    if (charging && level >= 1 && this.chargeLevel < 1) {
      sound.playSwordSummon();
      if (this.particles) {
        this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 16, [0xffd700, 0xffffff], [2, 5], 0.4, 2.0, 0.6);
      }
    }
    if (!charging && this.isCharging) {
      this.rightArm.rotation.z = 0;
      this.leftArm.rotation.z = 0;
      this.body.rotation.y = 0;
    }
    if (charging) this.drawSword();
    this.isCharging = charging;
    this.chargeLevel = charging ? level : 0;
    if (charging) {
      this.slashFacing = facing;
      this.targetRotationY = facing;
    }
  }

  triggerSkillCast(skillNum) {
    this.isCasting = true;
    this.castSkill = skillNum;
    this.castTime = 0;
    const durations = { 1: 0.48, 2: 0.45, 3: 0.65, 4: 1.05 };
    this.castDuration = durations[skillNum] || 0.6;
    this.drawSword();

    const roleColors = [
      { 1: 0xfbbf24, 2: 0x38bdf8, 3: 0xf59e0b, 4: 0xfde047 }, // 🛡️ Hộ Vệ
      { 1: 0xa855f7, 2: 0xc084fc, 3: 0xe879f9, 4: 0xf43f5e }, // 🗡️ Sát Thủ
      { 1: 0x38bdf8, 2: 0x7dd3fc, 3: 0x818cf8, 4: 0x0ea5e9 }, // ❄️ Pháp Sư
      { 1: 0xf43f5e, 2: 0xf97316, 3: 0xef4444, 4: 0xfbbf24 }, // 🔥 Đấu Sĩ
      { 1: 0x10b981, 2: 0x34d399, 3: 0xfacc15, 4: 0x6ee7b7 }, // 🏹 Xạ Thủ
      { 1: 0xfbbf24, 2: 0x00d2d3, 3: 0xff4757, 4: 0xffd700 }, // ⭐ NAMCAM
    ];

    const currentRoleColors = roleColors[this.outfitIndex % roleColors.length] || roleColors[0];
    const color = currentRoleColors[skillNum] || 0xffd700;

    if (this.castAuraMat) {
      this.castAuraMat.color.setHex(color);
      this.castAuraMat.opacity = 0.95;
    }
    this.castAuraGroup.visible = true;
    this.castAuraGroup.scale.set(0.3, 0.3, 0.3);

    this.flashBlade(color, 1.0);

    if (skillNum === 4) {
      this.jumpVelocity = 5.5;
      this.isGrounded = false;
      this.squashFactor = 1.3;
      sound.playSwordSummon();
    } else if (skillNum === 2) {
      this.squashFactor = 0.85;
    } else if (skillNum === 1) {
      this.squashFactor = 1.15;
    } else if (skillNum === 3) {
      this.squashFactor = 1.22;
      sound.playSwordSummon();
    }

    if (this.particles) {
      this.particles.emitElementalParticles(
        this.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
        16,
        [color, 0xffffff],
        [3, 6],
        0.5,
        4.0,
        0.8
      );
    }
  }

  cycleOutfit() {
    let next = (this.outfitIndex + 1) % this.outfits.length;
    if (next === 5 && this.name !== 'NAMCAM') {
      next = 0;
    }
    return this.applyOutfit(next);
  }

  update(delta, inputVector, isSprinting) {
    if (this.isDead) return;

    // Xoay tinh thể trên đỉnh Quyền Trượng Pháp Sư
    if (this.staffCrystal && this.outfitIndex === 2) {
      this.staffCrystal.rotation.y += delta * 4.0;
      this.staffCrystal.rotation.x += delta * 2.0;
    }

    this.lastHitTimer += delta;
    if (this.lastHitTimer > 5.0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + delta * 30);
      this.updateBillboard();
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.furMat.color.setHex(0xdf9a57);
        const current = this.outfits[this.outfitIndex];
        this.clothesMat.color.setHex(current.clothes);
      }
    }

    this.isSprinting = isSprinting;

    if (this.parryTimer > 0) {
      this.parryTimer -= delta;
      if (this.parryTimer <= 0) this.isParrying = false;
    }
    if (this.shieldReflectTimer > 0) {
      this.shieldReflectTimer -= delta;
      if (this.particles && Math.random() < 0.25) {
        this.particles.emitElementalParticles(
          this.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 1.4, (Math.random() - 0.5) * 1.6)),
          1, [0xf6b93b, 0xffd32a, 0xffffff], [0.5, 1.5], 0.28, 0, 0.45
        );
      }
    }
    if (this.berserkTimer > 0) {
      this.berserkTimer -= delta;
      if (this.particles && Math.random() < 0.35) {
        this.particles.emitElementalParticles(
          this.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.3 + Math.random() * 1.5, (Math.random() - 0.5) * 1.4)),
          2, [0xff5252, 0xff793f, 0xffd32a], [1.0, 2.8], 0.3, 0, 0.5
        );
      }
    }
    if (this.freezeTimer > 0) {
      this.freezeTimer -= delta;
      inputVector.set(0, 0, 0);
      this.isSprinting = false;
    }
    if (this.slowTimer > 0) {
      this.slowTimer -= delta;
    }
    if (this.statusResistTimer > 0) {
      this.statusResistTimer -= delta;
      this.freezeTimer = 0;
      this.slowTimer = 0;
      if (this.particles && Math.random() < 0.08) {
        this.particles.emitElementalParticles(
          this.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2)),
          1, [0xfbbf24, 0xfff3b0], [0.3, 1], 0.25, 0, 0.5
        );
      }
    }

    const moveLen = inputVector.length();
    this.isMoving = moveLen > 0.05 && this.freezeTimer <= 0;

    const baseWalk = this.sectStats?.speed || 5.4;
    const baseSprint = this.sectStats?.sprintSpeed || 9.8;
    let targetSpeed = this.isMoving ? (this.isSprinting ? baseSprint : baseWalk) : 0;
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= delta;
      targetSpeed *= 1.45;
    }
    if (this.berserkTimer > 0) {
      targetSpeed *= 1.35;
    }
    if (this.slowTimer > 0) {
      targetSpeed *= Math.max(0.2, 1.0 - this.slowAmount);
    }
    if (this.freezeTimer > 0) {
      targetSpeed = 0;
    }
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, delta * 11);

    if (this.isMoving) {
      this.velocity.x = inputVector.x * this.speed;
      this.velocity.z = inputVector.z * this.speed;
      this.targetRotationY = (this.slashTimer > 0 || this.isCharging) ? this.slashFacing : Math.atan2(inputVector.x, inputVector.z);
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, delta * 8);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, delta * 8);
    }

    let rotDiff = this.targetRotationY - this.rotationY;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    this.rotationY += rotDiff * Math.min(1, delta * 12);
    this.model.rotation.y = this.rotationY;

    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    if (this.dashTime > 0) {
      const step = Math.min(delta, this.dashTime);
      this.position.addScaledVector(this.dashDir, this.dashSpeed * step);
      this.dashTime -= delta;
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, -121, 121);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -121, 121);

    const groundY = getTerrainHeight(this.position.x, this.position.z);
    if (this.isGrounded) {
      this.position.y = groundY;
    }

    if (this.isMechaActive) {
      this.isGrounded = true;
      this.freezeTimer = 0;
      this.slowTimer = 0;

      // Đồng bộ vị trí của Namcam vào ghế lái buồng lái
      if (this.giantRobot?.getPilotSeatPos) {
        const seatPos = this.giantRobot.getPilotSeatPos();
        if (seatPos) {
          this.group.position.copy(seatPos);
          this.group.rotation.y = this.rotationY;
        }
      } else {
        const forward = new THREE.Vector3(-Math.sin(this.rotationY), 0, -Math.cos(this.rotationY));
        const cockpitPos = this.position.clone().addScaledVector(forward, 2.0);
        cockpitPos.y = groundY + 26.7;

        this.group.position.copy(cockpitPos);
        this.group.rotation.y = this.rotationY;
      }
      this.group.scale.set(1.35, 1.35, 1.35); // Namcam to hơn 1 chút để nhìn rõ từ bên ngoài kính

      // Dáng ngồi lái oai phong: 2 tay cầm cần lái, chân gác bàn đạp
      this.rightArm.rotation.set(-1.15, 0, -0.2);
      this.leftArm.rotation.set(-1.15, 0, 0.2);
      this.rightLeg.rotation.set(1.4, 0, 0.2);
      this.leftLeg.rotation.set(1.4, 0, -0.2);
      this.head.rotation.set(0.1, 0, 0);

      if (this.contactShadow) {
        this.contactShadow.visible = false;
      }
      return;
    }

    if (this.isFloatingUlt) {
      this.isGrounded = false;
      this.freezeTimer = 0;
      this.slowTimer = 0;
      this.group.position.copy(this.position);
      if (this.contactShadow) {
        this.contactShadow.position.set(this.position.x, groundY + 0.025, this.position.z);
        this.shadowMat.opacity = 0.08;
        this.contactShadow.scale.set(0.4, 0.4, 0.4);
      }
      this.rightArm.rotation.set(-2.8, 0, 0.4);
      this.leftArm.rotation.set(-2.8, 0, -0.4);
      this.head.rotation.x = -0.25;
      this.rightLeg.rotation.set(0.18, 0, 0.1);
      this.leftLeg.rotation.set(0.18, 0, -0.1);
      return;
    }

    if (!this.isGrounded) {
      this.jumpVelocity += this.gravity * delta;
      this.position.y += this.jumpVelocity * delta;

      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.isGrounded = true;
        this.jumpVelocity = 0;
        this.squashFactor = 0.65;
        sound.playLand();
        if (this.particles) {
          this.particles.emitDust(this.position);
          this.particles.emitDust(this.position);
        }
      }
    } else {
      this.position.y = groundY;
    }

    this.group.position.copy(this.position);

    if (this.contactShadow) {
      this.contactShadow.position.set(this.position.x, groundY + 0.025, this.position.z);
      const heightAbove = Math.max(0, this.position.y - groundY);
      this.shadowMat.opacity = Math.max(0.04, 0.38 - heightAbove * 0.12);
      const s = Math.max(0.35, 1.0 - heightAbove * 0.14);
      this.contactShadow.scale.set(s, s, s);
    }

    this.squashFactor = THREE.MathUtils.lerp(this.squashFactor, 1.0, delta * 9);

    if (this.isFarting) {
      this.fartTimer -= delta;
      if (this.fartTimer <= 0) {
        this.isFarting = false;
        this.body.rotation.x = 0;
        this.body.rotation.y = 0;
        this.rightLeg.rotation.x = 0;
        this.leftLeg.rotation.x = 0;
      } else {
        const progress = Math.sin((1 - this.fartTimer / 0.55) * Math.PI);
        this.body.rotation.x = progress * 0.65;
        this.body.rotation.y = Math.PI;
        this.rightLeg.rotation.x = progress * -0.6;
        this.leftLeg.rotation.x = progress * 0.2;
        this.rightArm.rotation.x = progress * -0.4;
        this.leftArm.rotation.x = progress * -0.4;
        return;
      }
    }

    const animSpeed = this.isMoving ? (this.isSprinting ? 14.5 : 9.5) : 3.2;
    this.animTime += delta * animSpeed;

    // --- XỬ LÝ ANIMATION THI TRIỂN KỸ NĂNG RIÊNG BIỆT CHO TỪNG VAI TRÒ ---
    if (this.isCasting) {
      this.castTime += delta;
      const castProgress = Math.min(1.0, this.castTime / this.castDuration);
      const easeOut = 1.0 - Math.pow(1.0 - castProgress, 3);

      this.castAuraGroup.rotation.y += delta * 7.5;
      const auraScale = THREE.MathUtils.lerp(0.35, 1.48, Math.min(1.0, castProgress * 1.8));
      this.castAuraGroup.scale.set(auraScale, auraScale, auraScale);
      this.castAuraMat.opacity = Math.max(0, (1.0 - castProgress * 0.65) * 0.92);

      this.rightArm.rotation.y = 0;
      this.leftArm.rotation.y = 0;

      if (this.outfitIndex === 0) {
        // 🛡️ THIẾT GIÁP HỘ VỆ: Động tác Trọng Khiên & Trọng Kiếm uy lực
        if (this.castSkill === 1) {
          // Chiêu 1 (Khiên Kích): Khóa chặt Đại Khiên trước ngực, lao vai húc tới
          this.leftArm.rotation.set(-1.55, 0.55, 0.35);
          this.rightArm.rotation.set(-0.55, 0, -0.45);
          this.body.rotation.x = 0.38;
          this.body.rotation.y = -0.32;
          this.head.rotation.x = -0.18;
        } else if (this.castSkill === 2) {
          // Chiêu 2 (Thiết Giáp Phản Chấn): Giương khiên lên trời rồi dậm khiên bất động
          const slam = castProgress < 0.35 ? -2.4 : -1.35;
          this.leftArm.rotation.set(slam, 0.35, 0.25);
          this.rightArm.rotation.set(-2.2, 0, -0.3);
          this.body.rotation.x = castProgress < 0.35 ? -0.18 : 0.12;
          this.body.position.y = castProgress < 0.35 ? 0.25 : 0;
        } else if (this.castSkill === 3) {
          // Chiêu 3 (Địa Chấn Khiêu Khích): Nhấc cả Khiên & Kiếm lên cao rồi nện sập mặt đất
          if (castProgress < 0.4) {
            this.body.position.y = Math.sin((castProgress / 0.4) * Math.PI) * 0.55;
            this.body.rotation.x = -0.28;
            this.leftArm.rotation.set(-2.6, 0, 0.3);
            this.rightArm.rotation.set(-2.6, 0, -0.3);
          } else {
            this.body.position.y = 0;
            this.body.rotation.x = 0.46;
            this.leftArm.rotation.set(-1.45, 0.3, 0);
            this.rightArm.rotation.set(-1.45, -0.3, 0);
          }
        } else {
          // Chiêu 4 (Bất Diệt Thần Thành): Xoay 360 độ rồi cắm Trọng Kiếm triệu hồi Pháo Đài
          this.body.rotation.y = easeOut * Math.PI * 2;
          this.body.position.y = 0.4 + Math.sin(this.castTime * 10) * 0.12;
          this.rightArm.rotation.set(-2.7, 0, -0.35);
          this.leftArm.rotation.set(-1.5, 0.4, 0.25);
        }
      } else if (this.outfitIndex === 1) {
        // 🗡️ ÁM ẢNH SÁT THỦ: Thân pháp nhẫn giả & song đao chớp nhoáng
        if (this.castSkill === 1) {
          // Chiêu 1 (Thuấn Bộ): Hạ thấp trọng tâm, bắt chéo song đao chữ X rồi bung lực cắt ngang
          this.body.rotation.x = 0.45;
          const slashLerp = THREE.MathUtils.lerp(1.2, -1.35, easeOut);
          this.rightArm.rotation.set(-1.45, 0, slashLerp);
          this.leftArm.rotation.set(-1.45, 0, -slashLerp);
        } else if (this.castSkill === 2) {
          // Chiêu 2 (Màn Sương Ẩn Thân): Nhào lộn xoay tròn trên không ném bom khói
          this.body.position.y = Math.sin(castProgress * Math.PI) * 0.95;
          this.body.rotation.y = castProgress * Math.PI * 2;
          this.body.rotation.x = 0.22;
          this.rightArm.rotation.set(-1.6, 0, -0.85);
          this.leftArm.rotation.set(-1.6, 0, 0.85);
        } else if (this.castSkill === 3) {
          // Chiêu 3 (Toàn Phong Song Nhận): Xoay tít như cơn lốc với 2 đoản đao dang ngang
          this.body.rotation.y = castProgress * Math.PI * 6;
          this.body.rotation.x = 0.2;
          this.rightArm.rotation.set(-1.45, 0, -1.25);
          this.leftArm.rotation.set(-1.45, 0, 1.25);
        } else {
          // Chiêu 4 (Tuyệt Mệnh Liên Trảm): Vũ điệu song đao liên hoàn siêu tốc
          const flurry = Math.sin(this.castTime * 36);
          this.body.rotation.x = 0.35;
          this.body.rotation.y = flurry * 0.65;
          this.rightArm.rotation.set(-1.55, 0, flurry * 1.4);
          this.leftArm.rotation.set(-1.55, 0, -flurry * 1.4);
        }
      } else if (this.outfitIndex === 2) {
        // ❄️ NGUYÊN TỐ PHÁP SƯ: Nghi thức Quyền Trượng Băng Tinh huyền ảo
        if (this.castSkill === 1) {
          // Chiêu 1 (Hàn Băng Tuyệt Vực): Giương cao Quyền Trượng rồi dộng mạnh xuống đất kích nổ băng
          const staffAngle = castProgress < 0.38 ? -2.65 : -1.05;
          this.rightArm.rotation.set(staffAngle, 0, -0.15);
          this.leftArm.rotation.set(-1.8, 0.3, 0.35);
          this.body.rotation.x = castProgress < 0.38 ? -0.2 : 0.22;
        } else if (this.castSkill === 2) {
          // Chiêu 2 (Tinh Không Dịch Chuyển): Xoay người bay lướt giữa tinh vân
          this.body.position.y = Math.sin(castProgress * Math.PI) * 0.7;
          this.body.rotation.y = easeOut * Math.PI * 2;
          this.rightArm.rotation.set(-1.85, 0, -0.65);
          this.leftArm.rotation.set(-1.55, 0, 0.65);
        } else if (this.castSkill === 3) {
          // Chiêu 3 (Hắc Động Trọng Trường): Tay trái chưởng lực hút, tay phải xoay Quyền Trượng tạo xoáy
          this.leftArm.rotation.set(-1.6, 0.25, 0);
          this.rightArm.rotation.set(-2.35, 0, Math.sin(this.castTime * 14) * 0.55);
          this.body.rotation.x = 0.14;
          this.body.position.y = 0.25 + Math.sin(this.castTime * 8) * 0.08;
        } else {
          // Chiêu 4 (Băng Tinh Thiên Phạt): Bay lơ lửng, hai tay nâng Quyền Trượng gọi Thiên Thạch Băng
          this.body.position.y = 0.65 + Math.sin(this.castTime * 10) * 0.15;
          this.body.rotation.x = -0.22;
          this.rightArm.rotation.set(-2.85, 0, 0.2);
          this.leftArm.rotation.set(-2.65, 0, -0.25);
          this.head.rotation.x = -0.3;
        }
      } else if (this.outfitIndex === 3) {
        // 🔥 CUỒNG CHIẾN ĐẤU SĨ: Bổ Cự Phủ Huyết Diễm & Gầm rú cuồng nộ
        if (this.castSkill === 1) {
          // Chiêu 1 (Phá Giáp Huyết Trảm): Vung Cự Phủ qua vai rồi bổ dọc chém toạc mặt đất
          if (castProgress < 0.35) {
            this.body.rotation.x = -0.28;
            this.body.rotation.y = 0.55;
            this.rightArm.rotation.set(-2.85, 0, 0.45);
            this.leftArm.rotation.set(-2.4, 0, 0.25);
          } else {
            this.body.rotation.x = 0.45;
            this.body.rotation.y = -0.38;
            this.rightArm.rotation.set(-0.75, 0, -0.2);
            this.leftArm.rotation.set(-0.85, 0, 0.1);
          }
        } else if (this.castSkill === 2) {
          // Chiêu 2 (Không Kích Địa Liệt): Nhào lộn 360 độ trên không bổ Cự Phủ xuống
          this.body.rotation.x = easeOut * Math.PI * 2;
          this.rightArm.rotation.set(-2.75, 0, 0);
          this.leftArm.rotation.set(-2.55, 0, 0);
        } else if (this.castSkill === 3) {
          // Chiêu 3 (Huyết Cuồng Chiến Hống): Ưỡn ngực gầm vang trời, hai tay bung rộng bộc phát lửa
          this.body.rotation.x = -0.32;
          this.head.rotation.x = -0.45;
          this.head.rotation.y = Math.sin(this.castTime * 28) * 0.14;
          this.rightArm.rotation.set(-1.35, 0, -1.15);
          this.leftArm.rotation.set(-1.35, 0, 1.15);
        } else {
          // Chiêu 4 (Dung Nham Hủy Diệt): Nhảy cao xoay rìu rồi đập vỡ đại địa
          if (castProgress < 0.48) {
            this.body.rotation.y = (castProgress / 0.48) * Math.PI * 2;
            this.rightArm.rotation.set(-2.9, 0, 0);
            this.leftArm.rotation.set(-2.7, 0, 0);
          } else {
            this.body.rotation.y = 0;
            this.body.rotation.x = 0.52;
            this.rightArm.rotation.set(-0.65, 0, 0);
            this.leftArm.rotation.set(-0.75, 0, 0);
          }
        }
      } else if (this.outfitIndex === 4) {
        // 🏹 THẦN TIỄN XẠ THỦ: Thân pháp giương Đại Cung Quang Ảnh thiện xạ
        if (this.castSkill === 1) {
          // Chiêu 1 (Liên Hoàn Lôi Tiễn): Giương cung chếch 45 độ lên bầu trời bắn Lôi Tiễn
          this.leftArm.rotation.set(-2.05, 0.25, 0);
          this.rightArm.rotation.set(castProgress < 0.5 ? -2.0 : -1.1, 0, 0.3);
          this.body.rotation.x = -0.22;
          this.body.rotation.y = -0.32;
          this.head.rotation.x = -0.25;
        } else if (this.castSkill === 2) {
          // Chiêu 2 (Phi Vũ Thoát Thân): Xoay người sải cánh lướt gió trên không
          this.body.position.y = Math.sin(castProgress * Math.PI) * 0.85;
          this.body.rotation.y = easeOut * Math.PI * 2;
          this.leftArm.rotation.set(-1.4, 0, 1.15);
          this.rightArm.rotation.set(-1.4, 0, -1.15);
        } else if (this.castSkill === 3) {
          // Chiêu 3 (Chấn Địa Đẩy Lùi): Cắm tiễn chấn địa rồi bật lùi nhẹ
          this.body.rotation.x = castProgress < 0.4 ? 0.38 : -0.18;
          this.body.position.y = Math.sin(castProgress * Math.PI) * 0.45;
          this.rightArm.rotation.set(castProgress < 0.4 ? -0.8 : -2.1, 0, -0.4);
          this.leftArm.rotation.set(-1.5, 0.2, 0.4);
        } else {
          // Chiêu 4 (Thiên Tiễn Phán Quyết): Bay lên giương Đại Cung tụ lực cực đại bắn lên trời
          this.body.position.y = 0.55 + Math.sin(this.castTime * 10) * 0.14;
          this.body.rotation.y = -0.35;
          this.body.rotation.x = -0.25;
          this.leftArm.rotation.set(-2.25, 0.2, 0);
          this.rightArm.rotation.set(castProgress < 0.65 ? -2.25 : -1.0, 0, 0.4);
        }
      } else {
        // Vai trò Ẩn NAMCAM
        if (this.castSkill === 1) {
          this.body.rotation.x = castProgress < 0.35 ? -0.2 : 0.25;
          this.rightArm.rotation.x = castProgress < 0.35 ? -2.6 : -1.45;
          this.leftArm.rotation.x = castProgress < 0.35 ? -1.2 : -0.7;
        } else if (this.castSkill === 2) {
          this.rightArm.rotation.set(-1.2, 0, -0.35);
          this.leftArm.rotation.set(-1.35, 0, 0.45);
        } else {
          this.body.position.y = 0.45 + Math.sin(this.castTime * 12) * 0.14;
          this.rightArm.rotation.x = -2.6;
          this.leftArm.rotation.x = -2.6;
        }
      }

      if (this.castTime >= this.castDuration) {
        this.isCasting = false;
        this.castAuraGroup.visible = false;
        this.body.rotation.set(0, 0, 0);
        this.head.rotation.set(0, 0, 0);
      }
    } else {
      const bankRoll = -rotDiff * 0.35;
      this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, bankRoll, delta * 10);

      if (this.isGrounded) {
        if (this.isMoving) {
          const legSwing = Math.sin(this.animTime) * (this.isSprinting ? 0.95 : 0.65);
          this.leftLeg.rotation.x = legSwing;
          this.rightLeg.rotation.x = -legSwing;

          if (this.outfitIndex === 5) {
            this.leftLeg.rotation.x = legSwing;
            this.rightLeg.rotation.x = -legSwing;
            if (this.slashTimer <= 0) {
              this.rightArm.rotation.set(-0.85, -0.15, 0.08);
              this.leftArm.rotation.set(-0.65, 0.22, 0.12);
            }
          } else {
            this.leftArm.rotation.x = this.outfitIndex === 0 ? -0.65 : -legSwing * 0.85;
            this.rightArm.rotation.x = -0.45 + Math.sin(this.animTime) * 0.18;
            this.rightArm.rotation.y = 0;
            this.rightArm.rotation.z = 0;
            this.leftArm.rotation.z = 0;
          }

          this.body.rotation.x = this.isSprinting ? 0.24 : 0.09;
          this.head.rotation.x = 0;

          const bounce = Math.abs(Math.sin(this.animTime * 2)) * (this.isSprinting ? 0.12 : 0.08);
          this.body.position.y = bounce;

          this.backpack.rotation.x = Math.sin(this.animTime * 2) * 0.14;

          this.ears[0].rotation.z = -0.1 + Math.sin(this.animTime * 2) * 0.18;
          this.ears[1].rotation.z = 0.1 - Math.sin(this.animTime * 2) * 0.18;

          this.footstepTimer += delta * animSpeed;
          if (this.footstepTimer > Math.PI) {
            this.footstepTimer = 0;
            sound.playFootstep(this.isSprinting);
            if (this.particles) {
              this.particles.emitDust(this.position);
            }
          }
        } else {
          const breath = Math.sin(this.animTime * 0.8);
          this.body.scale.set(1.0 + breath * 0.02, 1.0 - breath * 0.02, 1.0 + breath * 0.02);
          this.body.position.y = breath * 0.03;
          this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, 0, delta * 8);

          this.leftLeg.rotation.set(0, 0, 0);
          this.rightLeg.rotation.set(0, 0, 0);

          // Tư thế nghỉ đặc trưng theo Vai Trò
          if (this.outfitIndex === 0) {
            // Hộ Vệ: Dựng khiên chắn vững chãi phía trước
            this.leftArm.rotation.set(-0.65, 0.25, 0);
            this.rightArm.rotation.set(-0.45 + breath * 0.04, 0.1, 0);
          } else if (this.outfitIndex === 4) {
            // Xạ Thủ: Tay trái nâng cung nhẹ
            this.leftArm.rotation.set(-0.45, 0.1, 0);
            this.rightArm.rotation.set(-0.35 + breath * 0.04, 0, 0);
          } else if (this.outfitIndex === 5) {
            // 🇻🇳 Chiến Sĩ NAMCAM: Tay bồng súng trường sẵn sàng chiến đấu
            this.rightArm.rotation.set(-0.95 + breath * 0.03, -0.15, 0.08);
            this.leftArm.rotation.set(-0.75 + breath * 0.03, 0.22, 0.12);
          } else {
            this.leftArm.rotation.set(0, 0, Math.sin(this.animTime * 0.8) * 0.06);
            this.rightArm.rotation.set(-0.55 + breath * 0.04, 0.1, 0);
          }

          this.head.rotation.x = 0;
          this.head.rotation.y = Math.sin(this.animTime * 0.4) * 0.12;
          this.head.rotation.z = Math.cos(this.animTime * 0.5) * 0.04;

          this.ears[0].rotation.z = Math.sin(this.animTime * 0.6) * 0.08;
          this.ears[1].rotation.z = -Math.sin(this.animTime * 0.6) * 0.08;
        }
      } else {
        this.leftLeg.rotation.x = -0.55;
        this.rightLeg.rotation.x = -0.55;
        this.leftArm.rotation.x = 2.4;
        this.rightArm.rotation.x = -0.85;
        this.body.rotation.x = -0.18;
        this.head.rotation.x = -0.22;
      }
    }

    // --- HOẠT ẢNH ĐÁNH THƯỜNG RIÊNG BIỆT THEO TỪNG VAI TRÒ ---
    if (this.slashTimer > 0) {
      this.slashTimer -= delta;
      const p = 1.0 - Math.max(0, this.slashTimer) / this.slashDuration;
      const ease = 1.0 - Math.pow(1.0 - p, 3);
      this.rightArm.rotation.y = 0;

      if (this.outfitIndex === 1) {
        // 🗡️ SÁT THỦ: Song Đao Liên Vũ (Tay phải -> Tay trái -> Xoay tròn 360° chém chữ X)
        if (this.slashStep === 0) {
          this.rightArm.rotation.x = -1.45;
          this.rightArm.rotation.z = THREE.MathUtils.lerp(1.5, -1.3, ease);
          this.leftArm.rotation.x = -0.6;
          this.body.rotation.y = THREE.MathUtils.lerp(0.4, -0.4, ease);
        } else if (this.slashStep === 1) {
          this.leftArm.rotation.x = -1.45;
          this.leftArm.rotation.z = THREE.MathUtils.lerp(-1.5, 1.3, ease);
          this.rightArm.rotation.x = -0.6;
          this.body.rotation.y = THREE.MathUtils.lerp(-0.4, 0.4, ease);
        } else {
          // Đòn 3: Xoay 360 độ cắt chữ X bằng cả 2 đoản đao
          this.rightArm.rotation.x = -1.5;
          this.leftArm.rotation.x = -1.5;
          this.rightArm.rotation.z = -0.8;
          this.leftArm.rotation.z = 0.8;
          this.body.rotation.y = ease * Math.PI * 2;
        }
        this.sword.rotation.x = Math.PI - 0.25;
      } else if (this.outfitIndex === 2) {
        // ❄️ PHÁP SƯ: Vung Quyền Trượng Thủy Tinh phóng cầu năng lượng
        this.rightArm.rotation.x = THREE.MathUtils.lerp(-2.1, -1.1, ease);
        this.rightArm.rotation.z = this.slashSide * THREE.MathUtils.lerp(0.6, -0.3, ease);
        this.leftArm.rotation.x = -1.1;
        this.body.rotation.x = THREE.MathUtils.lerp(-0.1, 0.18, ease);
      } else if (this.outfitIndex === 3) {
        // 🔥 ĐẤU SĨ: Bổ Chiến Phủ hạng nặng (Đòn 3 là Bổ Đôi Mặt Đất từ trên đỉnh đầu xuống)
        if (this.slashStep === 2) {
          this.rightArm.rotation.x = THREE.MathUtils.lerp(-2.9, -0.85, ease);
          this.leftArm.rotation.x = THREE.MathUtils.lerp(-2.6, -0.95, ease);
          this.body.rotation.x = THREE.MathUtils.lerp(-0.28, 0.42, ease);
        } else {
          this.rightArm.rotation.x = -1.4;
          this.rightArm.rotation.z = this.slashSide * THREE.MathUtils.lerp(1.6, -1.4, ease);
          this.body.rotation.y = this.slashSide * THREE.MathUtils.lerp(0.45, -0.45, ease);
        }
      } else if (this.outfitIndex === 4) {
        // 🏹 XẠ THỦ: Tay trái giương thẳng Thần Cung, tay phải kéo căng dây cung rồi búng ra
        this.leftArm.rotation.x = -1.52;
        this.leftArm.rotation.y = 0.22;
        this.rightArm.rotation.x = THREE.MathUtils.lerp(-1.55, -0.95, ease);
        this.rightArm.rotation.z = THREE.MathUtils.lerp(0.35, -0.1, ease);
        this.body.rotation.y = -0.32;
      } else if (this.outfitIndex === 5) {
        // 🇻🇳 CHIẾN SĨ NAMCAM: Giương súng trường nhắm bắn & giật nòng (Recoil)
        const recoil = Math.sin(p * Math.PI) * 0.22;
        this.rightArm.rotation.set(-Math.PI / 2 + 0.15 + recoil, -0.15, 0.05);
        this.leftArm.rotation.set(-1.42 + recoil * 0.5, 0.22, 0.25);
        this.body.rotation.x = -recoil * 0.4;
        this.body.rotation.y = -0.08;
      } else {
        // 🛡️ HỘ VỆ (hoặc mặc định): Đòn 1 chém ngang, Đòn 2 thúc khiên trái, Đòn 3 giậm khiên + kiếm
        if (this.slashStep === 1 && this.outfitIndex === 0) {
          // Nhát 2: Thúc mạnh Trọng Khiên ở tay trái về phía trước
          this.leftArm.rotation.x = THREE.MathUtils.lerp(-0.6, -1.65, ease);
          this.leftArm.rotation.z = THREE.MathUtils.lerp(-0.5, 0.35, ease);
          this.body.rotation.y = THREE.MathUtils.lerp(-0.4, 0.35, ease);
        } else if (this.slashStep === 2) {
          this.rightArm.rotation.x = THREE.MathUtils.lerp(-0.3, -1.65, ease);
          this.rightArm.rotation.z = 0;
          this.leftArm.rotation.x = -1.35;
          this.body.rotation.x = THREE.MathUtils.lerp(-0.1, 0.35, ease);
          this.body.rotation.y = THREE.MathUtils.lerp(0.4, -0.15, ease);
        } else {
          this.rightArm.rotation.x = -1.35;
          this.rightArm.rotation.z = this.slashSide * THREE.MathUtils.lerp(1.5, -1.3, ease);
          this.leftArm.rotation.x = -0.85;
          this.body.rotation.y = this.slashSide * THREE.MathUtils.lerp(0.35, -0.35, ease);
        }
        this.sword.rotation.x = Math.PI - 0.25;
      }

      if (this.slashTimer <= 0) {
        this.rightArm.rotation.z = 0;
        this.leftArm.rotation.z = 0;
        this.body.rotation.y = 0;
      }
    } else if (this.isCharging) {
      const c = this.chargeLevel;
      if (this.outfitIndex === 4) {
        // Xạ Thủ giương cung tụ lực Nhất Tiễn Xuyên Tâm
        this.leftArm.rotation.x = -1.55;
        this.rightArm.rotation.x = -1.45 + c * 0.35;
        this.body.rotation.y = -0.35 * c;
      } else {
        this.rightArm.rotation.x = 0.55 + c * 0.25;
        this.rightArm.rotation.y = 0;
        this.rightArm.rotation.z = 0.7;
        this.body.rotation.y = 0.3 * c;
        this.sword.rotation.x = Math.PI - 0.25;
      }
      const pulse = c >= 1 ? 0.5 + 0.5 * Math.sin(this.animTime * 6) : c;
      this.bladeGlowMat.color.setHex(0xfff3b0).lerp(CHARGE_FULL_COLOR, pulse);
      this.auraIntensity = Math.max(this.auraIntensity, 0.3 + 0.6 * c);

      if (this.particles && Math.random() < 0.15 + c * 0.35) {
        this.particles.emitElementalParticles(
          this.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2)),
          1,
          c >= 1 ? [0xffd700, 0xffffff] : [0x00f2fe, 0xffffff],
          [0.5, 1.5],
          0.25,
          0,
          0.4
        );
      }
    } else if (!this.isCasting) {
      this.sword.rotation.x = THREE.MathUtils.lerp(this.sword.rotation.x, Math.PI / 2, delta * 12);
    }

    this.bladeGlowMat.opacity = this.auraIntensity * 0.6;
    this.auraIntensity = Math.max(0, this.auraIntensity - delta * 2.5);

    if (this.isSwordDrawn && !this.isSwordThrown && !this.isCharging && !this.isCasting && this.slashTimer <= 0) {
      this.sheatheTimer -= delta;
      if (this.sheatheTimer <= 0) this.sheatheSword();
    }

    this.body.scale.y = this.squashFactor;
    this.body.scale.x = 1.0 / Math.sqrt(this.squashFactor);
    this.body.scale.z = 1.0 / Math.sqrt(this.squashFactor);
  }
}
