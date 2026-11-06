import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';

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
    this.slashDuration = 0.26;
    this.slashSide = 1;
    this.slashFacing = 0;

    // Kỹ năng & Thi triển phép thuật (Skill Casting)
    this.isCasting = false;
    this.castSkill = 0;
    this.castTime = 0;
    this.castDuration = 0.6;

    // Bảng màu trang phục Tiên Hiệp cổ phong
    this.outfitIndex = 0;
    this.outfits = [
      { name: 'Thanh Vân Tiên Bào (Lam Ngọc)', clothes: 0x54a0ff, hat: 0x1dd1a1 },
      { name: 'Tử Tiêu Kiếm Tông (Tử Kim)', clothes: 0x8854d0, hat: 0xf1c40f },
      { name: 'Hồng Trần Ma Tu (Chu Sa Hắc Bào)', clothes: 0xeb3b5a, hat: 0x2d3436 },
      { name: 'Bạch Hạc Chân Nhân (Bạch Ngọc)', clothes: 0xf5f6fa, hat: 0x00d2d3 },
    ];

    this.buildMesh();
    this.buildCastAura();
    this.buildContactShadow();
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

    // Áo yếm / quần áo
    this.clothesMat = new THREE.MeshStandardMaterial({
      color: this.outfits[0].clothes,
      roughness: 0.7,
      flatShading: true,
    });

    // Mũ Beret xinh xắn
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

    // Cúc áo nhỏ xinh
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0xfff0c2, roughness: 0.5 });
    for (let b = 0; b < 2; b++) {
      const button = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), buttonMat);
      button.position.set(0, 0.75 - b * 0.18, 0.52);
      this.body.add(button);
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

    // Mũ Beret
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0.1, 0.5, -0.05);
    hatGroup.rotation.z = -0.2;
    hatGroup.rotation.x = -0.1;

    const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.16, 8), this.hatMat);
    hatBase.castShadow = true;
    hatGroup.add(hatBase);

    const hatPompom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), snoutMat);
    hatPompom.position.y = 0.16;
    hatGroup.add(hatPompom);

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

    // 5. TAY PHẢI VÀ THANH TIÊN KIẾM LOW POLY
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.48, 0.85, 0);
    const armMeshR = new THREE.Mesh(armGeo, this.furMat);
    armMeshR.position.y = -0.16;
    armMeshR.castShadow = true;
    this.rightArm.add(armMeshR);

    // Tiên kiếm: trục +y của nhóm là hướng lưỡi kiếm
    this.sword = new THREE.Group();
    this.sword.position.set(0.02, -0.3, 0.06);
    this.sword.rotation.x = Math.PI / 2;

    // Chuôi kiếm
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8, flatShading: true });
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), hiltMat);
    hilt.castShadow = true;
    this.sword.add(hilt);

    // Tua kiếm đỏ ở đốc
    const swordTassel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.16, 4), new THREE.MeshBasicMaterial({ color: 0xee5253 }));
    swordTassel.position.y = -0.18;
    this.sword.add(swordTassel);

    // Đốc chắn tay vàng
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.3, metalness: 0.4, flatShading: true });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.08), guardMat);
    guard.position.y = 0.13;
    guard.castShadow = true;
    this.sword.add(guard);

    // Lưỡi kiếm bạc
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe6e9, roughness: 0.25, metalness: 0.6, flatShading: true });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.03), bladeMat);
    blade.position.y = 0.58;
    blade.castShadow = true;
    this.sword.add(blade);

    const bladeTip = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.064, 0.16, 4), bladeMat);
    bladeTip.rotation.y = Math.PI / 4;
    bladeTip.scale.z = 0.35;
    bladeTip.position.y = 1.08;
    this.sword.add(bladeTip);

    // Đường kiếm quang phát sáng giữa lưỡi
    this.bladeGlowMat = new THREE.MeshBasicMaterial({ color: 0x00d2d3 });
    const bladeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.8, 0.04), this.bladeGlowMat);
    bladeGlow.position.y = 0.58;
    this.sword.add(bladeGlow);

    this.rightArm.add(this.sword);
    this.body.add(this.rightArm);

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

  // Chém kiếm theo hướng facing (radian), luân phiên chém trái/phải
  triggerSlashAnimation(facing) {
    this.slashTimer = this.slashDuration;
    this.slashSide = -this.slashSide;
    this.slashFacing = facing;
    this.targetRotationY = facing;

    // Kiếm quang lóe sáng
    this.bladeGlowMat.color.setHex(0xffffff);

    sound.playSwordSlash();
  }

  // KÍCH HOẠT ANIMATION VÀ VÒNG MA PHÁP THI TRIỂN KỸ NĂNG CỦA BÉ GẤU
  triggerSkillCast(skillNum) {
    this.isCasting = true;
    this.castSkill = skillNum;
    this.castTime = 0;
    this.castDuration = skillNum === 5 ? 1.35 : (skillNum === 4 ? 0.75 : 0.6);

    const colors = {
      1: 0xff4757, // Hỏa
      2: 0x00d2d3, // Lôi
      3: 0x7ed6df, // Băng
      4: 0xe67e22, // Thổ
      5: 0xffd700, // Kim (Vạn Kiếm Quy Tông)
    };

    const color = colors[skillNum] || 0xffffff;
    if (this.castAuraMat) {
      this.castAuraMat.color.setHex(color);
      this.castAuraMat.opacity = 0.95;
    }
    this.castAuraGroup.visible = true;
    this.castAuraGroup.scale.set(0.3, 0.3, 0.3);

    // Cập nhật màu kiếm quang theo kỹ năng
    this.bladeGlowMat.color.setHex(color);

    if (skillNum === 5) {
      // Vạn Kiếm: Bé gấu ngự không phi hành, lơ lửng ngự kiếm!
      this.jumpVelocity = 5.5;
      this.isGrounded = false;
      this.squashFactor = 1.25;
      sound.playSwordSummon();
    } else if (skillNum === 4) {
      // Địa chấn: Bé gấu co chân bật nhảy lên không trung rồi giậm mạnh xuống!
      this.jumpVelocity = 7.0;
      this.isGrounded = false;
      this.squashFactor = 1.35;
    } else if (skillNum === 1) {
      this.squashFactor = 1.25;
    } else if (skillNum === 3) {
      this.squashFactor = 0.85;
    }

    if (this.particles) {
      this.particles.emitElementalParticles(
        this.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
        14,
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
    this.isSprinting = isSprinting;
    const moveLen = inputVector.length();
    this.isMoving = moveLen > 0.05;

    // Tốc độ di chuyển
    const targetSpeed = this.isMoving ? (this.isSprinting ? 9.8 : 5.4) : 0;
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, delta * 11);

    // Tính vector vận tốc theo hướng
    if (this.isMoving) {
      this.velocity.x = inputVector.x * this.speed;
      this.velocity.z = inputVector.z * this.speed;
      // Đang chém thì giữ hướng mặt về phía đòn chém
      this.targetRotationY = this.slashTimer > 0 ? this.slashFacing : Math.atan2(inputVector.x, inputVector.z);
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

      // Từng dáng thi triển đặc trưng cho 4 kỹ năng:
      if (this.castSkill === 1) {
        // [1] Thiên thạch lửa: Ưỡn người ngửa ra sau, hai tay giương súng lên trời kêu gọi hỏa thạch!
        this.body.rotation.x = -0.32;
        this.head.rotation.x = -0.45;
        this.rightArm.rotation.x = -2.6;
        this.leftArm.rotation.x = -2.6;
        this.body.position.y = 0.15;
      } else if (this.castSkill === 2) {
        // [2] Sấm sét: Lao người về phía trước ngắm bắn súng thẳng tắp, súng giật điện rung lắc!
        this.body.rotation.x = 0.28;
        this.head.rotation.x = 0.15;
        this.rightArm.rotation.x = -1.6 + (Math.random() - 0.5) * 0.08;
        this.rightArm.rotation.y = (Math.random() - 0.5) * 0.08;
        this.leftArm.rotation.x = 0.4;
        this.ears[0].rotation.z = -0.25;
        this.ears[1].rotation.z = 0.25;
      } else if (this.castSkill === 3) {
        // [3] Bão băng: Xoay tròn 360 độ (Whirlwind Spin) bung rộng hai cánh tay tạo vòng bão tuyết!
        this.model.rotation.y = this.rotationY + castProgress * Math.PI * 4;
        this.body.rotation.x = 0.15;
        this.rightArm.rotation.x = 0;
        this.rightArm.rotation.z = 1.3;
        this.leftArm.rotation.x = 0;
        this.leftArm.rotation.z = -1.3;
        this.head.rotation.y = Math.sin(castProgress * 12) * 0.2;
      } else if (this.castSkill === 4) {
        // [4] Địa chấn: Bật nhảy giậm mạnh xuống đất với toàn bộ trọng lực!
        if (castProgress < 0.5) {
          this.body.rotation.x = -0.2;
          this.rightArm.rotation.x = -2.2;
          this.leftArm.rotation.x = -2.2;
        } else {
          this.body.rotation.x = 0.45;
          this.rightArm.rotation.x = -0.8;
          this.leftArm.rotation.x = -0.8;
          this.head.rotation.x = 0.3;
        }
      } else if (this.castSkill === 5) {
        // [5] Vạn Kiếm Quy Tông: Ngự kiếm phi tiên, hai tay kết kiếm chỉ giương lên rồi trảm xuống!
        this.body.position.y = 0.65 + Math.sin(this.castTime * 10) * 0.14;
        if (castProgress < 0.45) {
          // Giai đoạn 1: Hai tay kết kiếm ấn giương cao lên trời, chuẩn bị vạn kiếm
          this.body.rotation.x = -0.28;
          this.rightArm.rotation.x = -2.4;
          this.rightArm.rotation.z = 0.35;
          this.leftArm.rotation.x = -2.4;
          this.leftArm.rotation.z = -0.35;
          this.head.rotation.x = -0.3;
        } else {
          // Giai đoạn 2: Hai tay trảm thẳng về phía trước chỉ huy vạn kiếm phóng tới mục tiêu
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
            [0xffd700, 0xffffff, 0xffa502],
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
      // Vung tay ngang trước mặt: rotation.z quét cung, rotation.x đưa tay ra trước
      this.rightArm.rotation.x = -1.35;
      this.rightArm.rotation.y = 0;
      this.rightArm.rotation.z = this.slashSide * THREE.MathUtils.lerp(1.5, -1.3, ease);
      this.body.rotation.y = this.slashSide * THREE.MathUtils.lerp(0.35, -0.35, ease);
      // Lưỡi kiếm duỗi thẳng theo cánh tay khi chém
      this.sword.rotation.x = Math.PI - 0.25;

      if (this.slashTimer <= 0) {
        this.rightArm.rotation.z = 0;
        this.body.rotation.y = 0;
        this.bladeGlowMat.color.setHex(0x00d2d3);
      }
    } else {
      this.sword.rotation.x = THREE.MathUtils.lerp(this.sword.rotation.x, Math.PI / 2, delta * 12);
    }

    // Squash & Stretch toàn thân
    this.body.scale.y = this.squashFactor;
    this.body.scale.x = 1.0 / Math.sqrt(this.squashFactor);
    this.body.scale.z = 1.0 / Math.sqrt(this.squashFactor);
  }
}
