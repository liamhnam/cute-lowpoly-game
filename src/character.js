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
    this.gunRecoil = 0;

    // Bảng màu trang phục cute
    this.outfitIndex = 0;
    this.outfits = [
      { name: 'Xanh Mint Dễ Thương', clothes: 0x76d7c4, hat: 0xff6b6b },
      { name: 'Vàng Mật Ong Rực Rỡ', clothes: 0xffd166, hat: 0x48dbfb },
      { name: 'Hồng Dâu Ngọt Ngào', clothes: 0xff9ff3, hat: 0xfeca57 },
      { name: 'Tím Lavender Mộng Mơ', clothes: 0xb8b5ff, hat: 0x54a0ff },
    ];

    this.buildMesh();
    this.scene.add(this.group);
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

    // 5. TAY PHẢI VÀ KHẨU SÚNG BLASTER LOW POLY SIÊU CUTE!
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.48, 0.85, 0);
    const armMeshR = new THREE.Mesh(armGeo, this.furMat);
    armMeshR.position.y = -0.16;
    armMeshR.castShadow = true;
    this.rightArm.add(armMeshR);

    // Khẩu súng Mega Blaster
    this.gun = new THREE.Group();
    this.gun.position.set(0.05, -0.28, 0.18);
    this.gun.rotation.x = -Math.PI / 2 + 0.1; // Chĩa súng về phía trước

    // Thân súng chính
    const gunBodyMat = new THREE.MeshStandardMaterial({
      color: 0xff6348, // Cam tươi vui nhộn
      roughness: 0.4,
      flatShading: true,
    });
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.45), gunBodyMat);
    gunBody.castShadow = true;
    this.gun.add(gunBody);

    // Nòng súng tròn to (Megaphone Blaster)
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xffc048, // Vàng ấm
      roughness: 0.3,
      flatShading: true,
    });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.32, 8), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.32);
    barrel.castShadow = true;
    this.gun.add(barrel);

    // Lõi năng lượng phát sáng
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00d2d3 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), coreMat);
    core.position.set(0, 0.12, -0.05);
    this.gun.add(core);

    // Điểm đầu nòng súng (Muzzle Point)
    this.muzzleNode = new THREE.Object3D();
    this.muzzleNode.position.set(0, 0.02, 0.52);
    this.gun.add(this.muzzleNode);

    this.rightArm.add(this.gun);
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

  triggerShootAnimation() {
    this.gunRecoil = 0.25; // Giật súng lùi lại
    sound.playShoot();
  }

  getMuzzleWorldPosition() {
    const worldPos = new THREE.Vector3();
    this.muzzleNode.getWorldPosition(worldPos);
    return worldPos;
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
    const targetSpeed = this.isMoving ? (this.isSprinting ? 9.5 : 5.2) : 0;
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, delta * 10);

    // Tính vector vận tốc theo hướng
    if (this.isMoving) {
      this.velocity.x = inputVector.x * this.speed;
      this.velocity.z = inputVector.z * this.speed;

      this.targetRotationY = Math.atan2(inputVector.x, inputVector.z);
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

    this.position.x = THREE.MathUtils.clamp(this.position.x, -80, 80);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -80, 80);

    const groundY = getTerrainHeight(this.position.x, this.position.z);

    if (!this.isGrounded) {
      this.jumpVelocity += this.gravity * delta;
      this.position.y += this.jumpVelocity * delta;

      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.isGrounded = true;
        this.jumpVelocity = 0;
        this.squashFactor = 0.75;
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

    this.squashFactor = THREE.MathUtils.lerp(this.squashFactor, 1.0, delta * 8);
    this.gunRecoil = THREE.MathUtils.lerp(this.gunRecoil, 0, delta * 12);

    // ANIMATION TIẾN TRÌNH
    const animSpeed = this.isMoving ? (this.isSprinting ? 14 : 9) : 3;
    this.animTime += delta * animSpeed;

    // Giật súng khi bắn
    this.gun.position.z = 0.18 - this.gunRecoil;

    if (this.isGrounded) {
      if (this.isMoving) {
        const legSwing = Math.sin(this.animTime) * (this.isSprinting ? 0.9 : 0.6);
        this.leftLeg.rotation.x = legSwing;
        this.rightLeg.rotation.x = -legSwing;

        this.leftArm.rotation.x = -legSwing * 0.8;
        // Tay phải cầm súng giơ về phía trước và nhấp nhô nhẹ
        this.rightArm.rotation.x = -0.4 + Math.sin(this.animTime) * 0.15;

        this.body.rotation.z = Math.sin(this.animTime) * 0.08;
        this.body.rotation.x = this.isSprinting ? 0.22 : 0.08;

        const bounce = Math.abs(Math.sin(this.animTime * 2)) * 0.08;
        this.body.position.y = bounce;

        this.backpack.rotation.x = Math.sin(this.animTime * 2) * 0.12;

        this.ears[0].rotation.z = -0.1 + Math.sin(this.animTime * 2) * 0.15;
        this.ears[1].rotation.z = 0.1 - Math.sin(this.animTime * 2) * 0.15;

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
        this.body.rotation.set(0, 0, 0);

        this.leftLeg.rotation.set(0, 0, 0);
        this.rightLeg.rotation.set(0, 0, 0);
        this.leftArm.rotation.set(0, 0, Math.sin(this.animTime * 0.8) * 0.05);

        // Tay phải luôn cầm súng sẵn sàng ngắm bắn
        this.rightArm.rotation.set(-0.55 + breath * 0.04, 0.1, 0);

        this.head.rotation.y = Math.sin(this.animTime * 0.4) * 0.12;
        this.head.rotation.z = Math.cos(this.animTime * 0.5) * 0.04;

        this.ears[0].rotation.z = Math.sin(this.animTime * 0.6) * 0.08;
        this.ears[1].rotation.z = -Math.sin(this.animTime * 0.6) * 0.08;
      }
    } else {
      this.leftLeg.rotation.x = -0.5;
      this.rightLeg.rotation.x = -0.5;
      this.leftArm.rotation.x = 2.4;
      this.rightArm.rotation.x = -0.8;
      this.body.rotation.x = -0.15;
      this.head.rotation.x = -0.2;
    }

    this.body.scale.y = this.squashFactor;
    this.body.scale.x = 1.0 / Math.sqrt(this.squashFactor);
    this.body.scale.z = 1.0 / Math.sqrt(this.squashFactor);
  }
}
