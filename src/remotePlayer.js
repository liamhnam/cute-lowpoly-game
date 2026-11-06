import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';

export class RemotePlayer {
  constructor(scene, particles, data) {
    this.scene = scene;
    this.particles = particles;
    this.id = data.id;
    this.name = data.name || 'Gấu Hiệp Sĩ';
    this.outfitIndex = Number(data.outfit) || 0;
    this.hp = data.hp !== undefined ? data.hp : 2000;
    this.maxHp = data.maxHp || 2000;
    this.isDead = Boolean(data.isDead);

    this.group = new THREE.Group();
    this.position = new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0);
    this.group.position.copy(this.position);

    this.targetPosition = this.position.clone();
    this.rotationY = data.rotY || 0;
    this.targetRotationY = this.rotationY;

    this.isMoving = false;
    this.isSprinting = false;
    this.isGrounded = true;
    this.isCasting = false;
    this.castSkill = 0;
    this.castTime = 0;

    this.animTime = 0;
    this.hitFlashTimer = 0;

    this.outfits = [
      { name: 'Thanh Vân Tiên Bào (Lam Ngọc)', clothes: 0x54a0ff, hat: 0x1dd1a1 },
      { name: 'Tử Tiêu Kiếm Tông (Tử Kim)', clothes: 0x8854d0, hat: 0xf1c40f },
      { name: 'Hồng Trần Ma Tu (Chu Sa Hắc Bào)', clothes: 0xeb3b5a, hat: 0x2d3436 },
      { name: 'Bạch Hạc Chân Nhân (Bạch Ngọc)', clothes: 0xf5f6fa, hat: 0x00d2d3 },
    ];

    this.buildMesh();
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
    this.contactShadow.position.y = 0.04;
    this.group.add(this.contactShadow);
  }

  buildBillboard() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 300;
    this.canvas.height = 90;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
    });
    this.sprite = new THREE.Sprite(spriteMat);
    this.sprite.scale.set(2.4, 0.72, 1);
    this.sprite.position.set(0, 2.35, 0);
    this.group.add(this.sprite);

    this.updateBillboard();
  }

  updateBillboard() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Khung nền nametag
    ctx.fillStyle = 'rgba(24, 30, 42, 0.82)';
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(10, 8, w - 20, h - 16, 10);
    ctx.fill();
    ctx.stroke();

    // 2. Tên người chơi
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    const displayTitle = `⚔️ ${this.name}`;
    ctx.fillText(displayTitle, w / 2, 14);

    // 3. Thanh Máu (Health bar)
    const barX = 24;
    const barY = 46;
    const barW = w - 48;
    const barH = 18;

    // Viền & nền thanh máu
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#2f3542';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    // Màu thanh máu gradient theo tỷ lệ
    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    let barColor = '#2ed573'; // Xanh lá
    if (ratio < 0.3) {
      barColor = '#ff4757'; // Đỏ nguy cấp
    } else if (ratio < 0.6) {
      barColor = '#ffa502'; // Cam
    }

    ctx.fillStyle = barColor;
    ctx.fillRect(barX + 2, barY + 2, Math.max(0, (barW - 4) * ratio), barH - 4);

    // Chỉ số HP chữ
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.round(this.hp)} / ${this.maxHp} HP`, w / 2, barY + barH / 2 + 1);

    this.texture.needsUpdate = true;
  }

  buildMesh() {
    this.model = new THREE.Group();

    this.furMat = new THREE.MeshStandardMaterial({
      color: 0xdf9a57,
      roughness: 0.8,
      flatShading: true,
    });

    const outfit = this.outfits[this.outfitIndex % this.outfits.length];

    this.clothesMat = new THREE.MeshStandardMaterial({
      color: outfit.clothes,
      roughness: 0.7,
      flatShading: true,
    });

    this.hatMat = new THREE.MeshStandardMaterial({
      color: outfit.hat,
      roughness: 0.6,
      flatShading: true,
    });

    const snoutMat = new THREE.MeshStandardMaterial({
      color: 0xffedd8,
      roughness: 0.8,
      flatShading: true,
    });

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2 });
    const eyeSparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff7b90, transparent: true, opacity: 0.65 });
    const backpackMat = new THREE.MeshStandardMaterial({ color: 0x8d5b4c, roughness: 0.8, flatShading: true });

    // 1. Thân
    this.body = new THREE.Group();
    const bodyMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), this.clothesMat);
    bodyMesh.scale.set(1.0, 1.2, 0.95);
    bodyMesh.position.y = 0.65;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.body.add(bodyMesh);

    // 2. Đầu
    this.head = new THREE.Group();
    this.head.position.y = 1.35;
    const headMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 1), this.furMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Mõm & Mũi
    const snout = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), snoutMat);
    snout.scale.set(1.1, 0.85, 1.0);
    snout.position.set(0, -0.08, 0.48);
    this.head.add(snout);

    const nose = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), noseMat);
    nose.position.set(0, -0.02, 0.7);
    this.head.add(nose);

    // Mắt
    for (const side of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeMat);
      eye.position.set(side * 0.22, 0.08, 0.49);
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeSparkleMat);
      sparkle.position.set(side * 0.24, 0.11, 0.56);
      this.head.add(eye);
      this.head.add(sparkle);

      // Tai
      const earGroup = new THREE.Group();
      earGroup.position.set(side * 0.42, 0.45, 0.05);
      const earMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), this.furMat);
      earMesh.scale.set(0.9, 0.9, 0.5);
      earGroup.add(earMesh);
      this.head.add(earGroup);
    }

    // Mũ
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0.1, 0.5, -0.05);
    hatGroup.rotation.z = -0.2;
    const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.16, 8), this.hatMat);
    hatGroup.add(hatBase);
    this.head.add(hatGroup);

    this.body.add(this.head);

    // 3. Ba Lô
    this.backpack = new THREE.Group();
    this.backpack.position.set(0, 0.72, -0.5);
    const bagMain = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.3), backpackMat);
    this.backpack.add(bagMain);
    this.body.add(this.backpack);

    // 4. Tay trái
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.35, 6);
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.48, 0.85, 0);
    const armMeshL = new THREE.Mesh(armGeo, this.furMat);
    armMeshL.position.y = -0.16;
    this.leftArm.add(armMeshL);
    this.body.add(this.leftArm);

    // 5. Tay phải & Súng Blaster
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.48, 0.85, 0);
    const armMeshR = new THREE.Mesh(armGeo, this.furMat);
    armMeshR.position.y = -0.16;
    this.rightArm.add(armMeshR);

    this.gun = new THREE.Group();
    this.gun.position.set(0.05, -0.28, 0.18);
    this.gun.rotation.x = -Math.PI / 2 + 0.1;

    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.22, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xff6348, roughness: 0.4, flatShading: true })
    );
    this.gun.add(gunBody);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 0.32, 8),
      new THREE.MeshStandardMaterial({ color: 0xffc048, roughness: 0.3, flatShading: true })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.32);
    this.gun.add(barrel);

    this.muzzleFlash = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({ color: 0xfffa65, transparent: true, opacity: 0.95 })
    );
    this.muzzleFlash.position.set(0, 0.02, 0.52);
    this.muzzleFlash.visible = false;
    this.gun.add(this.muzzleFlash);

    this.rightArm.add(this.gun);
    this.body.add(this.rightArm);

    // 6. Chân
    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 6);
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.25, 0.32, 0);
    const legL = new THREE.Mesh(legGeo, this.furMat);
    legL.position.y = -0.12;
    this.leftLeg.add(legL);
    this.body.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.25, 0.32, 0);
    const legR = new THREE.Mesh(legGeo, this.furMat);
    legR.position.y = -0.12;
    this.rightLeg.add(legR);
    this.body.add(this.rightLeg);

    this.model.add(this.body);
    this.group.add(this.model);
  }

  updateState(state) {
    if (state.x !== undefined && state.z !== undefined) {
      this.targetPosition.set(state.x, state.y || 0, state.z);
    }
    if (state.rotY !== undefined) {
      this.targetRotationY = state.rotY;
    }
    this.isMoving = Boolean(state.isMoving);
    this.isSprinting = Boolean(state.isSprinting);
    this.isGrounded = state.isGrounded !== undefined ? state.isGrounded : true;
    this.isCasting = Boolean(state.isCasting);
    this.castSkill = Number(state.castSkill) || 0;
  }

  triggerShoot() {
    this.muzzleFlash.visible = true;
    setTimeout(() => {
      if (this.muzzleFlash) this.muzzleFlash.visible = false;
    }, 90);
  }

  takeDamage(dmg, hitPos) {
    this.hp = Math.max(0, this.hp - dmg);
    this.updateBillboard();

    // Chớp đỏ toàn thân
    this.hitFlashTimer = 0.22;
    this.furMat.color.setHex(0xff3838);
    this.clothesMat.color.setHex(0xff4757);

    if (this.particles && hitPos) {
      this.particles.emitHitSparkles(hitPos, 14);
    }
  }

  setHp(hp, maxHp) {
    this.hp = hp;
    if (maxHp) this.maxHp = maxHp;
    this.updateBillboard();
  }

  respawn(spawnPos, hp, maxHp) {
    this.isDead = false;
    this.position.set(spawnPos.x, spawnPos.y || 0, spawnPos.z);
    this.targetPosition.copy(this.position);
    this.group.position.copy(this.position);
    this.group.visible = true;
    this.hp = hp || 2000;
    this.maxHp = maxHp || 2000;
    this.updateBillboard();

    if (this.particles) {
      this.particles.emitShockwave(this.position, 0x00d2d3, 4.0, 0.4);
      this.particles.emitElementalParticles(this.position, 20, [0x00d2d3, 0xffd700, 0xffffff], [1, 4], 0.6, 5.0, 0.8);
    }
  }

  setDead(isDead) {
    this.isDead = isDead;
    this.group.visible = !isDead;
    if (isDead && this.particles) {
      this.particles.emitShockwave(this.position, 0xff4757, 3.5, 0.35);
    }
  }

  checkBulletCollision(bulletPos, bulletRadius = 0.65) {
    if (this.isDead || !this.group.visible) return false;
    const playerCenter = this.position.clone().add(new THREE.Vector3(0, 0.85, 0));
    return bulletPos.distanceTo(playerCenter) <= (0.85 + bulletRadius);
  }

  update(delta) {
    if (this.isDead) return;

    // Phục hồi màu sắc sau khi dính sát thương chớp đỏ
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        this.furMat.color.setHex(0xdf9a57);
        const outfit = this.outfits[this.outfitIndex % this.outfits.length];
        this.clothesMat.color.setHex(outfit.clothes);
      }
    }

    // Nội suy vị trí lerp mượt mà
    this.position.lerp(this.targetPosition, Math.min(1.0, delta * 15));
    this.group.position.copy(this.position);

    // Nội suy góc xoay lerp
    let diff = this.targetRotationY - this.rotationY;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.rotationY += diff * Math.min(1.0, delta * 14);
    this.model.rotation.y = this.rotationY;

    // Animation chạy / bước đi
    this.animTime += delta * (this.isSprinting ? 12 : (this.isMoving ? 8 : 2.5));

    if (this.isMoving) {
      const swing = Math.sin(this.animTime) * (this.isSprinting ? 0.9 : 0.6);
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.8;
      this.rightArm.rotation.x = -0.45 + Math.sin(this.animTime) * 0.18;
      this.body.position.y = Math.abs(Math.sin(this.animTime * 2)) * 0.08;
    } else {
      const breath = Math.sin(this.animTime * 0.8);
      this.body.position.y = breath * 0.03;
      this.leftLeg.rotation.set(0, 0, 0);
      this.rightLeg.rotation.set(0, 0, 0);
      this.leftArm.rotation.set(0, 0, Math.sin(this.animTime * 0.8) * 0.05);
      this.rightArm.rotation.set(-0.55 + breath * 0.04, 0.1, 0);
    }
  }

  destroy() {
    this.scene.remove(this.group);
    if (this.texture) this.texture.dispose();
  }
}
