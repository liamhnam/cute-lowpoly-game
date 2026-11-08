import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';
import { BOSS_CONFIGS, BOSS_KITS } from './bosses.js';
import {
  getDragonScalesTexture,
  getCrackedRuneStoneTexture,
  getCarvedJadeTexture,
  getScorpionCarapaceTexture,
  getCelestialSilkTexture,
  getDinoScalesTexture,
} from './textures.js';

// Cấu hình chi tiết 2 nhóm Yêu Ma (QUÁI NHỎ nhanh khó chịu vs QUÁI LỚN chậm nặng nề, sát thương khủng dễ né) & Đại Boss
export const MONSTER_CONFIGS = {
  // =========================================================================
  // NHÓM QUÁI LỚN (LARGE / COLOSSAL BRUTES):
  // - Thân hình đồ sộ (scale 1.38x - 1.44x), máu trâu, bước đi chậm nặng nề
  // - Đánh chậm, khóa hướng khi ra đòn, animation 4 pha có sức nặng (lấy đà lâu -> đập sập -> kẹt vũ khí xuống đất -> rút lên)
  // - Sát thương cực lớn (180 - 245 ST) nhưng có vòng cảnh báo đỏ dài (1.1s - 1.35s) rất dễ né
  // =========================================================================
  golem: {
    name: 'Thái Cổ Cự Thạch Yêu',
    icon: '🗿',
    sizeCategory: 'large',
    modelScale: 1.42,
    maxHp: 920,
    speed: 1.75,
    hitRadius: 3.6,
    hitHeight: 8.8,
    barColor: 0xf39c12,
    flankOffset: 0.0,
    respawnTime: 15.0,
    xpMpReward: 48,
    healReward: 180,
  },
  flame_scorpion: {
    name: 'Thiết Giáp Cự Hạt Vương',
    icon: '🦂',
    sizeCategory: 'large',
    modelScale: 1.38,
    maxHp: 860,
    speed: 1.95,
    hitRadius: 3.5,
    hitHeight: 6.4,
    barColor: 0xff7f50,
    flankOffset: -0.15,
    respawnTime: 14.5,
    xpMpReward: 45,
    healReward: 170,
  },
  jade_guardian: {
    name: 'Thanh Ngọc Cự Thần Sư',
    icon: '🦁',
    sizeCategory: 'large',
    modelScale: 1.40,
    maxHp: 1020,
    speed: 1.88,
    hitRadius: 3.6,
    hitHeight: 8.5,
    barColor: 0x00d2d3,
    flankOffset: 0.1,
    respawnTime: 16.0,
    xpMpReward: 52,
    healReward: 190,
  },

  // =========================================================================
  // NHÓM QUÁI NHỎ (SMALL / AGILE SWARMERS):
  // - Thân hình nhỏ gọn (scale 0.62x - 0.65x), máu ít (185 - 215 HP)
  // - Chạy cực nhanh (5.8 - 6.6), lách zíc-zắc, nhảy chồm, đánh liên hoàn cực nhanh (0.55s - 0.8s CD)
  // - Sát thương nhỏ (14 - 24 ST) nhưng làm chậm nhẹ / rỉa máu liên tục gây khó chịu
  // =========================================================================
  chomper: {
    name: 'Hắc Diễm Tiểu Thú',
    icon: '🦖',
    sizeCategory: 'small',
    modelScale: 0.62,
    maxHp: 215,
    speed: 6.2,
    hitRadius: 1.55,
    hitHeight: 3.4,
    barColor: 0x2ecc71,
    flankOffset: 0.65,
    respawnTime: 7.5,
    xpMpReward: 18,
    healReward: 65,
  },
  fox_mage: {
    name: 'Hồ Hỏa Tiểu Yêu',
    icon: '🦊',
    sizeCategory: 'small',
    modelScale: 0.64,
    maxHp: 185,
    speed: 5.8,
    hitRadius: 1.45,
    hitHeight: 3.2,
    barColor: 0xff6b8b,
    flankOffset: -0.75,
    respawnTime: 8.0,
    xpMpReward: 20,
    healReward: 65,
  },
  sword_wraith: {
    name: 'U Minh Tiểu Quỷ',
    icon: '👻',
    sizeCategory: 'small',
    modelScale: 0.65,
    maxHp: 200,
    speed: 6.6,
    hitRadius: 1.5,
    hitHeight: 3.4,
    barColor: 0xa29bfe,
    flankOffset: 0.95,
    respawnTime: 8.0,
    xpMpReward: 22,
    healReward: 70,
  },

  // =========================================================================
  // ĐẠI BOSS TRẤN THÀNH (WORLD BOSS)
  // =========================================================================
  boss_dragon_emperor: {
    name: 'HẮC LONG MA ĐẾ',
    icon: '🐉',
    isBoss: true,
    sizeCategory: 'boss',
    modelScale: 1.16,
    maxHp: 3800,
    speed: 3.4,
    hitRadius: 4.1,
    hitHeight: 10.2,
    barColor: 0xff3838,
    flankOffset: 0.0,
    respawnTime: 25.0,
    xpMpReward: 100,
    healReward: 600,
    roleIndex: 3,
    enrageText: '🔥 CUỒNG NỘ HUYẾT LONG (PHASE 2)!',
    hint: 'Toàn năng: vừa cận chiến vừa có Thuấn Bộ, Khiên Phản Chấn, Phân Thân & Tia Long Tức. Né theo vòng/vệt cảnh báo!',
  },
};

// Gộp cấu hình 9 Đại Boss mới
Object.assign(MONSTER_CONFIGS, BOSS_CONFIGS);

export class Monster {
  constructor(scene, particles, type = 'golem', spawnPos = new THREE.Vector3(), world = null) {
    this.scene = scene;
    this.particles = particles;
    this.type = MONSTER_CONFIGS[type] ? type : 'golem';
    this.config = MONSTER_CONFIGS[this.type];
    this.isBoss = Boolean(this.config.isBoss);
    this.sizeCategory = this.config.sizeCategory || (this.isBoss ? 'boss' : 'large');
    this.isLarge = this.sizeCategory === 'large' || this.isBoss;
    this.isSmall = this.sizeCategory === 'small';
    this.baseModelScale = this.config.modelScale || 1.0;
    this.name = this.config.name;
    this.world = world;

    this.group = new THREE.Group();
    this.spawnOrigin = spawnPos.clone();
    this.position = spawnPos.clone();
    this.position.y = getTerrainHeight(this.position.x, this.position.z);
    this.group.position.copy(this.position);

    this.maxHp = this.config.maxHp;
    this.hp = this.maxHp;
    this.isDead = false;
    this.respawnTimer = 0;

    // AI & Vận động thông minh
    this.speed = this.config.speed;
    this.rotationY = Math.random() * Math.PI * 2;
    this.walkAnimTime = Math.random() * 10;
    this.stepDustTimer = 0;
    this.hitFlashTimer = 0;
    this.velocity = new THREE.Vector3();
    this.flankSign = Math.random() < 0.5 ? 1 : -1;
    this.strafePhase = Math.random() * Math.PI * 2;

    // Trạng thái chiến đấu & Kỹ năng AI
    this.attackCooldown = this.isSmall ? 0.35 + Math.random() * 0.35 : 1.4 + Math.random() * 0.9;
    this.specialCooldown = this.isSmall ? 1.8 + Math.random() * 1.2 : 3.2 + Math.random() * 1.8;
    this.aiState = 'idle'; // 'idle' | 'windup' | 'charging' | 'leaping' | 'channeling'
    this.stateTimer = 0;
    this.stateDuration = 0;
    this.currentSkillName = '⚡ Sẵn sàng chiến đấu';
    this.chargeDir = new THREE.Vector3();
    this.leapStart = new THREE.Vector3();
    this.leapTarget = new THREE.Vector3();

    // Hệ thống Animation Tấn Công chuyên biệt (nhiều pha: Lấy đà -> Giáng đòn -> Chấn động/Kẹt đất -> Thu thế)
    this.attackAnimType = null;
    this.attackAnimTimer = 0;
    this.attackAnimDuration = 0.6;
    this.attackComboStep = Math.floor(Math.random() * 3);
    this.pendingStrikeCallback = null;
    this.pendingStrikeTriggered = false;
    this.pendingStrikeRatio = 0.45;
    // Cho phép Quái Nhỏ tung đòn liên hoàn nhiều nhịp trong 1 animation
    this.secondaryStrikeCallback = null;
    this.secondaryStrikeTriggered = false;
    this.secondaryStrikeRatio = 0.78;

    // Giai đoạn Cuồng Nộ của Đại Boss
    this.isEnraged = false;
    this.bossSkillCycle = 0;
    this.recentBossSkills = [];     // tránh lặp lại chiêu vừa dùng
    this.guardTimer = 0;            // Hộ Thể Phản Chấn: thời gian còn giữ thế thủ
    this.guardHits = 0;             // số đòn đã đỡ trong thế thủ -> phản chấn
    this.bossShieldMesh = null;
    this.blinkTarget = new THREE.Vector3();
    this.beamDir = new THREE.Vector3();

    // Tạm dừng hồi sinh (vd. khi Đại Boss giáng thế thì quái thường không sinh lại)
    this.respawnPaused = false;

    // Danh sách đạn, vòng cảnh báo, vệt chém 3D, sóng xung kích & bẫy độc
    this.activeEffects = [];

    // Hiệu ứng trạng thái: Đóng băng & Đẩy lùi
    this.isFrozen = false;
    this.freezeTimer = 0;

    // Kích thước va chạm
    this.hitRadius = this.config.hitRadius;
    this.hitHeight = this.config.hitHeight;
    this.damageableMaterials = [];

    // Bộ kỹ năng & tạo hình riêng của 9 Đại Boss mới (xem bosses.js)
    this.kit = BOSS_KITS[this.type] ? new BOSS_KITS[this.type](this) : null;
    this.damageMult = 1;

    this.buildMesh();
    this.buildHealthBar();
    this.buildContactShadow();

    this.scene.add(this.group);
  }

  destroy() {
    if (this.group && this.scene) {
      this.scene.remove(this.group);
    }
    if (this.contactShadow && this.scene) {
      this.scene.remove(this.contactShadow);
    }
    this.clearActiveEffects();
  }

  clearActiveEffects() {
    for (const ef of this.activeEffects) {
      if (ef.mesh && this.scene) {
        this.scene.remove(ef.mesh);
      }
    }
    this.activeEffects = [];
  }

  // Ẩn hoàn toàn & không tự hồi sinh cho tới khi được gọi respawn() (dùng cho Đại Boss chờ giáng thế)
  setDormant() {
    this.isDead = true;
    this.respawnTimer = Infinity;
    this.aiState = 'idle';
    this.attackAnimType = null;
    this.pendingStrikeCallback = null;
    this.secondaryStrikeCallback = null;
    this.clearActiveEffects();
    this.removeBossShield();
    this.group.visible = false;
    if (this.healthBarGroup) this.healthBarGroup.visible = false;
    if (this.contactShadow) this.contactShadow.visible = false;
  }

  // Quái thường tan biến (không tính là bị hạ, không thưởng) & tạm ngưng hồi sinh
  vanish() {
    if (!this.isDead && this.particles) {
      this.particles.emitElementalParticles(
        this.position.clone().add(new THREE.Vector3(0, 2, 0)), 14, [0x8e44ad, 0x2d0a3d, 0xffffff], [1, 3], 0.6, 3.0, 0.6
      );
    }
    this.isDead = true;
    this.respawnPaused = true;
    this.aiState = 'idle';
    this.attackAnimType = null;
    this.pendingStrikeCallback = null;
    this.secondaryStrikeCallback = null;
    this.clearActiveEffects();
    this.group.visible = false;
    if (this.healthBarGroup) this.healthBarGroup.visible = false;
    if (this.contactShadow) this.contactShadow.visible = false;
  }

  // Cho phép hồi sinh lại sau `delay` giây
  resumeRespawn(delay = 1.0) {
    this.respawnPaused = false;
    if (this.isDead) this.respawnTimer = delay;
  }

  // Kích hoạt animation tấn công kèm callback đúng thời điểm ra đòn (impact frame) + hỗ trợ nhịp 2 liên hoàn
  startAttackAnimation(animType, duration = 0.6, impactRatio = 0.45, onImpact = null, secondaryRatio = 0, onSecondaryImpact = null) {
    this.attackAnimType = animType;
    this.attackAnimTimer = 0;
    this.attackAnimDuration = duration;
    this.pendingStrikeRatio = impactRatio;
    this.pendingStrikeCallback = onImpact;
    this.pendingStrikeTriggered = false;
    this.secondaryStrikeRatio = secondaryRatio;
    this.secondaryStrikeCallback = onSecondaryImpact;
    this.secondaryStrikeTriggered = !onSecondaryImpact;
  }

  buildContactShadow() {
    const radius = this.isBoss ? 4.6 : (this.isLarge ? this.hitRadius * 1.05 : this.hitRadius * 0.78);
    const geo = new THREE.CircleGeometry(radius, 22);
    geo.rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: this.isBoss ? 0x2c041c : (this.isLarge ? 0x0b0b12 : 0x151520),
      transparent: true,
      opacity: this.isBoss ? 0.62 : (this.isLarge ? 0.52 : 0.34),
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(geo, this.shadowMat);
    this.scene.add(this.contactShadow);
  }

  buildMesh() {
    this.model = new THREE.Group();
    this.floatingParts = [];

    if (this.type === 'golem') {
      this.buildGolemMesh();
    } else if (this.type === 'chomper') {
      this.buildChomperMesh();
    } else if (this.type === 'fox_mage') {
      this.buildFoxMageMesh();
    } else if (this.type === 'sword_wraith') {
      this.buildSwordWraithMesh();
    } else if (this.type === 'flame_scorpion') {
      this.buildFlameScorpionMesh();
    } else if (this.type === 'jade_guardian') {
      this.buildJadeGuardianMesh();
    } else if (this.type === 'boss_dragon_emperor') {
      this.buildBossDragonEmperorMesh();
    } else if (this.kit) {
      this.kit.buildMesh();
    }

    // Áp dụng tỉ lệ kích thước phân hóa rõ rệt giữa Quái Nhỏ (0.62x) và Quái Lớn (1.42x)
    this.model.scale.setScalar(this.baseModelScale);
    this.group.add(this.model);
  }

  // 1. 🗿 THÁI CỔ THẠCH YÊU (COLOSSAL RUNIC MOSS GOLEM)
  buildGolemMesh() {
    const stoneTex = getCrackedRuneStoneTexture();
    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      color: 0xffffff,
      flatShading: true,
      roughness: 0.88,
      metalness: 0.12,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x3d424d,
      flatShading: true,
      roughness: 0.95
    });
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x4a7c38,
      flatShading: true,
      roughness: 0.9
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e18,
      flatShading: true,
      roughness: 0.85
    });
    const pineLeafMat = new THREE.MeshStandardMaterial({
      color: 0x1e5128,
      flatShading: true,
      roughness: 0.8
    });
    const magmaCoreMat = new THREE.MeshBasicMaterial({ color: 0xf39c12 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    this.damageableMaterials = [stoneMat, darkStoneMat, mossMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 3.2;

    // Lồng ngực cự thạch hùng vĩ
    const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3, 1), stoneMat);
    mainRock.scale.set(1.35, 1.15, 1.15);
    mainRock.castShadow = true;
    this.torso.add(mainRock);

    // Lõi Ma Thạch Thái Cổ phát sáng rực rỡ ở giữa ngực
    const coreCavity = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.4, 6), darkStoneMat);
    coreCavity.position.set(0, 0.4, 1.25);
    coreCavity.rotation.x = Math.PI / 2;
    this.torso.add(coreCavity);

    const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), magmaCoreMat);
    coreCrystal.position.set(0, 0.4, 1.35);
    this.torso.add(coreCrystal);

    // Tảng rêu phong bao phủ vai & sườn
    const mossPatchL = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), mossMat);
    mossPatchL.position.set(0.9, 1.15, 0.3);
    mossPatchL.scale.set(1.0, 0.55, 0.9);
    this.torso.add(mossPatchL);

    const mossPatchR = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), mossMat);
    mossPatchR.position.set(-0.85, 0.95, -0.2);
    mossPatchR.scale.set(0.9, 0.45, 0.8);
    this.torso.add(mossPatchR);

    // Cổ thụ Tùng La Hán mini mọc trên bờ vai đá rêu phong
    const bonsaiTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.2, 5), woodMat);
    bonsaiTrunk.position.set(1.1, 1.75, 0.2);
    bonsaiTrunk.rotation.z = -0.35;
    this.torso.add(bonsaiTrunk);

    for (let b = 0; b < 3; b++) {
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 - b * 0.08, 0), pineLeafMat);
      foliage.position.set(1.4 + b * 0.25, 2.1 + b * 0.15, 0.2 + (b - 1) * 0.2);
      this.torso.add(foliage);
    }

    // Dây leo cổ thụ buông rủ xuống ngực
    for (const vx of [-0.6, 0.5, 0.8]) {
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 1.1, 4), mossMat);
      vine.position.set(vx, 0.1, 1.2);
      vine.rotation.z = vx * 0.2;
      this.torso.add(vine);
    }

    // Đầu thủ linh thạch uy nghiêm
    this.head = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 0), stoneMat);
    this.head.position.set(0, 1.55, 0.55);
    this.head.castShadow = true;
    this.torso.add(this.head);

    // Chân mày đá gồ ghề
    const stoneBrow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.5), darkStoneMat);
    stoneBrow.position.set(0, 1.85, 1.35);
    this.torso.add(stoneBrow);

    // Cặp mắt tinh thể ma thạch vàng phát quang
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.16), eyeMat);
    eyeL.position.set(-0.38, 1.65, 1.5);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.16), eyeMat);
    eyeR.position.set(0.38, 1.65, 1.5);
    this.torso.add(eyeL, eyeR);

    // Chòm râu cằm đá nham thạch
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 5), darkStoneMat);
    beard.position.set(0, 0.95, 1.3);
    beard.rotation.x = 0.3;
    this.torso.add(beard);

    // Đạo Bùa Trấn Thạch Cổ bằng giấy hoàng phù & chu sa đỏ
    const talisman = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.92),
      new THREE.MeshBasicMaterial({ color: 0xffdd59, side: THREE.DoubleSide })
    );
    talisman.position.set(0, 1.95, 1.68);
    talisman.rotation.x = -0.15;
    this.torso.add(talisman);

    const runeCinnabar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.58),
      new THREE.MeshBasicMaterial({ color: 0xee5253, side: THREE.DoubleSide })
    );
    runeCinnabar.position.set(0, 1.95, 1.69);
    runeCinnabar.rotation.x = -0.15;
    this.torso.add(runeCinnabar);

    // TAY TRÁI (Khớp đá khối, cẳng tay gồ ghề & bàn tay nắm đấm có ngón rõ nét)
    this.armL = new THREE.Group();
    this.armL.position.set(-2.4, 0.8, 0);

    const shoulderL = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), stoneMat);
    this.armL.add(shoulderL);

    const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 1.1), stoneMat);
    armLMesh.position.y = -1.0;
    armLMesh.castShadow = true;
    this.armL.add(armLMesh);

    // Nắm đấm cự thạch có ngón tay đá
    const fistL = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.9, 1.25), darkStoneMat);
    fistL.position.y = -2.1;
    this.armL.add(fistL);
    for (let f = 0; f < 3; f++) {
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.35), darkStoneMat);
      knuckle.position.set(-0.35 + f * 0.35, -2.55, 0.25);
      this.armL.add(knuckle);
    }
    this.torso.add(this.armL);

    // TAY PHẢI
    this.armR = new THREE.Group();
    this.armR.position.set(2.4, 0.8, 0);

    const shoulderR = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), stoneMat);
    this.armR.add(shoulderR);

    const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 1.1), stoneMat);
    armRMesh.position.y = -1.0;
    armRMesh.castShadow = true;
    this.armR.add(armRMesh);

    const fistR = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.9, 1.25), darkStoneMat);
    fistR.position.y = -2.1;
    this.armR.add(fistR);
    for (let f = 0; f < 3; f++) {
      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.35), darkStoneMat);
      knuckle.position.set(-0.35 + f * 0.35, -2.55, 0.25);
      this.armR.add(knuckle);
    }
    this.torso.add(this.armR);

    this.model.add(this.torso);

    // CHÂN TRÁI (Trụ đá kiên cố có giáp gối & bàn chân có móng đá)
    this.legL = new THREE.Group();
    this.legL.position.set(-1.25, 1.8, 0);

    const legLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 2.2, 6), stoneMat);
    legLMesh.position.y = -0.3;
    legLMesh.castShadow = true;
    this.legL.add(legLMesh);

    const kneeL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), darkStoneMat);
    kneeL.position.set(0, -0.1, 0.75);
    this.legL.add(kneeL);

    const footL = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 1.7), darkStoneMat);
    footL.position.set(0, -1.35, 0.25);
    this.legL.add(footL);
    this.model.add(this.legL);

    // CHÂN PHẢI
    this.legR = new THREE.Group();
    this.legR.position.set(1.25, 1.8, 0);

    const legRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 2.2, 6), stoneMat);
    legRMesh.position.y = -0.3;
    legRMesh.castShadow = true;
    this.legR.add(legRMesh);

    const kneeR = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), darkStoneMat);
    kneeR.position.set(0, -0.1, 0.75);
    this.legR.add(kneeR);

    const footR = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 1.7), darkStoneMat);
    footR.position.set(0, -1.35, 0.25);
    this.legR.add(footR);
    this.model.add(this.legR);
  }

  // 2. 🦖 HẮC DIỄM LINH THÚ (KING CHOMPER - T-REX DRAGON BEAST)
  buildChomperMesh() {
    const dinoTex = getDinoScalesTexture();
    const dinoMat = new THREE.MeshStandardMaterial({
      map: dinoTex,
      color: 0xffffff,
      flatShading: true,
      roughness: 0.65
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0xf39c12,
      flatShading: true,
      roughness: 0.75
    });
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.8,
      roughness: 0.25,
      flatShading: true
    });
    const rubyMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
    const fangMat = new THREE.MeshStandardMaterial({ color: 0xfffff0, roughness: 0.3 });
    const tongueMat = new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.5 });
    const darkClawMat = new THREE.MeshStandardMaterial({ color: 0x1e1e24, roughness: 0.4 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const eyeSparkle = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.damageableMaterials = [dinoMat, bellyMat, crownMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 2.8;

    // Thân khủng long tròn trịa dễ thương với vảy sọc tím cam
    const dinoBody = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3, 1), dinoMat);
    dinoBody.scale.set(1.15, 1.25, 1.35);
    dinoBody.castShadow = true;
    this.torso.add(dinoBody);

    // Bụng mỡ màu cam kem có ngấn sọc
    const belly = new THREE.Mesh(new THREE.DodecahedronGeometry(1.65, 1), bellyMat);
    belly.position.set(0, -0.35, 1.15);
    belly.scale.set(0.92, 1.12, 0.65);
    this.torso.add(belly);

    // Dãy gai vây lưng xương rồng (Dorsal Spine Plates)
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.1, 5), crownMat);
      spike.position.set(0, 1.35 - i * 0.55, -1.15 - i * 0.38);
      spike.rotation.x = -0.65;
      this.torso.add(spike);
    }

    // ĐẦU THỦ & HÀM RĂNG (Head & Ferocious Cute Jaws)
    this.head = new THREE.Group();
    this.head.position.set(0, 1.85, 0.85);

    const headUpper = new THREE.Mesh(new THREE.DodecahedronGeometry(1.65, 1), dinoMat);
    headUpper.scale.set(1.05, 1.0, 1.2);
    headUpper.castShadow = true;
    this.head.add(headUpper);

    // Mũi và lỗ mũi rồng
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), darkClawMat);
      nostril.position.set(side * 0.32, 0.2, 1.95);
      this.head.add(nostril);
    }

    // Hàm dưới mở to với lưỡi đỏ & răng nanh sắc nhọn
    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.6), dinoMat);
    lowerJaw.position.set(0, -0.75, 0.85);
    lowerJaw.rotation.x = 0.18;
    this.head.add(lowerJaw);

    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 1.1), tongueMat);
    tongue.position.set(0, -0.55, 0.85);
    this.head.add(tongue);

    // 10 Răng nanh nhọn hoắt đan xen (Interlocking Ivory Fangs)
    for (let t = 0; t < 5; t++) {
      const fangUpperL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 4), fangMat);
      fangUpperL.position.set(-0.65, -0.55, 0.4 + t * 0.3);
      fangUpperL.rotation.x = Math.PI;
      this.head.add(fangUpperL);

      const fangUpperR = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 4), fangMat);
      fangUpperR.position.set(0.65, -0.55, 0.4 + t * 0.3);
      fangUpperR.rotation.x = Math.PI;
      this.head.add(fangUpperR);
    }

    // Vương miện hoàng kim 5 cánh nạm ngọc Ruby
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 0.3, 6), crownMat);
    crownBase.position.set(0, 1.65, 0);
    this.head.add(crownBase);

    for (let c = 0; c < 5; c++) {
      const ca = (c / 5) * Math.PI * 2;
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 4), crownMat);
      point.position.set(Math.sin(ca) * 0.7, 1.95, Math.cos(ca) * 0.7);
      this.head.add(point);
    }
    const crownJewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), rubyMat);
    crownJewel.position.set(0, 1.75, 0.72);
    this.head.add(crownJewel);

    // Mắt to tròn long lanh có đốm sáng trắng
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eyeWhite.position.set(side * 0.95, 0.42, 1.05);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), eyeMat);
      eye.position.set(side * 1.02, 0.44, 1.15);

      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), eyeSparkle);
      spark.position.set(side * 1.06, 0.52, 1.28);
      this.head.add(eyeWhite, eye, spark);
    }
    this.torso.add(this.head);

    // 2 TAY NHỎ ĐẶC TRƯNG KHỦNG LONG BẠO CHÚA (Tiny Articulated Raptor Arms)
    for (const side of [-1, 1]) {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * 1.15, -0.1, 1.35);

      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.65, 5), dinoMat);
      upperArm.rotation.x = Math.PI / 3;
      armGroup.add(upperArm);

      const claw1 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), darkClawMat);
      claw1.position.set(side * 0.08, -0.3, 0.35);
      claw1.rotation.x = Math.PI / 2;
      const claw2 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), darkClawMat);
      claw2.position.set(-side * 0.08, -0.3, 0.35);
      claw2.rotation.x = Math.PI / 2;
      armGroup.add(claw1, claw2);

      this.torso.add(armGroup);
    }

    // ĐUÔI KHỦNG LONG CÓ CHÙY GAI XƯƠNG (Thagomizer Tail)
    this.tail = new THREE.Group();
    this.tail.position.set(0, -0.6, -2.1);

    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.8, 6), dinoMat);
    tailMesh.rotation.x = -Math.PI / 2.3;
    tailMesh.position.z = -1.1;
    this.tail.add(tailMesh);

    // 4 Cọc gai xương nhọn hoắt ở chóp đuôi
    for (let s = 0; s < 4; s++) {
      const sa = (s / 4) * Math.PI * 2;
      const thag = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 4), crownMat);
      thag.position.set(Math.sin(sa) * 0.45, Math.cos(sa) * 0.45, -2.2);
      thag.rotation.z = Math.sin(sa) * 0.8;
      this.tail.add(thag);
    }
    this.torso.add(this.tail);

    this.model.add(this.torso);

    // CHÂN TRÁI (Bắp đùi khủng long lực lưỡng & 3 móng vuốt chim ưng)
    this.legL = new THREE.Group();
    this.legL.position.set(-1.25, 1.4, 0.2);

    const thighL = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), dinoMat);
    thighL.scale.set(0.95, 1.35, 1.15);
    thighL.castShadow = true;
    this.legL.add(thighL);

    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 1.4), darkClawMat);
    footL.position.set(0, -1.05, 0.35);
    this.legL.add(footL);

    for (let c = -1; c <= 1; c++) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), darkClawMat);
      talon.position.set(c * 0.32, -1.1, 1.1);
      talon.rotation.x = Math.PI / 2;
      this.legL.add(talon);
    }
    this.model.add(this.legL);

    // CHÂN PHẢI
    this.legR = new THREE.Group();
    this.legR.position.set(1.25, 1.4, 0.2);

    const thighR = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), dinoMat);
    thighR.scale.set(0.95, 1.35, 1.15);
    thighR.castShadow = true;
    this.legR.add(thighR);

    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 1.4), darkClawMat);
    footR.position.set(0, -1.05, 0.35);
    this.legR.add(footR);

    for (let c = -1; c <= 1; c++) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), darkClawMat);
      talon.position.set(c * 0.32, -1.1, 1.1);
      talon.rotation.x = Math.PI / 2;
      this.legR.add(talon);
    }
    this.model.add(this.legR);
  }

  // 3. 🦊 CỬU VĨ HỒ YÊU (NINE-TAILED CELESTIAL FOX MAGE)
  buildFoxMageMesh() {
    const silkTex = getCelestialSilkTexture('fox');
    const whiteFurMat = new THREE.MeshStandardMaterial({ color: 0xfff0f6, flatShading: true, roughness: 0.6 });
    const robeMat = new THREE.MeshStandardMaterial({
      map: silkTex,
      color: 0xffffff,
      flatShading: true,
      roughness: 0.5
    });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff6b8b, flatShading: true, roughness: 0.65 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd32a, metalness: 0.75, roughness: 0.25, flatShading: true });
    const maskMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.35 });
    const orbMat = new THREE.MeshBasicMaterial({ color: 0xff4757 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xa55eea });
    const eyeSparkle = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.4 });
    this.damageableMaterials = [whiteFurMat, robeMat, pinkMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 2.4;

    // Thân áo lụa pháp y hoa lệ thêu họa tiết hoa đào & mây ngũ sắc
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.25, 2.4, 8), robeMat);
    bodyMesh.castShadow = true;
    this.torso.add(bodyMesh);

    // Đai thắt lưng Obi lụa hồng cánh sen
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.96, 0.52, 8), pinkMat);
    sash.position.y = 0.22;
    this.torso.add(sash);

    // Nơ bướm đại cát sau lưng kèm ngọc bội
    const bowCenter = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), goldMat);
    bowCenter.position.set(0, 0.25, -0.92);
    this.torso.add(bowCenter);
    for (const side of [-1, 1]) {
      const bowWing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.12), pinkMat);
      bowWing.position.set(side * 0.32, 0.35, -0.92);
      bowWing.rotation.z = side * 0.35;
      this.torso.add(bowWing);

      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.06), pinkMat);
      ribbon.position.set(side * 0.18, -0.22, -0.92);
      ribbon.rotation.z = side * 0.15;
      this.torso.add(ribbon);
    }

    // Vòng cổ lụa đỏ đeo chuông vàng linh thiêng
    const choker = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 12), pinkMat);
    choker.position.set(0, 1.25, 0.1);
    choker.rotation.x = Math.PI / 2;
    this.torso.add(choker);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), goldMat);
    bell.position.set(0, 1.15, 0.65);
    this.torso.add(bell);

    // ĐẦU THỦ CỬU VĨ HỒ (Sleek Beautiful Fox Head)
    this.head = new THREE.Group();
    this.head.position.set(0, 1.68, 0.22);

    const headBase = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), whiteFurMat);
    headBase.castShadow = true;
    this.head.add(headBase);

    // Mõm hồ ly thon gọn với chóp mũi đen & ria mép tinh tế
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 6), whiteFurMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.08, 0.95);
    this.head.add(snout);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), noseMat);
    nose.position.set(0, -0.05, 1.48);
    this.head.add(nose);

    // Ấn Ký Hồ Tộc chu sa đỏ rực trên trán
    const mark = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), orbMat);
    mark.position.set(0, 0.42, 0.88);
    mark.rotation.x = -0.25;
    this.head.add(mark);

    // Mắt phượng hồ ly có viền kẻ chu sa & đốm sáng
    for (const side of [-1, 1]) {
      const eyeliner = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), pinkMat);
      eyeliner.position.set(side * 0.45, 0.16, 0.82);
      eyeliner.rotation.z = -side * 0.32;
      this.head.add(eyeliner);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeMat);
      eye.position.set(side * 0.42, 0.16, 0.86);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeSparkle);
      spark.position.set(side * 0.45, 0.2, 0.96);
      this.head.add(eye, spark);

      // Đôi tai hồ ly dựng cao có lông tơ hồng bên trong
      const earGroup = new THREE.Group();
      earGroup.position.set(side * 0.55, 0.95, 0);
      earGroup.rotation.z = -side * 0.25;

      const earOuter = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.25, 5), whiteFurMat);
      earGroup.add(earOuter);

      const earInner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 4), pinkMat);
      earInner.position.set(0, -0.05, 0.1);
      earGroup.add(earInner);

      this.head.add(earGroup);
    }

    // Mặt nạ Hồ Ly (Kitsune Mask) cách điệu đeo nghiêng bên tai
    const maskGroup = new THREE.Group();
    maskGroup.position.set(0.72, 0.65, 0.35);
    maskGroup.rotation.set(-0.2, 0.6, -0.3);

    const maskFace = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.75, 5), maskMat);
    maskFace.rotation.x = Math.PI / 2;
    maskGroup.add(maskFace);

    const maskEarL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), pinkMat);
    maskEarL.position.set(-0.2, 0.35, -0.1);
    const maskEarR = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), pinkMat);
    maskEarR.position.set(0.2, 0.35, -0.1);
    maskGroup.add(maskEarL, maskEarR);

    const maskTassel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.45, 4), pinkMat);
    maskTassel.position.set(0, -0.4, 0);
    maskGroup.add(maskTassel);

    this.head.add(maskGroup);
    this.torso.add(this.head);

    // 9 ĐUÔI HỒ LY BỒNG BỀNH TUYỆT ĐẸP (9 Lush Animated Tails)
    this.tailGroup = new THREE.Group();
    this.tailGroup.position.set(0, -0.28, -0.92);
    this.foxTails = [];
    for (let i = 0; i < 9; i++) {
      const angle = ((i - 4) / 4) * 1.35;
      const tailPivot = new THREE.Group();
      tailPivot.userData.baseZ = angle;
      tailPivot.userData.baseX = -0.52 - Math.abs(i - 4) * 0.08;
      tailPivot.rotation.z = tailPivot.userData.baseZ;
      tailPivot.rotation.x = tailPivot.userData.baseX;

      // Đoạn gốc đuôi bồng bềnh
      const tailMain = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.5, 7), whiteFurMat);
      tailMain.position.y = 1.15;
      tailMain.castShadow = true;

      // Ngọn đuôi chu sa chuyển sắc hồng
      const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 7), pinkMat);
      tailTip.position.y = 2.25;

      tailPivot.add(tailMain, tailTip);
      this.tailGroup.add(tailPivot);
      this.foxTails.push(tailPivot);
    }
    this.torso.add(this.tailGroup);

    // PHÁP BẢO HỒ HỎA LINH CHÂU (Floating Celestial Fox-Fire Orb)
    this.foxOrb = new THREE.Group();
    this.foxOrb.position.set(0, 0.75, 1.65);

    const coreOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), orbMat);
    const ringOrb1 = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.06, 6, 16), goldMat);
    const ringOrb2 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.04, 6, 16), pinkMat);
    ringOrb2.rotation.x = Math.PI / 3;

    // 3 Hạt ngọc Magatama câu ngọc bay xung quanh linh châu
    for (let m = 0; m < 3; m++) {
      const ma = (m / 3) * Math.PI * 2;
      const magatama = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 4), goldMat);
      magatama.position.set(Math.cos(ma) * 0.85, Math.sin(ma) * 0.85, 0);
      magatama.rotation.z = ma + Math.PI / 2;
      this.foxOrb.add(magatama);
    }

    this.foxOrb.add(coreOrb, ringOrb1, ringOrb2);
    this.torso.add(this.foxOrb);
    this.floatingParts.push(this.foxOrb);

    // TAY ÁO RỘNG THƯỢNG THẦN (Flowing Kimono Sleeves)
    this.armL = new THREE.Group();
    this.armL.position.set(-1.05, 0.65, 0.2);
    const sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.35, 0.75), robeMat);
    sleeveL.position.set(-0.15, -0.35, 0);
    const pawL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), whiteFurMat);
    pawL.position.set(-0.1, -0.95, 0.15);
    this.armL.add(sleeveL, pawL);
    this.torso.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(1.05, 0.65, 0.2);
    const sleeveR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.35, 0.75), robeMat);
    sleeveR.position.set(0.15, -0.35, 0);
    const pawR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), whiteFurMat);
    pawR.position.set(0.1, -0.95, 0.15);
    this.armR.add(sleeveR, pawR);
    this.torso.add(this.armR);

    this.model.add(this.torso);

    // CHÂN HỒ TIÊN
    this.legL = new THREE.Group();
    this.legL.position.set(-0.45, 0.9, 0);
    this.legL.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 1.25, 6), whiteFurMat));
    this.model.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(0.45, 0.9, 0);
    this.legR.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 1.25, 6), whiteFurMat));
    this.model.add(this.legR);
  }

  // 4. 👻 U MINH KIẾM LINH (SPECTRAL SWORD WRAITH)
  buildSwordWraithMesh() {
    const cloakTex = getCelestialSilkTexture('wraith');
    const cloakMat = new THREE.MeshStandardMaterial({
      map: cloakTex,
      color: 0xffffff,
      flatShading: true,
      roughness: 0.75
    });
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x3d375e, flatShading: true, roughness: 0.6 });
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x00d2d3 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2ed573 });
    const maskMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.85, roughness: 0.2 });
    const darkStrawMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, flatShading: true, roughness: 0.9 });
    this.damageableMaterials = [cloakMat, innerMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 2.7;

    // Áo choàng u hồn rách xơ xác bay lượn phập phồng
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.4, 8), cloakMat);
    cloak.position.y = -0.25;
    cloak.castShadow = true;
    this.torso.add(cloak);

    // Vạt áo tưa rách bay theo gió
    for (let f = 0; f < 5; f++) {
      const fa = (f / 5) * Math.PI * 2;
      const tatter = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 4), innerMat);
      tatter.position.set(Math.sin(fa) * 1.35, -1.6, Math.cos(fa) * 1.35);
      tatter.rotation.x = Math.PI;
      this.torso.add(tatter);
    }

    // Giáp ngực U Hồn khắc phù văn bảo vệ
    const chestArmor = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), innerMat);
    chestArmor.position.set(0, 0.55, 0.1);
    this.torso.add(chestArmor);

    // ĐẦU THỦ & MẶT NẠ SÁT THỦ (Hood, Jingasa Hat & Noh Mask)
    this.head = new THREE.Group();
    this.head.position.set(0, 1.55, 0.1);

    const voidHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 1), new THREE.MeshBasicMaterial({ color: 0x0d0d14 }));
    this.head.add(voidHead);

    // Mặt nạ tuồng cổ rạn nứt bí ẩn (Cracked Porcelain Mask)
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.2), maskMat);
    mask.position.set(0, 0.05, 0.48);
    this.head.add(mask);

    // Mắt U Hồn xanh ngọc bích phát quang xuyên qua mặt nạ
    for (const side of [-1, 1]) {
      const eyeSlot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.1), eyeMat);
      eyeSlot.position.set(side * 0.22, 0.12, 0.56);
      this.head.add(eyeSlot);
    }

    // Nón tơi kiếm khách cổ phong (Jingasa Straw Hat)
    const hat = new THREE.Mesh(new THREE.ConeGeometry(1.85, 0.55, 12), darkStrawMat);
    hat.position.y = 0.52;
    hat.castShadow = true;
    this.head.add(hat);

    // Đỉnh chóp nón bọc đồng vàng
    const hatSpire = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 6), goldMat);
    hatSpire.position.y = 0.85;
    this.head.add(hatSpire);

    // Bùa U Minh trấn yểm rủ xuống trước vành nón
    const talisman = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.65), new THREE.MeshBasicMaterial({ color: 0x00d2d3, side: THREE.DoubleSide }));
    talisman.position.set(0, 0.18, 1.6);
    this.head.add(talisman);

    this.torso.add(this.head);

    // 3 THANH KIẾM HỘ THỂ CHU THIÊN XOAY QUANH (Orbiting Spirit Swords)
    this.orbitSwords = new THREE.Group();
    this.orbitSwords.position.y = 0.6;
    this.orbitSwordNodes = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const swGroup = new THREE.Group();
      swGroup.userData.baseAngle = angle;
      swGroup.position.set(Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1);

      // Thân kiếm thanh quang tỏa sáng
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 0.05), bladeMat);

      // Đốc kiếm hoa sen vàng
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.18), goldMat);
      guard.position.y = -0.85;

      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6), darkStrawMat);
      hilt.position.y = -1.15;

      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), goldMat);
      pommel.position.y = -1.45;

      // Kiếm hoa lụa đỏ U Minh
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xff4757 }));
      tassel.position.set(0, -1.75, 0);

      swGroup.add(blade, guard, hilt, pommel, tassel);
      swGroup.rotation.z = 0.25;
      this.orbitSwords.add(swGroup);
      this.orbitSwordNodes.push(swGroup);
    }
    this.torso.add(this.orbitSwords);

    // TAY TRÁI (Áo choàng u hồn)
    this.armL = new THREE.Group();
    this.armL.position.set(-1.15, 0.5, 0.3);
    const sleeveL = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.4, 6), cloakMat);
    sleeveL.rotation.z = 0.35;
    this.armL.add(sleeveL);
    this.torso.add(this.armL);

    // TAY PHẢI CẦM THANH LONG BẢO KIẾM (Holding Legendary Dragon Jian)
    this.armR = new THREE.Group();
    this.armR.position.set(1.15, 0.5, 0.3);

    const mainSwordGroup = new THREE.Group();
    mainSwordGroup.position.set(0, -0.4, 0.9);
    mainSwordGroup.rotation.x = Math.PI / 2.2;

    const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 0.07), bladeMat);
    const mainGuard = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.22), goldMat);
    mainGuard.position.y = -1.0;
    const mainHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6), darkStrawMat);
    mainHilt.position.y = -1.35;
    const mainPommel = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), goldMat);
    mainPommel.position.y = -1.75;
    const swordTassel = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 4), new THREE.MeshBasicMaterial({ color: 0xff4757 }));
    swordTassel.position.set(0, -2.15, 0);

    mainSwordGroup.add(mainBlade, mainGuard, mainHilt, mainPommel, swordTassel);
    this.armR.add(mainSwordGroup);
    this.torso.add(this.armR);

    this.model.add(this.torso);

    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.model.add(this.legL, this.legR);
  }

  // 5. 🦂 XÍCH DIỄM HẠT VƯƠNG (FLAME SCORPION KING - PHÁO KÍCH ĐỘC DỊCH)
  buildFlameScorpionMesh() {
    const shellMat = new THREE.MeshStandardMaterial({
      map: getScorpionCarapaceTexture(),
      color: 0xb33939,
      flatShading: true,
      roughness: 0.45,
      metalness: 0.3,
    });
    const darkChitinMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b2e,
      flatShading: true,
      roughness: 0.6,
      metalness: 0.35,
    });
    const goldChitinMat = new THREE.MeshStandardMaterial({
      color: 0xffa502,
      flatShading: true,
      roughness: 0.3,
      metalness: 0.7,
    });
    const magmaGlowMat = new THREE.MeshBasicMaterial({ color: 0xff4757 });
    const venomGlowMat = new THREE.MeshBasicMaterial({ color: 0x2ed573 });
    this.damageableMaterials = [shellMat, darkChitinMat, goldChitinMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 1.65;

    // Giáp thân chính (Cephalothorax / Prosoma) dạng vòm gồ ghề
    const thorax = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 1), shellMat);
    thorax.scale.set(1.2, 0.72, 1.55);
    thorax.castShadow = true;
    this.torso.add(thorax);

    // 3 phiến giáp lưng xếp lớp (Dorsal Tergite Plates) với gai sống lưng
    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.8 - i * 0.25, 0.28, 0.65), darkChitinMat);
      plate.position.set(0, 0.48 - i * 0.04, 0.3 - i * 0.65);
      plate.rotation.x = -0.15;
      this.torso.add(plate);

      const dorsalSpine = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 4), goldChitinMat);
      dorsalSpine.position.set(0, 0.72 - i * 0.04, 0.3 - i * 0.65);
      dorsalSpine.rotation.x = -0.25;
      this.torso.add(dorsalSpine);

      // Khe nứt dung nham phát sáng bên hông giáp
      for (const side of [-1, 1]) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.4), magmaGlowMat);
        vent.position.set(side * (0.95 - i * 0.1), 0.35, 0.3 - i * 0.65);
        this.torso.add(vent);
      }
    }

    // Đầu & Cụm mắt đa giác quan (Head & Chelicerae)
    this.head = new THREE.Group();
    this.head.position.set(0, 0.25, 1.65);

    const face = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), darkChitinMat);
    face.scale.set(1.1, 0.85, 1.0);
    this.head.add(face);

    // Mũ sừng giáp đầu
    const browPlate = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.75, 4), goldChitinMat);
    browPlate.position.set(0, 0.48, 0.35);
    browPlate.rotation.x = 0.55;
    this.head.add(browPlate);

    // 2 mắt chính độc quang phát sáng rực rỡ + 4 mắt phụ
    for (const side of [-1, 1]) {
      const mainEye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), venomGlowMat);
      mainEye.position.set(side * 0.42, 0.28, 0.75);
      this.head.add(mainEye);

      const subEye1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), venomGlowMat);
      subEye1.position.set(side * 0.65, 0.22, 0.55);
      const subEye2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), magmaGlowMat);
      subEye2.position.set(side * 0.28, 0.42, 0.62);
      this.head.add(subEye1, subEye2);

      // Cặp hàm nhai kìm phụ (Chelicerae Fangs) sắc lẹm
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 5), goldChitinMat);
      fang.position.set(side * 0.32, -0.32, 0.85);
      fang.rotation.x = 0.85;
      fang.rotation.z = -side * 0.35;
      this.head.add(fang);
    }
    this.torso.add(this.head);

    // Càng trái & càng phải khổng lồ (Articulated Dual Guillotine Claws)
    const buildScorpionClaw = (side) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * 1.65, 0.1, 1.4);

      // Cánh tay bắp thịt giáp cứng (Pedipalp Base)
      const humerus = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.1, 6), darkChitinMat);
      humerus.rotation.z = -side * 0.75;
      humerus.position.set(side * 0.45, 0.1, 0.2);
      armGroup.add(humerus);

      const elbowSpike = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 4), goldChitinMat);
      elbowSpike.position.set(side * 0.85, 0.25, 0.2);
      elbowSpike.rotation.z = -side * 1.1;
      armGroup.add(elbowSpike);

      // Thân càng chính (Chela Palm)
      const clawPalm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), shellMat);
      clawPalm.scale.set(0.85, 0.65, 1.45);
      clawPalm.position.set(side * 0.8, 0.15, 0.95);
      clawPalm.castShadow = true;
      armGroup.add(clawPalm);

      // Ngàm kẹp cố định (Fixed Finger) với răng cưa
      const fixedFinger = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.35, 5), shellMat);
      fixedFinger.position.set(side * 0.95, 0.18, 1.95);
      fixedFinger.rotation.x = Math.PI / 2;
      fixedFinger.rotation.y = side * 0.25;
      armGroup.add(fixedFinger);

      // Ngàm kẹp di động (Movable Dactyl)
      const movableFinger = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.25, 5), goldChitinMat);
      movableFinger.position.set(side * 0.55, 0.18, 1.9);
      movableFinger.rotation.x = Math.PI / 2;
      movableFinger.rotation.y = -side * 0.35;
      armGroup.add(movableFinger);

      // Hàng răng cưa kẹp xương (Serrated Teeth)
      for (let t = 0; t < 4; t++) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), goldChitinMat);
        tooth.position.set(side * 0.85, 0.18, 1.45 + t * 0.28);
        tooth.rotation.z = -side * Math.PI / 2;
        armGroup.add(tooth);
      }

      // Đỉnh ngàm đẫm nọc độc phát sáng
      const venomTip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 5), venomGlowMat);
      venomTip.position.set(side * 0.95, 0.18, 2.55);
      venomTip.rotation.x = Math.PI / 2;
      armGroup.add(venomTip);

      return armGroup;
    };

    this.armL = buildScorpionClaw(-1);
    this.torso.add(this.armL);

    this.armR = buildScorpionClaw(1);
    this.torso.add(this.armR);

    // Đuôi bò cạp 5 đốt hoàng kim & ngòi độc kép (5-Segment Metasoma & Stinger)
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.4, -1.9);

    const segPositions = [
      [0, 0.35, -0.35, 0.58],
      [0, 1.05, -0.65, 0.52],
      [0, 1.85, -0.55, 0.48],
      [0, 2.65, 0.05, 0.44],
      [0, 3.15, 0.85, 0.40],
    ];

    for (let i = 0; i < segPositions.length; i++) {
      const [sx, sy, sz, radius] = segPositions[i];
      const segMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), shellMat);
      segMesh.scale.set(1.0, 1.15, 1.1);
      segMesh.position.set(sx, sy, sz);
      this.tail.add(segMesh);

      // Gai sống lưng trên mỗi đốt đuôi
      const segSpike = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.35, radius * 0.85, 4), goldChitinMat);
      segSpike.position.set(sx, sy + radius * 0.75, sz - radius * 0.3);
      segSpike.rotation.x = -0.55;
      this.tail.add(segSpike);
    }

    // Túi nọc độc phồng to (Venom Bulb / Ampulla)
    const venomBulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), darkChitinMat);
    venomBulb.scale.set(0.9, 1.25, 1.1);
    venomBulb.position.set(0, 3.25, 1.35);
    this.tail.add(venomBulb);

    // Ngòi độc chính uốn cong nhọn hoắt hướng về phía trước (Aculeus)
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.45, 6), venomGlowMat);
    stinger.position.set(0, 3.05, 2.05);
    stinger.rotation.x = Math.PI / 1.85;
    this.tail.add(stinger);

    // Móc ngạnh độc phụ (Secondary Poison Barb)
    const subBarb = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 4), magmaGlowMat);
    subBarb.position.set(0, 2.75, 1.85);
    subBarb.rotation.x = Math.PI / 1.5;
    this.tail.add(subBarb);

    this.torso.add(this.tail);
    this.model.add(this.torso);

    // 6 Chân bò cạp khớp đa tầng (6 Articulated Walking Legs)
    this.legL = new THREE.Group();
    this.legL.position.set(-1.45, 0.85, 0);
    this.legR = new THREE.Group();
    this.legR.position.set(1.45, 0.85, 0);

    const legAngles = [0.35, 0, -0.35];
    for (let i = 0; i < 3; i++) {
      const zOffset = (i - 1) * 0.95;
      const angle = legAngles[i];

      // Chân trái
      const lCoxa = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.05, 5), darkChitinMat);
      lCoxa.position.set(-0.45, 0.15, zOffset);
      lCoxa.rotation.z = 0.75;
      lCoxa.rotation.y = angle;
      this.legL.add(lCoxa);

      const lTibia = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.25, 5), shellMat);
      lTibia.position.set(-0.95, -0.45, zOffset);
      lTibia.rotation.z = -0.65;
      lTibia.rotation.y = angle;
      this.legL.add(lTibia);

      const lClaw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 4), goldChitinMat);
      lClaw.position.set(-1.35, -0.95, zOffset);
      lClaw.rotation.z = 0.25;
      this.legL.add(lClaw);

      // Chân phải
      const rCoxa = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.05, 5), darkChitinMat);
      rCoxa.position.set(0.45, 0.15, zOffset);
      rCoxa.rotation.z = -0.75;
      rCoxa.rotation.y = -angle;
      this.legR.add(rCoxa);

      const rTibia = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.25, 5), shellMat);
      rTibia.position.set(0.95, -0.45, zOffset);
      rTibia.rotation.z = 0.65;
      rTibia.rotation.y = -angle;
      this.legR.add(rTibia);

      const rClaw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 4), goldChitinMat);
      rClaw.position.set(1.35, -0.95, zOffset);
      rClaw.rotation.z = -0.25;
      this.legR.add(rClaw);
    }
    this.model.add(this.legL, this.legR);
  }

  // 6. 🦁 THANH NGỌC THẦN SƯ (JADE GUARDIAN LION - HỘ ĐIỆN TINH ANH)
  buildJadeGuardianMesh() {
    const jadeMat = new THREE.MeshStandardMaterial({
      map: getCarvedJadeTexture(),
      color: 0x1dd1a1,
      flatShading: true,
      roughness: 0.28,
      metalness: 0.15,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd32a,
      flatShading: true,
      roughness: 0.22,
      metalness: 0.85,
    });
    const iceGlowMat = new THREE.MeshBasicMaterial({ color: 0x48dbfb });
    const silkRedMat = new THREE.MeshStandardMaterial({
      color: 0xee5253,
      flatShading: true,
      roughness: 0.5,
    });
    const ivoryMat = new THREE.MeshStandardMaterial({
      color: 0xf7f1e3,
      flatShading: true,
      roughness: 0.35,
    });
    this.damageableMaterials = [jadeMat, goldMat, silkRedMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 2.9;

    // Thân sư tử ngọc uy nghiêm (Muscular Arched Imperial Lion Body)
    const lionBody = new THREE.Mesh(new THREE.DodecahedronGeometry(2.1, 1), jadeMat);
    lionBody.scale.set(1.2, 1.1, 1.45);
    lionBody.castShadow = true;
    this.torso.add(lionBody);

    // Đai yếm thắt ngực hoàng gia & lục lạc vàng (Imperial Chest Harness & Bell)
    const harness = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.14, 6, 16), silkRedMat);
    harness.position.set(0, 0.2, 0.75);
    harness.rotation.x = Math.PI / 2.8;
    this.torso.add(harness);

    const bronzeBell = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), goldMat);
    bronzeBell.position.set(0, -0.45, 1.55);
    this.torso.add(bronzeBell);

    const bellRings = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 4, 12), goldMat);
    bellRings.position.set(0, -0.78, 1.55);
    this.torso.add(bellRings);

    // Pháp Luân Hộ Thể Kim Liên (Golden Lotus Halo)
    this.guardianHalo = new THREE.Group();
    this.guardianHalo.position.set(0, 1.1, -0.4);

    const haloRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 8, 24), goldMat);
    this.guardianHalo.add(haloRing);

    // 8 Cánh Sen Vàng tỏa sáng quanh pháp luân
    for (let p = 0; p < 8; p++) {
      const angle = (p / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.95, 4), goldMat);
      petal.position.set(Math.cos(angle) * 2.2, Math.sin(angle) * 2.2, 0);
      petal.rotation.z = angle - Math.PI / 2;
      this.guardianHalo.add(petal);

      // Hạt minh châu băng hàn tỏa sáng ở chóp cánh sen
      const pearlPetal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), iceGlowMat);
      pearlPetal.position.set(Math.cos(angle) * 2.7, Math.sin(angle) * 2.7, 0);
      this.guardianHalo.add(pearlPetal);
    }
    this.torso.add(this.guardianHalo);

    // Đầu Sư Tử Hoàng Gia & Bờm 16 Xoắn Ốc Thần Thánh (Head & 16 Mane Rosettes)
    this.head = new THREE.Group();
    this.head.position.set(0, 1.45, 1.45);

    // 16 Xoắn bờm ốc (Traditional Snail-Curl Mane Rosettes)
    const maneGroup = new THREE.Group();
    for (let m = 0; m < 16; m++) {
      const angle = (m / 16) * Math.PI * 2;
      const maneRosette = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), goldMat);
      const radius = 1.35 + (m % 2) * 0.2;
      maneRosette.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.9, -0.35 + (m % 3) * 0.15);
      maneRosette.rotation.set(angle, 0.5, m * 0.2);
      maneGroup.add(maneRosette);
    }
    this.head.add(maneGroup);

    // Khuôn mặt ngọc uy dũng
    const face = new THREE.Mesh(new THREE.DodecahedronGeometry(1.18, 0), jadeMat);
    face.position.z = 0.45;
    this.head.add(face);

    // Sừng ngọc hộ pháp / miện kim vương trên trán
    const hornCrest = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.25, 5), goldMat);
    hornCrest.position.set(0, 1.15, 0.55);
    hornCrest.rotation.x = -0.35;
    this.head.add(hornCrest);

    // Mõm sư tử há rộng gầm thét (Roaring Snout & Jaws)
    const upperJaw = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.45, 0.85), jadeMat);
    upperJaw.position.set(0, 0.15, 1.25);
    this.head.add(upperJaw);

    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.35, 0.75), jadeMat);
    lowerJaw.position.set(0, -0.45, 1.15);
    lowerJaw.rotation.x = 0.25;
    this.head.add(lowerJaw);

    // 4 Răng nanh ngà voi cong vút (Ivory Fangs)
    for (const side of [-1, 1]) {
      const upperFang = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 4), ivoryMat);
      upperFang.position.set(side * 0.38, -0.1, 1.45);
      upperFang.rotation.x = Math.PI;
      this.head.add(upperFang);

      const lowerFang = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 4), ivoryMat);
      lowerFang.position.set(side * 0.32, -0.32, 1.4);
      this.head.add(lowerFang);

      // Tai sư tử vểnh uy nghiêm
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 4), goldMat);
      ear.position.set(side * 1.05, 1.05, 0.15);
      ear.rotation.z = -side * 0.65;
      this.head.add(ear);

      // Đôi mắt băng ngọc thần quang
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), iceGlowMat);
      eye.position.set(side * 0.48, 0.35, 1.25);
      this.head.add(eye);
    }

    // Minh Châu Thần Khí (Spinning Frost Pearl in Mouth)
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), iceGlowMat);
    pearl.position.set(0, -0.15, 1.35);
    this.head.add(pearl);

    this.torso.add(this.head);

    // Đuôi Sư Tử ngọc uốn lượn chùm lửa vàng (Curled Flame Tuft Tail)
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.5, -2.2);

    const tailStem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 1.6, 6), jadeMat);
    tailStem.rotation.x = -0.85;
    this.tail.add(tailStem);

    const tailTuft = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.85, 6), goldMat);
    tailTuft.position.set(0, 0.95, -0.85);
    tailTuft.rotation.x = -1.35;
    this.tail.add(tailTuft);
    this.torso.add(this.tail);

    // Chân trước trái & phải (Forelegs with Gold Flame Tassels)
    const buildForeleg = (side, hasBall) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(side * 1.35, -0.6, 1.1);

      const legColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 1.9, 8), jadeMat);
      legColumn.castShadow = true;
      legGroup.add(legColumn);

      // Cánh hoa lửa vàng ở khuỷu chân (Flame Knee Guard)
      const flameGuard = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.95, 4), goldMat);
      flameGuard.position.set(side * 0.35, 0.45, -0.2);
      flameGuard.rotation.x = -0.55;
      flameGuard.rotation.z = side * 0.45;
      legGroup.add(flameGuard);

      // Bàn chân 4 móng vuốt vàng kim
      const paw = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 1.05), jadeMat);
      paw.position.set(0, -0.85, 0.25);
      legGroup.add(paw);

      for (let c = -1; c <= 2; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 4), goldMat);
        claw.position.set((c - 0.5) * 0.25, -0.85, 0.85);
        claw.rotation.x = Math.PI / 2.2;
        legGroup.add(claw);
      }

      // Quả Tú Cầu Hoàng Cung (Embroidered Silk Ball under right front paw)
      if (hasBall) {
        const xiuQiu = new THREE.Group();
        xiuQiu.position.set(0, -0.85, 0.95);
        const ballCore = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 12), silkRedMat);
        const ballRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.07, 6, 16), goldMat);
        const ballRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.07, 6, 16), goldMat);
        ballRing2.rotation.y = Math.PI / 2;
        xiuQiu.add(ballCore, ballRing1, ballRing2);
        legGroup.add(xiuQiu);
      }

      return legGroup;
    };

    this.armL = buildForeleg(-1, false);
    this.torso.add(this.armL);

    this.armR = buildForeleg(1, true); // Chân phải dẫm Tú Cầu trấn trạch
    this.torso.add(this.armR);

    this.model.add(this.torso);

    // 2 Chân sau (Hind Legs)
    const buildHindLeg = (side) => {
      const hGroup = new THREE.Group();
      hGroup.position.set(side * 1.25, 1.3, -1.1);

      const thigh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), jadeMat);
      thigh.scale.set(0.95, 1.35, 1.15);
      hGroup.add(thigh);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.9, 7), jadeMat);
      shin.position.set(0, -0.9, 0.1);
      shin.castShadow = true;
      hGroup.add(shin);

      const hindPaw = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 0.95), jadeMat);
      hindPaw.position.set(0, -1.8, 0.35);
      hGroup.add(hindPaw);

      for (let c = -1; c <= 2; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.38, 4), goldMat);
        claw.position.set((c - 0.5) * 0.22, -1.8, 0.85);
        claw.rotation.x = Math.PI / 2.2;
        hGroup.add(claw);
      }
      return hGroup;
    };

    this.legL = buildHindLeg(-1);
    this.model.add(this.legL);

    this.legR = buildHindLeg(1);
    this.model.add(this.legR);
  }

  // 7. 🐉 ĐẠI BOSS TRẤN THÀNH: HẮC LONG MA ĐẾ (WORLD BOSS)
  buildBossDragonEmperorMesh() {
    const obsidianMat = new THREE.MeshStandardMaterial({
      map: getDragonScalesTexture(),
      color: 0x1e1b2e,
      flatShading: true,
      roughness: 0.38,
      metalness: 0.55,
    });
    const crimsonSilkMat = new THREE.MeshStandardMaterial({
      map: getCelestialSilkTexture('crimson'),
      color: 0x8b0000,
      flatShading: true,
      roughness: 0.45,
    });
    const imperialGoldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      flatShading: true,
      roughness: 0.22,
      metalness: 0.92,
    });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff3838 });
    const flameGlowMat = new THREE.MeshBasicMaterial({ color: 0xff9f43 });
    this.damageableMaterials = [obsidianMat, crimsonSilkMat, imperialGoldMat];

    // Trận đồ Hắc Long Ma Quang dưới đất (Multi-Ring Ground Magic Circle)
    this.bossAuraRing = new THREE.Group();
    this.bossAuraRing.position.y = 0.08;

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(3.6, 4.3, 32),
      new THREE.MeshBasicMaterial({ color: 0xff3838, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    outerRing.rotateX(-Math.PI / 2);

    const innerRunes = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 2.9, 12),
      new THREE.MeshBasicMaterial({ color: 0xff9f43, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    innerRunes.rotateX(-Math.PI / 2);

    const innerStar = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.9, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    innerStar.rotateX(-Math.PI / 2);
    this.bossAuraRing.add(outerRing, innerRunes, innerStar);
    this.model.add(this.bossAuraRing);

    // Thân rồng ma đế đồ sộ (Massive Dragon Emperor Body)
    this.torso = new THREE.Group();
    this.torso.position.y = 4.6;

    const chest = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), obsidianMat);
    chest.scale.set(1.25, 1.35, 0.95);
    chest.castShadow = true;
    this.torso.add(chest);

    // Phù điêu Long Phù đầu rồng vàng ngậm châu trước ngực (Imperial Dragon Emblem on Chest)
    const chestDragon = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), imperialGoldMat);
    chestDragon.scale.set(1.2, 0.85, 0.9);
    chestDragon.position.set(0, 0.45, 1.05);
    this.torso.add(chestDragon);

    const chestOrb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), flameGlowMat);
    chestOrb.position.set(0, 0.25, 1.55);
    this.torso.add(chestOrb);

    for (const side of [-1, 1]) {
      const dragonFang = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), imperialGoldMat);
      dragonFang.position.set(side * 0.35, 0.12, 1.5);
      dragonFang.rotation.x = Math.PI;
      this.torso.add(dragonFang);
    }

    // Long bào hạ thân xếp lớp màu huyết dụ thêu vân mây (Crimson Silk Imperial Robe Lower)
    const robeLower = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.9, 3.4, 8), crimsonSilkMat);
    robeLower.position.y = -2.1;
    robeLower.castShadow = true;
    this.torso.add(robeLower);

    // Đai ngọc rồng hoàng kim (Imperial Dragon Jade Belt)
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.65, 8), imperialGoldMat);
    belt.position.y = -0.75;
    this.torso.add(belt);

    const beltBuckle = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), flameGlowMat);
    beltBuckle.position.set(0, -0.75, 2.25);
    this.torso.add(beltBuckle);

    // Giáp vai Đầu Rồng đôi bên (Dragon Head Shoulder Pauldrons)
    for (const side of [-1, 1]) {
      const pauldron = new THREE.Group();
      pauldron.position.set(side * 2.8, 1.4, 0);

      const dragonShoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35, 0), imperialGoldMat);
      dragonShoulder.scale.set(1.2, 0.85, 1.1);
      pauldron.add(dragonShoulder);

      const pauldronEye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), flameMat);
      pauldronEye.position.set(side * 0.5, 0.2, 0.95);
      pauldron.add(pauldronEye);

      // Cặp sừng rồng rực lửa trên vai
      const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 5), flameMat);
      horn1.position.set(side * 0.45, 1.1, 0);
      horn1.rotation.z = -side * 0.65;
      pauldron.add(horn1);

      const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.1, 4), imperialGoldMat);
      horn2.position.set(side * 0.25, 0.85, -0.45);
      horn2.rotation.z = -side * 0.85;
      horn2.rotation.x = -0.4;
      pauldron.add(horn2);

      this.torso.add(pauldron);
    }

    // Đầu Ma Đế & Thập Nhị Miện Miện Lưu Hoàng Cung (Head & 12-Bead Imperial Crown)
    this.head = new THREE.Group();
    this.head.position.set(0, 2.75, 0.35);

    // Chiến khôi rồng đen
    const helm = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35, 1), obsidianMat);
    helm.castShadow = true;
    this.head.add(helm);

    // Mũ Miện Hoàng Gia (Imperial Mianguan Crown)
    const crownBoard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 2.8), imperialGoldMat);
    crownBoard.position.y = 1.65;
    crownBoard.rotation.x = 0.12;
    this.head.add(crownBoard);

    // Chuỗi ngọc miện lưu trước & sau (Hanging Beaded Curtains)
    for (let b = -3; b <= 3; b++) {
      const beadStrandFront = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 4), flameGlowMat);
      beadStrandFront.position.set(b * 0.28, 1.25, 1.4);
      this.head.add(beadStrandFront);

      const beadStrandBack = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 4), imperialGoldMat);
      beadStrandBack.position.set(b * 0.28, 1.25, -1.35);
      this.head.add(beadStrandBack);
    }

    // Sừng Rồng Hoàng Kim Phân Nhánh (Branching Golden Dragon Antlers)
    for (const side of [-1, 1]) {
      const mainAntler = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 6), imperialGoldMat);
      mainAntler.position.set(side * 1.1, 1.75, -0.2);
      mainAntler.rotation.z = -side * 0.55;
      mainAntler.rotation.x = -0.3;
      this.head.add(mainAntler);

      const branchAntler = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.25, 5), imperialGoldMat);
      branchAntler.position.set(side * 1.65, 2.15, -0.4);
      branchAntler.rotation.z = -side * 0.95;
      branchAntler.rotation.x = -0.55;
      this.head.add(branchAntler);

      // Đôi mắt Huyết Ma Long rực lửa
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.18), flameMat);
      eye.position.set(side * 0.48, 0.18, 1.25);
      eye.rotation.z = -side * 0.2;
      this.head.add(eye);

      // Râu Rồng uốn lượn phong trần (Dragon Whiskers)
      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 1.6, 5), imperialGoldMat);
      whisker.position.set(side * 0.75, -0.45, 1.15);
      whisker.rotation.z = -side * 0.35;
      whisker.rotation.x = 0.35;
      this.head.add(whisker);
    }
    this.torso.add(this.head);

    // Cánh Rồng Huyết Quỷ 3 Tầng Xương (Articulated Multi-Segment Draconic Wings)
    const buildDragonWing = (side) => {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(side * 1.2, 1.4, -1.2);

      // 4 Nan xương rồng vàng & màng cánh huyết sắc
      for (let i = 0; i < 4; i++) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 3.8 - i * 0.5, 5), imperialGoldMat);
        strut.position.set(side * (1.4 + i * 0.8), 0.7 - i * 0.35, 0);
        strut.rotation.z = -side * (1.1 + i * 0.25);
        wingGroup.add(strut);

        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.6 - i * 0.55, 4), crimsonSilkMat);
        feather.position.set(side * (1.5 + i * 0.85), 0.6 - i * 0.35, -0.05);
        feather.rotation.z = -side * (1.1 + i * 0.25);
        wingGroup.add(feather);

        // Móng vuốt nhọn ở đầu nan cánh
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), flameGlowMat);
        claw.position.set(side * (2.8 + i * 0.95), 1.6 - i * 0.2, 0);
        claw.rotation.z = -side * 1.6;
        wingGroup.add(claw);
      }
      return wingGroup;
    };

    this.wingL = buildDragonWing(-1);
    this.wingR = buildDragonWing(1);
    this.torso.add(this.wingL, this.wingR);

    // Cửu Long Hộ Thể Thần Hoàn (Nine-Dragon Flaming Back Halo)
    this.bossHalo = new THREE.Group();
    this.bossHalo.position.set(0, 1.5, -1.55);

    const haloTorus = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.16, 8, 28), imperialGoldMat);
    this.bossHalo.add(haloTorus);

    // 8 Viên Hỏa Long Châu quay quanh quang hoàn
    for (let h = 0; h < 8; h++) {
      const hAngle = (h / 8) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), flameMat);
      orb.position.set(Math.cos(hAngle) * 3.4, Math.sin(hAngle) * 3.4, 0);
      this.bossHalo.add(orb);
    }
    this.torso.add(this.bossHalo);

    // Cánh tay trái bọc giáp vảy rồng (Left Arm)
    this.armL = new THREE.Group();
    this.armL.position.set(-2.9, 0.7, 0.3);
    const armLMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), obsidianMat);
    armLMesh.scale.set(0.85, 1.75, 0.85);
    this.armL.add(armLMesh);

    // Móng vuốt rồng bàn tay trái
    for (let c = -1; c <= 2; c++) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), imperialGoldMat);
      talon.position.set((c - 0.5) * 0.25, -1.65, 0.35);
      talon.rotation.x = Math.PI / 2.2;
      this.armL.add(talon);
    }
    this.torso.add(this.armL);

    // Cánh tay phải cầm Phương Thiên Họa Kích (Right Arm & Dragon Halberd)
    this.armR = new THREE.Group();
    this.armR.position.set(2.9, 0.7, 0.3);
    const armRMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), obsidianMat);
    armRMesh.scale.set(0.85, 1.75, 0.85);
    this.armR.add(armRMesh);

    for (let c = -1; c <= 2; c++) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), imperialGoldMat);
      talon.position.set((c - 0.5) * 0.25, -1.65, 0.35);
      talon.rotation.x = Math.PI / 2.2;
      this.armR.add(talon);
    }

    // 7.2m Phương Thiên Họa Kích Hắc Long (Heaven-Piercing Dragon Halberd)
    this.halberdGroup = new THREE.Group();
    this.halberdGroup.position.set(0, -1.2, 1.2);
    this.halberdGroup.rotation.x = Math.PI / 3;

    // Cán kích hoàng kim chạm khắc rồng cuộn
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7.2, 8), imperialGoldMat);
    this.halberdGroup.add(shaft);

    // Đầu rồng ngậm mũi kích (Dragon Head Socket)
    const socketDragon = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), imperialGoldMat);
    socketDragon.position.y = 3.3;
    this.halberdGroup.add(socketDragon);

    // Mũi kích chính thương kiếm 2 lưỡi (Main Spearhead Blade)
    const bladeMain = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.6, 4), flameMat);
    bladeMain.position.y = 4.7;
    this.halberdGroup.add(bladeMain);

    // Lưỡi liềm Nguyệt Nha Kích 2 bên đối xứng (Dual Crescent Moon Cleaver Blades)
    for (const side of [-1, 1]) {
      const crescent = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.14), flameMat);
      crescent.position.set(side * 0.75, 3.4, 0);
      crescent.rotation.z = side * 0.35;
      this.halberdGroup.add(crescent);

      const crescentSpike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 4), imperialGoldMat);
      crescentSpike.position.set(side * 1.5, 3.8, 0);
      crescentSpike.rotation.z = side * 1.1;
      this.halberdGroup.add(crescentSpike);
    }

    // Dải lụa chiến kỳ đỏ thắm phấp phới dưới mũi kích (Crimson Battle Pennant)
    const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.45, 4), crimsonSilkMat);
    pennant.position.set(0, 2.6, -0.3);
    pennant.rotation.x = -0.55;
    this.halberdGroup.add(pennant);

    this.armR.add(this.halberdGroup);
    this.torso.add(this.armR);
    this.model.add(this.torso);

    // 2 Chân Ma Đế vững như bàn thạch (Heavy Scale Greaves with Dragon Knee Cops)
    this.legL = new THREE.Group();
    this.legL.position.set(-1.1, 1.6, 0);
    const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.3, 1.15), obsidianMat);
    legLMesh.castShadow = true;
    this.legL.add(legLMesh);

    const kneeL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), imperialGoldMat);
    kneeL.position.set(0, 0.45, 0.65);
    this.legL.add(kneeL);
    this.model.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(1.1, 1.6, 0);
    const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.3, 1.15), obsidianMat);
    legRMesh.castShadow = true;
    this.legR.add(legRMesh);

    const kneeR = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), imperialGoldMat);
    kneeR.position.set(0, 0.45, 0.65);
    this.legR.add(kneeR);
    this.model.add(this.legR);
  }

  buildHealthBar() {
    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.y = this.hitHeight + (this.isBoss ? 1.4 : (this.isLarge ? 1.05 : 0.55));

    const barWidth = this.isBoss ? 5.6 : (this.isLarge ? 4.2 : 2.15);
    const barHeight = this.isBoss ? 0.52 : (this.isLarge ? 0.44 : 0.28);
    this.barInnerWidth = barWidth - 0.18;

    // Viền vàng kim nổi bật cho Quái Lớn (Cự Yêu) & Đại Boss
    if (this.isLarge) {
      const borderMat = new THREE.MeshBasicMaterial({
        color: this.isBoss ? 0xff4757 : 0xfbbf24,
        transparent: true,
        opacity: 0.9,
      });
      const borderMesh = new THREE.Mesh(new THREE.PlaneGeometry(barWidth + 0.12, barHeight + 0.1), borderMat);
      borderMesh.position.z = -0.01;
      this.healthBarGroup.add(borderMesh);
    }

    const bgMat = new THREE.MeshBasicMaterial({ color: 0x181824, transparent: true, opacity: 0.85 });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, barHeight), bgMat);
    this.healthBarGroup.add(bgMesh);

    this.barMat = new THREE.MeshBasicMaterial({ color: this.config.barColor });
    this.barMesh = new THREE.Mesh(new THREE.PlaneGeometry(this.barInnerWidth, barHeight - 0.1), this.barMat);
    this.barMesh.position.z = 0.01;
    this.healthBarGroup.add(this.barMesh);

    this.group.add(this.healthBarGroup);
  }

  checkCollision(bulletPos, bulletRadius) {
    const dx = bulletPos.x - this.position.x;
    const dz = bulletPos.z - this.position.z;
    const horizDistSq = dx * dx + dz * dz;
    const maxRadius = this.hitRadius + bulletRadius;

    if (horizDistSq <= maxRadius * maxRadius) {
      if (bulletPos.y >= this.position.y - 0.5 && bulletPos.y <= this.position.y + this.hitHeight + 0.5) {
        return true;
      }
    }
    return false;
  }

  takeDamage(amount, hitPos) {
    if (this.isDead) return;
    // Đang Thuấn Bộ (tàng hình giữa không gian) thì không trúng đòn
    if (this.aiState === 'blinking') return;

    let finalAmount = amount;
    // Cơ chế riêng của từng Boss (giáp trước/lõi sau, bay lượn bất khả xâm phạm, khiên băng...)
    if (this.kit) {
      if (!this.model.visible) return; // đang độn thổ / thuấn bộ
      finalAmount = this.kit.modifyDamage(amount, hitPos);
      if (!(finalAmount > 0)) return;
    }

    if (this.type === 'jade_guardian' && hitPos) {
      const toHit = new THREE.Vector3().subVectors(hitPos, this.position).normalize();
      const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
      if (forward.dot(toHit) > 0.35) {
        finalAmount = Math.max(1, Math.round(amount * 0.65));
      }
    }

    // Đại Boss đang Hộ Thể Phản Chấn: chỉ nhận 15% sát thương và tích lực phản đòn
    if (this.isBoss && this.guardTimer > 0) {
      finalAmount = Math.max(1, Math.round(finalAmount * 0.15));
      this.guardHits++;
      if (this.particles && hitPos) {
        this.particles.emitHitSparkles(hitPos.clone ? hitPos.clone() : this.position.clone(), 6);
      }
    }

    this.hp = Math.max(0, this.hp - finalAmount);
    this.hitFlashTimer = 0.18;
    this.whiteFlashTimer = 0.07; // Bước 1 - Chớp TRẮNG vài khung hình ngay lúc trúng, sau đó ửng đỏ
    // Quái nhỏ bị giật lùi mạnh khi trúng đòn, quái lớn chỉ nhúc nhích nhẹ vì sức nặng
    if (this.torso && !this.attackAnimType) {
      this.torso.position.z -= this.isSmall ? 0.42 : 0.12;
    }

    if (this.isBoss && !this.isEnraged && this.hp > 0 && this.hp <= this.maxHp * 0.5) {
      this.isEnraged = true;
      this.speed = this.config.speed * 1.35;
      this.currentSkillName = this.config.enrageText || '🔥 CUỒNG NỘ HUYẾT LONG (PHASE 2)!';
      if (this.kit?.onEnrage) this.kit.onEnrage();
      this.model.scale.setScalar(this.baseModelScale * 1.12);
      if (this.particles) {
        this.particles.emitShockwave(this.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 0xff1e1e, 16.0, 0.7);
        this.particles.emitElementalParticles(
          this.position.clone().add(new THREE.Vector3(0, 3.5, 0)),
          45,
          [0xff1e1e, 0xffd32a, 0xffffff],
          [3, 9],
          1.2,
          9.0,
          1.2
        );
      }
      if (this.onBossEnrage) {
        this.onBossEnrage(this);
      }
    }

    const hpRatio = Math.max(0, this.hp / this.maxHp);
    this.barMesh.scale.x = Math.max(0.0001, hpRatio);
    this.barMesh.position.x = -(1.0 - hpRatio) * (this.barInnerWidth * 0.5);

    if (hpRatio < 0.3) {
      this.barMat.color.setHex(0xe74c3c);
    } else if (hpRatio < 0.6) {
      this.barMat.color.setHex(0xf39c12);
    }

    if (this.hp <= 0) {
      // Boss có thể có cơ chế không chết lần đầu (vd. U Minh Quỷ Vương hồi sinh)
      if (this.kit?.onLethal && this.kit.onLethal()) return;
      this.die();
    }
  }

  freeze(duration = 2.6) {
    if (this.isDead) return;
    const actualDuration = this.isBoss ? duration * 0.35 : (this.isLarge ? duration * 0.75 : duration);
    this.isFrozen = true;
    this.freezeTimer = Math.max(this.freezeTimer, actualDuration);
    this.hitFlashTimer = 0.3;
    if (this.particles) {
      this.particles.emitElementalParticles(
        this.position.clone().add(new THREE.Vector3(0, 2, 0)),
        16,
        [0x7ed6df, 0xffffff, 0x48dbfb],
        [2, 5],
        0.8,
        2.0,
        1.0
      );
    }
  }

  knockback(fromPos, force = 12) {
    if (this.isDead) return;
    // Quái Lớn nặng nề kháng đẩy lùi rất cao (0.28), trong khi Quái Nhỏ nhẹ cân bị đánh văng xa (1.35)
    const resist = this.isBoss ? 0.18 : (this.isLarge ? 0.28 : 1.35);
    const actualForce = force * resist;
    const dir = new THREE.Vector3().subVectors(this.position, fromPos);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(1, 0, 0);
    dir.normalize();
    this.velocity.x += dir.x * actualForce;
    this.velocity.z += dir.z * actualForce;
    this.velocity.y += actualForce * (this.isSmall ? 0.45 : 0.18);
    if (this.torso && !this.attackAnimType) this.torso.position.z -= this.isSmall ? 0.55 : 0.2;
  }

  die() {
    this.isDead = true;
    this.aiState = 'idle';
    this.attackAnimType = null;
    this.pendingStrikeCallback = null;
    this.secondaryStrikeCallback = null;
    this.respawnTimer = this.config.respawnTime;
    this.popTimer = 0;      // Bonus - phồng lên rồi NỔ BỤP như bong bóng
    this.popped = false;
    this.clearActiveEffects();
    this.removeBossShield();
    this.guardTimer = 0;
    this.model.visible = true;
    sound.playMonsterDefeated();
    this.particles.emitMonsterDefeat(this.position.clone().add(new THREE.Vector3(0, 3, 0)));

    if (this.world && this.isLarge) {
      const debrisColor = this.isBoss ? 0xc0392b : (this.type === 'jade_guardian' ? 0x1dd1a1 : (this.type === 'flame_scorpion' ? 0xb33939 : 0x7f8c8d));
      const rockMat = new THREE.MeshStandardMaterial({ color: debrisColor, flatShading: true, roughness: 0.8 });
      const count = this.isBoss ? 12 : 7;
      for (let i = 0; i < count; i++) {
        const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 + Math.random() * 0.65, 0), rockMat);
        chunk.position.copy(this.position);
        chunk.position.y += 1.5 + Math.random() * 2.5;
        chunk.castShadow = true;
        const dir = new THREE.Vector3((Math.random() - 0.5) * 2, 0.9, (Math.random() - 0.5) * 2).normalize();
        this.world.addDebris(chunk, dir, 8 + Math.random() * 6, 20, 4.2, 0.52);
      }
    }

    if (this.onDefeated) {
      this.onDefeated(this);
    }
  }

  respawn() {
    this.isDead = false;
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.aiState = 'idle';
    this.attackAnimType = null;
    this.pendingStrikeCallback = null;
    this.secondaryStrikeCallback = null;
    this.isEnraged = false;
    this.speed = this.config.speed;
    this.velocity.set(0, 0, 0);
    this.hp = this.maxHp;
    this.barMesh.scale.x = 1.0;
    this.barMesh.position.x = 0;
    this.barMat.color.setHex(this.config.barColor);
    this.currentSkillName = '⚡ Sẵn sàng chiến đấu';

    if (this.isBoss) {
      this.position.copy(this.spawnOrigin);
    } else {
      const angle = Math.random() * Math.PI * 2;
      const offset = 5 + Math.random() * 9;
      this.position.x = THREE.MathUtils.clamp(this.spawnOrigin.x + Math.cos(angle) * offset, -110, 110);
      this.position.z = THREE.MathUtils.clamp(this.spawnOrigin.z + Math.sin(angle) * offset, -110, 110);
    }
    this.position.y = getTerrainHeight(this.position.x, this.position.z);
    this.group.position.copy(this.position);

    this.model.scale.setScalar(this.baseModelScale);
    this.model.rotation.set(0, 0, 0);
    this.model.visible = true;
    this.group.visible = true;
    this.healthBarGroup.visible = true;
    if (this.contactShadow) this.contactShadow.visible = true;
    this.guardTimer = 0;
    this.guardHits = 0;
    this.removeBossShield();
    this.recentBossSkills = [];

    sound.playMonsterRoar();
    this.particles.emitHitSparkles(this.position.clone().add(new THREE.Vector3(0, 2, 0)), 15);
  }

  // =========================================================================
  // HIỆU ỨNG CHẤN ĐỘNG MẶT ĐẤT HẠNG NẶNG (HEAVY GROUND IMPACT), VỆT CHÉM & CẢNH BÁO
  // =========================================================================

  // Hiệu ứng sức nặng ngàn cân khi Quái Lớn giáng đòn xuống đất: đá văng 3D + sóng xung kích + bụi + rung chấn
  emitHeavyGroundImpact(impactPos, radius = 5.5, colorHex = 0xffa502, debrisCount = 5, player = null) {
    const groundY = getTerrainHeight(impactPos.x, impactPos.z);
    const center = new THREE.Vector3(impactPos.x, groundY + 0.25, impactPos.z);

    sound.playExplosion?.();
    if (this.particles) {
      this.particles.emitShockwave(center, colorHex, radius * 1.15, 0.55);
      this.particles.emitElementalParticles(
        center.clone().add(new THREE.Vector3(0, 0.6, 0)),
        26,
        [colorHex, 0xffd32a, 0x7f8c8d, 0xffffff],
        [2.5, 6.5],
        0.95,
        5.5,
        0.85
      );
      for (let i = 0; i < 4; i++) {
        this.particles.emitDust(center.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius * 0.7, 0, (Math.random() - 0.5) * radius * 0.7)));
      }
    }

    if (this.world && debrisCount > 0) {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x636e72, flatShading: true, roughness: 0.9 });
      for (let i = 0; i < debrisCount; i++) {
        const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 + Math.random() * 0.45, 0), rockMat);
        chunk.position.copy(center);
        chunk.castShadow = true;
        const a = (i / debrisCount) * Math.PI * 2 + Math.random() * 0.5;
        const dir = new THREE.Vector3(Math.cos(a) * 0.85, 0.95 + Math.random() * 0.35, Math.sin(a) * 0.85).normalize();
        this.world.addDebris(chunk, dir, 6.5 + Math.random() * 5.5, 22, 2.8, 0.45);
      }
    }

    // Rung màn hình theo khoảng cách để người chơi cảm nhận rõ sức nặng đòn đập của Quái Lớn dù đã né được
    if (player && player.pixelFX?.controller) {
      const d = Math.hypot(player.position.x - impactPos.x, player.position.z - impactPos.z);
      if (d < 26) {
        const shake = Math.max(0.08, (1.0 - d / 26) * 0.32);
        player.pixelFX.controller.addTrauma(shake);
      }
    }
  }

  // Tạo vệt chém 3D (Slash Arc / Claw Swipe) hiển thị quỹ đạo vung vũ khí của quái & Boss
  spawnSlashArc(radius = 3.2, colorHex = 0xff4757, tiltZ = 0.0, heightOffset = 2.0, duration = 0.28) {
    const arcGroup = new THREE.Group();
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    arcGroup.position.copy(this.position).add(new THREE.Vector3(forward.x * 1.4, heightOffset, forward.z * 1.4));
    arcGroup.rotation.y = this.rotationY;
    arcGroup.rotation.z = tiltZ;

    const arcMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const arcGeo = new THREE.RingGeometry(radius * 0.62, radius, 20, 1, -Math.PI * 0.45, Math.PI * 0.9);
    arcGeo.rotateX(-Math.PI / 2);
    arcGeo.rotateY(-Math.PI / 2);
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcGroup.add(arcMesh);

    this.scene.add(arcGroup);
    this.activeEffects.push({
      kind: 'slash_arc',
      mesh: arcGroup,
      mat: arcMat,
      elapsed: 0,
      duration,
    });
  }

  spawnTelegraphAOE(centerPos, radius, delay, colorHex, onTrigger) {
    const group = new THREE.Group();
    const groundY = getTerrainHeight(centerPos.x, centerPos.z) + 0.08;
    group.position.set(centerPos.x, groundY, centerPos.z);

    const outerMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(radius * 0.9, radius, 32), outerMat);
    outerRing.rotateX(-Math.PI / 2);

    const innerBorderMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(radius * 0.85, radius * 0.9, 32), innerBorderMat);
    innerRing.rotateX(-Math.PI / 2);

    const fillMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const fillDisk = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), fillMat);
    fillDisk.rotateX(-Math.PI / 2);
    fillDisk.scale.set(0.05, 0.05, 1);

    group.add(outerRing, innerRing, fillDisk);
    this.scene.add(group);

    this.activeEffects.push({
      kind: 'telegraph',
      mesh: group,
      fillDisk,
      center: centerPos.clone(),
      radius,
      elapsed: 0,
      duration: delay,
      onTrigger,
    });
  }

  // opts: { homing (rad/s), label, textColor, onHit(player), knockback }
  spawnMonsterProjectile(origin, dir, speed, radius, damage, colorHex, maxLifetime = 3.2, status = null, isWave = false, opts = {}) {
    const meshGroup = new THREE.Group();
    meshGroup.position.copy(origin);

    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    if (isWave) {
      const waveMesh = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.35, 0.22, 6, 16, Math.PI), mat);
      waveMesh.rotation.x = Math.PI / 2;
      waveMesh.rotation.z = -Math.PI / 2;
      meshGroup.add(waveMesh);
      meshGroup.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(radius, 1), mat);
      meshGroup.add(orb);
    }

    this.scene.add(meshGroup);
    this.activeEffects.push({
      kind: 'projectile',
      mesh: meshGroup,
      velocity: dir.clone().normalize().multiplyScalar(speed),
      radius,
      damage,
      colorHex,
      status,
      homing: opts.homing || 0,
      label: opts.label || null,
      textColor: opts.textColor || '#ff6b81',
      onHit: opts.onHit || null,
      knockback: opts.knockback || 0,
      elapsed: 0,
      duration: maxLifetime,
    });
  }

  spawnExpandingShockwave(centerPos, maxRadius, duration, damage, colorHex) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 32), ringMat);
    ringMesh.rotateX(-Math.PI / 2);
    const groundY = getTerrainHeight(centerPos.x, centerPos.z) + 0.18;
    ringMesh.position.set(centerPos.x, groundY, centerPos.z);
    this.scene.add(ringMesh);

    this.activeEffects.push({
      kind: 'shockwave',
      mesh: ringMesh,
      mat: ringMat,
      center: centerPos.clone(),
      maxRadius,
      damage,
      hitPlayer: false,
      elapsed: 0,
      duration,
    });
  }

  // opts: { color, label, status ('slow' | null), interval, particleColors } — dùng chung cho vùng độc / lửa / bão tuyết
  spawnPoisonPool(centerPos, radius, duration, tickDamage, opts = {}) {
    const poolMat = new THREE.MeshBasicMaterial({
      color: opts.color ?? 0x2ed573,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const poolMesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), poolMat);
    poolMesh.rotateX(-Math.PI / 2);
    const groundY = getTerrainHeight(centerPos.x, centerPos.z) + 0.06;
    poolMesh.position.set(centerPos.x, groundY, centerPos.z);
    this.scene.add(poolMesh);

    this.activeEffects.push({
      kind: 'poison_pool',
      mesh: poolMesh,
      mat: poolMat,
      center: centerPos.clone(),
      radius,
      tickDamage,
      tickTimer: 0,
      interval: opts.interval ?? 0.65,
      label: opts.label ?? '☣️ ĐỘC DỊCH',
      textColor: opts.textColor ?? '#2ed573',
      status: opts.status === undefined ? 'slow' : opts.status,
      particleColors: opts.particleColors ?? [0x2ed573, 0xbadc58],
      elapsed: 0,
      duration,
    });
  }

  // Hiệu ứng tuỳ biến: update(ef, delta, player, t) mỗi khung hình, onEnd() khi hết giờ (không gọi nếu quái chết giữa chừng)
  spawnCustomEffect(duration, update = null, onEnd = null, mesh = null) {
    if (mesh) this.scene.add(mesh);
    const ef = { kind: 'custom', mesh, elapsed: 0, duration, update, onEnd };
    this.activeEffects.push(ef);
    return ef;
  }

  // Hẹn giờ an toàn: tự huỷ khi Boss chết / biến mất
  schedule(delay, fn) {
    return this.spawnCustomEffect(delay, null, fn, null);
  }

  inflictDamageToPlayer(player, amount, label, color = '#ff4757', status = null, knockbackForce = 0) {
    if (!player || player.isDead) return;
    // Boss lượt sau mạnh hơn: nhân sát thương & sửa lại con số trên chữ bay
    const mult = this.damageMult || 1;
    if (mult !== 1) {
      amount = Math.max(1, Math.round(amount * mult));
      if (label) label = label.replace(/^-\d+/, `-${amount}`);
    }
    if (this.kit?.onDealDamage) this.kit.onDealDamage(amount, player);
    const dist = Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
    player.takeDamage(amount, this.name, player.position.clone());

    if (status === 'freeze') {
      player.freeze(1.5);
    } else if (status === 'slow') {
      player.slow(2.5, 0.42);
    }

    if (knockbackForce > 0 && !player.isInvulnerable && !player.isParrying) {
      const pushDir = new THREE.Vector3(player.position.x - this.position.x, 0, player.position.z - this.position.z);
      if (pushDir.lengthSq() < 0.01) pushDir.set(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
      pushDir.normalize();
      player.startDash(pushDir, Math.min(6.5, knockbackForce * 0.35), 0.22);
    }

    if (player.pixelFX?.damageTexts) {
      player.pixelFX.damageTexts.spawn(
        label || `-${amount} 💥`,
        player.position.clone().add(new THREE.Vector3(0, 2.1, 0)),
        color
      );
    }
    if (player.pixelFX?.controller && dist < 40) {
      if (this.isBoss) {
        player.pixelFX.controller.addTrauma(0.35);
      } else if (this.isLarge) {
        player.pixelFX.controller.addTrauma(0.2);
      } else {
        // Quái nhỏ: chỉ rung nhẹ & không cộng dồn quá mức khi bị cả đàn vây đánh
        player.pixelFX.controller.addTrauma(0.1, 0.18);
      }
    }
  }

  // =========================================================================
  // ĐẠI BOSS: BỘ KỸ NĂNG MÔ PHỎNG NGƯỜI CHƠI
  // 4 = Ảnh Sát Thuấn Bộ (Sát Thủ), 5 = Hộ Thể Phản Chấn (Hộ Vệ),
  // 6 = Hắc Ảnh Phân Thân (phân thân như người chơi), 7 = Tụ Lực Long Tức (Xạ Thủ - tụ lực bắn xuyên)
  // =========================================================================
  pickBossSkill(distToPlayer) {
    // Xa: ưu tiên chiêu áp sát / tầm xa. Gần: ưu tiên chiêu cận chiến / khống chế
    const far = distToPlayer > 16;
    const pool = far
      ? [0, 1, 2, 4, 4, 6, 7, 7]
      : [0, 1, 3, 3, 4, 5, 5, 6, 7];
    if (this.isEnraged) pool.push(4, 6, 7); // Cuồng nộ: dồn dập chiêu mô phỏng người chơi hơn
    const candidates = pool.filter((k) => !this.recentBossSkills.includes(k));
    const list = candidates.length ? candidates : pool;
    const pick = list[Math.floor(Math.random() * list.length)];
    this.recentBossSkills.push(pick);
    if (this.recentBossSkills.length > 2) this.recentBossSkills.shift();
    return pick;
  }

  faceTowards(pos) {
    this.rotationY = Math.atan2(pos.x - this.position.x, pos.z - this.position.z);
    this.model.rotation.y = this.rotationY;
  }

  // 🗡️ ẢNH SÁT THUẤN BỘ: biến mất, hiện ra SAU LƯNG người chơi rồi chém 2 nhát liên hoàn
  startBossBlink(player) {
    this.currentSkillName = '🗡️ Ảnh Sát: Thuấn Bộ Đoạt Mệnh!';
    this.aiState = 'blinking';
    this.stateTimer = 0;
    this.stateDuration = this.isEnraged ? 0.5 : 0.65; // thời gian để người chơi kịp né
    const rotY = player.rotationY || 0;
    const behind = new THREE.Vector3(
      player.position.x - Math.sin(rotY) * 4.2,
      0,
      player.position.z - Math.cos(rotY) * 4.2
    );
    behind.x = THREE.MathUtils.clamp(behind.x, -115, 115);
    behind.z = THREE.MathUtils.clamp(behind.z, -115, 115);
    behind.y = getTerrainHeight(behind.x, behind.z);
    this.blinkTarget.copy(behind);

    if (this.particles) {
      this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 3, 0)), 30, [0x6c5ce7, 0x2d0a3d, 0xffffff], [2, 6], 0.8, 4.0, 0.7);
    }
    this.model.visible = false;
    this.healthBarGroup.visible = false;
    this.spawnTelegraphAOE(behind, 6.0, this.stateDuration + 0.42, 0x6c5ce7, null);
    sound.playSwordSummon?.();
  }

  // 🛡️ HỘ THỂ PHẢN CHẤN: dựng khiên vàng 2s, chỉ nhận 15% sát thương; bị đánh thì phản chấn sóng xung kích
  startBossGuard() {
    this.currentSkillName = '🛡️ Hộ Thể: Kim Long Phản Chấn! (ĐỪNG ĐÁNH!)';
    this.aiState = 'guarding';
    this.stateTimer = 0;
    this.stateDuration = 2.0;
    this.guardTimer = this.stateDuration;
    this.guardHits = 0;

    this.removeBossShield();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd32a, transparent: true, opacity: 0.28, depthWrite: false, wireframe: true });
    this.bossShieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(this.hitRadius + 2.2, 1), mat);
    this.bossShieldMesh.position.y = 4.5;
    this.group.add(this.bossShieldMesh);
  }

  removeBossShield() {
    if (this.bossShieldMesh) {
      this.group.remove(this.bossShieldMesh);
      this.bossShieldMesh.geometry.dispose();
      this.bossShieldMesh.material.dispose();
      this.bossShieldMesh = null;
    }
  }

  // 👥 HẮC ẢNH PHÂN THÂN: 2 (cuồng nộ: 3) phân thân bóng tối hiện quanh người chơi, lần lượt lướt chém xuyên qua
  castBossShadowClones(player) {
    this.currentSkillName = '👥 Hắc Ảnh Phân Thân: Vạn Ảnh Quy Tông!';
    this.startAttackAnimation('boss_summon_sky', 0.7, 0.4, null);
    const count = this.isEnraged ? 3 : 2;
    const baseAngle = Math.random() * Math.PI * 2;
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x2d0a3d, transparent: true, opacity: 0.6, depthWrite: false });

    for (let i = 0; i < count; i++) {
      const a = baseAngle + (i / count) * Math.PI * 2;
      const start = new THREE.Vector3(player.position.x + Math.sin(a) * 11, 0, player.position.z + Math.cos(a) * 11);
      start.y = getTerrainHeight(start.x, start.z);
      const dir = new THREE.Vector3(player.position.x - start.x, 0, player.position.z - start.z).normalize();
      const length = 22;
      const delay = 1.0 + i * 0.35;

      const clone = this.model.clone(true);
      clone.traverse((o) => { if (o.isMesh) o.material = shadowMat; });
      clone.visible = true;
      clone.position.copy(start);
      clone.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
      clone.scale.setScalar(this.baseModelScale * 0.85);
      this.scene.add(clone);
      this.activeEffects.push({
        kind: 'shadow_clone',
        mesh: clone,
        mat: shadowMat,
        start: start.clone(),
        end: start.clone().addScaledVector(dir, length),
        dashAt: delay,
        elapsed: 0,
        duration: delay + 0.75,
      });

      this.spawnTelegraphLine(start, dir, length, 3.0, delay, 0x8e44ad, (pl) => {
        if (pl && !pl.isDead && this.isPointInLine(pl.position, start, dir, length, 3.0)) {
          this.inflictDamageToPlayer(pl, 95, '-95 👥 HẮC ẢNH TRẢM!', '#a29bfe', null, 9);
        }
        sound.playSwordSlash?.();
      });
    }
  }

  // 🏹 TỤ LỰC LONG TỨC: đứng yên tụ lực rồi phun tia rồng xuyên thẳng một đường dài
  startBossBeam(player) {
    this.currentSkillName = '🏹 Tụ Lực: Long Tức Xuyên Vân!';
    this.aiState = 'beam_charging';
    this.stateTimer = 0;
    this.stateDuration = this.isEnraged ? 1.1 : 1.35;
    const pred = this.predictPlayerPosition(player, 0.3);
    this.beamDir.set(pred.x - this.position.x, 0, pred.z - this.position.z);
    if (this.beamDir.lengthSq() < 0.01) this.beamDir.set(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    this.beamDir.normalize();
    this.faceTowards(this.position.clone().add(this.beamDir));

    const origin = this.position.clone();
    const dir = this.beamDir.clone();
    const length = 42;
    const width = this.isEnraged ? 4.2 : 3.4;
    this.spawnTelegraphLine(origin, dir, length, width, this.stateDuration, 0xff3838, (pl) => {
      this.spawnBeamFlash(origin, dir, length, width);
      if (pl && !pl.isDead && this.isPointInLine(pl.position, origin, dir, length, width)) {
        this.inflictDamageToPlayer(pl, 220, '-220 🏹 LONG TỨC XUYÊN VÂN!', '#ff3838', 'slow', 16);
      }
      sound.playExplosion?.();
    });
  }

  updateBossPlayerLikeState(delta, player) {
    this.stateTimer += delta;

    if (this.aiState === 'blinking') {
      if (this.stateTimer >= this.stateDuration) {
        this.position.copy(this.blinkTarget);
        this.group.position.copy(this.position);
        this.model.visible = true;
        this.healthBarGroup.visible = true;
        this.aiState = 'idle';
        if (player) this.faceTowards(player.position);
        if (this.particles) {
          this.particles.emitShockwave(this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0x6c5ce7, 7.0, 0.4);
        }
        const strike = (dmg) => {
          sound.playSwordSlash?.();
          this.spawnSlashArc(5.8, 0x6c5ce7, 0.1, 3.0, 0.25);
          if (player && Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 6.2) {
            this.inflictDamageToPlayer(player, dmg, `-${dmg} 🗡️ THUẤN BỘ ĐOẠT MỆNH!`, '#a29bfe', null, 8);
          }
        };
        this.startAttackAnimation('boss_ cleave_lr', 0.7, 0.3, () => strike(85), 0.72, () => strike(105));
        this.attackCooldown = 1.2;
        this.currentSkillName = this.isEnraged ? '🔥 Cuồng Nộ Huyết Long' : '⚡ Sẵn sàng chiến đấu';
      }
      return;
    }

    if (this.aiState === 'guarding') {
      this.guardTimer -= delta;
      if (this.bossShieldMesh) {
        this.bossShieldMesh.rotation.y += delta * 2.2;
        this.bossShieldMesh.material.opacity = 0.22 + Math.min(0.45, this.guardHits * 0.06) + Math.sin(this.stateTimer * 12) * 0.05;
      }
      if (player) this.faceTowards(player.position);
      if (this.stateTimer >= this.stateDuration) {
        this.guardTimer = 0;
        this.removeBossShield();
        this.aiState = 'idle';
        if (this.guardHits > 0) {
          // Phản chấn: càng bị đánh nhiều, sóng càng mạnh
          const dmg = Math.min(260, 120 + this.guardHits * 14);
          this.currentSkillName = `⚡ PHẢN CHẤN! (đỡ ${this.guardHits} đòn)`;
          this.spawnSlashArc(7.0, 0xffd32a, 0.0, 2.0, 0.4);
          this.spawnExpandingShockwave(this.position, 18.0, 0.85, dmg, 0xffd32a);
          if (this.particles) {
            this.particles.emitShockwave(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd32a, 14.0, 0.6);
          }
          sound.playExplosion?.();
        } else {
          this.currentSkillName = this.isEnraged ? '🔥 Cuồng Nộ Huyết Long' : '⚡ Sẵn sàng chiến đấu';
        }
        this.guardHits = 0;
      }
      return;
    }

    if (this.aiState === 'beam_charging') {
      if (this.particles && Math.random() < 0.6) {
        const mouth = this.position.clone().add(new THREE.Vector3(this.beamDir.x * 3, 5.5, this.beamDir.z * 3));
        this.particles.emitElementalParticles(mouth, 2, [0xff3838, 0xffd32a, 0xffffff], [1, 3], 0.35, -2.0, 0.4);
      }
      if (this.stateTimer >= this.stateDuration) {
        this.aiState = 'idle';
        this.attackCooldown = Math.max(this.attackCooldown, 0.8);
        this.currentSkillName = this.isEnraged ? '🔥 Cuồng Nộ Huyết Long' : '⚡ Sẵn sàng chiến đấu';
      }
    }
  }

  // Khoảng cách điểm tới đoạn thẳng (mặt phẳng XZ) để xét trúng chiêu dạng đường thẳng
  isPointInLine(point, origin, dir, length, width) {
    const px = point.x - origin.x;
    const pz = point.z - origin.z;
    const along = px * dir.x + pz * dir.z;
    if (along < -1 || along > length + 1) return false;
    const perp = Math.abs(px * dir.z - pz * dir.x);
    return perp <= width / 2 + 0.6;
  }

  // Vòng cảnh báo dạng đường thẳng (nạp dần từ gốc tới ngọn) — cho người chơi thấy hướng chiêu để né
  spawnTelegraphLine(origin, dir, length, width, delay, colorHex, onTrigger) {
    const group = new THREE.Group();
    const groundY = getTerrainHeight(origin.x, origin.z) + 0.1;
    group.position.set(origin.x, groundY, origin.z);
    group.rotation.y = Math.atan2(dir.x, dir.z);

    const borderMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false });
    const border = new THREE.Mesh(new THREE.PlaneGeometry(width, length), borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.z = length / 2;

    const fillMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false });
    const fillGeo = new THREE.PlaneGeometry(width, length);
    fillGeo.translate(0, length / 2, 0); // gốc ở đầu đường để nạp dần về phía trước
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.scale.set(1, 0.02, 1);

    group.add(border, fill);
    this.scene.add(group);
    this.activeEffects.push({ kind: 'telegraph_line', mesh: group, fill, elapsed: 0, duration: delay, onTrigger });
  }

  spawnBeamFlash(origin, dir, length, width) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 1.6, length), mat);
    beam.position.set(origin.x + dir.x * length / 2, getTerrainHeight(origin.x, origin.z) + 2.2, origin.z + dir.z * length / 2);
    beam.rotation.y = Math.atan2(dir.x, dir.z);
    this.scene.add(beam);
    this.activeEffects.push({ kind: 'beam_flash', mesh: beam, mat, elapsed: 0, duration: 0.35 });
    if (this.particles) {
      for (let i = 0; i < 6; i++) {
        const p = origin.clone().addScaledVector(dir, (i + 0.5) * length / 6);
        p.y = getTerrainHeight(p.x, p.z) + 1.5;
        this.particles.emitElementalParticles(p, 6, [0xff3838, 0xffd32a, 0xffffff], [1, 4], 0.5, 3.0, 0.5);
      }
    }
  }

  updateActiveEffects(delta, player) {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const ef = this.activeEffects[i];
      ef.elapsed += delta;
      const t = Math.min(1.0, ef.elapsed / ef.duration);

      if (ef.kind === 'custom') {
        if (ef.update) ef.update(ef, delta, player, t);
        if (ef.elapsed >= ef.duration) {
          if (ef.mesh) this.scene.remove(ef.mesh);
          this.activeEffects.splice(i, 1);
          if (ef.onEnd) ef.onEnd();
        }
        continue;
      }
      if (ef.kind === 'telegraph_line') {
        ef.fill.scale.y = Math.max(0.02, t);
        if (ef.elapsed >= ef.duration) {
          if (ef.onTrigger) ef.onTrigger(player);
          this.scene.remove(ef.mesh);
          ef.mesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
          this.activeEffects.splice(i, 1);
        }
        continue;
      }
      if (ef.kind === 'shadow_clone') {
        if (ef.elapsed >= ef.dashAt) {
          const dt = Math.min(1, (ef.elapsed - ef.dashAt) / 0.22);
          ef.mesh.position.lerpVectors(ef.start, ef.end, dt);
          ef.mat.opacity = Math.max(0, 0.6 * (1 - (ef.elapsed - ef.dashAt) / 0.75));
        } else {
          ef.mat.opacity = 0.2 + 0.4 * (ef.elapsed / ef.dashAt);
        }
        if (ef.elapsed >= ef.duration) {
          this.scene.remove(ef.mesh);
          this.activeEffects.splice(i, 1);
        }
        continue;
      }
      if (ef.kind === 'beam_flash') {
        ef.mat.opacity = 0.95 * (1 - t);
        ef.mesh.scale.x = 1 + t * 0.6;
        if (ef.elapsed >= ef.duration) {
          this.scene.remove(ef.mesh);
          ef.mesh.geometry.dispose();
          ef.mat.dispose();
          this.activeEffects.splice(i, 1);
        }
        continue;
      }

      if (ef.kind === 'slash_arc') {
        const s = THREE.MathUtils.lerp(0.65, 1.35, t);
        ef.mesh.scale.set(s, s, s);
        ef.mat.opacity = (1.0 - t) * 0.92;
        if (ef.elapsed >= ef.duration) {
          this.scene.remove(ef.mesh);
          this.activeEffects.splice(i, 1);
        }
      } else if (ef.kind === 'telegraph') {
        const s = Math.max(0.05, t);
        ef.fillDisk.scale.set(s, s, 1);
        if (ef.elapsed >= ef.duration) {
          if (ef.onTrigger) ef.onTrigger(player);
          this.scene.remove(ef.mesh);
          this.activeEffects.splice(i, 1);
        }
      } else if (ef.kind === 'projectile') {
        // Đạn truy đuổi: bẻ lái dần về phía người chơi
        if (ef.homing && player && !player.isDead) {
          const speed = ef.velocity.length();
          const want = new THREE.Vector3(player.position.x - ef.mesh.position.x, 0, player.position.z - ef.mesh.position.z);
          if (want.lengthSq() > 0.01) {
            want.normalize().multiplyScalar(speed);
            ef.velocity.lerp(want, Math.min(1, ef.homing * delta)).setLength(speed);
          }
        }
        ef.mesh.position.addScaledVector(ef.velocity, delta);
        ef.mesh.rotation.y += delta * 5;
        if (this.particles && Math.random() < 0.35) {
          this.particles.emitElementalParticles(ef.mesh.position, 1, [ef.colorHex, 0xffffff], [0.5, 1.5], 0.25, 0, 0.2);
        }

        if (player && !player.isDead) {
          const dx = player.position.x - ef.mesh.position.x;
          const dz = player.position.z - ef.mesh.position.z;
          const dy = (player.position.y + 0.9) - ef.mesh.position.y;
          if (dx * dx + dz * dz <= (ef.radius + 0.75) * (ef.radius + 0.75) && Math.abs(dy) < 2.0) {
            this.inflictDamageToPlayer(player, ef.damage, ef.label ? `-${ef.damage} ${ef.label}` : `-${ef.damage} 🔥 ${this.name}`, ef.textColor, ef.status, ef.knockback);
            if (ef.onHit) ef.onHit(player);
            this.scene.remove(ef.mesh);
            this.activeEffects.splice(i, 1);
            continue;
          }
        }

        if (ef.elapsed >= ef.duration) {
          this.scene.remove(ef.mesh);
          this.activeEffects.splice(i, 1);
        }
      } else if (ef.kind === 'shockwave') {
        const currentR = THREE.MathUtils.lerp(1.2, ef.maxRadius, t);
        ef.mesh.scale.set(currentR, currentR, 1);
        ef.mat.opacity = (1.0 - t) * 0.9;

        if (player && !player.isDead && !ef.hitPlayer) {
          const dist = Math.hypot(player.position.x - ef.center.x, player.position.z - ef.center.z);
          const groundY = getTerrainHeight(player.position.x, player.position.z);
          const heightAboveGround = player.position.y - groundY;
          if (Math.abs(dist - currentR) < 1.35 && heightAboveGround < 1.1) {
            ef.hitPlayer = true;
            this.inflictDamageToPlayer(player, ef.damage, `-${ef.damage} 💥 SÓNG CHẤN ĐỘNG!`, '#ffa502', 'slow', 10);
          }
        }

        if (ef.elapsed >= ef.duration) {
          this.scene.remove(ef.mesh);
          this.activeEffects.splice(i, 1);
        }
      } else if (ef.kind === 'poison_pool') {
        ef.mat.opacity = 0.42 * (1.0 - t * 0.5);
        ef.tickTimer += delta;
        if (ef.tickTimer >= ef.interval) {
          ef.tickTimer = 0;
          if (this.particles) {
            this.particles.emitElementalParticles(
              ef.center.clone().add(new THREE.Vector3((Math.random() - 0.5) * ef.radius, 0.2, (Math.random() - 0.5) * ef.radius)),
              2,
              ef.particleColors,
              [1, 2.5],
              0.4,
              1.0,
              0.4
            );
          }
          if (player && !player.isDead) {
            const dist = Math.hypot(player.position.x - ef.center.x, player.position.z - ef.center.z);
            if (dist <= ef.radius) {
              this.inflictDamageToPlayer(player, ef.tickDamage, `-${ef.tickDamage} ${ef.label}`, ef.textColor, ef.status);
            }
          }
        }
        if (ef.elapsed >= ef.duration) {
          this.scene.remove(ef.mesh);
          this.activeEffects.splice(i, 1);
        }
      }
    }
  }

  // =========================================================================
  // TRÍ TUỆ NHÂN TẠO (AI) & LỐI ĐÁNH ĐỘC ĐÁO TỪNG LOẠI QUÁI + ĐẠI BOSS
  // =========================================================================

  predictPlayerPosition(player, leadTime = 0.55) {
    if (!player) return this.position.clone();
    const pred = player.position.clone();
    if (player.velocity) {
      pred.x += player.velocity.x * leadTime;
      pred.z += player.velocity.z * leadTime;
    }
    pred.x = THREE.MathUtils.clamp(pred.x, -118, 118);
    pred.z = THREE.MathUtils.clamp(pred.z, -118, 118);
    pred.y = getTerrainHeight(pred.x, pred.z);
    return pred;
  }

  updateBossAI(delta, player, distToPlayer) {
    if (!player || player.isDead) return;

    const cdSpeed = this.isEnraged ? 1.38 : 1.0;
    this.attackCooldown -= delta * cdSpeed;
    this.specialCooldown -= delta * cdSpeed;

    // 1. Đang thực hiện cú nhảy Long Hoàng Đột Kích trên không trung
    if (this.aiState === 'leaping') {
      this.stateTimer += delta;
      const p = Math.min(1.0, this.stateTimer / this.stateDuration);
      this.position.x = THREE.MathUtils.lerp(this.leapStart.x, this.leapTarget.x, p);
      this.position.z = THREE.MathUtils.lerp(this.leapStart.z, this.leapTarget.z, p);
      const baseGround = getTerrainHeight(this.position.x, this.position.z);
      this.position.y = baseGround + Math.sin(p * Math.PI) * 14.0;

      if (p >= 1.0) {
        this.aiState = 'idle';
        this.position.y = baseGround;
        this.currentSkillName = this.isEnraged ? '🔥 Cuồng Nộ Huyết Long' : '⚡ Sẵn sàng chiến đấu';
        sound.playExplosion?.();
        this.spawnSlashArc(6.2, 0xff3838, 0.0, 1.5, 0.38);
        if (this.particles) {
          this.particles.emitShockwave(this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xff3838, 12.0, 0.6);
          this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 35, [0xff3838, 0xffd32a, 0xffffff], [3, 9], 1.2, 8.0, 1.0);
        }
        if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 6.5) {
          this.inflictDamageToPlayer(player, 175, '-175 🐉 LONG HOÀNG GIÁNG THẾ!', '#ff3838', null, 18);
        }
        this.spawnExpandingShockwave(this.position, 22.0, 1.35, 110, 0xffa502);
      }
      return;
    }

    // 2. Đang vận chiêu Hắc Động Thôn Phệ
    if (this.aiState === 'channeling') {
      this.stateTimer += delta;
      if (distToPlayer < 14.5 && !player.isInvulnerable) {
        const pullDir = new THREE.Vector3(this.position.x - player.position.x, 0, this.position.z - player.position.z);
        if (pullDir.lengthSq() > 0.25) {
          pullDir.normalize();
          player.position.x += pullDir.x * 4.8 * delta;
          player.position.z += pullDir.z * 4.8 * delta;
        }
      }
      if (this.particles && Math.random() < 0.5) {
        this.particles.emitElementalParticles(
          this.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 1.2, (Math.random() - 0.5) * 14)),
          2,
          [0xc0392b, 0x8e44ad, 0xffd32a],
          [2, 5],
          0.4,
          -4.0,
          0.5
        );
      }
      if (this.stateTimer >= this.stateDuration) {
        this.aiState = 'idle';
        this.currentSkillName = this.isEnraged ? '🔥 Cuồng Nộ Huyết Long' : '⚡ Sẵn sàng chiến đấu';
      }
      return;
    }

    // 3. Các thế võ mô phỏng người chơi (Thuấn Bộ / Hộ Thể / Tụ Lực Long Tức)
    if (this.aiState === 'blinking' || this.aiState === 'guarding' || this.aiState === 'beam_charging') {
      this.updateBossPlayerLikeState(delta, player);
      return;
    }

    if (distToPlayer > 58) {
      this.currentSkillName = '🐉 Trấn Thủ Đại Điện';
      return;
    }

    const targetAngle = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
    let rotDiff = targetAngle - this.rotationY;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    this.rotationY += rotDiff * Math.min(1.0, delta * 5.0);
    this.model.rotation.y = this.rotationY;

    // 3. KỸ NĂNG ĐẶC BIỆT CỦA ĐẠI BOSS (luân phiên 4 tuyệt kỹ kèm animation riêng)
    if (this.specialCooldown <= 0 && !this.attackAnimType) {
      this.specialCooldown = 4.6;
      const skillIdx = this.pickBossSkill(distToPlayer);
      this.bossSkillCycle++;

      if (skillIdx === 0) {
        // TUYỆT KỸ 1: HẮC LONG LIÊN TRẢM (Vung Họa Kích quét ngang phóng sóng kiếm khí)
        this.currentSkillName = '🔥 Tuyệt Kỹ: Hắc Long Phá Thiên Trảm!';
        this.startAttackAnimation('boss_wave_slash', 0.78, 0.48, () => {
          this.spawnSlashArc(6.0, 0xff3838, 0.15, 3.2, 0.35);
          const predPos = this.predictPlayerPosition(player, 0.45);
          const baseAngle = Math.atan2(predPos.x - this.position.x, predPos.z - this.position.z);
          const waveCount = this.isEnraged ? 5 : 3;
          const spread = 0.34;
          const origin = this.position.clone().add(new THREE.Vector3(0, 1.8, 0));
          for (let i = 0; i < waveCount; i++) {
            const offset = (i - (waveCount - 1) / 2) * spread;
            const dir = new THREE.Vector3(Math.sin(baseAngle + offset), 0, Math.cos(baseAngle + offset));
            this.spawnMonsterProjectile(origin, dir, 22.0, 1.5, 130, 0xff3838, 2.8, null, true);
          }
          sound.playSwordSlash?.();
        });
      } else if (skillIdx === 1) {
        // TUYỆT KỸ 2: CỬU THIÊN HUYẾT VŨ (Giương Họa Kích chỉ trời triệu hồi mưa thiên thạch)
        this.currentSkillName = '☄️ Tuyệt Kỹ: Cửu Thiên Huyết Vũ!';
        this.startAttackAnimation('boss_summon_sky', 1.0, 0.35, () => {
          const meteorCount = this.isEnraged ? 8 : 5;
          for (let i = 0; i < meteorCount; i++) {
            const targetCenter = i === 0
              ? this.predictPlayerPosition(player, 0.65)
              : player.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20));

            this.spawnTelegraphAOE(targetCenter, 4.4, 1.05 + i * 0.12, 0xff3838, (pl) => {
              if (this.particles) {
                this.particles.emitShockwave(targetCenter.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xff4757, 5.5, 0.45);
                this.particles.emitElementalParticles(targetCenter.clone().add(new THREE.Vector3(0, 1.2, 0)), 22, [0xff3838, 0xffa502, 0x2f3542], [2, 6], 0.9, 6.0, 0.8);
              }
              if (pl && !pl.isDead && Math.hypot(pl.position.x - targetCenter.x, pl.position.z - targetCenter.z) <= 4.4) {
                this.inflictDamageToPlayer(pl, 145, '-145 ☄️ THIÊN THẠCH HUYẾT VŨ!', '#ff4757', null, 12);
              }
            });
          }
        });
      } else if (skillIdx === 2) {
        // TUYỆT KỸ 3: LONG HOÀNG ĐỘT KÍCH (Nhảy vọt lên không trung giáng kích)
        this.currentSkillName = '⚡ Tuyệt Kỹ: Long Hoàng Đột Kích!';
        this.aiState = 'leaping';
        this.stateTimer = 0;
        this.stateDuration = 0.95;
        this.leapStart.copy(this.position);
        this.leapTarget.copy(this.predictPlayerPosition(player, 0.5));
        this.spawnTelegraphAOE(this.leapTarget, 6.5, 0.95, 0xffa502, null);
        return;
      } else if (skillIdx === 3) {
        // TUYỆT KỸ 4: HẮC ĐỘNG THÔN PHỆ (Cắm ngược Họa Kích xuống đất hút mục tiêu)
        this.currentSkillName = '🌀 Tuyệt Kỹ: Hắc Động Thôn Phệ!';
        this.aiState = 'channeling';
        this.stateTimer = 0;
        this.stateDuration = 1.65;
        const blastCenter = this.position.clone();
        this.spawnTelegraphAOE(blastCenter, 11.5, 1.65, 0xd980fa, (pl) => {
          if (this.particles) {
            this.particles.emitShockwave(blastCenter.clone().add(new THREE.Vector3(0, 0.8, 0)), 0xff1e1e, 14.0, 0.65);
            this.particles.emitElementalParticles(blastCenter.clone().add(new THREE.Vector3(0, 2.0, 0)), 40, [0xff1e1e, 0x8e44ad, 0xffd32a], [3, 8], 1.3, 8.5, 1.1);
          }
          if (pl && !pl.isDead && Math.hypot(pl.position.x - blastCenter.x, pl.position.z - blastCenter.z) <= 11.5) {
            this.inflictDamageToPlayer(pl, 210, '-210 💥 HUYẾT LONG ĐẠI BẠO!', '#ff1e1e', null, 22);
          }
        });
        return;
      } else if (skillIdx === 4) {
        this.startBossBlink(player);
        return;
      } else if (skillIdx === 5) {
        this.startBossGuard();
        return;
      } else if (skillIdx === 6) {
        this.castBossShadowClones(player);
      } else {
        this.startBossBeam(player);
        return;
      }
    }

    // 4. Đòn đánh cận chiến 3 thức liên hoàn bằng Họa Kích (Hoành Tảo -> Bổ Dọc -> Đâm Kích)
    if (distToPlayer <= 7.2 && this.attackCooldown <= 0 && !this.attackAnimType) {
      this.attackCooldown = 1.65;
      const step = this.attackComboStep % 3;
      this.attackComboStep++;
      const animName = step === 0 ? 'boss_ cleave_lr' : (step === 1 ? 'boss_overhead_slam' : 'boss_thrust');
      this.startAttackAnimation(animName, 0.68, 0.46, () => {
        sound.playSwordSlash?.();
        const tilt = step === 0 ? 0.1 : (step === 1 ? Math.PI / 2 : -0.2);
        this.spawnSlashArc(5.6, 0xff3838, tilt, 3.0, 0.3);
        if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 7.5) {
          this.inflictDamageToPlayer(player, 115, '-115 ⚔️ HẮC LONG KÍCH!', '#ff4757', null, 10);
        }
      });
    }

    // 5. Di chuyển áp sát (chậm lại khi đang vung vũ khí để đòn đánh có sức nặng)
    const moveFactor = this.attackAnimType ? 0.35 : 1.0;
    if (distToPlayer > 5.5) {
      this.position.x += Math.sin(this.rotationY) * this.speed * moveFactor * delta;
      this.position.z += Math.cos(this.rotationY) * this.speed * moveFactor * delta;
    }
  }

  updateMonsterAI(delta, player, distToPlayer) {
    if (!player || player.isDead) return;

    this.attackCooldown -= delta;
    this.specialCooldown -= delta;

    // 1. Trạng thái lao vọt cắn gót của Hắc Diễm Tiểu Thú (Quái Nhỏ)
    if (this.aiState === 'charging') {
      this.stateTimer += delta;
      const chargeSpeed = this.speed * 2.35;
      this.position.x += this.chargeDir.x * chargeSpeed * delta;
      this.position.z += this.chargeDir.z * chargeSpeed * delta;
      if (this.particles && Math.random() < 0.45) {
        this.particles.emitDust(this.position);
      }
      if (distToPlayer <= this.hitRadius + 1.15 && this.attackCooldown <= 0) {
        this.attackCooldown = 0.65;
        this.spawnSlashArc(2.0, 0xffa502, 0.25, 1.2, 0.18);
        this.inflictDamageToPlayer(player, 22, '-22 🦖 CẮN GÓT LÀM CHẬM!', '#ffa502', 'slow', 3);
        this.aiState = 'idle';
      }
      if (this.stateTimer >= this.stateDuration) {
        this.aiState = 'idle';
      }
      return;
    }

    // 2. Quái Lớn đang trong chu kỳ vung đòn hạng nặng -> KHÓA HƯỚNG & ĐỨNG YÊN TRỤ VỮNG (giúp người chơi dễ né)
    if (this.aiState === 'windup' || (this.isLarge && this.attackAnimType)) {
      if (this.aiState === 'windup') {
        this.stateTimer += delta;
        if (this.stateTimer >= this.stateDuration) {
          this.aiState = 'idle';
        }
      }
      return;
    }

    // 3. Ngoài phạm vi phát hiện (48m) -> Đi tuần quanh điểm xuất hiện
    if (distToPlayer > 48) {
      this.walkAnimTime += delta * 0.4;
      const toHomeX = this.spawnOrigin.x - this.position.x;
      const toHomeZ = this.spawnOrigin.z - this.position.z;
      const distHome = Math.hypot(toHomeX, toHomeZ);
      const patrolAngle = distHome > 18 ? Math.atan2(toHomeX, toHomeZ) : this.rotationY + Math.sin(this.walkAnimTime) * 0.025;
      this.rotationY = THREE.MathUtils.lerp(this.rotationY, patrolAngle, delta * 2.5);
      this.model.rotation.y = this.rotationY;
      this.position.x += Math.sin(this.rotationY) * (this.speed * 0.45) * delta;
      this.position.z += Math.cos(this.rotationY) * (this.speed * 0.45) * delta;
      return;
    }

    const dirToPlayerX = player.position.x - this.position.x;
    const dirToPlayerZ = player.position.z - this.position.z;
    const directAngle = Math.atan2(dirToPlayerX, dirToPlayerZ);

    // =========================================================================
    // A. HÀNH VI NHÓM QUÁI NHỎ (SMALL / FAST / ANNOYING SWARMERS)
    // - Chạy cực nhanh, lách ngang liên tục, đánh chớp nhoáng (0.35s - 0.42s), ít ST nhưng gây khó chịu
    // =========================================================================
    if (this.isSmall) {
      // 🦊 1. HỒ HỎA TIỂU YÊU (Kiting nhanh + bắn tỉa liên thanh làm chậm)
      if (this.type === 'fox_mage') {
        let moveAngle = directAngle;
        let moveSpeed = this.speed;

        if (distToPlayer < 8.5) {
          if (this.specialCooldown <= 0) {
            this.specialCooldown = 2.8;
            const awayDir = new THREE.Vector3(-dirToPlayerX, 0, -dirToPlayerZ).normalize();
            this.velocity.x += awayDir.x * 16;
            this.velocity.z += awayDir.z * 16;
            this.velocity.y += 5.8;
            this.startAttackAnimation('fox_spin_evade', 0.38, 0.25, () => {
              const origin = this.position.clone().add(new THREE.Vector3(0, 1.4, 0));
              const aimDir = new THREE.Vector3(Math.sin(directAngle), 0, Math.cos(directAngle));
              this.spawnMonsterProjectile(origin, aimDir, 21.0, 0.38, 14, 0xff6b8b, 1.8, 'slow', false);
            });
            if (this.particles) {
              this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12, [0xff6b8b, 0xd980fa], [1.5, 3.5], 0.45, 2.5, 0.5);
            }
          }
          moveAngle = directAngle + Math.PI;
        } else if (distToPlayer < 19.0) {
          this.strafePhase += delta * 3.2;
          moveAngle = directAngle + (Math.PI / 2.1) * Math.sin(this.strafePhase);
          moveSpeed = this.speed * 0.95;
        }

        this.rotationY = directAngle;
        this.model.rotation.y = this.rotationY;
        this.position.x += Math.sin(moveAngle) * moveSpeed * delta;
        this.position.z += Math.cos(moveAngle) * moveSpeed * delta;

        // Bắn liên thanh 2 tia Hồ Hỏa nhỏ tốc độ cao gây rỉa máu & làm chậm nhẹ
        if (distToPlayer <= 25.0 && this.attackCooldown <= 0 && !this.attackAnimType) {
          this.attackCooldown = 0.88;
          const fireQuickDart = (spreadOffset = 0) => {
            const pred = this.predictPlayerPosition(player, 0.25);
            const aimAngle = Math.atan2(pred.x - this.position.x, pred.z - this.position.z) + spreadOffset;
            const origin = this.position.clone().add(new THREE.Vector3(0, 1.45, 0));
            const dir = new THREE.Vector3(Math.sin(aimAngle), 0, Math.cos(aimAngle));
            this.spawnMonsterProjectile(origin, dir, 22.5, 0.36, 15, 0xff6b8b, 2.0, 'slow', false);
          };
          this.startAttackAnimation(
            'fox_quick_dart',
            0.36,
            0.35,
            () => fireQuickDart(-0.06),
            0.78,
            () => fireQuickDart(0.06)
          );
        }
        return;
      }

      // 👻 2. U MINH TIỂU QUỶ (Ám ảnh thuấn bộ chọc lén + Tam đoạn trảm siêu tốc)
      if (this.type === 'sword_wraith') {
        if (distToPlayer > 5.0 && distToPlayer < 22.0 && this.specialCooldown <= 0 && !this.attackAnimType) {
          this.specialCooldown = 3.2;
          if (this.particles) {
            this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 12, [0x706fd3, 0x00d2d3], [1.5, 3.5], 0.45, 2.2, 0.45);
          }
          const sideOffset = (Math.random() < 0.5 ? 1 : -1) * 0.65;
          const behindX = player.position.x - Math.sin(player.rotationY + sideOffset) * 2.3;
          const behindZ = player.position.z - Math.cos(player.rotationY + sideOffset) * 2.3;
          this.position.x = THREE.MathUtils.clamp(behindX, -115, 115);
          this.position.z = THREE.MathUtils.clamp(behindZ, -115, 115);
          this.position.y = getTerrainHeight(this.position.x, this.position.z);
          this.rotationY = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
          this.model.rotation.y = this.rotationY;

          this.startAttackAnimation('wraith_blink_poke', 0.34, 0.45, () => {
            sound.playSwordSlash?.();
            this.spawnSlashArc(2.1, 0xa29bfe, 0.15, 1.4, 0.18);
            if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 3.2) {
              this.inflictDamageToPlayer(player, 24, '-24 👻 CHỌC LÉN LÀM CHẬM!', '#a29bfe', 'slow');
            }
          });
          return;
        }

        const zigZag = Math.sin(this.walkAnimTime * 2.4) * 0.68;
        const moveAngle = distToPlayer > 2.4 ? directAngle + zigZag : directAngle;
        this.rotationY = directAngle;
        this.model.rotation.y = this.rotationY;
        if (distToPlayer > 2.35) {
          this.position.x += Math.sin(moveAngle) * this.speed * delta;
          this.position.z += Math.cos(moveAngle) * this.speed * delta;
        } else if (this.attackCooldown <= 0 && !this.attackAnimType) {
          this.attackCooldown = 0.62;
          this.startAttackAnimation(
            'wraith_rapid_flurry',
            0.38,
            0.32,
            () => {
              sound.playSwordSlash?.();
              this.spawnSlashArc(2.0, 0x00d2d3, -0.35, 1.45, 0.16);
              if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 3.1) {
                this.inflictDamageToPlayer(player, 13, '-13 👻 Tiểu Quỷ Trảm!', '#00d2d3');
              }
            },
            0.76,
            () => {
              sound.playSwordSlash?.();
              this.spawnSlashArc(2.0, 0xa29bfe, 0.35, 1.45, 0.16);
              if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 3.1) {
                this.inflictDamageToPlayer(player, 15, '-15 👻 Liên Hoàn Thứ!', '#a29bfe');
              }
            }
          );
        }
        return;
      }

      // 🦖 3. HẮC DIỄM TIỂU THÚ (Chạy zíc-zắc áp sát + Cắn nhấp nhả 2 nhịp cực nhanh vào chân)
      if (this.type === 'chomper') {
        if (distToPlayer >= 5.2 && distToPlayer <= 16.5 && this.specialCooldown <= 0 && !this.attackAnimType) {
          this.specialCooldown = 2.9;
          this.aiState = 'charging';
          this.stateTimer = 0;
          this.stateDuration = 0.55;
          const pred = this.predictPlayerPosition(player, 0.2);
          this.chargeDir.set(pred.x - this.position.x, 0, pred.z - this.position.z).normalize();
          this.rotationY = Math.atan2(this.chargeDir.x, this.chargeDir.z);
          this.model.rotation.y = this.rotationY;
          return;
        }

        const dartWeave = Math.sin(this.walkAnimTime * 2.2) * 0.52;
        const moveAngle = distToPlayer > 2.5 ? directAngle + dartWeave : directAngle;
        this.rotationY = directAngle;
        this.model.rotation.y = this.rotationY;

        if (distToPlayer > 2.35) {
          this.position.x += Math.sin(moveAngle) * this.speed * delta;
          this.position.z += Math.cos(moveAngle) * this.speed * delta;
        } else if (this.attackCooldown <= 0 && !this.attackAnimType) {
          this.attackCooldown = 0.58;
          this.attackComboStep++;
          this.startAttackAnimation(
            'chomper_rapid_bite',
            0.35,
            0.34,
            () => {
              this.spawnSlashArc(1.9, 0x9b59b6, 0.3, 1.2, 0.15);
              if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 3.0) {
                this.inflictDamageToPlayer(player, 14, '-14 🦖 Rỉa Chân!', '#ff6b81');
              }
            },
            0.78,
            () => {
              this.spawnSlashArc(1.9, 0xf39c12, -0.3, 1.2, 0.15);
              if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 3.0) {
                this.inflictDamageToPlayer(player, 15, '-15 🦖 Cắn Nhấp Nhả!', '#ffa502');
              }
            }
          );
        }
        return;
      }
    }

    // =========================================================================
    // B. HÀNH VI NHÓM QUÁI LỚN HẠNG NẶNG (LARGE / SLOW / HEAVY MULTI-STAGE / HIGH DMG / EASY DODGE)
    // - Sải bước chậm rãi (1.75 - 1.95), xoay người chậm
    // - Khi vào tầm đánh, KHÓA HƯỚNG và tung 1 trong 3 thế đánh hạng nặng (kéo dài 1.5s - 1.82s)
    // - Luôn có Vòng Cảnh Báo Đỏ/Cam (Telegraph AOE) từ 1.0s - 1.28s trước khi chạm đất -> Cực dễ né!
    // - Đánh trúng gây sát thương khổng lồ (180 - 245 ST) + hất văng + nổ đá 3D mặt đất
    // =========================================================================

    // Xoay thân chậm nặng nề về phía người chơi khi đang đi bộ
    let rotDiff = directAngle - this.rotationY;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    this.rotationY += rotDiff * Math.min(1.0, delta * 2.2);
    this.model.rotation.y = this.rotationY;

    // 🦂 Pháo kích tầm xa của Thiết Giáp Cự Hạt Vương khi người chơi đứng xa (8.5m - 26m)
    if (this.type === 'flame_scorpion' && distToPlayer >= 8.5 && distToPlayer <= 26.0 && this.specialCooldown <= 0 && !this.attackAnimType) {
      this.specialCooldown = 6.2;
      this.attackCooldown = 2.8;
      this.aiState = 'windup';
      this.stateTimer = 0;
      this.stateDuration = 1.65;
      const targetSpot = this.predictPlayerPosition(player, 0.45);
      // Cảnh báo rõ ràng suốt 1.25s trước khi pháo độc rơi xuống
      this.spawnTelegraphAOE(targetSpot, 5.0, 1.25, 0x2ed573, null);
      this.startAttackAnimation('scorpion_heavy_mortar', 1.65, 0.76, () => {
        this.emitHeavyGroundImpact(targetSpot, 5.0, 0x2ed573, 5, player);
        if (player && !player.isDead && Math.hypot(player.position.x - targetSpot.x, player.position.z - targetSpot.z) <= 5.0) {
          this.inflictDamageToPlayer(player, 210, '-210 🦂 CỰ HẠT ĐỘC PHÁO!', '#2ed573', 'slow', 16);
        }
        this.spawnPoisonPool(targetSpot, 4.8, 4.5, 25);
      });
      return;
    }

    const engageRange = this.hitRadius + 2.4;
    if (distToPlayer > engageRange) {
      this.position.x += Math.sin(this.rotationY) * this.speed * delta;
      this.position.z += Math.cos(this.rotationY) * this.speed * delta;
      return;
    }

    // Khi đã vào tầm cận chiến và hồi chiêu xong -> Chọn 1 trong 3 Thế Đánh Hạng Nặng của từng loài Quái Lớn
    if (this.attackCooldown <= 0 && !this.attackAnimType) {
      this.attackCooldown = 2.7 + Math.random() * 0.6;
      const moveVariant = this.attackComboStep % 3;
      this.attackComboStep++;

      // Khóa hướng ngay lúc bắt đầu lấy đà để người chơi dễ dàng lách qua bên hông hoặc lùi ra ngoài
      this.rotationY = directAngle;
      this.model.rotation.y = this.rotationY;
      const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));

      if (this.type === 'golem') {
        if (moveVariant === 0) {
          // THỨC 1: KHAI SƠN ĐỘC THỦ (Vặn mình giương cao tay phải đập sập mặt đất)
          const totalDur = 1.58;
          const impactRatio = 0.68; // 1.07s lấy đà cảnh báo
          const strikePos = this.position.clone().addScaledVector(forward, 3.2);
          this.aiState = 'windup';
          this.stateTimer = 0;
          this.stateDuration = totalDur;
          this.spawnTelegraphAOE(strikePos, 4.5, totalDur * impactRatio, 0xffa502, null);
          this.startAttackAnimation('golem_heavy_overhead', totalDur, impactRatio, () => {
            this.spawnSlashArc(4.8, 0xffaa00, Math.PI / 2, 3.2, 0.38);
            this.emitHeavyGroundImpact(strikePos, 4.5, 0xffa502, 6, player);
            if (Math.hypot(player.position.x - strikePos.x, player.position.z - strikePos.z) <= 4.5) {
              this.inflictDamageToPlayer(player, 185, '-185 🗿 KHAI SƠN ĐỘC THỦ!', '#ffa502', null, 18);
            }
          });
        } else if (moveVariant === 1) {
          // THỨC 2: HOÀNH TẢO CỰ THẠCH (Kéo tay đá ra sau lưng 135 độ rồi quét ngang cực mạnh)
          const totalDur = 1.62;
          const impactRatio = 0.66; // 1.07s lấy đà cảnh báo
          const strikePos = this.position.clone().addScaledVector(forward, 2.8);
          this.aiState = 'windup';
          this.stateTimer = 0;
          this.stateDuration = totalDur;
          this.spawnTelegraphAOE(strikePos, 4.8, totalDur * impactRatio, 0xff7f50, null);
          this.startAttackAnimation('golem_colossal_sweep', totalDur, impactRatio, () => {
            this.spawnSlashArc(5.4, 0xff7f50, 0.12, 2.8, 0.4);
            this.emitHeavyGroundImpact(strikePos, 4.8, 0xff7f50, 5, player);
            if (Math.hypot(player.position.x - strikePos.x, player.position.z - strikePos.z) <= 4.8) {
              this.inflictDamageToPlayer(player, 195, '-195 🗿 HOÀNH TẢO CỰ THẠCH!', '#ff7f50', null, 20);
            }
          });
        } else {
          // THỨC 3: THÁI CỔ SONG QUYỀN ĐỊA CHẤN (Nhón chân giương 2 tay đá khổng lồ đập sập cả thân người)
          const totalDur = 1.85;
          const impactRatio = 0.70; // 1.30s lấy đà cảnh báo
          const strikePos = this.position.clone().addScaledVector(forward, 2.6);
          this.aiState = 'windup';
          this.stateTimer = 0;
          this.stateDuration = totalDur;
          this.spawnTelegraphAOE(strikePos, 5.8, totalDur * impactRatio, 0xff4757, null);
          this.startAttackAnimation('golem_double_titan_slam', totalDur, impactRatio, () => {
            this.spawnSlashArc(5.8, 0xff4757, Math.PI / 2, 3.0, 0.42);
            this.emitHeavyGroundImpact(strikePos, 5.8, 0xff4757, 8, player);
            if (Math.hypot(player.position.x - strikePos.x, player.position.z - strikePos.z) <= 5.8) {
              this.inflictDamageToPlayer(player, 245, '-245 💥 SONG QUYỀN ĐỊA CHẤN!', '#ff4757', null, 24);
            }
          });
        }
      } else if (this.type === 'flame_scorpion') {
        if (moveVariant === 0) {
          // THỨC 1: SONG CÀNG ĐOẠT MỆNH (Mở rộng 2 càng thiết giáp sang 2 bên rồi kẹp sập chéo)
          const totalDur = 1.54;
          const impactRatio = 0.66; // 1.02s cảnh báo
          const strikePos = this.position.clone().addScaledVector(forward, 3.2);
          this.aiState = 'windup';
          this.stateTimer = 0;
          this.stateDuration = totalDur;
          this.spawnTelegraphAOE(strikePos, 4.4, totalDur * impactRatio, 0xff7f50, null);
          this.startAttackAnimation('scorpion_guillotine_crush', totalDur, impactRatio, () => {
            this.spawnSlashArc(4.8, 0xff7f50, 0.25, 2.0, 0.36);
            this.emitHeavyGroundImpact(strikePos, 4.4, 0xff7f50, 5, player);
            if (Math.hypot(player.position.x - strikePos.x, player.position.z - strikePos.z) <= 4.4) {
              this.inflictDamageToPlayer(player, 180, '-180 🦂 SONG CÀNG ĐOẠT MỆNH!', '#ff7f50', null, 16);
            }
          });
        } else if (moveVariant === 1) {
          // THỨC 2: THIÊN CHU ĐỘC KÍCH (Uốn cong 4 đốt đuôi khổng lồ lên đỉnh đầu rồi đâm ngập ngòi độc xuống đất)
          const totalDur = 1.72;
          const impactRatio = 0.68; // 1.17s cảnh báo
          const strikePos = this.position.clone().addScaledVector(forward, 3.6);
          this.aiState = 'windup';
          this.stateTimer = 0;
          this.stateDuration = totalDur;
          this.spawnTelegraphAOE(strikePos, 4.7, totalDur * impactRatio, 0x2ed573, null);
          this.startAttackAnimation('scorpion_tail_impale', totalDur, impactRatio, () => {
            this.spawnSlashArc(5.0, 0x2ed573, Math.PI / 2, 2.6, 0.4);
            this.emitHeavyGroundImpact(strikePos, 4.7, 0x2ed573, 6, player);
            if (Math.hypot(player.position.x - strikePos.x, player.position.z - strikePos.z) <= 4.7) {
              this.inflictDamageToPlayer(player, 215, '-215 🦂 THIÊN CHU ĐỘC KÍCH!', '#2ed573', 'slow', 18);
            }
          });
        } else {
          // THỨC 3: DUNG NHAM ĐỘC PHÁO CẬN CHIẾN (Quật đuôi nổ độc địa chấn quanh thân)
          const totalDur = 1.78;
          const impactRatio = 0.70; // 1.25s cảnh báo
          const strikePos = this.position.clone().addScaledVector(forward, 3.0);
          this.aiState = 'windup';
          this.stateTimer = 0;
          this.stateDuration = totalDur;
          this.spawnTelegraphAOE(strikePos, 5.2, totalDur * impactRatio, 0x2ed573, null);
          this.startAttackAnimation('scorpion_heavy_mortar', totalDur, impactRatio, () => {
            this.emitHeavyGroundImpact(strikePos, 5.2, 0x2ed573, 6, player);
            if (Math.hypot(player.position.x - strikePos.x, player.position.z - strikePos.z) <= 5.2) {
              this.inflictDamageToPlayer(player, 225, '-225 🦂 ĐỘC LONG ĐỊA CHẤN!', '#2ed573', 'slow', 20);
            }
            this.spawnPoisonPool(strikePos, 4.5, 4.0, 24);
          });
        }
      } else if (this.type === 'jade_guardian') {
        if (moveVariant === 0) {
          // THỨC 1: THẦN SƯ GIÁNG THẾ (Chồm dựng đứng 2 chân trước lên trời rồi vồ sập xuống đất)
          const totalDur = 1.65;
          const impactRatio = 0.68; // 1.12s cảnh báo
          const strikePos = this.position.clone().addScaledVector(forward, 3.4);
          this.aiState = 'windup';
          this.stateTimer = 0;
          this.stateDuration = totalDur;
          this.spawnTelegraphAOE(strikePos, 4.8, totalDur * impactRatio, 0x1dd1a1, null);
          this.startAttackAnimation('guardian_titan_pounce', totalDur, impactRatio, () => {
            this.spawnSlashArc(5.2, 0x1dd1a1, 0.35, 2.8, 0.38);
            this.emitHeavyGroundImpact(strikePos, 4.8, 0x1dd1a1, 6, player);
            if (Math.hypot(player.position.x - strikePos.x, player.position.z - strikePos.z) <= 4.8) {
              this.inflictDamageToPlayer(player, 205, '-205 🦁 THẦN SƯ GIÁNG THẾ!', '#1dd1a1', null, 20);
            }
          });
        } else if (moveVariant === 1) {
          // THỨC 2: NGỌC TRẢO KHAI THIÊN (Nghiêng bờm vàng giơ cao chân ngọc phải rồi tát sập mặt đất)
          const totalDur = 1.55;
          const impactRatio = 0.66; // 1.02s cảnh báo
          const strikePos = this.position.clone().addScaledVector(forward, 3.1);
          this.aiState = 'windup';
          this.stateTimer = 0;
          this.stateDuration = totalDur;
          this.spawnTelegraphAOE(strikePos, 4.5, totalDur * impactRatio, 0xffd32a, null);
          this.startAttackAnimation('guardian_heavy_paw_crush', totalDur, impactRatio, () => {
            this.spawnSlashArc(5.0, 0xffd32a, -0.3, 2.6, 0.36);
            this.emitHeavyGroundImpact(strikePos, 4.5, 0xffd32a, 5, player);
            if (Math.hypot(player.position.x - strikePos.x, player.position.z - strikePos.z) <= 4.5) {
              this.inflictDamageToPlayer(player, 185, '-185 🦁 NGỌC TRẢO KHAI THIÊN!', '#ffd32a', null, 17);
            }
          });
        } else {
          // THỨC 3: HÀN BĂNG SƯ TỬ HỐNG (Thu cổ tụ lực pháp luân rồi gầm nổ tung băng giá)
          const totalDur = 1.80;
          const impactRatio = 0.70; // 1.26s cảnh báo
          const strikePos = this.position.clone().addScaledVector(forward, 3.6);
          this.aiState = 'windup';
          this.stateTimer = 0;
          this.stateDuration = totalDur;
          this.spawnTelegraphAOE(strikePos, 5.8, totalDur * impactRatio, 0x00d2d3, null);
          this.startAttackAnimation('guardian_glacier_roar', totalDur, impactRatio, () => {
            this.emitHeavyGroundImpact(strikePos, 5.8, 0x00d2d3, 7, player);
            if (Math.hypot(player.position.x - strikePos.x, player.position.z - strikePos.z) <= 5.8) {
              this.inflictDamageToPlayer(player, 230, '-230 ❄️ HÀN BĂNG SƯ TỬ HỐNG!', '#00d2d3', 'freeze', 22);
            }
          });
        }
      }
    }
  }

  // =========================================================================
  // HỆ THỐNG PROCEDURAL ANIMATION TẤN CÔNG CHI TIẾT:
  // - QUÁI NHỎ: Nhanh, dồn dập nhiều nhịp (flurry / double-bite / quick-dart)
  // - QUÁI LỚN: Chậm mà nhiều pha (1. Lấy đà gồng rung -> 2. Giáng đòn nghìn cân -> 3. Kẹt lún đất -> 4. Rút vũ khí nặng nhọc)
  // =========================================================================
  applyAttackAnimation(delta) {
    if (!this.attackAnimType) return false;

    this.attackAnimTimer += delta;
    const p = Math.min(1.0, this.attackAnimTimer / this.attackAnimDuration);

    // Nhịp sát thương chính (Impact frame 1)
    if (!this.pendingStrikeTriggered && p >= this.pendingStrikeRatio) {
      this.pendingStrikeTriggered = true;
      if (this.pendingStrikeCallback) {
        this.pendingStrikeCallback();
      }
    }

    // Nhịp sát thương phụ liên hoàn (dành cho Quái Nhỏ đánh 2 nhát liên tiếp)
    if (!this.secondaryStrikeTriggered && p >= this.secondaryStrikeRatio) {
      this.secondaryStrikeTriggered = true;
      if (this.secondaryStrikeCallback) {
        this.secondaryStrikeCallback();
      }
    }

    const type = this.attackAnimType;

    // -------------------------------------------------------------------------
    // I. ANIMATION QUÁI LỚN HẠNG NẶNG (4 PHA RÕ RỆT & SỨC NẶNG NGÀN CÂN)
    // -------------------------------------------------------------------------
    if (type === 'golem_heavy_overhead') {
      // 🗿 Thức 1 Thạch Yêu: Vặn xoắn thân sang phải, nhấc bổng tay đá phải lên đỉnh đầu rung gồng -> Đập sập -> Kẹt dưới đất -> Kéo lên
      if (p < 0.58) {
        const w = p / 0.58;
        const easeW = w * w * (3 - 2 * w);
        const tremor = w > 0.5 ? Math.sin(p * 55) * 0.08 : 0;
        this.torso.rotation.y = -0.78 * easeW + tremor;
        this.torso.rotation.x = -0.35 * easeW;
        this.torso.position.y = 3.2 + 0.55 * easeW;
        this.armR.rotation.x = -2.95 * easeW + tremor;
        this.armR.rotation.z = -0.35 * easeW;
        this.armL.rotation.x = 0.75 * easeW;
        this.legR.position.y = 1.8 + 0.45 * easeW;
      } else if (p < 0.70) {
        // Pha 2: Giáng sập nghìn cân xuống đất
        const s = (p - 0.58) / 0.12;
        const slam = s * s;
        this.torso.rotation.y = THREE.MathUtils.lerp(-0.78, 0.55, slam);
        this.torso.rotation.x = THREE.MathUtils.lerp(-0.35, 0.58, slam);
        this.torso.position.y = THREE.MathUtils.lerp(3.75, 2.25, slam);
        this.torso.position.z = 1.15 * slam;
        this.armR.rotation.x = THREE.MathUtils.lerp(-2.95, -0.35, slam);
        this.legR.position.y = 1.8;
      } else if (p < 0.85) {
        // Pha 3: Nắm đấm đá KẸT LÚN DƯỚI ĐẤT, thân rung chấn vì sức nặng
        const stuckShake = Math.sin(p * 45) * 0.04;
        this.torso.rotation.y = 0.55;
        this.torso.rotation.x = 0.58 + stuckShake;
        this.torso.position.y = 2.25;
        this.torso.position.z = 1.15;
        this.armR.rotation.x = -0.35 + stuckShake;
      } else {
        // Pha 4: Gồng vai rút nắm đấm đá từ dưới đất lên nặng nhọc
        const r = (p - 0.85) / 0.15;
        this.torso.rotation.y = THREE.MathUtils.lerp(0.55, 0, r);
        this.torso.rotation.x = THREE.MathUtils.lerp(0.58, 0, r);
        this.torso.position.y = THREE.MathUtils.lerp(2.25, 3.2, r);
        this.torso.position.z = THREE.MathUtils.lerp(1.15, 0, r);
        this.armR.rotation.x = THREE.MathUtils.lerp(-0.35, 0, r);
        this.armR.rotation.z = THREE.MathUtils.lerp(-0.35, 0, r);
        this.armL.rotation.x = THREE.MathUtils.lerp(0.75, 0, r);
      }
    } else if (type === 'golem_colossal_sweep') {
      // 🗿 Thức 2 Thạch Yêu: Mở vai kéo ngược cánh tay đá 135 độ ra sau lưng -> Quét ngang 180 độ -> Đà quán tính làm xoay lệch người -> Thu thế
      if (p < 0.56) {
        const w = p / 0.56;
        const easeW = w * w * (3 - 2 * w);
        const tremor = w > 0.5 ? Math.sin(p * 50) * 0.07 : 0;
        this.torso.rotation.y = 1.05 * easeW + tremor;
        this.torso.rotation.z = -0.18 * easeW;
        this.armL.rotation.x = -1.55 * easeW;
        this.armL.rotation.z = 1.45 * easeW + tremor;
        this.armR.rotation.x = 0.65 * easeW;
      } else if (p < 0.70) {
        const s = (p - 0.56) / 0.14;
        const sweep = s * s;
        this.torso.rotation.y = THREE.MathUtils.lerp(1.05, -1.05, sweep);
        this.torso.rotation.x = 0.38 * sweep;
        this.torso.position.z = 0.95 * sweep;
        this.armL.rotation.x = -1.55;
        this.armL.rotation.z = THREE.MathUtils.lerp(1.45, -1.35, sweep);
      } else if (p < 0.84) {
        // Quán tính nặng làm thân đá chúi nghiêng sang phải
        this.torso.rotation.y = -1.05;
        this.torso.rotation.x = 0.38;
        this.torso.position.z = 0.95;
        this.armL.rotation.x = -1.55;
        this.armL.rotation.z = -1.35;
      } else {
        const r = (p - 0.84) / 0.16;
        this.torso.rotation.y = THREE.MathUtils.lerp(-1.05, 0, r);
        this.torso.rotation.x = THREE.MathUtils.lerp(0.38, 0, r);
        this.torso.rotation.z = THREE.MathUtils.lerp(-0.18, 0, r);
        this.torso.position.z = THREE.MathUtils.lerp(0.95, 0, r);
        this.armL.rotation.x = THREE.MathUtils.lerp(-1.55, 0, r);
        this.armL.rotation.z = THREE.MathUtils.lerp(-1.35, 0, r);
        this.armR.rotation.x = THREE.MathUtils.lerp(0.65, 0, r);
      }
    } else if (type === 'golem_double_titan_slam') {
      // 🗿 Thức 3 Thạch Yêu: Nhón chân nhấc bổng cả 2 tay đá khổng lồ lên trời gồng rung -> Đập sập toàn thân xuống đất -> Kẹt lún cả 2 tay -> Gượng dậy
      if (p < 0.62) {
        const w = p / 0.62;
        const easeW = w * w * (3 - 2 * w);
        const tremor = w > 0.45 ? Math.sin(p * 65) * 0.1 : 0;
        this.torso.position.y = 3.2 + 0.95 * easeW;
        this.torso.rotation.x = -0.45 * easeW;
        this.armL.rotation.x = -3.05 * easeW + tremor;
        this.armR.rotation.x = -3.05 * easeW - tremor;
        this.armL.rotation.z = 0.3 * easeW;
        this.armR.rotation.z = -0.3 * easeW;
      } else if (p < 0.72) {
        const s = (p - 0.62) / 0.10;
        const crush = s * s;
        this.torso.position.y = THREE.MathUtils.lerp(4.15, 2.05, crush);
        this.torso.rotation.x = THREE.MathUtils.lerp(-0.45, 0.65, crush);
        this.torso.position.z = 1.2 * crush;
        this.armL.rotation.x = THREE.MathUtils.lerp(-3.05, -0.4, crush);
        this.armR.rotation.x = THREE.MathUtils.lerp(-3.05, -0.4, crush);
      } else if (p < 0.86) {
        // Cả 2 tay đá lún sâu dưới mặt đất
        const shake = Math.sin(p * 50) * 0.04;
        this.torso.position.y = 2.05;
        this.torso.rotation.x = 0.65 + shake;
        this.torso.position.z = 1.2;
        this.armL.rotation.x = -0.4 + shake;
        this.armR.rotation.x = -0.4 - shake;
      } else {
        const r = (p - 0.86) / 0.14;
        this.torso.position.y = THREE.MathUtils.lerp(2.05, 3.2, r);
        this.torso.rotation.x = THREE.MathUtils.lerp(0.65, 0, r);
        this.torso.position.z = THREE.MathUtils.lerp(1.2, 0, r);
        this.armL.rotation.x = THREE.MathUtils.lerp(-0.4, 0, r);
        this.armR.rotation.x = THREE.MathUtils.lerp(-0.4, 0, r);
        this.armL.rotation.z = THREE.MathUtils.lerp(0.3, 0, r);
        this.armR.rotation.z = THREE.MathUtils.lerp(-0.3, 0, r);
      }
    } else if (type === 'scorpion_guillotine_crush') {
      // 🦂 Thức 1 Cự Hạt: Mở rộng 2 càng thiết giáp sang 2 bên + nâng cao thân trước lấy đà -> Kẹp sập chéo xuống đất -> Càng kẹt đất -> Rút về
      if (p < 0.58) {
        const w = p / 0.58;
        const easeW = w * w * (3 - 2 * w);
        const tremor = w > 0.5 ? Math.sin(p * 55) * 0.07 : 0;
        this.torso.position.y = 1.65 + 0.55 * easeW;
        this.torso.rotation.x = -0.35 * easeW;
        this.armL.rotation.y = -0.95 * easeW + tremor;
        this.armR.rotation.y = 0.95 * easeW - tremor;
        this.armL.rotation.x = -0.85 * easeW;
        this.armR.rotation.x = -0.85 * easeW;
        this.tail.rotation.x = -0.45 * easeW;
      } else if (p < 0.70) {
        const s = (p - 0.58) / 0.12;
        const snap = s * s;
        this.torso.position.y = THREE.MathUtils.lerp(2.2, 1.25, snap);
        this.torso.rotation.x = THREE.MathUtils.lerp(-0.35, 0.35, snap);
        this.torso.position.z = 1.05 * snap;
        this.armL.rotation.y = THREE.MathUtils.lerp(-0.95, 0.85, snap);
        this.armR.rotation.y = THREE.MathUtils.lerp(0.95, -0.85, snap);
        this.armL.rotation.x = THREE.MathUtils.lerp(-0.85, 0.35, snap);
        this.armR.rotation.x = THREE.MathUtils.lerp(-0.85, 0.35, snap);
      } else if (p < 0.85) {
        this.torso.position.y = 1.25;
        this.torso.rotation.x = 0.35;
        this.torso.position.z = 1.05;
        this.armL.rotation.y = 0.85;
        this.armR.rotation.y = -0.85;
      } else {
        const r = (p - 0.85) / 0.15;
        this.torso.position.y = THREE.MathUtils.lerp(1.25, 1.65, r);
        this.torso.rotation.x = THREE.MathUtils.lerp(0.35, 0, r);
        this.torso.position.z = THREE.MathUtils.lerp(1.05, 0, r);
        this.armL.rotation.y = THREE.MathUtils.lerp(0.85, 0, r);
        this.armR.rotation.y = THREE.MathUtils.lerp(-0.85, 0, r);
        this.armL.rotation.x = THREE.MathUtils.lerp(0.35, 0, r);
        this.armR.rotation.x = THREE.MathUtils.lerp(0.35, 0, r);
        this.tail.rotation.x = THREE.MathUtils.lerp(-0.45, 0, r);
      }
    } else if (type === 'scorpion_tail_impale') {
      // 🦂 Thức 2 Cự Hạt: Uốn cong 4 đốt đuôi khổng lồ dựng đứng lên trời rung lắc -> Đâm ngập ngòi độc xuống mặt đất -> Ngòi độc cắm kẹt dưới đất -> Giật nhổ lên
      if (p < 0.60) {
        const w = p / 0.60;
        const easeW = w * w * (3 - 2 * w);
        const tremor = w > 0.45 ? Math.sin(p * 60) * 0.09 : 0;
        this.torso.rotation.x = 0.25 * easeW;
        this.torso.position.z = -0.55 * easeW;
        this.tail.rotation.x = -0.85 * easeW + tremor;
        this.armL.rotation.y = -0.55 * easeW;
        this.armR.rotation.y = 0.55 * easeW;
      } else if (p < 0.70) {
        const s = (p - 0.60) / 0.10;
        const stab = s * s;
        this.torso.rotation.x = THREE.MathUtils.lerp(0.25, -0.22, stab);
        this.torso.position.z = THREE.MathUtils.lerp(-0.55, 1.15, stab);
        this.tail.rotation.x = THREE.MathUtils.lerp(-0.85, 1.55, stab);
      } else if (p < 0.86) {
        // Ngòi độc cắm sâu dưới đất, đuôi rung giật để rút ra
        const tug = Math.sin(p * 55) * 0.06;
        this.torso.position.z = 1.15;
        this.tail.rotation.x = 1.55 + tug;
      } else {
        const r = (p - 0.86) / 0.14;
        this.torso.rotation.x = THREE.MathUtils.lerp(-0.22, 0, r);
        this.torso.position.z = THREE.MathUtils.lerp(1.15, 0, r);
        this.tail.rotation.x = THREE.MathUtils.lerp(1.55, 0, r);
        this.armL.rotation.y = THREE.MathUtils.lerp(-0.55, 0, r);
        this.armR.rotation.y = THREE.MathUtils.lerp(0.55, 0, r);
      }
    } else if (type === 'scorpion_heavy_mortar') {
      // 🦂 Thức 3 Cự Hạt: Nén thấp toàn bộ giáp lưng lấy đà rồi quật mạnh đuôi bắn pháo độc hạng nặng
      if (p < 0.64) {
        const w = p / 0.64;
        const tremor = Math.sin(p * 50) * 0.06;
        this.torso.position.y = 1.65 - 0.45 * w;
        this.torso.rotation.x = 0.32 * w;
        this.tail.rotation.x = -0.65 * w + tremor;
      } else if (p < 0.78) {
        const s = (p - 0.64) / 0.14;
        this.torso.position.y = THREE.MathUtils.lerp(1.2, 2.05, s);
        this.torso.rotation.x = THREE.MathUtils.lerp(0.32, -0.25, s);
        this.tail.rotation.x = THREE.MathUtils.lerp(-0.65, 1.35, s);
      } else {
        const r = (p - 0.78) / 0.22;
        this.torso.position.y = THREE.MathUtils.lerp(2.05, 1.65, r);
        this.torso.rotation.x = THREE.MathUtils.lerp(-0.25, 0, r);
        this.tail.rotation.x = THREE.MathUtils.lerp(1.35, 0, r);
      }
    } else if (type === 'guardian_titan_pounce') {
      // 🦁 Thức 1 Cự Thần Sư: Chồm dựng đứng 2 chân trước lên trời lấy đà -> Vồ sập toàn bộ sức nặng hàng tấn xuống đất -> Lún sâu -> Đứng dậy
      if (p < 0.60) {
        const w = p / 0.60;
        const easeW = w * w * (3 - 2 * w);
        const tremor = w > 0.5 ? Math.sin(p * 55) * 0.07 : 0;
        this.torso.rotation.x = -0.78 * easeW + tremor;
        this.torso.position.y = 2.9 + 1.55 * easeW;
        this.armL.rotation.x = -2.15 * easeW;
        this.armR.rotation.x = -2.15 * easeW;
        if (this.guardianHalo) this.guardianHalo.rotation.z += delta * 10;
      } else if (p < 0.72) {
        const s = (p - 0.60) / 0.12;
        const slam = s * s;
        this.torso.rotation.x = THREE.MathUtils.lerp(-0.78, 0.48, slam);
        this.torso.position.y = THREE.MathUtils.lerp(4.45, 2.15, slam);
        this.torso.position.z = 1.25 * slam;
        this.armL.rotation.x = THREE.MathUtils.lerp(-2.15, 0.55, slam);
        this.armR.rotation.x = THREE.MathUtils.lerp(-2.15, 0.55, slam);
      } else if (p < 0.86) {
        this.torso.rotation.x = 0.48;
        this.torso.position.y = 2.15;
        this.torso.position.z = 1.25;
      } else {
        const r = (p - 0.86) / 0.14;
        this.torso.rotation.x = THREE.MathUtils.lerp(0.48, 0, r);
        this.torso.position.y = THREE.MathUtils.lerp(2.15, 2.9, r);
        this.torso.position.z = THREE.MathUtils.lerp(1.25, 0, r);
        this.armL.rotation.x = THREE.MathUtils.lerp(0.55, 0, r);
        this.armR.rotation.x = THREE.MathUtils.lerp(0.55, 0, r);
      }
    } else if (type === 'guardian_heavy_paw_crush') {
      // 🦁 Thức 2 Cự Thần Sư: Nghiêng bờm vàng giơ cao chân ngọc phải -> Tát sập móng vuốt xuống mặt đất -> Giữ thế đè nặng -> Thu chân
      if (p < 0.58) {
        const w = p / 0.58;
        const easeW = w * w * (3 - 2 * w);
        this.torso.rotation.y = -0.68 * easeW;
        this.torso.rotation.z = 0.25 * easeW;
        this.torso.position.y = 2.9 + 0.65 * easeW;
        this.armR.rotation.x = -2.45 * easeW;
        this.armR.rotation.z = -0.55 * easeW;
      } else if (p < 0.70) {
        const s = (p - 0.58) / 0.12;
        const swipe = s * s;
        this.torso.rotation.y = THREE.MathUtils.lerp(-0.68, 0.55, swipe);
        this.torso.rotation.x = 0.38 * swipe;
        this.torso.position.y = THREE.MathUtils.lerp(3.55, 2.35, swipe);
        this.torso.position.z = 1.05 * swipe;
        this.armR.rotation.x = THREE.MathUtils.lerp(-2.45, 0.35, swipe);
        this.armR.rotation.z = THREE.MathUtils.lerp(-0.55, 0.45, swipe);
      } else if (p < 0.85) {
        this.torso.rotation.y = 0.55;
        this.torso.rotation.x = 0.38;
        this.torso.position.y = 2.35;
        this.torso.position.z = 1.05;
      } else {
        const r = (p - 0.85) / 0.15;
        this.torso.rotation.y = THREE.MathUtils.lerp(0.55, 0, r);
        this.torso.rotation.x = THREE.MathUtils.lerp(0.38, 0, r);
        this.torso.rotation.z = THREE.MathUtils.lerp(0.25, 0, r);
        this.torso.position.y = THREE.MathUtils.lerp(2.35, 2.9, r);
        this.torso.position.z = THREE.MathUtils.lerp(1.05, 0, r);
        this.armR.rotation.x = THREE.MathUtils.lerp(0.35, 0, r);
        this.armR.rotation.z = THREE.MathUtils.lerp(0.45, 0, r);
      }
    } else if (type === 'guardian_glacier_roar') {
      // 🦁 Thức 3 Cự Thần Sư: Thu cổ về sau tụ hàn khí, pháp luân xoay tít -> Rướn cổ gầm nổ tung sóng băng giá
      if (p < 0.64) {
        const w = p / 0.64;
        const tremor = Math.sin(p * 60) * 0.06;
        this.torso.position.z = -0.65 * w;
        this.torso.rotation.x = -0.25 * w;
        this.head.position.z = 1.45 - 0.35 * w;
        this.head.scale.setScalar(1.0 + 0.22 * w + tremor);
        if (this.guardianHalo) this.guardianHalo.rotation.z += delta * 18;
      } else {
        const s = (p - 0.64) / 0.36;
        const roar = Math.sin(s * Math.PI);
        this.torso.position.z = 0.95 * roar;
        this.torso.rotation.x = 0.32 * roar;
        this.head.position.z = 1.45 + 0.85 * roar;
        this.head.scale.setScalar(1.0 + 0.32 * roar);
        if (this.guardianHalo) this.guardianHalo.rotation.z += delta * 24;
      }
    }

    // -------------------------------------------------------------------------
    // II. ANIMATION QUÁI NHỎ (CHỚP NHOÁNG, LIÊN HOÀN NHIỀU NHỊP, LINH HOẠT)
    // -------------------------------------------------------------------------
    else if (type === 'chomper_rapid_bite') {
      // 🦖 Tiểu Thú đớp liên hoàn 2 phát cực nhanh vào chân người chơi
      const biteWave = Math.sin(p * Math.PI * 2);
      this.torso.position.z = Math.abs(biteWave) * 0.95;
      this.torso.rotation.x = Math.abs(biteWave) * 0.38;
      this.torso.rotation.y = biteWave * 0.35;
      this.head.scale.setScalar(1.0 + Math.abs(biteWave) * 0.28);
      this.tail.rotation.y = -biteWave * 0.85;
    } else if (type === 'fox_quick_dart') {
      // 🦊 Tiểu Hồ Yêu nhảy chân sáo vẫy 9 đuôi bắn liên thanh 2 tia lửa
      const pulse = Math.sin(p * Math.PI * 2);
      this.torso.position.y = 2.4 + Math.abs(pulse) * 0.45;
      this.torso.rotation.y = pulse * 0.32;
      this.armL.rotation.x = -1.45 * Math.abs(pulse);
      this.armR.rotation.x = -1.45 * Math.abs(pulse);
      if (this.foxOrb) {
        this.foxOrb.position.z = 1.6 + Math.abs(pulse) * 0.95;
        this.foxOrb.scale.setScalar(1.0 + Math.abs(pulse) * 0.5);
      }
      if (this.foxTails) {
        for (let i = 0; i < this.foxTails.length; i++) {
          const tail = this.foxTails[i];
          tail.rotation.x = tail.userData.baseX + Math.abs(pulse) * 0.55;
        }
      }
    } else if (type === 'fox_spin_evade') {
      this.torso.rotation.y = p * Math.PI * 2;
    } else if (type === 'wraith_rapid_flurry') {
      // 👻 Tiểu Quỷ chém liên hoàn trái - phải siêu tốc
      const slashWave = Math.sin(p * Math.PI * 2);
      this.torso.rotation.y = slashWave * 0.85;
      this.torso.position.z = Math.abs(slashWave) * 0.65;
      this.armR.rotation.x = -1.55;
      this.armR.rotation.z = slashWave * 1.45;
      if (this.orbitSwordNodes) {
        for (const sw of this.orbitSwordNodes) {
          const r = 2.1 + Math.abs(slashWave) * 1.1;
          sw.position.set(Math.cos(sw.userData.baseAngle) * r, 0, Math.sin(sw.userData.baseAngle) * r);
          sw.rotation.x = Math.abs(slashWave) * 1.3;
        }
      }
    } else if (type === 'wraith_blink_poke') {
      // 👻 Tiểu Quỷ lướt ra sau lưng đâm chọc nhanh
      const thrust = Math.sin(p * Math.PI);
      this.torso.position.z = thrust * 1.1;
      this.torso.rotation.x = thrust * 0.35;
      this.armR.rotation.x = -1.8 * thrust;
    }

    // -------------------------------------------------------------------------
    // III. ANIMATION ĐẠI BOSS HẮC LONG MA ĐẾ
    // -------------------------------------------------------------------------
    else if (type === 'boss_ cleave_lr' || type === 'boss_wave_slash') {
      if (p < 0.42) {
        const w = p / 0.42;
        this.torso.rotation.y = -0.75 * w;
        this.armR.rotation.x = -1.45 * w;
        this.armR.rotation.z = -1.25 * w;
        this.armL.rotation.x = -0.8 * w;
      } else {
        const s = (p - 0.42) / 0.58;
        this.torso.rotation.y = THREE.MathUtils.lerp(-0.75, 0.85, Math.min(1, s * 1.7));
        this.torso.rotation.x = 0.25 * Math.sin(s * Math.PI);
        this.armR.rotation.x = -1.55;
        this.armR.rotation.z = THREE.MathUtils.lerp(-1.25, 1.35, Math.min(1, s * 1.7));
      }
    } else if (type === 'boss_overhead_slam') {
      if (p < 0.45) {
        const w = p / 0.45;
        this.torso.rotation.x = -0.35 * w;
        this.armR.rotation.x = -2.85 * w;
        this.armL.rotation.x = -2.4 * w;
      } else {
        const s = (p - 0.45) / 0.55;
        this.torso.rotation.x = THREE.MathUtils.lerp(-0.35, 0.42, Math.min(1, s * 1.8));
        this.armR.rotation.x = THREE.MathUtils.lerp(-2.85, -0.35, Math.min(1, s * 1.8));
        this.armL.rotation.x = THREE.MathUtils.lerp(-2.4, -0.5, Math.min(1, s * 1.8));
      }
    } else if (type === 'boss_thrust') {
      if (p < 0.38) {
        const w = p / 0.38;
        this.torso.rotation.y = -0.45 * w;
        this.armR.rotation.x = 0.65 * w;
      } else {
        const s = (p - 0.38) / 0.62;
        const thrust = Math.sin(s * Math.PI);
        this.torso.rotation.y = 0.35 * thrust;
        this.torso.position.z = 1.25 * thrust;
        this.armR.rotation.x = -1.85 * thrust;
      }
    } else if (type === 'boss_summon_sky') {
      const lift = Math.sin(p * Math.PI);
      this.torso.position.y = 4.6 + lift * 1.8;
      this.head.rotation.x = -0.45 * lift;
      this.armR.rotation.x = -2.95 * lift;
      this.armL.rotation.x = -2.5 * lift;
      if (this.wingL && this.wingR) {
        this.wingL.rotation.y = 0.55 * lift;
        this.wingR.rotation.y = -0.55 * lift;
      }
    }

    // Kết thúc chu kỳ animation tấn công -> Đưa các khớp về vị trí cân bằng
    if (this.attackAnimTimer >= this.attackAnimDuration) {
      this.attackAnimType = null;
      this.pendingStrikeCallback = null;
      this.secondaryStrikeCallback = null;
      if (this.torso) {
        this.torso.rotation.set(0, 0, 0);
        this.torso.position.z = 0;
      }
      if (this.head) {
        this.head.rotation.set(0, 0, 0);
        this.head.scale.setScalar(1.0);
        if (this.type === 'jade_guardian') this.head.position.z = 1.45;
      }
      if (this.armL) this.armL.rotation.set(0, 0, 0);
      if (this.armR) this.armR.rotation.set(0, 0, 0);
      if (this.tail) this.tail.rotation.set(this.type === 'chomper' ? -Math.PI / 2.5 : (this.type === 'jade_guardian' ? -0.8 : 0), 0, 0);
      if (this.foxOrb) {
        this.foxOrb.position.z = 1.6;
        this.foxOrb.scale.setScalar(1.0);
      }
    }
    return true;
  }

  update(delta, playerPos, camera, player = null) {
    // 1. Cập nhật các hiệu ứng kỹ năng, vệt chém 3D, vòng cảnh báo, đạn và vùng độc
    this.updateActiveEffects(delta, player);

    // 2. Thanh máu luôn xoay về Camera (Billboard)
    if (camera && this.healthBarGroup) {
      this.healthBarGroup.quaternion.copy(camera.quaternion);
    }

    // 3. Xử lý trạng thái CHẾT & Hồi sinh
    if (this.isDead) {
      this.respawnTimer -= delta;
      if (!this.popped && this.popTimer !== undefined) {
        // Phồng to & trắng xoá trong tích tắc rồi nổ bung thành hạt
        const inflate = this.isBoss ? 0.28 : (this.isLarge ? 0.16 : 0.11);
        this.popTimer += delta;
        const k = Math.min(1, this.popTimer / inflate);
        this.model.scale.setScalar(this.baseModelScale * (1 + 0.32 * k * k));
        for (const mat of this.damageableMaterials) {
          if (mat.emissive) mat.emissive.setHex(0xffffff);
        }
        if (k >= 1) {
          this.popped = true;
          this.model.visible = false;
          const c = this.position.clone().add(new THREE.Vector3(0, this.hitHeight * 0.45, 0));
          const color = this.config.barColor || 0xffffff;
          const n = this.isBoss ? 70 : (this.isLarge ? 40 : 24);
          this.particles.emitElementalParticles(c, n, [color, 0xffffff, color], [5, this.isBoss ? 16 : 11], 0.7, 7.0, this.isLarge ? 1.4 : 1.0);
          this.particles.emitShockwave(c, color, this.isBoss ? 14 : (this.isLarge ? 8 : 4.5), 0.35);
          sound.playPop?.(this.isLarge);
        }
      }
      this.healthBarGroup.visible = false;
      // Ẩn vệt bóng dưới chân để không để lại vết tối trên mặt đất khi quái đã chết / tan biến / chờ giáng thế
      if (this.contactShadow) this.contactShadow.visible = false;

      if (!this.respawnPaused && this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    // 4. Xử lý trạng thái BỊ ĐÓNG BĂNG
    if (this.isFrozen) {
      this.freezeTimer -= delta;
      if (this.freezeTimer <= 0) {
        this.isFrozen = false;
      }
      for (const mat of this.damageableMaterials) {
        if (mat.emissive) mat.emissive.setHex(0x00d2d3);
      }
      this.model.position.x = (Math.random() - 0.5) * 0.12;
      this.model.position.z = (Math.random() - 0.5) * 0.12;
      return;
    } else {
      this.model.position.x = 0;
      this.model.position.z = 0;
    }

    // 5. Hiệu ứng nhấp nháy khi bị trúng đòn hoặc đang Cuồng Nộ
    if (this.whiteFlashTimer > 0) {
      this.whiteFlashTimer -= delta;
      this.hitFlashTimer -= delta;
      for (const mat of this.damageableMaterials) {
        if (mat.emissive) mat.emissive.setHex(0xffffff);
      }
    } else if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      for (const mat of this.damageableMaterials) {
        if (mat.emissive) mat.emissive.setHex(0xff3333);
      }
    } else {
      const baseEmissive = this.isBoss && this.isEnraged ? 0x3b0808 : 0x000000;
      for (const mat of this.damageableMaterials) {
        if (mat.emissive) mat.emissive.setHex(baseEmissive);
      }
    }

    // 6. Áp dụng phản lực Đẩy lùi (Knockback Velocity) & Trọng lực vật lý liên tục
    if (Math.abs(this.velocity.x) > 0.001 || Math.abs(this.velocity.z) > 0.001) {
      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
      this.velocity.x *= 0.88;
      this.velocity.z *= 0.88;
      if (Math.abs(this.velocity.x) < 0.001) this.velocity.x = 0;
      if (Math.abs(this.velocity.z) < 0.001) this.velocity.z = 0;
    }

    const groundY = getTerrainHeight(this.position.x, this.position.z);
    if (this.aiState !== 'leaping') {
      if (this.position.y > groundY || this.velocity.y !== 0) {
        this.velocity.y -= 24 * delta;
        this.position.y += this.velocity.y * delta;
      }
      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.velocity.y = 0;
      }
    }

    if (this.torso && !this.attackAnimType) {
      this.torso.position.z = THREE.MathUtils.lerp(this.torso.position.z, 0, delta * 6);
    }

    // 7. CẬP NHẬT AI CHIẾN ĐẤU & DI CHUYỂN
    const distToPlayer = playerPos ? this.position.distanceTo(playerPos) : 999;
    if (this.kit) {
      this.kit.update(delta, player, distToPlayer);
    } else if (this.isBoss) {
      this.updateBossAI(delta, player, distToPlayer);
    } else {
      this.updateMonsterAI(delta, player, distToPlayer);
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, -120, 120);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -120, 120);

    // Đảm bảo không bao giờ bị lơ lửng sau khi AI di chuyển
    const finalGroundY = getTerrainHeight(this.position.x, this.position.z);
    if (this.aiState !== 'leaping' && this.position.y <= finalGroundY) {
      this.position.y = finalGroundY;
      this.velocity.y = 0;
    }

    this.group.position.copy(this.position);

    if (this.contactShadow) {
      this.contactShadow.position.set(this.position.x, groundY + 0.025, this.position.z);
      const heightAbove = Math.max(0, this.position.y - groundY);
      this.shadowMat.opacity = this.isDead ? 0 : Math.max(0.06, (this.isBoss ? 0.62 : (this.isLarge ? 0.52 : 0.34)) - heightAbove * 0.04);
      const s = Math.max(0.35, 1.0 - heightAbove * 0.05);
      this.contactShadow.scale.set(s, s, s);
    }

    // Boss có bộ kỹ năng riêng tự điều khiển animation của mình
    if (this.kit) {
      this.walkAnimTime += delta * 3.6;
      this.kit.animate(delta);
      return;
    }

    // 8. PROCEDURAL ANIMATION: TƯƠNG PHẢN NHỊP BƯỚC GIỮA QUÁI NHỎ (THOĂN THOẮT 11.5x) & QUÁI LỚN (NẶNG NỀ 2.35x)
    const stepFreq = this.isBoss
      ? 3.8
      : (this.isLarge ? 2.35 : (this.aiState === 'charging' ? 16.0 : 11.2));
    this.walkAnimTime += delta * stepFreq;
    const stepSwing = Math.sin(this.walkAnimTime) * (this.isLarge ? 0.38 : 0.55);

    if (this.legL) this.legL.rotation.x = stepSwing;
    if (this.legR) this.legR.rotation.x = -stepSwing;

    // Bụi đất dưới gót chân nặng nề của Quái Lớn khi di chuyển gần người chơi
    if (this.isLarge && !this.isBoss && !this.attackAnimType && distToPlayer < 35) {
      this.stepDustTimer += delta;
      if (this.stepDustTimer >= 0.85) {
        this.stepDustTimer = 0;
        if (this.particles) {
          this.particles.emitDust(this.position);
        }
      }
    }

    // Cập nhật các bộ phận xoay liên tục (Pháp luân, Ngọc Châu, Kiếm Hộ Thể, Cánh Rồng)
    if (this.foxOrb) {
      this.foxOrb.rotation.y += delta * 5.0;
      this.foxOrb.rotation.x += delta * 3.0;
    }
    if (this.orbitSwords) {
      this.orbitSwords.rotation.y += delta * (this.attackAnimType ? 14.0 : 6.0);
    }
    if (this.guardianHalo) {
      this.guardianHalo.rotation.z += delta * 1.8;
    }
    if (this.isBoss) {
      if (this.bossAuraRing) this.bossAuraRing.rotation.y += delta * (this.isEnraged ? 2.4 : 1.1);
      if (this.bossHalo) this.bossHalo.rotation.z -= delta * (this.isEnraged ? 3.2 : 1.5);
      if (this.wingL && this.wingR) {
        const flap = Math.sin(this.walkAnimTime * (this.isEnraged ? 1.4 : 0.85)) * 0.28;
        this.wingL.rotation.y = flap;
        this.wingR.rotation.y = -flap;
      }
      if (this.aiState === 'leaping') {
        this.torso.rotation.x = 0.45;
        this.armR.rotation.x = -2.6;
        this.armL.rotation.x = -2.2;
        return;
      }
      if (this.aiState === 'guarding') {
        this.torso.rotation.x = -0.1;
        this.armR.rotation.x = -1.6;
        this.armL.rotation.x = -1.6;
        return;
      }
      if (this.aiState === 'beam_charging') {
        this.torso.rotation.x = -0.25 - Math.min(0.3, this.stateTimer * 0.25);
        this.armR.rotation.x = -0.6;
        this.armL.rotation.x = -0.6;
        return;
      }
      if (this.aiState === 'channeling') {
        this.torso.rotation.x = 0.35;
        this.armR.rotation.x = -1.2 + Math.sin(this.walkAnimTime * 5) * 0.08;
        this.armL.rotation.x = -1.2;
        return;
      }
    }

    // Nếu đang thực hiện Animation Tấn Công -> Ưu tiên điều khiển khớp xương theo thế đánh
    if (this.applyAttackAnimation(delta)) {
      return;
    }

    // Animation bước đi / tuần tra mặc định khi không ra đòn
    if (this.type === 'golem') {
      this.armL.rotation.x = -stepSwing * 0.55;
      this.armR.rotation.x = stepSwing * 0.55;
      // Nghiêng vai nặng trịch sang hai bên theo từng bước dậm chân của Cự Thạch Yêu
      this.torso.rotation.z = Math.sin(this.walkAnimTime) * 0.09;
      this.torso.position.y = 3.2 - Math.abs(Math.cos(this.walkAnimTime)) * 0.26;
    } else if (this.type === 'chomper') {
      this.tail.rotation.y = Math.sin(this.walkAnimTime) * 0.42;
      this.head.rotation.z = Math.sin(this.walkAnimTime) * 0.1;
      this.head.rotation.x = this.aiState === 'charging' ? 0.55 : 0;
      this.torso.rotation.x = this.aiState === 'charging' ? 0.3 : 0;
      this.torso.position.y = 2.8 + Math.abs(Math.sin(this.walkAnimTime)) * 0.35;
    } else if (this.type === 'fox_mage') {
      this.torso.position.y = 2.4 + Math.sin(this.walkAnimTime * 0.9) * 0.24;
      if (this.foxTails) {
        for (let i = 0; i < this.foxTails.length; i++) {
          const tail = this.foxTails[i];
          tail.rotation.x = tail.userData.baseX;
          tail.rotation.z = tail.userData.baseZ;
          tail.rotation.y = Math.sin(this.walkAnimTime + i * 0.5) * 0.28;
        }
      }
    } else if (this.type === 'sword_wraith') {
      this.torso.position.y = 2.7 + Math.sin(this.walkAnimTime) * 0.36;
      if (this.orbitSwordNodes) {
        for (const sw of this.orbitSwordNodes) {
          sw.position.set(Math.cos(sw.userData.baseAngle) * 2.1, 0, Math.sin(sw.userData.baseAngle) * 2.1);
          sw.rotation.x = 0;
        }
      }
    } else if (this.type === 'flame_scorpion') {
      this.torso.position.y = 1.65 - Math.abs(Math.cos(this.walkAnimTime)) * 0.18;
      this.torso.rotation.z = Math.sin(this.walkAnimTime) * 0.06;
      if (this.tail) {
        this.tail.rotation.x = Math.sin(this.walkAnimTime * 0.8) * 0.18;
      }
      this.armL.rotation.y = Math.sin(this.walkAnimTime) * 0.22;
      this.armR.rotation.y = -Math.sin(this.walkAnimTime) * 0.22;
    } else if (this.type === 'jade_guardian') {
      this.torso.position.y = 2.9 - Math.abs(Math.cos(this.walkAnimTime)) * 0.22;
      this.torso.rotation.z = Math.sin(this.walkAnimTime) * 0.07;
    } else if (this.isBoss) {
      this.torso.position.y = 4.6 + Math.sin(this.walkAnimTime * 0.7) * 0.25;
      this.armL.rotation.x = -stepSwing * 0.5;
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, stepSwing * 0.5, delta * 5);
    }
  }
}
