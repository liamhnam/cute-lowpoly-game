import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';

// Cấu hình chi tiết 7 chủng loại Yêu Ma & Đại Boss trong Trường An Cổ Đô
export const MONSTER_CONFIGS = {
  golem: {
    name: 'Thái Cổ Thạch Yêu',
    icon: '🗿',
    maxHp: 480,
    speed: 2.5,
    hitRadius: 2.8,
    hitHeight: 6.5,
    barColor: 0x2ecc71,
    flankOffset: 0.0,
    respawnTime: 11.0,
    xpMpReward: 30,
  },
  chomper: {
    name: 'Hắc Diễm Linh Thú',
    icon: '🦖',
    maxHp: 340,
    speed: 3.4,
    hitRadius: 2.5,
    hitHeight: 5.5,
    barColor: 0x2ecc71,
    flankOffset: 0.45,
    respawnTime: 9.5,
    xpMpReward: 25,
  },
  fox_mage: {
    name: 'Cửu Vĩ Hồ Yêu',
    icon: '🦊',
    maxHp: 280,
    speed: 4.2,
    hitRadius: 2.0,
    hitHeight: 4.8,
    barColor: 0xff6b8b,
    flankOffset: -0.6,
    respawnTime: 10.0,
    xpMpReward: 30,
  },
  sword_wraith: {
    name: 'U Minh Kiếm Linh',
    icon: '👻',
    maxHp: 320,
    speed: 4.8,
    hitRadius: 2.1,
    hitHeight: 5.2,
    barColor: 0xa29bfe,
    flankOffset: 0.85,
    respawnTime: 10.5,
    xpMpReward: 35,
  },
  flame_scorpion: {
    name: 'Xích Diễm Hạt Vương',
    icon: '🦂',
    maxHp: 540,
    speed: 3.1,
    hitRadius: 2.9,
    hitHeight: 4.6,
    barColor: 0xff7f50,
    flankOffset: -0.35,
    respawnTime: 13.0,
    xpMpReward: 40,
  },
  jade_guardian: {
    name: 'Thanh Ngọc Thần Sư',
    icon: '🦁',
    maxHp: 650,
    speed: 2.9,
    hitRadius: 3.0,
    hitHeight: 6.2,
    barColor: 0x00d2d3,
    flankOffset: 0.25,
    respawnTime: 14.0,
    xpMpReward: 45,
  },
  boss_dragon_emperor: {
    name: 'HẮC LONG MA ĐẾ',
    icon: '🐉',
    isBoss: true,
    maxHp: 3500,
    speed: 3.8,
    hitRadius: 3.8,
    hitHeight: 9.5,
    barColor: 0xff3838,
    flankOffset: 0.0,
    respawnTime: 25.0,
    xpMpReward: 100,
  },
};

export class Monster {
  constructor(scene, particles, type = 'golem', spawnPos = new THREE.Vector3(), world = null) {
    this.scene = scene;
    this.particles = particles;
    this.type = MONSTER_CONFIGS[type] ? type : 'golem';
    this.config = MONSTER_CONFIGS[this.type];
    this.isBoss = Boolean(this.config.isBoss);
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
    this.hitFlashTimer = 0;
    this.velocity = new THREE.Vector3();
    this.flankSign = Math.random() < 0.5 ? 1 : -1;
    this.strafePhase = Math.random() * Math.PI * 2;

    // Trạng thái chiến đấu & Kỹ năng AI
    this.attackCooldown = 1.0 + Math.random() * 0.8;
    this.specialCooldown = 2.8 + Math.random() * 1.8;
    this.aiState = 'idle'; // 'idle' | 'windup' | 'charging' | 'leaping' | 'channeling'
    this.stateTimer = 0;
    this.stateDuration = 0;
    this.currentSkillName = '⚡ Sẵn sàng chiến đấu';
    this.chargeDir = new THREE.Vector3();
    this.leapStart = new THREE.Vector3();
    this.leapTarget = new THREE.Vector3();

    // Hệ thống Animation Tấn Công chuyên biệt (3 pha: Lấy đà -> Ra đòn -> Thu thế)
    this.attackAnimType = null;
    this.attackAnimTimer = 0;
    this.attackAnimDuration = 0.6;
    this.attackComboStep = 0;
    this.pendingStrikeCallback = null;
    this.pendingStrikeTriggered = false;
    this.pendingStrikeRatio = 0.45;

    // Giai đoạn Cuồng Nộ của Đại Boss
    this.isEnraged = false;
    this.bossSkillCycle = 0;

    // Danh sách đạn, vòng cảnh báo, vệt chém 3D, sóng xung kích & bẫy độc
    this.activeEffects = [];

    // Hiệu ứng trạng thái: Đóng băng & Đẩy lùi
    this.isFrozen = false;
    this.freezeTimer = 0;

    // Kích thước va chạm
    this.hitRadius = this.config.hitRadius;
    this.hitHeight = this.config.hitHeight;
    this.damageableMaterials = [];

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

  // Kích hoạt animation tấn công kèm callback đúng thời điểm ra đòn (impact frame)
  startAttackAnimation(animType, duration = 0.6, impactRatio = 0.45, onImpact = null) {
    this.attackAnimType = animType;
    this.attackAnimTimer = 0;
    this.attackAnimDuration = duration;
    this.pendingStrikeRatio = impactRatio;
    this.pendingStrikeCallback = onImpact;
    this.pendingStrikeTriggered = false;
  }

  buildContactShadow() {
    const radius = this.isBoss ? 4.2 : this.hitRadius * 0.88;
    const geo = new THREE.CircleGeometry(radius, 20);
    geo.rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: this.isBoss ? 0x2c041c : 0x111111,
      transparent: true,
      opacity: this.isBoss ? 0.58 : 0.42,
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
    }

    this.group.add(this.model);
  }

  // 1. 🗿 THÁI CỔ THẠCH YÊU (MOSS GOLEM - CẬN CHIẾN ĐỊA CHẤN)
  buildGolemMesh() {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, flatShading: true, roughness: 0.9 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x589b4a, flatShading: true, roughness: 0.85 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    this.damageableMaterials = [stoneMat, mossMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 3.2;

    const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 1), stoneMat);
    mainRock.scale.set(1.3, 1.1, 1.1);
    mainRock.castShadow = true;
    this.torso.add(mainRock);

    const mossPatch = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), mossMat);
    mossPatch.position.set(0.6, 1.0, 0.4);
    mossPatch.scale.set(1.1, 0.5, 1.0);
    this.torso.add(mossPatch);

    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xff6b8b, flatShading: true });
    const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), flowerMat);
    flower.position.set(0.5, 2.2, 0);
    this.torso.add(flower);

    this.head = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), stoneMat);
    this.head.position.set(0, 1.5, 0.5);
    this.head.castShadow = true;
    this.torso.add(this.head);

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.15), eyeMat);
    eyeL.position.set(-0.4, 1.6, 1.45);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.15), eyeMat);
    eyeR.position.set(0.4, 1.6, 1.45);
    this.torso.add(eyeL, eyeR);

    const talisman = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.75),
      new THREE.MeshBasicMaterial({ color: 0xffdd59, side: THREE.DoubleSide })
    );
    talisman.position.set(0, 1.85, 1.62);
    talisman.rotation.x = -0.15;
    this.torso.add(talisman);

    const runeCinnabar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xee5253, side: THREE.DoubleSide })
    );
    runeCinnabar.position.set(0, 1.85, 1.63);
    runeCinnabar.rotation.x = -0.15;
    this.torso.add(runeCinnabar);

    this.armL = new THREE.Group();
    this.armL.position.set(-2.2, 0.8, 0);
    const armLMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), stoneMat);
    armLMesh.scale.set(0.8, 1.6, 0.8);
    armLMesh.position.y = -0.7;
    armLMesh.castShadow = true;
    this.armL.add(armLMesh);
    this.torso.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(2.2, 0.8, 0);
    const armRMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), stoneMat);
    armRMesh.scale.set(0.8, 1.6, 0.8);
    armRMesh.position.y = -0.7;
    armRMesh.castShadow = true;
    this.armR.add(armRMesh);
    this.torso.add(this.armR);

    this.model.add(this.torso);

    this.legL = new THREE.Group();
    this.legL.position.set(-1.1, 1.8, 0);
    const legLMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), stoneMat);
    legLMesh.scale.set(0.9, 1.4, 0.9);
    legLMesh.castShadow = true;
    this.legL.add(legLMesh);
    this.model.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(1.1, 1.8, 0);
    const legRMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), stoneMat);
    legRMesh.scale.set(0.9, 1.4, 0.9);
    legRMesh.castShadow = true;
    this.legR.add(legRMesh);
    this.model.add(this.legR);
  }

  // 2. 🦖 HẮC DIỄM LINH THÚ (KING CHOMPER - XUNG PHONG HÚC ĐẦU)
  buildChomperMesh() {
    const dinoMat = new THREE.MeshStandardMaterial({ color: 0x9b59b6, flatShading: true, roughness: 0.8 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf39c12, flatShading: true, roughness: 0.8 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.4, roughness: 0.3, flatShading: true });
    this.damageableMaterials = [dinoMat, bellyMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 2.8;

    const dinoBody = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3, 1), dinoMat);
    dinoBody.scale.set(1.1, 1.25, 1.3);
    dinoBody.castShadow = true;
    this.torso.add(dinoBody);

    const belly = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), bellyMat);
    belly.position.set(0, -0.3, 1.1);
    belly.scale.set(0.9, 1.1, 0.6);
    this.torso.add(belly);

    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 5), crownMat);
      spike.position.set(0, 1.2 - i * 0.55, -1.2 - i * 0.35);
      spike.rotation.x = -0.65;
      this.torso.add(spike);
    }

    this.head = new THREE.Group();
    this.head.position.set(0, 1.8, 0.8);
    const headMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), dinoMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.45, 5), crownMat);
    crown.position.set(0, 1.6, 0);
    this.head.add(crown);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const eyeSparkle = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), eyeMat);
      eye.position.set(side * 0.9, 0.3, 1.1);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeSparkle);
      spark.position.set(side * 0.95, 0.4, 1.3);
      this.head.add(eye, spark);
    }
    this.torso.add(this.head);

    this.tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.5, 6), dinoMat);
    this.tail.rotation.x = -Math.PI / 2.5;
    this.tail.position.set(0, -0.6, -2.2);
    this.torso.add(this.tail);

    this.model.add(this.torso);

    this.legL = new THREE.Group();
    this.legL.position.set(-1.2, 1.4, 0.2);
    const legLMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), dinoMat);
    legLMesh.scale.set(0.9, 1.3, 1.1);
    legLMesh.castShadow = true;
    this.legL.add(legLMesh);
    this.model.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(1.2, 1.4, 0.2);
    const legRMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), dinoMat);
    legRMesh.scale.set(0.9, 1.3, 1.1);
    legRMesh.castShadow = true;
    this.legR.add(legRMesh);
    this.model.add(this.legR);
  }

  // 3. 🦊 CỬU VĨ HỒ YÊU (NINE-TAILED FOX MAGE - PHÁP SƯ HỒ HỎA TẦM XA)
  buildFoxMageMesh() {
    const whiteFurMat = new THREE.MeshStandardMaterial({ color: 0xfff0f6, flatShading: true, roughness: 0.7 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff6b8b, flatShading: true, roughness: 0.65 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd32a, metalness: 0.5, roughness: 0.3, flatShading: true });
    const orbMat = new THREE.MeshBasicMaterial({ color: 0xff4757 });
    this.damageableMaterials = [whiteFurMat, pinkMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 2.4;

    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.15, 2.3, 8), whiteFurMat);
    bodyMesh.castShadow = true;
    this.torso.add(bodyMesh);

    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.95, 0.55, 8), pinkMat);
    sash.position.y = 0.2;
    this.torso.add(sash);

    this.head = new THREE.Group();
    this.head.position.set(0, 1.65, 0.25);
    const headBase = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), whiteFurMat);
    headBase.castShadow = true;
    this.head.add(headBase);

    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.95, 6), whiteFurMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.1, 0.95);
    this.head.add(snout);

    const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), orbMat);
    mark.position.set(0, 0.35, 0.88);
    this.head.add(mark);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd980fa });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.12), eyeMat);
      eye.position.set(side * 0.42, 0.12, 0.82);
      eye.rotation.z = -side * 0.22;
      this.head.add(eye);

      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.15, 5), pinkMat);
      ear.position.set(side * 0.55, 0.98, 0);
      ear.rotation.z = -side * 0.28;
      this.head.add(ear);
    }
    this.torso.add(this.head);

    this.tailGroup = new THREE.Group();
    this.tailGroup.position.set(0, -0.35, -0.85);
    this.foxTails = [];
    for (let i = 0; i < 9; i++) {
      const angle = ((i - 4) / 4) * 1.25;
      const tailPivot = new THREE.Group();
      tailPivot.userData.baseZ = angle;
      tailPivot.userData.baseX = -0.55 - Math.abs(i - 4) * 0.06;
      tailPivot.rotation.z = tailPivot.userData.baseZ;
      tailPivot.rotation.x = tailPivot.userData.baseX;

      const tailMain = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.4, 6), whiteFurMat);
      tailMain.position.y = 1.1;
      tailMain.castShadow = true;
      const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 6), pinkMat);
      tailTip.position.y = 2.15;
      tailPivot.add(tailMain, tailTip);

      this.tailGroup.add(tailPivot);
      this.foxTails.push(tailPivot);
    }
    this.torso.add(this.tailGroup);

    this.foxOrb = new THREE.Group();
    this.foxOrb.position.set(0, 0.7, 1.6);
    const coreOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), orbMat);
    const ringOrb = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 16), goldMat);
    this.foxOrb.add(coreOrb, ringOrb);
    this.torso.add(this.foxOrb);
    this.floatingParts.push(this.foxOrb);

    this.armL = new THREE.Group();
    this.armL.position.set(-0.95, 0.6, 0.2);
    this.armL.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.1, 6), pinkMat));
    this.torso.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(0.95, 0.6, 0.2);
    this.armR.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.1, 6), pinkMat));
    this.torso.add(this.armR);

    this.model.add(this.torso);

    this.legL = new THREE.Group();
    this.legL.position.set(-0.45, 0.9, 0);
    this.legL.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 1.2, 6), whiteFurMat));
    this.model.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(0.45, 0.9, 0);
    this.legR.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 1.2, 6), whiteFurMat));
    this.model.add(this.legR);
  }

  // 4. 👻 U MINH KIẾM LINH (SWORD WRAITH - SÁT THỦ ÁM ẢNH THUẤN BỘ)
  buildSwordWraithMesh() {
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x2c2c54, flatShading: true, roughness: 0.85 });
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x706fd3, flatShading: true, roughness: 0.6 });
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x00d2d3 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2ed573 });
    this.damageableMaterials = [cloakMat, innerMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 2.7;

    const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.2, 7), cloakMat);
    cloak.position.y = -0.2;
    cloak.castShadow = true;
    this.torso.add(cloak);

    const chestArmor = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), innerMat);
    chestArmor.position.y = 0.55;
    this.torso.add(chestArmor);

    this.head = new THREE.Group();
    this.head.position.set(0, 1.55, 0.1);
    const voidHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 1), new THREE.MeshBasicMaterial({ color: 0x111118 }));
    this.head.add(voidHead);

    const hat = new THREE.Mesh(new THREE.ConeGeometry(1.65, 0.62, 10), cloakMat);
    hat.position.y = 0.45;
    hat.castShadow = true;
    this.head.add(hat);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), eyeMat);
      eye.position.set(side * 0.26, 0.05, 0.55);
      this.head.add(eye);
    }
    this.torso.add(this.head);

    this.orbitSwords = new THREE.Group();
    this.orbitSwords.position.y = 0.6;
    this.orbitSwordNodes = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const swGroup = new THREE.Group();
      swGroup.userData.baseAngle = angle;
      swGroup.position.set(Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 0.06), bladeMat);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.14), innerMat);
      guard.position.y = -0.8;
      swGroup.add(blade, guard);
      swGroup.rotation.z = 0.25;
      this.orbitSwords.add(swGroup);
      this.orbitSwordNodes.push(swGroup);
    }
    this.torso.add(this.orbitSwords);

    this.armL = new THREE.Group();
    this.armL.position.set(-1.1, 0.5, 0.3);
    this.armL.add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.3, 5), cloakMat));
    this.torso.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(1.1, 0.5, 0.3);
    const mainSword = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.08), bladeMat);
    mainSword.position.set(0, -0.5, 1.0);
    mainSword.rotation.x = Math.PI / 2.2;
    this.armR.add(mainSword);
    this.torso.add(this.armR);

    this.model.add(this.torso);

    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.model.add(this.legL, this.legR);
  }

  // 5. 🦂 XÍCH DIỄM HẠT VƯƠNG (FLAME SCORPION KING - PHÁO KÍCH ĐỘC DỊCH)
  buildFlameScorpionMesh() {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xb33939, flatShading: true, roughness: 0.55, metalness: 0.25 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c2c54, flatShading: true, roughness: 0.7 });
    const venomMat = new THREE.MeshBasicMaterial({ color: 0x2ed573 });
    this.damageableMaterials = [shellMat, darkMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 1.65;

    const thorax = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 1), shellMat);
    thorax.scale.set(1.15, 0.72, 1.55);
    thorax.castShadow = true;
    this.torso.add(thorax);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.25, 1.65);
    const face = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), darkMat);
    this.head.add(face);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), venomMat);
      eye.position.set(side * 0.42, 0.28, 0.72);
      this.head.add(eye);
    }
    this.torso.add(this.head);

    this.armL = new THREE.Group();
    this.armL.position.set(-1.65, 0.1, 1.5);
    const clawL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), shellMat);
    clawL.scale.set(0.8, 0.6, 1.7);
    clawL.position.z = 0.6;
    clawL.castShadow = true;
    this.armL.add(clawL);
    this.torso.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(1.65, 0.1, 1.5);
    const clawR = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), shellMat);
    clawR.scale.set(0.8, 0.6, 1.7);
    clawR.position.z = 0.6;
    clawR.castShadow = true;
    this.armR.add(clawR);
    this.torso.add(this.armR);

    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.4, -1.9);
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58 - i * 0.07, 0), shellMat);
      seg.position.set(0, i * 0.75, -i * 0.2 + (i >= 2 ? (i - 1.5) * 0.65 : 0));
      this.tail.add(seg);
    }
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.25, 6), venomMat);
    stinger.position.set(0, 2.85, 0.55);
    stinger.rotation.x = Math.PI / 2.2;
    this.tail.add(stinger);
    this.torso.add(this.tail);

    this.model.add(this.torso);

    this.legL = new THREE.Group();
    this.legL.position.set(-1.5, 0.9, 0);
    this.legR = new THREE.Group();
    this.legR.position.set(1.5, 0.9, 0);
    for (let i = -1; i <= 1; i++) {
      const lMesh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.28), darkMat);
      lMesh.position.set(-0.3, -0.2, i * 1.0);
      lMesh.rotation.z = 0.45;
      this.legL.add(lMesh);

      const rMesh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.28), darkMat);
      rMesh.position.set(0.3, -0.2, i * 1.0);
      rMesh.rotation.z = -0.45;
      this.legR.add(rMesh);
    }
    this.model.add(this.legL, this.legR);
  }

  // 6. 🦁 THANH NGỌC THẦN SƯ (JADE GUARDIAN LION - HỘ ĐIỆN TINH ANH)
  buildJadeGuardianMesh() {
    const jadeMat = new THREE.MeshStandardMaterial({ color: 0x1dd1a1, flatShading: true, roughness: 0.35, metalness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd32a, flatShading: true, roughness: 0.3, metalness: 0.65 });
    const iceMat = new THREE.MeshBasicMaterial({ color: 0x48dbfb });
    this.damageableMaterials = [jadeMat, goldMat];

    this.torso = new THREE.Group();
    this.torso.position.y = 2.9;

    const lionBody = new THREE.Mesh(new THREE.DodecahedronGeometry(2.1, 1), jadeMat);
    lionBody.scale.set(1.15, 1.05, 1.35);
    lionBody.castShadow = true;
    this.torso.add(lionBody);

    this.guardianHalo = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.12, 8, 20), goldMat);
    this.guardianHalo.position.set(0, 1.1, -0.4);
    this.torso.add(this.guardianHalo);

    this.head = new THREE.Group();
    this.head.position.set(0, 1.45, 1.45);
    const mane = new THREE.Mesh(new THREE.DodecahedronGeometry(1.55, 1), goldMat);
    mane.scale.set(1.15, 1.15, 0.85);
    this.head.add(mane);

    const face = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 0), jadeMat);
    face.position.z = 0.45;
    this.head.add(face);

    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), iceMat);
    pearl.position.set(0, -0.35, 1.35);
    this.head.add(pearl);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), iceMat);
      eye.position.set(side * 0.48, 0.25, 1.3);
      this.head.add(eye);
    }
    this.torso.add(this.head);

    this.tail = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.8, 6), goldMat);
    this.tail.position.set(0, 0.5, -2.3);
    this.tail.rotation.x = -0.8;
    this.torso.add(this.tail);

    this.armL = new THREE.Group();
    this.armL.position.set(-1.35, -0.6, 1.1);
    this.armL.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.8, 7), jadeMat));
    this.torso.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(1.35, -0.6, 1.1);
    this.armR.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.8, 7), jadeMat));
    this.torso.add(this.armR);

    this.model.add(this.torso);

    this.legL = new THREE.Group();
    this.legL.position.set(-1.25, 1.3, -1.0);
    this.legL.add(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 1.9, 7), jadeMat));
    this.model.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(1.25, 1.3, -1.0);
    this.legR.add(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 1.9, 7), jadeMat));
    this.model.add(this.legR);
  }

  // 7. 🐉 ĐẠI BOSS TRẤN THÀNH: HẮC LONG MA ĐẾ (WORLD BOSS)
  buildBossDragonEmperorMesh() {
    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x1e1b2e, flatShading: true, roughness: 0.45, metalness: 0.45 });
    const crimsonMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, flatShading: true, roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd32a, flatShading: true, roughness: 0.25, metalness: 0.75 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff3838 });
    this.damageableMaterials = [obsidianMat, crimsonMat, goldMat];

    this.bossAuraRing = new THREE.Group();
    this.bossAuraRing.position.y = 0.08;
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(3.4, 4.1, 28),
      new THREE.MeshBasicMaterial({ color: 0xff3838, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
    );
    outerRing.rotateX(-Math.PI / 2);
    const innerStar = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.3, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd32a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    innerStar.rotateX(-Math.PI / 2);
    this.bossAuraRing.add(outerRing, innerStar);
    this.model.add(this.bossAuraRing);

    this.torso = new THREE.Group();
    this.torso.position.y = 4.6;

    const chest = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), obsidianMat);
    chest.scale.set(1.25, 1.35, 0.95);
    chest.castShadow = true;
    this.torso.add(chest);

    const robeLower = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.8, 3.2, 8), crimsonMat);
    robeLower.position.y = -2.1;
    robeLower.castShadow = true;
    this.torso.add(robeLower);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.55, 8), goldMat);
    belt.position.y = -0.8;
    this.torso.add(belt);

    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35, 0), goldMat);
      pauldron.position.set(side * 2.8, 1.4, 0);
      pauldron.scale.set(1.2, 0.85, 1.1);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 5), flameMat);
      horn.position.set(side * 3.3, 2.2, 0);
      horn.rotation.z = -side * 0.65;
      this.torso.add(pauldron, horn);
    }

    this.head = new THREE.Group();
    this.head.position.set(0, 2.75, 0.35);
    const helm = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35, 1), obsidianMat);
    helm.castShadow = true;
    this.head.add(helm);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.75, 0.85, 6), goldMat);
    crown.position.y = 1.25;
    this.head.add(crown);

    for (const side of [-1, 1]) {
      const dragonHorn = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.2, 6), goldMat);
      dragonHorn.position.set(side * 1.1, 1.65, -0.2);
      dragonHorn.rotation.z = -side * 0.55;
      dragonHorn.rotation.x = -0.25;
      this.head.add(dragonHorn);

      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.16), flameMat);
      eye.position.set(side * 0.45, 0.15, 1.22);
      eye.rotation.z = -side * 0.2;
      this.head.add(eye);
    }
    this.torso.add(this.head);

    this.wingL = new THREE.Group();
    this.wingL.position.set(-1.2, 1.4, -1.2);
    this.wingR = new THREE.Group();
    this.wingR.position.set(1.2, 1.4, -1.2);
    for (let i = 0; i < 3; i++) {
      const featherL = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.8 - i * 0.6, 4), crimsonMat);
      featherL.position.set(-1.6 - i * 0.9, 0.6 - i * 0.4, 0);
      featherL.rotation.z = 1.1 + i * 0.22;
      this.wingL.add(featherL);

      const featherR = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.8 - i * 0.6, 4), crimsonMat);
      featherR.position.set(1.6 + i * 0.9, 0.6 - i * 0.4, 0);
      featherR.rotation.z = -1.1 - i * 0.22;
      this.wingR.add(featherR);
    }
    this.torso.add(this.wingL, this.wingR);

    this.bossHalo = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.16, 8, 24), flameMat);
    this.bossHalo.position.set(0, 1.5, -1.55);
    this.torso.add(this.bossHalo);

    this.armL = new THREE.Group();
    this.armL.position.set(-2.9, 0.7, 0.3);
    const armLMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), obsidianMat);
    armLMesh.scale.set(0.85, 1.75, 0.85);
    this.armL.add(armLMesh);
    this.torso.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(2.9, 0.7, 0.3);
    const armRMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), obsidianMat);
    armRMesh.scale.set(0.85, 1.75, 0.85);
    this.armR.add(armRMesh);

    this.halberdGroup = new THREE.Group();
    this.halberdGroup.position.set(0, -1.2, 1.2);
    this.halberdGroup.rotation.x = Math.PI / 3;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 6.8, 8), goldMat);
    const bladeMain = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.4, 4), flameMat);
    bladeMain.position.y = 3.6;
    const crescent = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 0.14), flameMat);
    crescent.position.set(0.55, 2.7, 0);
    this.halberdGroup.add(shaft, bladeMain, crescent);
    this.armR.add(this.halberdGroup);

    this.torso.add(this.armR);
    this.model.add(this.torso);

    this.legL = new THREE.Group();
    this.legL.position.set(-1.1, 1.6, 0);
    this.legL.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), obsidianMat));
    this.model.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(1.1, 1.6, 0);
    this.legR.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), obsidianMat));
    this.model.add(this.legR);
  }

  buildHealthBar() {
    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.y = this.hitHeight + (this.isBoss ? 1.4 : 0.85);

    const barWidth = this.isBoss ? 5.6 : 3.2;
    const barHeight = this.isBoss ? 0.52 : 0.38;
    this.barInnerWidth = barWidth - 0.2;

    const bgMat = new THREE.MeshBasicMaterial({ color: 0x181824, transparent: true, opacity: 0.82 });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, barHeight), bgMat);
    this.healthBarGroup.add(bgMesh);

    this.barMat = new THREE.MeshBasicMaterial({ color: this.config.barColor });
    this.barMesh = new THREE.Mesh(new THREE.PlaneGeometry(this.barInnerWidth, barHeight - 0.12), this.barMat);
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

    let finalAmount = amount;

    if (this.type === 'jade_guardian' && hitPos) {
      const toHit = new THREE.Vector3().subVectors(hitPos, this.position).normalize();
      const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
      if (forward.dot(toHit) > 0.35) {
        finalAmount = Math.max(1, Math.round(amount * 0.6));
      }
    }

    this.hp = Math.max(0, this.hp - finalAmount);
    this.hitFlashTimer = 0.18;
    if (this.torso) this.torso.position.z -= 0.3;

    if (this.isBoss && !this.isEnraged && this.hp > 0 && this.hp <= this.maxHp * 0.5) {
      this.isEnraged = true;
      this.speed = this.config.speed * 1.35;
      this.currentSkillName = '🔥 CUỒNG NỘ HUYẾT LONG (PHASE 2)!';
      this.model.scale.set(1.12, 1.12, 1.12);
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
      this.die();
    }
  }

  freeze(duration = 2.6) {
    if (this.isDead) return;
    const actualDuration = this.isBoss ? duration * 0.35 : duration;
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
    const resist = this.isBoss ? 0.22 : (this.type === 'golem' || this.type === 'jade_guardian' ? 0.5 : 1.0);
    const actualForce = force * resist;
    const dir = new THREE.Vector3().subVectors(this.position, fromPos);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(1, 0, 0);
    dir.normalize();
    this.velocity.x += dir.x * actualForce;
    this.velocity.z += dir.z * actualForce;
    this.velocity.y += actualForce * 0.35;
    if (this.torso) this.torso.position.z -= 0.45;
  }

  die() {
    this.isDead = true;
    this.aiState = 'idle';
    this.attackAnimType = null;
    this.pendingStrikeCallback = null;
    this.respawnTimer = this.config.respawnTime;
    this.clearActiveEffects();
    sound.playMonsterDefeated();
    this.particles.emitMonsterDefeat(this.position.clone().add(new THREE.Vector3(0, 3, 0)));

    if (this.world && (this.type === 'golem' || this.type === 'jade_guardian' || this.isBoss)) {
      const debrisColor = this.isBoss ? 0xc0392b : (this.type === 'jade_guardian' ? 0x1dd1a1 : 0x7f8c8d);
      const rockMat = new THREE.MeshStandardMaterial({ color: debrisColor, flatShading: true, roughness: 0.8 });
      const count = this.isBoss ? 12 : 6;
      for (let i = 0; i < count; i++) {
        const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.6, 0), rockMat);
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
      const offset = 6 + Math.random() * 10;
      this.position.x = THREE.MathUtils.clamp(this.spawnOrigin.x + Math.cos(angle) * offset, -110, 110);
      this.position.z = THREE.MathUtils.clamp(this.spawnOrigin.z + Math.sin(angle) * offset, -110, 110);
    }
    this.position.y = getTerrainHeight(this.position.x, this.position.z);
    this.group.position.copy(this.position);

    this.model.scale.set(1, 1, 1);
    this.model.rotation.set(0, 0, 0);
    this.healthBarGroup.visible = true;

    sound.playMonsterRoar();
    this.particles.emitHitSparkles(this.position.clone().add(new THREE.Vector3(0, 2, 0)), 15);
  }

  // =========================================================================
  // HIỆU ỨNG VỆT CHÉM 3D (SLASH ARC), VÒNG CẢNH BÁO, ĐẠN & SÓNG XUNG KÍCH
  // =========================================================================

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
      opacity: 0.75,
      depthWrite: false,
    });
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(radius * 0.92, radius, 28), outerMat);
    outerRing.rotateX(-Math.PI / 2);

    const fillMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const fillDisk = new THREE.Mesh(new THREE.CircleGeometry(radius, 28), fillMat);
    fillDisk.rotateX(-Math.PI / 2);
    fillDisk.scale.set(0.05, 0.05, 1);

    group.add(outerRing, fillDisk);
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

  spawnMonsterProjectile(origin, dir, speed, radius, damage, colorHex, maxLifetime = 3.2, status = null, isWave = false) {
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

  spawnPoisonPool(centerPos, radius, duration, tickDamage) {
    const poolMat = new THREE.MeshBasicMaterial({
      color: 0x2ed573,
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
      elapsed: 0,
      duration,
    });
  }

  inflictDamageToPlayer(player, amount, label, color = '#ff4757', status = null, knockbackForce = 0) {
    if (!player || player.isDead) return;
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
      player.pixelFX.controller.addTrauma(this.isBoss ? 0.35 : 0.2);
    }
  }

  updateActiveEffects(delta, player) {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const ef = this.activeEffects[i];
      ef.elapsed += delta;
      const t = Math.min(1.0, ef.elapsed / ef.duration);

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
            this.inflictDamageToPlayer(player, ef.damage, `-${ef.damage} 🔥 ${this.name}`, '#ff6b81', ef.status);
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
        if (ef.tickTimer >= 0.65) {
          ef.tickTimer = 0;
          if (this.particles) {
            this.particles.emitElementalParticles(
              ef.center.clone().add(new THREE.Vector3((Math.random() - 0.5) * ef.radius, 0.2, (Math.random() - 0.5) * ef.radius)),
              2,
              [0x2ed573, 0xbadc58],
              [1, 2.5],
              0.4,
              1.0,
              0.4
            );
          }
          if (player && !player.isDead) {
            const dist = Math.hypot(player.position.x - ef.center.x, player.position.z - ef.center.z);
            if (dist <= ef.radius) {
              this.inflictDamageToPlayer(player, ef.tickDamage, `-${ef.tickDamage} ☣️ ĐỘC DỊCH`, '#2ed573', 'slow');
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
      this.specialCooldown = 5.2;
      const skillIdx = this.bossSkillCycle % 4;
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
      } else {
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

    // Đang trong trạng thái lao Húc Tốc Độ Cao (Hắc Diễm Linh Thú)
    if (this.aiState === 'charging') {
      this.stateTimer += delta;
      const chargeSpeed = this.speed * 3.4;
      this.position.x += this.chargeDir.x * chargeSpeed * delta;
      this.position.z += this.chargeDir.z * chargeSpeed * delta;
      if (this.particles && Math.random() < 0.5) {
        this.particles.emitDust(this.position);
      }
      if (distToPlayer <= this.hitRadius + 1.1 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.2;
        this.spawnSlashArc(3.2, 0xffa502, 0, 2.0, 0.25);
        this.inflictDamageToPlayer(player, 95, '-95 🦖 MAN NGƯU HÚC ĐẦU!', '#ffa502', null, 14);
      }
      if (this.stateTimer >= this.stateDuration) {
        this.aiState = 'idle';
      }
      return;
    }

    // Đang gồng lực tại chỗ chờ nổ chiêu (Thạch Yêu / Thần Sư)
    if (this.aiState === 'windup') {
      this.stateTimer += delta;
      if (this.stateTimer >= this.stateDuration) {
        this.aiState = 'idle';
      }
      return;
    }

    // Ngoài phạm vi phát hiện (46m) -> Đi tuần quanh điểm xuất hiện
    if (distToPlayer > 46) {
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

    // --- HÀNH VI & ANIMATION TẤN CÔNG THEO CHỦNG LOẠI QUÁI ---
    if (this.type === 'fox_mage') {
      let moveAngle = directAngle;
      let moveSpeed = this.speed;

      if (distToPlayer < 8.5) {
        if (this.specialCooldown <= 0) {
          this.specialCooldown = 4.5;
          const awayDir = new THREE.Vector3(-dirToPlayerX, 0, -dirToPlayerZ).normalize();
          this.velocity.x += awayDir.x * 18;
          this.velocity.z += awayDir.z * 18;
          this.velocity.y += 6.5;
          this.startAttackAnimation('fox_spin_evade', 0.55, 0.2, null);
          if (this.particles) {
            this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 18, [0xff6b8b, 0xd980fa, 0xffffff], [2, 5], 0.6, 3.0, 0.7);
          }
        }
        moveAngle = directAngle + Math.PI;
      } else if (distToPlayer < 18.0) {
        this.strafePhase += delta * 1.4;
        moveAngle = directAngle + (Math.PI / 2) * Math.sign(Math.sin(this.strafePhase));
        moveSpeed = this.speed * 0.85;
      }

      this.rotationY = directAngle;
      this.model.rotation.y = this.rotationY;
      this.position.x += Math.sin(moveAngle) * moveSpeed * delta;
      this.position.z += Math.cos(moveAngle) * moveSpeed * delta;

      // Bắn 3 Quả Cầu Hồ Hỏa kèm Vũ Đạo Xòe 9 Đuôi & Đẩy Ngọc Châu
      if (distToPlayer <= 28.0 && this.attackCooldown <= 0 && !this.attackAnimType) {
        this.attackCooldown = 2.4;
        this.startAttackAnimation('fox_cast', 0.68, 0.5, () => {
          const pred = this.predictPlayerPosition(player, 0.45);
          const aimAngle = Math.atan2(pred.x - this.position.x, pred.z - this.position.z);
          const origin = this.position.clone().add(new THREE.Vector3(0, 2.2, 0));
          for (const offset of [-0.22, 0, 0.22]) {
            const dir = new THREE.Vector3(Math.sin(aimAngle + offset), 0, Math.cos(aimAngle + offset));
            this.spawnMonsterProjectile(origin, dir, 17.5, 0.55, 65, 0xff6b8b, 2.6, 'slow', false);
          }
        });
      }
      return;
    }

    if (this.type === 'sword_wraith') {
      // 👻 U MINH KIẾM LINH: Ám Ảnh Thuấn Bộ ra sau lưng + Xoay Kiếm Lốc Xoáy
      if (distToPlayer > 7.5 && distToPlayer < 24.0 && this.specialCooldown <= 0 && !this.attackAnimType) {
        this.specialCooldown = 5.5;
        if (this.particles) {
          this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 2, 0)), 18, [0x706fd3, 0x00d2d3], [2, 5], 0.6, 3.0, 0.6);
        }
        const behindX = player.position.x - Math.sin(player.rotationY) * 3.2;
        const behindZ = player.position.z - Math.cos(player.rotationY) * 3.2;
        this.position.x = THREE.MathUtils.clamp(behindX, -115, 115);
        this.position.z = THREE.MathUtils.clamp(behindZ, -115, 115);
        this.position.y = getTerrainHeight(this.position.x, this.position.z);
        this.rotationY = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
        this.model.rotation.y = this.rotationY;

        const strikePos = player.position.clone();
        this.startAttackAnimation('wraith_whirlwind', 0.65, 0.7, () => {
          this.spawnSlashArc(3.8, 0x00d2d3, 0.1, 2.2, 0.3);
          sound.playSwordSlash?.();
        });
        this.spawnTelegraphAOE(strikePos, 3.6, 0.5, 0xa29bfe, (pl) => {
          if (pl && !pl.isDead && Math.hypot(pl.position.x - strikePos.x, pl.position.z - strikePos.z) <= 3.6) {
            this.inflictDamageToPlayer(pl, 95, '-95 👻 ÁM ẢNH KIẾM TRẢM!', '#a29bfe');
          }
        });
        return;
      }

      const zigZag = Math.sin(this.walkAnimTime * 1.6) * 0.55;
      const moveAngle = distToPlayer > 3.2 ? directAngle + zigZag : directAngle;
      this.rotationY = directAngle;
      this.model.rotation.y = this.rotationY;
      if (distToPlayer > 3.2) {
        this.position.x += Math.sin(moveAngle) * this.speed * delta;
        this.position.z += Math.cos(moveAngle) * this.speed * delta;
      } else if (this.attackCooldown <= 0 && !this.attackAnimType) {
        this.attackCooldown = 1.4;
        this.startAttackAnimation('wraith_slash', 0.55, 0.45, () => {
          sound.playSwordSlash?.();
          this.spawnSlashArc(3.2, 0x00d2d3, -0.2, 2.3, 0.26);
          if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= 4.2) {
            this.inflictDamageToPlayer(player, 70, '-70 ⚔️ U MINH KIẾM!', '#00d2d3');
          }
        });
      }
      return;
    }

    if (this.type === 'flame_scorpion') {
      if (distToPlayer >= 7.0 && distToPlayer <= 28.0 && this.specialCooldown <= 0 && !this.attackAnimType) {
        this.specialCooldown = 5.2;
        const targetSpot = this.predictPlayerPosition(player, 0.65);
        this.startAttackAnimation('scorpion_mortar', 0.72, 0.4, null);
        this.spawnTelegraphAOE(targetSpot, 4.5, 0.95, 0x2ed573, (pl) => {
          if (this.particles) {
            this.particles.emitElementalParticles(targetSpot.clone().add(new THREE.Vector3(0, 0.8, 0)), 22, [0x2ed573, 0xbadc58, 0xff7f50], [2, 5], 0.8, 4.5, 0.8);
          }
          if (pl && !pl.isDead && Math.hypot(pl.position.x - targetSpot.x, pl.position.z - targetSpot.z) <= 4.5) {
            this.inflictDamageToPlayer(pl, 85, '-85 🦂 PHÁO ĐỘC HẠT VƯƠNG!', '#2ed573', 'slow');
          }
          this.spawnPoisonPool(targetSpot, 4.5, 4.0, 28);
        });
      }
    }

    if (this.type === 'chomper') {
      if (distToPlayer >= 7.5 && distToPlayer <= 20.0 && this.specialCooldown <= 0 && !this.attackAnimType) {
        this.specialCooldown = 5.0;
        this.aiState = 'charging';
        this.stateTimer = 0;
        this.stateDuration = 0.85;
        const pred = this.predictPlayerPosition(player, 0.35);
        this.chargeDir.set(pred.x - this.position.x, 0, pred.z - this.position.z).normalize();
        this.rotationY = Math.atan2(this.chargeDir.x, this.chargeDir.z);
        this.model.rotation.y = this.rotationY;
        sound.playMonsterRoar?.();
        return;
      }
    }

    if (this.type === 'golem' && distToPlayer <= 6.2 && this.specialCooldown <= 0 && !this.attackAnimType) {
      this.specialCooldown = 4.8;
      this.aiState = 'windup';
      this.stateTimer = 0;
      this.stateDuration = 0.85;
      this.startAttackAnimation('golem_slam', 0.95, 0.82, null);
      const slamPos = this.position.clone().add(new THREE.Vector3(Math.sin(this.rotationY) * 2.2, 0, Math.cos(this.rotationY) * 2.2));
      this.spawnTelegraphAOE(slamPos, 5.2, 0.85, 0xffa502, (pl) => {
        if (this.particles) {
          this.particles.emitShockwave(slamPos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xffa502, 5.5, 0.45);
        }
        if (pl && !pl.isDead && Math.hypot(pl.position.x - slamPos.x, pl.position.z - slamPos.z) <= 5.2) {
          this.inflictDamageToPlayer(pl, 110, '-110 🗿 THẠCH YÊU ĐỊA CHẤN!', '#ffa502', null, 14);
        }
      });
      return;
    }

    if (this.type === 'jade_guardian' && distToPlayer <= 7.5 && this.specialCooldown <= 0 && !this.attackAnimType) {
      this.specialCooldown = 5.5;
      this.aiState = 'windup';
      this.stateTimer = 0;
      this.stateDuration = 0.85;
      this.startAttackAnimation('guardian_roar', 0.95, 0.8, null);
      const roarPos = this.position.clone().add(new THREE.Vector3(Math.sin(this.rotationY) * 3.5, 0, Math.cos(this.rotationY) * 3.5));
      this.spawnTelegraphAOE(roarPos, 5.8, 0.85, 0x00d2d3, (pl) => {
        if (this.particles) {
          this.particles.emitShockwave(roarPos.clone().add(new THREE.Vector3(0, 0.4, 0)), 0x00d2d3, 6.2, 0.5);
          this.particles.emitElementalParticles(roarPos.clone().add(new THREE.Vector3(0, 1.2, 0)), 24, [0x00d2d3, 0x7ed6df, 0xffffff], [2, 5], 0.9, 4.0, 0.8);
        }
        if (pl && !pl.isDead && Math.hypot(pl.position.x - roarPos.x, pl.position.z - roarPos.z) <= 5.8) {
          this.inflictDamageToPlayer(pl, 115, '-115 ❄️ HÀN BĂNG SƯ TỬ HỐNG!', '#00d2d3', 'freeze');
        }
      });
      return;
    }

    // Di chuyển bao vây thông minh (Flanking)
    const flankInfluence = distToPlayer > 7.0 ? Math.min(0.45, (distToPlayer - 7.0) * 0.03) : 0;
    const targetAngle = directAngle + this.config.flankOffset * this.flankSign * flankInfluence;

    let rotDiff = targetAngle - this.rotationY;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    this.rotationY += rotDiff * Math.min(1.0, delta * 4.2);
    this.model.rotation.y = this.rotationY;

    if (distToPlayer > this.hitRadius + 1.25) {
      const moveFactor = this.attackAnimType ? 0.35 : 1.0;
      this.position.x += Math.sin(this.rotationY) * this.speed * moveFactor * delta;
      this.position.z += Math.cos(this.rotationY) * this.speed * moveFactor * delta;
    } else if (this.attackCooldown <= 0 && !this.attackAnimType) {
      // KÍCH HOẠT ANIMATION ĐÒN ĐÁNH THƯỜNG ĐẶC TRƯNG TỪNG LOẠI QUÁI
      this.attackCooldown = 1.55;
      this.attackComboStep++;

      if (this.type === 'golem') {
        this.startAttackAnimation('golem_punch', 0.65, 0.48, () => {
          this.spawnSlashArc(3.6, 0xffaa00, 0.35, 2.5, 0.28);
          if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= this.hitRadius + 2.2) {
            this.inflictDamageToPlayer(player, 80, `-80 🗿 Quyền Đá Nghìn Cân!`, '#ffa502', null, 8);
          }
        });
      } else if (this.type === 'chomper') {
        const isTailWhip = this.attackComboStep % 2 === 0;
        this.startAttackAnimation(isTailWhip ? 'chomper_tail_whip' : 'chomper_bite', 0.58, 0.45, () => {
          this.spawnSlashArc(3.3, 0x9b59b6, isTailWhip ? 0.0 : 0.4, 2.1, 0.26);
          if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= this.hitRadius + 2.0) {
            this.inflictDamageToPlayer(player, 68, isTailWhip ? `-68 🦖 Đuôi Rồng Quật Ngang!` : `-68 🦖 Nanh Độc Cắn Xé!`, '#ff6b81');
          }
        });
      } else if (this.type === 'flame_scorpion') {
        this.startAttackAnimation('scorpion_sting', 0.62, 0.46, () => {
          this.spawnSlashArc(3.5, 0x2ed573, -0.35, 1.8, 0.28);
          if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= this.hitRadius + 2.2) {
            this.inflictDamageToPlayer(player, 75, `-75 🦂 Ngòi Độc Hạt Vương!`, '#2ed573', 'slow');
          }
        });
      } else if (this.type === 'jade_guardian') {
        this.startAttackAnimation('guardian_pounce', 0.64, 0.48, () => {
          this.spawnSlashArc(3.8, 0x1dd1a1, 0.25, 2.2, 0.28);
          if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) <= this.hitRadius + 2.2) {
            this.inflictDamageToPlayer(player, 85, `-85 🦁 Thần Sư Vồ Mồi!`, '#00d2d3', null, 9);
          }
        });
      }
    }
  }

  // =========================================================================
  // HỆ THỐNG PROCEDURAL ANIMATION TẤN CÔNG CHI TIẾT CHO TỪNG LOẠI QUÁI & BOSS
  // =========================================================================
  applyAttackAnimation(delta) {
    if (!this.attackAnimType) return false;

    this.attackAnimTimer += delta;
    const p = Math.min(1.0, this.attackAnimTimer / this.attackAnimDuration);

    // Kích hoạt sát thương/đạn đúng thời điểm ra đòn (impact frame)
    if (!this.pendingStrikeTriggered && p >= this.pendingStrikeRatio) {
      this.pendingStrikeTriggered = true;
      if (this.pendingStrikeCallback) {
        this.pendingStrikeCallback();
      }
    }

    const type = this.attackAnimType;

    if (type === 'golem_punch') {
      // Thạch Yêu vặn mình giương nắm đấm đá phải lên cao rồi giáng mạnh xuống
      if (p < 0.45) {
        const w = p / 0.45;
        this.torso.rotation.y = -0.55 * w;
        this.torso.rotation.x = -0.22 * w;
        this.armR.rotation.x = -2.7 * w;
        this.armL.rotation.x = 0.6 * w;
      } else {
        const s = (p - 0.45) / 0.55;
        const swing = Math.sin(s * Math.PI);
        this.torso.rotation.y = THREE.MathUtils.lerp(-0.55, 0.5, Math.min(1, s * 1.8));
        this.torso.rotation.x = 0.35 * swing;
        this.armR.rotation.x = THREE.MathUtils.lerp(-2.7, -0.4, Math.min(1, s * 2.0));
        this.torso.position.z = 0.65 * swing;
      }
    } else if (type === 'golem_slam') {
      // Thạch Yêu giương cả 2 cánh tay đá lên trời rung lắc rồi đập sập xuống đất
      if (p < 0.78) {
        const w = p / 0.78;
        this.torso.position.y = 3.2 + w * 0.6;
        this.torso.rotation.x = -0.32 * w;
        this.armL.rotation.x = -2.95 * w + Math.sin(p * 35) * 0.08;
        this.armR.rotation.x = -2.95 * w - Math.sin(p * 35) * 0.08;
      } else {
        const s = (p - 0.78) / 0.22;
        this.torso.position.y = THREE.MathUtils.lerp(3.8, 2.5, s);
        this.torso.rotation.x = THREE.MathUtils.lerp(-0.32, 0.48, s);
        this.armL.rotation.x = THREE.MathUtils.lerp(-2.95, -0.5, s);
        this.armR.rotation.x = THREE.MathUtils.lerp(-2.95, -0.5, s);
      }
    } else if (type === 'chomper_bite') {
      // Khủng long ngửa cổ lấy đà rồi lao chồm cả đầu và thân tới đớp mạnh
      if (p < 0.4) {
        const w = p / 0.4;
        this.torso.rotation.x = -0.35 * w;
        this.head.rotation.x = -0.55 * w;
        this.torso.position.z = -0.4 * w;
      } else {
        const s = (p - 0.4) / 0.6;
        const lunge = Math.sin(s * Math.PI);
        this.torso.rotation.x = 0.45 * lunge;
        this.head.rotation.x = 0.5 * lunge;
        this.head.scale.setScalar(1.0 + 0.25 * lunge);
        this.torso.position.z = 1.15 * lunge;
      }
    } else if (type === 'chomper_tail_whip') {
      // Khủng long xoay tròn toàn thân 360 độ quật đuôi
      this.torso.rotation.y = p * Math.PI * 2;
      this.tail.rotation.y = Math.sin(p * Math.PI * 2) * 0.9;
    } else if (type === 'fox_cast') {
      // Cửu Vĩ Hồ Yêu bung xòe 9 chiếc đuôi dựng đứng phát sáng + đẩy Ngọc Châu Hồ Hỏa về trước
      const flare = Math.sin(p * Math.PI);
      this.torso.position.y = 2.4 + flare * 0.55;
      this.armL.rotation.x = -1.6 * flare;
      this.armR.rotation.x = -1.6 * flare;
      if (this.foxOrb) {
        this.foxOrb.position.z = 1.6 + flare * 1.1;
        this.foxOrb.scale.setScalar(1.0 + flare * 0.65);
      }
      if (this.foxTails) {
        for (let i = 0; i < this.foxTails.length; i++) {
          const tail = this.foxTails[i];
          tail.rotation.x = tail.userData.baseX + flare * 0.65;
          tail.rotation.z = tail.userData.baseZ * (1.0 + flare * 0.35);
        }
      }
    } else if (type === 'fox_spin_evade') {
      // Hồ Yêu xoay mình lộn vòng trên không khi nhảy lùi
      this.torso.rotation.y = p * Math.PI * 2;
    } else if (type === 'wraith_slash') {
      // U Minh Kiếm Linh vung Ma Kiếm chém ngang 180 độ + 3 thanh kiếm hộ thể phóng ra trước
      const swing = Math.sin(p * Math.PI);
      if (p < 0.4) {
        const w = p / 0.4;
        this.torso.rotation.y = 0.6 * w;
        this.armR.rotation.x = -1.5;
        this.armR.rotation.z = 1.3 * w;
      } else {
        const s = (p - 0.4) / 0.6;
        this.torso.rotation.y = THREE.MathUtils.lerp(0.6, -0.7, s);
        this.armR.rotation.x = -1.5;
        this.armR.rotation.z = THREE.MathUtils.lerp(1.3, -1.4, s);
      }
      if (this.orbitSwordNodes) {
        for (const sw of this.orbitSwordNodes) {
          const r = 2.1 + swing * 1.3;
          sw.position.set(Math.cos(sw.userData.baseAngle) * r, 0, Math.sin(sw.userData.baseAngle) * r);
          sw.rotation.x = swing * 1.2;
        }
      }
    } else if (type === 'wraith_whirlwind') {
      // Ám Ảnh Thuấn Bộ: Xoay kiếm lốc xoáy 2 vòng liên tiếp
      this.torso.rotation.y = p * Math.PI * 4;
      this.armR.rotation.x = -1.55;
      this.armR.rotation.z = -1.2;
      if (this.orbitSwordNodes) {
        const expand = Math.sin(p * Math.PI);
        for (const sw of this.orbitSwordNodes) {
          const r = 2.1 + expand * 1.6;
          sw.position.set(Math.cos(sw.userData.baseAngle) * r, 0, Math.sin(sw.userData.baseAngle) * r);
        }
      }
    } else if (type === 'scorpion_sting') {
      // Hạt Vương cắt chéo 2 càng lửa + bổ mạnh chiếc đuôi ngòi độc từ trên lưng xuống trước mặt!
      if (p < 0.4) {
        const w = p / 0.4;
        this.armL.rotation.y = -0.65 * w;
        this.armR.rotation.y = 0.65 * w;
        this.tail.rotation.x = -0.55 * w;
      } else {
        const s = (p - 0.4) / 0.6;
        const strike = Math.sin(s * Math.PI);
        this.armL.rotation.y = 0.75 * strike;
        this.armR.rotation.y = -0.75 * strike;
        this.tail.rotation.x = 1.35 * strike;
        this.torso.position.z = 0.75 * strike;
      }
    } else if (type === 'scorpion_mortar') {
      // Hạt Vương uốn cong đuôi lên đỉnh đầu bắn pháo cầu độc
      const arch = Math.sin(p * Math.PI);
      this.torso.rotation.x = 0.25 * arch;
      this.tail.rotation.x = 1.15 * arch;
    } else if (type === 'guardian_pounce') {
      // Thanh Ngọc Thần Sư chồm 2 chân trước lên cao rồi vồ đập mạnh xuống đất
      if (p < 0.45) {
        const w = p / 0.45;
        this.torso.rotation.x = -0.55 * w;
        this.torso.position.y = 2.9 + 1.1 * w;
        this.armL.rotation.x = -1.6 * w;
        this.armR.rotation.x = -1.6 * w;
      } else {
        const s = (p - 0.45) / 0.55;
        const slam = Math.sin(s * Math.PI);
        this.torso.rotation.x = THREE.MathUtils.lerp(-0.55, 0.35, Math.min(1, s * 1.8));
        this.torso.position.y = THREE.MathUtils.lerp(4.0, 2.7, Math.min(1, s * 1.8));
        this. torso.position.z = 0.9 * slam;
        this.armL.rotation.x = 0.4 * slam;
        this.armR.rotation.x = 0.4 * slam;
      }
    } else if (type === 'guardian_roar') {
      // Sư Tử Hống: Rướn cổ gầm vang, pháp luân sau lưng xoay tít
      const roar = Math.sin(p * Math.PI);
      this.head.position.z = 1.45 + roar * 0.65;
      this.head.rotation.x = 0.28 * roar;
      this.head.scale.setScalar(1.0 + roar * 0.18);
      if (this.guardianHalo) this.guardianHalo.rotation.z += delta * 12;
    } else if (type === 'boss_ cleave_lr' || type === 'boss_wave_slash') {
      // Đại Boss vung Phương Thiên Họa Kích quét ngang 180 độ uy lực
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
      // Đại Boss giương cao Họa Kích bổ dọc từ đỉnh đầu xuống đất
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
      // Đại Boss rút Họa Kích về hông rồi đâm thẳng về phía trước
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
      // Đại Boss bay lơ lửng, giương thẳng Họa Kích chỉ lên trời triệu hồi Cửu Thiên Huyết Vũ
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
      if (this.torso) {
        this.torso.rotation.set(0, 0, 0);
        this.torso.position.z = 0;
      }
      if (this.head) {
        this.head.rotation.set(0, 0, 0);
        this.head.scale.setScalar(1.0);
      }
      if (this.armL) this.armL.rotation.set(0, 0, 0);
      if (this.armR) this.armR.rotation.set(0, 0, 0);
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
      this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, -Math.PI / 2.2, delta * 5);
      this.model.scale.multiplyScalar(0.96);
      this.healthBarGroup.visible = false;

      if (this.respawnTimer <= 0) {
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
    if (this.hitFlashTimer > 0) {
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

    // 6. Áp dụng phản lực Đẩy lùi (Knockback Velocity)
    if (this.velocity.lengthSq() > 0.01) {
      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
      this.position.y += this.velocity.y * delta;

      this.velocity.x *= 0.88;
      this.velocity.z *= 0.88;
      this.velocity.y -= 24 * delta;
    }

    if (this.torso && !this.attackAnimType) {
      this.torso.position.z = THREE.MathUtils.lerp(this.torso.position.z, 0, delta * 6);
    }

    // 7. CẬP NHẬT AI CHIẾN ĐẤU & DI CHUYỂN
    const distToPlayer = playerPos ? this.position.distanceTo(playerPos) : 999;
    if (this.isBoss) {
      this.updateBossAI(delta, player, distToPlayer);
    } else {
      this.updateMonsterAI(delta, player, distToPlayer);
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, -120, 120);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -120, 120);

    const groundY = getTerrainHeight(this.position.x, this.position.z);
    if (this.aiState !== 'leaping' && this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
    }

    this.group.position.copy(this.position);

    if (this.contactShadow) {
      this.contactShadow.position.set(this.position.x, groundY + 0.025, this.position.z);
      const heightAbove = Math.max(0, this.position.y - groundY);
      this.shadowMat.opacity = this.isDead ? 0 : Math.max(0.06, (this.isBoss ? 0.58 : 0.42) - heightAbove * 0.04);
      const s = Math.max(0.35, 1.0 - heightAbove * 0.05);
      this.contactShadow.scale.set(s, s, s);
    }

    // 8. PROCEDURAL ANIMATION: DI CHUYỂN & TẤN CÔNG
    const stepFreq = this.isBoss ? 4.0 : (this.type === 'golem' ? 3.5 : (this.aiState === 'charging' ? 11.0 : 4.8));
    this.walkAnimTime += delta * stepFreq;
    const stepSwing = Math.sin(this.walkAnimTime) * 0.45;

    if (this.legL) this.legL.rotation.x = stepSwing;
    if (this.legR) this.legR.rotation.x = -stepSwing;

    // Cập nhật các bộ phận xoay liên tục (Pháp luân, Ngọc Châu, Kiếm Hộ Thể, Cánh Rồng)
    if (this.foxOrb) {
      this.foxOrb.rotation.y += delta * 3.5;
      this.foxOrb.rotation.x += delta * 2.0;
    }
    if (this.orbitSwords) {
      this.orbitSwords.rotation.y += delta * (this.attackAnimType ? 9.5 : 3.8);
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
      // Tư thế đặc biệt khi Đại Boss đang nhảy trên không hoặc cắm kích hút Hắc Động
      if (this.aiState === 'leaping') {
        this.torso.rotation.x = 0.45;
        this.armR.rotation.x = -2.6;
        this.armL.rotation.x = -2.2;
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
      this.armL.rotation.x = -stepSwing * 0.6;
      this.armR.rotation.x = stepSwing * 0.6;
      this.torso.rotation.z = Math.sin(this.walkAnimTime) * 0.05;
      this.torso.position.y = 3.2 + Math.abs(Math.sin(this.walkAnimTime)) * 0.2;
    } else if (this.type === 'chomper') {
      this.tail.rotation.y = Math.sin(this.walkAnimTime) * 0.28;
      this.head.rotation.z = Math.sin(this.walkAnimTime) * 0.06;
      this.head.rotation.x = this.aiState === 'charging' ? 0.55 : 0;
      this.torso.rotation.x = this.aiState === 'charging' ? 0.3 : 0;
      this.torso.position.y = 2.8 + Math.abs(Math.sin(this.walkAnimTime)) * 0.25;
    } else if (this.type === 'fox_mage') {
      this.torso.position.y = 2.4 + Math.sin(this.walkAnimTime * 0.8) * 0.18;
      if (this.foxTails) {
        for (let i = 0; i < this.foxTails.length; i++) {
          const tail = this.foxTails[i];
          tail.rotation.x = tail.userData.baseX;
          tail.rotation.z = tail.userData.baseZ;
          tail.rotation.y = Math.sin(this.walkAnimTime * 0.9 + i * 0.5) * 0.22;
        }
      }
    } else if (this.type === 'sword_wraith') {
      this.torso.position.y = 2.7 + Math.sin(this.walkAnimTime * 0.9) * 0.32;
      if (this.orbitSwordNodes) {
        for (const sw of this.orbitSwordNodes) {
          sw.position.set(Math.cos(sw.userData.baseAngle) * 2.1, 0, Math.sin(sw.userData.baseAngle) * 2.1);
          sw.rotation.x = 0;
        }
      }
    } else if (this.type === 'flame_scorpion') {
      this.torso.position.y = 1.65 + Math.abs(Math.sin(this.walkAnimTime * 1.3)) * 0.12;
      if (this.tail) {
        this.tail.rotation.x = Math.sin(this.walkAnimTime * 0.8) * 0.18;
      }
      this.armL.rotation.y = Math.sin(this.walkAnimTime) * 0.2;
      this.armR.rotation.y = -Math.sin(this.walkAnimTime) * 0.2;
    } else if (this.type === 'jade_guardian') {
      this.torso.position.y = 2.9 + Math.abs(Math.sin(this.walkAnimTime)) * 0.16;
    } else if (this.isBoss) {
      this.torso.position.y = 4.6 + Math.sin(this.walkAnimTime * 0.7) * 0.25;
      this.armL.rotation.x = -stepSwing * 0.5;
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, stepSwing * 0.5, delta * 5);
    }
  }
}
