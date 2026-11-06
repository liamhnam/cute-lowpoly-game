import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';
import { createSword, createSheath, onSwordModelReady } from './sword.js';

// Combo 3 nhát: chém ngang → chém ngược → đâm tới
const SLASH_DURATIONS = [0.24, 0.24, 0.3];
// Không đánh trong khoảng này thì tra kiếm vào vỏ sau lưng
const SHEATHE_DELAY = 4.0;
const CHARGE_FULL_COLOR = new THREE.Color(0xffd700);

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
    // Chém kiếm (Sword Slash)
    this.slashTimer = 0;
    this.slashDuration = SLASH_DURATIONS[0];
    this.slashStep = 0;
    this.slashSide = 1;
    this.slashFacing = 0;

    // Rút kiếm / tra kiếm vào vỏ, phi kiếm rời tay
    this.isSwordDrawn = false;
    this.sheatheTimer = 0;
    this.isSwordThrown = false;

    // Kiếm quang phủ lên lưỡi kiếm (độ sáng 0..1)
    this.auraIntensity = 0;

    // Lướt tới (đòn đâm combo, Thuấn Bộ Trảm)
    this.dashDir = new THREE.Vector3();
    this.dashSpeed = 0;
    this.dashTime = 0;

    // Tụ lực kiếm khí (0..1)
    this.isCharging = false;
    this.chargeLevel = 0;

    // Kỹ năng & Thi triển phép thuật (Skill Casting)
    this.isCasting = false;
    this.castSkill = 0;
    this.castTime = 0;
    this.castDuration = 0.6;
    this.speedBoostTimer = 0;

    // Bảng màu trang phục Tiên Hiệp cổ phong - 5 Môn Phái
    this.outfitIndex = 0;
    this.outfits = [
      { id: 'dao_gia', name: 'Hoàng Bào Đạo Sĩ (Thái Thanh Đạo Gia)', sectName: 'Thái Thanh Đạo Gia', clothes: 0xf6c344, hat: 0x2d3436, icon: '🐉' },
      { id: 'thanh_van', name: 'Thanh Vân Tiên Bào (Thanh Vân Tiên Tông)', sectName: 'Thanh Vân Tiên Tông', clothes: 0x54a0ff, hat: 0x1dd1a1, icon: '❄️' },
      { id: 'kiem_tong', name: 'Tử Tiêu Kiếm Tông (Vạn Kiếm Tông)', sectName: 'Tử Tiêu Kiếm Tông', clothes: 0x8854d0, hat: 0xf1c40f, icon: '⚔️' },
      { id: 'ma_tu', name: 'Hồng Trần Ma Tu (Hồng Trần Ma Tông)', sectName: 'Hồng Trần Ma Tu', clothes: 0xeb3b5a, hat: 0x2d3436, icon: '🩸' },
      { id: 'bach_hac', name: 'Bạch Hạc Chân Nhân (Bạch Hạc Tiên Tông)', sectName: 'Bạch Hạc Chân Nhân', clothes: 0xf5f6fa, hat: 0x00d2d3, icon: '🪶' },
    ];

    // Chỉ số Khí Huyết & Multiplayer PvP (2000 Máu)
    this.name = 'Gấu Hiệp Sĩ';
    this.hp = 2000;
    this.maxHp = 2000;
    this.isDead = false;
    this.kills = 0;
    this.deaths = 0;
    this.hitFlashTimer = 0;
    this.lastHitTimer = 0;

    this.buildMesh();
    this.buildCastAura();
    this.buildContactShadow();
    this.buildBillboard();
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
    this.bbCanvas.width = 300;
    this.bbCanvas.height = 90;
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
    this.billboardSprite.scale.set(2.4, 0.72, 1);
    this.billboardSprite.position.set(0, 2.35, 0);
    this.group.add(this.billboardSprite);

    this.updateBillboard();
  }

  updateBillboard() {
    if (!this.bbCtx) return;
    const ctx = this.bbCtx;
    const w = this.bbCanvas.width;
    const h = this.bbCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Khung nền nametag
    ctx.fillStyle = 'rgba(20, 26, 36, 0.85)';
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(10, 8, w - 20, h - 16, 10);
    ctx.fill();
    ctx.stroke();

    // 2. Tên người chơi
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(`👑 ${this.name}`, w / 2, 14);

    // 3. Thanh Máu (Health bar)
    const barX = 24;
    const barY = 46;
    const barW = w - 48;
    const barH = 18;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#2f3542';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    let barColor = '#2ed573';
    if (ratio < 0.3) {
      barColor = '#ff4757';
    } else if (ratio < 0.6) {
      barColor = '#ffa502';
    }

    ctx.fillStyle = barColor;
    ctx.fillRect(barX + 2, barY + 2, Math.max(0, (barW - 4) * ratio), barH - 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.round(this.hp)} / ${this.maxHp} HP`, w / 2, barY + barH / 2 + 1);

    this.bbTexture.needsUpdate = true;
  }

  setName(name) {
    this.name = (name || 'Gấu Hiệp Sĩ').trim().substring(0, 18);
    this.updateBillboard();
  }

  setOutfit(index) {
    this.outfitIndex = index % this.outfits.length;
    const current = this.outfits[this.outfitIndex];
    this.clothesMat.color.setHex(current.clothes);
    this.hatMat.color.setHex(current.hat);
    return current.name;
  }

  takeDamage(amount, attackerName = null, hitPos = null) {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.lastHitTimer = 0;
    this.updateBillboard();

    // Chớp đỏ
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

    // Vòng tròn ma pháp ngoài
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

    // Vòng sao 6 cánh bên trong
    const innerRingGeo = new THREE.RingGeometry(0.2, 0.45, 6);
    innerRingGeo.rotateX(-Math.PI / 2);
    const innerMesh = new THREE.Mesh(innerRingGeo, this.castAuraMat);
    this.castAuraGroup.add(innerMesh);

    this.castAuraGroup.visible = false;
    this.group.add(this.castAuraGroup);
  }

  buildMesh() {
    this.model = new THREE.Group();

    // Vật liệu da lông gấu
    this.furMat = new THREE.MeshStandardMaterial({
      color: 0xdf9a57,
      roughness: 0.8,
      flatShading: true,
    });

    // Mõm trắng kem
    const snoutMat = new THREE.MeshStandardMaterial({
      color: 0xffedd8,
      roughness: 0.8,
      flatShading: true,
    });

    // Mắt đen bóng long lanh
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.2,
    });

    // Điểm sáng mắt
    const eyeSparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Mũi & miệng
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.4,
    });

    // Má hồng kawaii
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xff7b90,
      transparent: true,
      opacity: 0.65,
    });

    // Đạo bào
    this.clothesMat = new THREE.MeshStandardMaterial({
      color: this.outfits[0].clothes,
      roughness: 0.7,
      flatShading: true,
    });

    // Viền cổ áo, đai lưng, cổ tay áo đạo bào
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x8e2b2b, roughness: 0.6, flatShading: true });

    // Mũ đạo sĩ
    this.hatMat = new THREE.MeshStandardMaterial({
      color: this.outfits[0].hat,
      roughness: 0.6,
      flatShading: true,
    });

    // Ba lô du lịch
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

    // Vạt đạo bào xoè dài phủ xuống tận chân
    const robeSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.64, 0.46, 10), this.clothesMat);
    robeSkirt.position.y = 0.33;
    robeSkirt.castShadow = true;
    this.body.add(robeSkirt);

    // Cổ áo giao lĩnh: hai vạt viền chéo nhau hình chữ V trước ngực
    for (const side of [-1, 1]) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.05), trimMat);
      collar.position.set(side * 0.1, 0.93, 0.46);
      collar.rotation.z = -side * 0.5;
      collar.rotation.x = -0.25;
      this.body.add(collar);
    }

    // Đai lưng và nút thắt đai
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

    // Mõm
    const snout = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), snoutMat);
    snout.scale.set(1.1, 0.85, 1.0);
    snout.position.set(0, -0.08, 0.48);
    this.head.add(snout);

    // Mũi đen nhỏ
    const nose = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), noseMat);
    nose.position.set(0, -0.02, 0.7);
    this.head.add(nose);

    // Đôi mắt to tròn
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

    // Má hồng 2 bên
    const blushGeo = new THREE.CircleGeometry(0.09, 8);
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.34, -0.09, 0.42);
    blushL.rotation.y = -Math.PI / 6;
    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushR.position.set(0.34, -0.09, 0.42);
    blushR.rotation.y = Math.PI / 6;
    this.head.add(blushL);
    this.head.add(blushR);

    // Đôi tai tròn vểnh
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

    // Mũ đạo sĩ: thân mũ đen, đỉnh mũ phẳng vuông, phía trước gắn thái cực đồ
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

    // Thái cực đồ: hai nửa âm dương và hai chấm
    const taiji = new THREE.Group();
    taiji.position.set(0, 0.02, 0.335);
    taiji.rotation.x = 0.1;
    const yangMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const yinMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const yang = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16, Math.PI / 2, Math.PI), yangMat);
    const yin = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16, -Math.PI / 2, Math.PI), yinMat);
    taiji.add(yang, yin);
    for (const side of [-1, 1]) {
      const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), side > 0 ? yangMat : yinMat);
      swirl.position.set(0, side * 0.04, 0.002);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.013, 8), side > 0 ? yinMat : yangMat);
      dot.position.set(0, side * 0.04, 0.004);
      taiji.add(swirl, dot);
    }
    const taijiRim = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.095, 16), new THREE.MeshBasicMaterial({ color: 0xf1c40f }));
    taiji.add(taijiRim);
    hatGroup.add(taiji);

    this.head.add(hatGroup);
    this.body.add(this.head);

    // 3. BA LÔ
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

    // Hồ Lô Tiên (Daoist Wine Gourd) đeo bên hông ba lô
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
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 4), new THREE.MeshBasicMaterial({ color: 0xee5253 }));
    tassel.position.set(0.08, 0.08, 0);
    tassel.rotation.z = 0.5;
    gourdGroup.add(tassel);
    this.backpack.add(gourdGroup);

    this.body.add(this.backpack);

    // 4. TAY TRÁI
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.35, 6);
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.48, 0.85, 0);
    const armMeshL = new THREE.Mesh(armGeo, this.furMat);
    armMeshL.position.y = -0.16;
    armMeshL.castShadow = true;
    this.leftArm.add(armMeshL);
    this.body.add(this.leftArm);

    // Tay áo đạo bào rộng xoè ra ở cổ tay, viền đỏ sẫm
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

    // 5. TAY PHẢI VÀ THANH TIÊN KIẾM LOW POLY
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.48, 0.85, 0);
    const armMeshR = new THREE.Mesh(armGeo, this.furMat);
    armMeshR.position.y = -0.16;
    armMeshR.castShadow = true;
    this.rightArm.add(armMeshR);
    addSleeve(this.rightArm);

    // Điểm cầm kiếm trên tay: trục +y của nhóm là hướng lưỡi kiếm
    this.sword = new THREE.Group();
    this.sword.position.set(0.02, -0.3, 0.06);
    this.sword.rotation.x = Math.PI / 2;

    // Kiếm quang: khối sáng cộng màu phủ dọc lưỡi, dùng được cho cả model GLB
    this.bladeGlowMat = new THREE.MeshBasicMaterial({
      color: 0x1dd1a1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.bladeAura = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.08), this.bladeGlowMat);
    this.bladeAura.position.y = 0.64;
    this.bladeAura.visible = false;
    this.sword.add(this.bladeAura);

    this.rightArm.add(this.sword);
    this.body.add(this.rightArm);

    // Vỏ kiếm đeo chéo sau lưng, miệng vỏ ở vai phải
    this.sheath = createSheath();
    this.sheath.position.set(0.3, 1.22, -0.7);
    this.sheath.rotation.z = -0.7;
    this.body.add(this.sheath);

    // Kiếm tra trong vỏ: chuôi nhô khỏi miệng vỏ, lưỡi chĩa xuống
    this.sheathSlot = new THREE.Group();
    this.sheathSlot.position.y = 0.14;
    this.sheathSlot.rotation.x = Math.PI;
    this.sheath.add(this.sheathSlot);

    this.swordModel = createSword();
    this.sheathSlot.add(this.swordModel);

    // Model GLB nạp xong thì thay kiếm dựng sẵn ở đúng chỗ đang đặt
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

  // Rút kiếm từ vỏ ra tay (nếu đang tra vỏ) và hoãn việc tra kiếm lại
  drawSword() {
    this.sheatheTimer = SHEATHE_DELAY;
    if (this.isSwordDrawn) return;
    this.isSwordDrawn = true;
    this.sword.add(this.swordModel);
    this.bladeAura.visible = !this.isSwordThrown;
    if (this.particles) {
      this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 6, [0x1dd1a1, 0xffffff], [1, 3], 0.3, 0, 0.4);
    }
  }

  sheatheSword() {
    if (!this.isSwordDrawn) return;
    this.isSwordDrawn = false;
    this.sheathSlot.add(this.swordModel);
    this.bladeAura.visible = false;
  }

  // Phi kiếm rời tay thì ẩn kiếm trên tay cho tới khi kiếm bay về
  setSwordThrown(thrown) {
    this.isSwordThrown = thrown;
    this.swordModel.visible = !thrown;
    this.bladeAura.visible = !thrown && this.isSwordDrawn;
    if (!thrown) this.drawSword();
  }

  // Lướt nhanh theo dir (đã chuẩn hoá) một quãng distance trong duration giây
  startDash(dir, distance, duration) {
    this.dashDir.set(dir.x, 0, dir.z).normalize();
    this.dashSpeed = distance / duration;
    this.dashTime = duration;
  }

  // Thắp kiếm quang với màu color, độ sáng intensity (0..1), tự tắt dần
  flashBlade(color, intensity = 1.0) {
    this.bladeGlowMat.color.setHex(color);
    this.auraIntensity = Math.max(this.auraIntensity, intensity);
  }

  // Chém kiếm theo hướng facing (radian); step 0/1 chém ngang qua lại, step 2 đâm tới
  triggerSlashAnimation(facing, step = 0) {
    this.drawSword();
    this.slashStep = step;
    this.slashDuration = SLASH_DURATIONS[step];
    this.slashTimer = this.slashDuration;
    this.slashSide = step === 1 ? -1 : 1;
    this.slashFacing = facing;
    this.targetRotationY = facing;

    this.flashBlade(step === 2 ? 0xffffff : 0x7bed9f, step === 2 ? 1.0 : 0.7);
    sound.playSwordSlash();
  }

  // Cập nhật mức tụ lực; facing (radian) là hướng nhân vật quay mặt khi đang tụ
  setChargeLevel(level, charging, facing = this.slashFacing) {
    if (charging && level >= 1 && this.chargeLevel < 1) {
      sound.playSwordSummon(); // Báo hiệu tụ đầy lực
      if (this.particles) {
        this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 16, [0xffd700, 0xffffff], [2, 5], 0.4, 2.0, 0.6);
      }
    }
    if (!charging && this.isCharging) {
      this.rightArm.rotation.z = 0;
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

  // KÍCH HOẠT ANIMATION VÀ VÒNG MA PHÁP THI TRIỂN KỸ NĂNG CỦA BÉ GẤU
  triggerSkillCast(skillNum) {
    this.isCasting = true;
    this.castSkill = skillNum;
    this.castTime = 0;
    const durations = { 1: 0.5, 2: 0.45, 3: 1.1, 4: 0.75, 5: 1.35, 6: 1.0 };
    this.castDuration = durations[skillNum] || 0.6;
    this.drawSword();

    // Màu sắc hào quang ma pháp theo từng Môn Phái và Chiêu thức
    const sectColors = [
      { 1: 0x1dd1a1, 2: 0xf1c40f, 3: 0xa29bfe }, // Đạo Gia (Chân Long, Bát Quái, Đại Canh)
      { 1: 0x00d2d3, 2: 0x7ed6df, 3: 0x54a0ff }, // Thanh Vân (Huyền Băng, Phong Trảm, Băng Vũ)
      { 1: 0xa29bfe, 2: 0x7bed9f, 3: 0xffd700 }, // Tử Tiêu (Thuấn Bộ, Hộ Thể, Vạn Kiếm)
      { 1: 0xff4757, 2: 0x8854d0, 3: 0xeb3b5a }, // Ma Tu (Huyết Ma, Hắc Động, Ma Bạo)
      { 1: 0xffd32a, 2: 0x2ed573, 3: 0xe67e22 }, // Bạch Hạc (Thiên Lôi, Bạch Hạc, Hám Địa)
    ];

    const currentSectColors = sectColors[this.outfitIndex % sectColors.length] || sectColors[0];
    const color = currentSectColors[skillNum] || 0xffd700;

    if (this.castAuraMat) {
      this.castAuraMat.color.setHex(color);
      this.castAuraMat.opacity = 0.95;
    }
    this.castAuraGroup.visible = true;
    this.castAuraGroup.scale.set(0.3, 0.3, 0.3);

    // Kiếm quang theo màu kỹ năng
    this.flashBlade(color, 1.0);

    if (skillNum === 3 || skillNum === 5) {
      // Chiêu Ultimate: Bé gấu ngự không phi hành, lơ lửng ngự kiếm!
      this.jumpVelocity = 5.5;
      this.isGrounded = false;
      this.squashFactor = 1.3;
      sound.playSwordSummon();
    } else if (skillNum === 2) {
      this.squashFactor = 0.85;
    } else if (skillNum === 1) {
      this.squashFactor = 1.15;
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
    this.outfitIndex = (this.outfitIndex + 1) % this.outfits.length;
    const current = this.outfits[this.outfitIndex];
    this.clothesMat.color.setHex(current.clothes);
    this.hatMat.color.setHex(current.hat);
    return current.name;
  }

  update(delta, inputVector, isSprinting) {
    if (this.isDead) return;

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
    const moveLen = inputVector.length();
    this.isMoving = moveLen > 0.05;

    // Tốc độ di chuyển
    let targetSpeed = this.isMoving ? (this.isSprinting ? 9.8 : 5.4) : 0;
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= delta;
      targetSpeed *= 1.5;
    }
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, delta * 11);

    // Tính vector vận tốc theo hướng
    if (this.isMoving) {
      this.velocity.x = inputVector.x * this.speed;
      this.velocity.z = inputVector.z * this.speed;
      // Đang chém thì giữ hướng mặt về phía đòn chém
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

    // Cập nhật bóng đổ tiếp xúc mặt đất (Contact Shadow)
    if (this.contactShadow) {
      this.contactShadow.position.set(this.position.x, groundY + 0.025, this.position.z);
      const heightAbove = Math.max(0, this.position.y - groundY);
      this.shadowMat.opacity = Math.max(0.04, 0.38 - heightAbove * 0.12);
      const s = Math.max(0.35, 1.0 - heightAbove * 0.14);
      this.contactShadow.scale.set(s, s, s);
    }

    this.squashFactor = THREE.MathUtils.lerp(this.squashFactor, 1.0, delta * 9);

    // ANIMATION TIẾN TRÌNH
    const animSpeed = this.isMoving ? (this.isSprinting ? 14.5 : 9.5) : 3.2;
    this.animTime += delta * animSpeed;

    // --- XỬ LÝ ANIMATION THI TRIỂN KỸ NĂNG (CASTING ANIMATIONS) ---
    if (this.isCasting) {
      this.castTime += delta;
      const castProgress = Math.min(1.0, this.castTime / this.castDuration);

      // Xoay và phóng to vòng ma pháp dưới chân
      this.castAuraGroup.rotation.y += delta * 6;
      const auraScale = THREE.MathUtils.lerp(0.3, 1.35, Math.min(1.0, castProgress * 1.8));
      this.castAuraGroup.scale.set(auraScale, auraScale, auraScale);
      this.castAuraMat.opacity = Math.max(0, (1.0 - castProgress * 0.7) * 0.9);

      // Từng dáng thi triển đặc trưng cho các kiếm chiêu tông môn:
      this.rightArm.rotation.y = 0;
      if (this.castSkill === 1) {
        // [1] Chiêu 1: Vung kiếm phóng uy áp thẳng về phía trước
        this.sword.rotation.x = Math.PI - 0.25;
        this.rightArm.rotation.z = 0;
        if (castProgress < 0.35) {
          this.body.rotation.x = -0.2;
          this.rightArm.rotation.x = -2.8;
        } else {
          this.body.rotation.x = 0.25;
          this.rightArm.rotation.x = -1.5;
          this.head.rotation.x = 0.1;
        }
        this.leftArm.rotation.x = -0.9;
      } else if (this.castSkill === 2) {
        // [2] Chiêu 2: Dựng kiếm kết ấn trước ngực, chân đứng thế pháp trận
        this.body.rotation.x = -0.05;
        this.rightArm.rotation.x = -1.2;
        this.rightArm.rotation.z = -0.35;
        this.sword.rotation.x = Math.PI / 2 - 0.9;
        this.leftArm.rotation.x = -1.3;
        this.leftArm.rotation.z = 0.45;
        this.head.rotation.y = Math.sin(castProgress * 10) * 0.12;
      } else if (this.castSkill === 3) {
        // [3] Trấn Tông Tuyệt Kỹ: Ngự kiếm phi tiên, hai tay kết kiếm chỉ giương cao rồi trảm xuống diệt thế!
        this.body.position.y = 0.65 + Math.sin(this.castTime * 10) * 0.14;
        if (castProgress < 0.45) {
          this.body.rotation.x = -0.28;
          this.rightArm.rotation.x = -2.6;
          this.rightArm.rotation.z = 0.35;
          this.leftArm.rotation.x = -2.6;
          this.leftArm.rotation.z = -0.35;
          this.head.rotation.x = -0.3;
        } else {
          this.body.rotation.x = 0.28;
          this.rightArm.rotation.x = -1.62;
          this.rightArm.rotation.z = 0;
          this.leftArm.rotation.x = -1.62;
          this.leftArm.rotation.z = 0;
          this.head.rotation.x = 0.12;
        }

        if (this.particles && Math.random() < 0.4) {
          this.particles.emitElementalParticles(
            this.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.2, (Math.random() - 0.5) * 0.6)),
            2,
            [0xffd700, 0xffffff, 0xa29bfe],
            [1, 3],
            0.35,
            0,
            0.5
          );
        }
      }

      if (this.castTime >= this.castDuration) {
        this.isCasting = false;
        this.castAuraGroup.visible = false;
      }
    } else {
      // --- ANIMATION DI CHUYỂN & NGHỈ NGƠI THƯỜNG ---
      // Độ nghiêng người khi ôm cua rẽ hướng (Banking roll)
      const bankRoll = -rotDiff * 0.35;
      this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, bankRoll, delta * 10);

      if (this.isGrounded) {
        if (this.isMoving) {
          const legSwing = Math.sin(this.animTime) * (this.isSprinting ? 0.95 : 0.65);
          this.leftLeg.rotation.x = legSwing;
          this.rightLeg.rotation.x = -legSwing;

          this.leftArm.rotation.x = -legSwing * 0.85;
          this.rightArm.rotation.x = -0.45 + Math.sin(this.animTime) * 0.18;
          this.rightArm.rotation.y = 0;
          this.rightArm.rotation.z = 0;
          this.leftArm.rotation.z = 0;

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
          // Trạng thái nghỉ (Idle thở phập phồng đáng yêu)
          const breath = Math.sin(this.animTime * 0.8);
          this.body.scale.set(1.0 + breath * 0.02, 1.0 - breath * 0.02, 1.0 + breath * 0.02);
          this.body.position.y = breath * 0.03;
          this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, 0, delta * 8);

          this.leftLeg.rotation.set(0, 0, 0);
          this.rightLeg.rotation.set(0, 0, 0);
          this.leftArm.rotation.set(0, 0, Math.sin(this.animTime * 0.8) * 0.06);

          this.rightArm.rotation.set(-0.55 + breath * 0.04, 0.1, 0);

          this.head.rotation.x = 0;
          this.head.rotation.y = Math.sin(this.animTime * 0.4) * 0.12;
          this.head.rotation.z = Math.cos(this.animTime * 0.5) * 0.04;

          this.ears[0].rotation.z = Math.sin(this.animTime * 0.6) * 0.08;
          this.ears[1].rotation.z = -Math.sin(this.animTime * 0.6) * 0.08;
        }
      } else {
        // Trạng thái trên không trung
        this.leftLeg.rotation.x = -0.55;
        this.rightLeg.rotation.x = -0.55;
        this.leftArm.rotation.x = 2.4;
        this.rightArm.rotation.x = -0.85;
        this.body.rotation.x = -0.18;
        this.head.rotation.x = -0.22;
      }
    }

    // --- ANIMATION CHÉM KIẾM (đè lên tư thế tay phải) ---
    if (this.slashTimer > 0) {
      this.slashTimer -= delta;
      const p = 1.0 - Math.max(0, this.slashTimer) / this.slashDuration;
      const ease = 1.0 - Math.pow(1.0 - p, 3);
      this.rightArm.rotation.y = 0;
      if (this.slashStep === 2) {
        // Nhát 3 - đâm tới: rút tay về rồi đâm thẳng, người đổ về trước
        this.rightArm.rotation.x = THREE.MathUtils.lerp(-0.3, -1.65, ease);
        this.rightArm.rotation.z = 0;
        this.body.rotation.x = THREE.MathUtils.lerp(-0.1, 0.35, ease);
        this.body.rotation.y = THREE.MathUtils.lerp(0.4, -0.15, ease);
      } else {
        // Nhát 1, 2 - chém ngang: rotation.z quét cung, rotation.x đưa tay ra trước
        this.rightArm.rotation.x = -1.35;
        this.rightArm.rotation.z = this.slashSide * THREE.MathUtils.lerp(1.5, -1.3, ease);
        this.body.rotation.y = this.slashSide * THREE.MathUtils.lerp(0.35, -0.35, ease);
      }
      // Lưỡi kiếm duỗi thẳng theo cánh tay khi chém
      this.sword.rotation.x = Math.PI - 0.25;

      if (this.slashTimer <= 0) {
        this.rightArm.rotation.z = 0;
        this.body.rotation.y = 0;
      }
    } else if (this.isCharging) {
      // Kéo kiếm ra sau hông, kiếm quang sáng dần từ lam sang hoàng kim
      const c = this.chargeLevel;
      this.rightArm.rotation.x = 0.55 + c * 0.25;
      this.rightArm.rotation.y = 0;
      this.rightArm.rotation.z = 0.7;
      this.body.rotation.y = 0.3 * c;
      this.sword.rotation.x = Math.PI - 0.25;
      const pulse = c >= 1 ? 0.5 + 0.5 * Math.sin(this.animTime * 6) : c;
      this.bladeGlowMat.color.setHex(0x1dd1a1).lerp(CHARGE_FULL_COLOR, pulse);
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

    // Kiếm quang tắt dần
    this.bladeGlowMat.opacity = this.auraIntensity * 0.6;
    this.auraIntensity = Math.max(0, this.auraIntensity - delta * 2.5);

    // Không đánh một lúc thì tra kiếm vào vỏ
    if (this.isSwordDrawn && !this.isSwordThrown && !this.isCharging && !this.isCasting && this.slashTimer <= 0) {
      this.sheatheTimer -= delta;
      if (this.sheatheTimer <= 0) this.sheatheSword();
    }

    // Squash & Stretch toàn thân
    this.body.scale.y = this.squashFactor;
    this.body.scale.x = 1.0 / Math.sqrt(this.squashFactor);
    this.body.scale.z = 1.0 / Math.sqrt(this.squashFactor);
  }
}
