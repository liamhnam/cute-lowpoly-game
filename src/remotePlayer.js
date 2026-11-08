import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';
import { createSword } from './sword.js';

// Thời lượng animation chém của từng nhát combo (khớp với nhân vật chính)
const SLASH_DURATIONS = [0.24, 0.24, 0.3];

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
    this.freezeTimer = 0;
    this.slowTimer = 0;
    this.slowAmount = 0;
    this.isFloatingUlt = false;

    // Chém kiếm (đồng bộ từ đòn của người chơi này)
    this.slashTimer = 0;
    this.slashDuration = SLASH_DURATIONS[0];
    this.slashStep = 0;

    // Cùng thứ tự với Character.outfits (5 Vai Trò Chiến Đấu + 1 Vai Trò Ẩn)
    this.outfits = [
      { name: 'Thiết Giáp Hộ Vệ (Đỡ Đòn / Khống Chế)', icon: '🛡️', clothes: 0xf6b93b, hat: 0x2c3e50 },
      { name: 'Ám Ảnh Sát Thủ (Cơ Động / Kết Liễu)', icon: '🗡️', clothes: 0x6c5ce7, hat: 0x1e272e },
      { name: 'Nguyên Tố Pháp Sư (Khống Chế / Phép AoE)', icon: '❄️', clothes: 0x0abde3, hat: 0x2e86de },
      { name: 'Cuồng Chiến Đấu Sĩ (Hút Máu / Phá Giáp)', icon: '🔥', clothes: 0xeb3b5a, hat: 0x2d3436 },
      { name: 'Thần Tiễn Xạ Thủ (Bắn Tỉa / Thả Diều)', icon: '🏹', clothes: 0x2ed573, hat: 0x1e272e },
      { name: 'Chiến Sĩ NAMCAM (Bộ Đội VN)', icon: '🇻🇳', clothes: 0x2e4a2b, hat: 0x2e4a2b },
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

    // 2. Tên người chơi + Biểu tượng Vai Trò
    const roleOutfit = this.outfits[this.outfitIndex % this.outfits.length];
    const roleIcon = roleOutfit?.icon || '⚔️';
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    const displayTitle = `${roleIcon} ${this.name}`;
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
    this.snout = snout;

    const nose = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), noseMat);
    nose.position.set(0, -0.02, 0.7);
    this.head.add(nose);
    this.nose = nose;

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
    this.hatGroup = hatGroup;
    this.head.add(this.hatGroup);

    // Mũ Cối & Mặt NAMCAM
    this.boDoiHatGroup = this.buildBoDoiHat();
    this.head.add(this.boDoiHatGroup);
    this.namCamFace = this.buildNamCamFace();
    this.head.add(this.namCamFace);

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

    // 5. Tay phải & Tiên kiếm (trục +y của nhóm là hướng lưỡi kiếm, như nhân vật chính)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.48, 0.85, 0);
    const armMeshR = new THREE.Mesh(armGeo, this.furMat);
    armMeshR.position.y = -0.16;
    this.rightArm.add(armMeshR);

    this.sword = new THREE.Group();
    this.sword.position.set(0.02, -0.3, 0.06);
    this.sword.rotation.x = Math.PI / 2;
    this.swordModel = createSword();
    this.sword.add(this.swordModel);

    // Súng trường quân đội (NAMCAM)
    this.gunGroup = this.buildGunModel();
    this.rightArm.add(this.gunGroup);

    this.rightArm.add(this.sword);
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

  // Mũ cối Bộ Đội
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
    group.add(dome);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.65), helmetMat);
    ridge.position.set(0, 0.28, 0);
    group.add(ridge);

    const brimGeo = new THREE.CylinderGeometry(0.56, 0.46, 0.08, 16, 1, true);
    const brim = new THREE.Mesh(brimGeo, helmetMat);
    brim.position.y = 0.02;
    brim.scale.set(1.0, 1.0, 1.18);
    group.add(brim);

    // Huy hiệu sao vàng
    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0, 0.16, 0.44);
    badgeGroup.rotation.x = 0.22;
    const redBacking = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), new THREE.MeshBasicMaterial({ color: 0xd63031 }));
    badgeGroup.add(redBacking);
    const goldBorder = new THREE.Mesh(new THREE.RingGeometry(0.062, 0.072, 16), new THREE.MeshBasicMaterial({ color: 0xf1c40f }));
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
    const starMesh = new THREE.Mesh(new THREE.ShapeGeometry(starShape), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    starMesh.position.z = 0.002;
    badgeGroup.add(starMesh);
    group.add(badgeGroup);

    group.visible = false;
    return group;
  }

  // Mặt NAMCAM
  buildNamCamFace() {
    const group = new THREE.Group();
    group.position.set(0, -0.02, 0.49);
    const loader = new THREE.TextureLoader();
    const texture = loader.load('./images/namcam_face.png');
    texture.minFilter = THREE.LinearFilter;
    const faceMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.64, 0.75),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    group.add(faceMesh);
    group.visible = false;
    return group;
  }

  // Súng trường
  buildGunModel() {
    const gun = new THREE.Group();
    gun.position.set(0.05, -0.15, 0.25);
    gun.rotation.x = -Math.PI / 2;
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.4, metalness: 0.8 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e2c00, roughness: 0.7 });

    gun.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.42), metalMat));
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.14, 0.28), woodMat);
    stock.position.set(0, -0.04, -0.32);
    gun.add(stock);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.48, 6), metalMat);
    barrel.position.set(0, 0.03, 0.42);
    barrel.rotation.x = Math.PI / 2;
    gun.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.24, 0.1), metalMat);
    mag.position.set(0, -0.16, 0.06);
    mag.rotation.x = 0.25;
    gun.add(mag);

    gun.visible = false;
    return gun;
  }

  triggerFartAnimation() {
    this.isFarting = true;
    this.fartTimer = 0.55;
  }

  triggerSkillCast(skillId = 1) {
    this.isCasting = true;
    this.castSkill = skillId;
    this.castDuration = skillId === 4 ? 0.85 : 0.55;
    this.castTimer = this.castDuration;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateBillboard();
  }

  setParry() {}

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
    // Đối thủ tàng hình: ẩn hoàn toàn (không thể bị bắn trúng vì checkBulletCollision bỏ qua khi ẩn)
    const stealth = Boolean(state.stealth);
    if (stealth !== Boolean(this.isStealthed)) {
      this.isStealthed = stealth;
      if (!this.isDead) this.group.visible = !stealth;
      if (this.particles) this.particles.emitElementalParticles(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 14, [0xa55eea, 0x1e272e], [1, 4], 0.5, 2, 0.7);
    }
    if (state.outfit !== undefined && state.outfit !== this.outfitIndex) {
      this.outfitIndex = Number(state.outfit);
      const isNamCam = this.outfitIndex === 5;
      if (this.boDoiHatGroup) this.boDoiHatGroup.visible = isNamCam;
      if (this.hatGroup) this.hatGroup.visible = !isNamCam;
      if (this.namCamFace) this.namCamFace.visible = isNamCam;
      if (this.snout) this.snout.visible = !isNamCam;
      if (this.nose) this.nose.visible = !isNamCam;
      if (this.gunGroup) this.gunGroup.visible = isNamCam;
      if (this.swordModel) this.swordModel.visible = !isNamCam;

      const outfit = this.outfits[this.outfitIndex % this.outfits.length];
      if (outfit) {
        if (this.clothesMat) this.clothesMat.color.setHex(outfit.clothes);
        if (this.hatMat) this.hatMat.color.setHex(outfit.hat);
      }
    }
  }

  // Animation chém kiếm khi nhận đòn của người chơi này qua mạng; step 0/1 chém ngang, step 2 đâm tới
  triggerSlash(facing, step = 0) {
    this.slashStep = step;
    this.slashDuration = SLASH_DURATIONS[step] || SLASH_DURATIONS[0];
    this.slashTimer = this.slashDuration;
    this.targetRotationY = facing;
  }

  // Kiếm chiêu Cự Kiếm Phá Thiên: kiếm rời tay trong lúc bay
  setSwordThrown(thrown) {
    this.swordModel.visible = !thrown;
  }

  // Thuấn Bộ Trảm: vị trí thật đến từ đồng bộ mạng nên không tự lướt trên máy này
  startDash() {}

  freeze(duration = 2.2) {
    this.freezeTimer = duration;
    if (this.particles) {
      this.particles.emitElementalParticles(
        this.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
        10,
        [0x00d2d3, 0x7ed6df, 0xffffff],
        [1, 4],
        0.4,
        2.0,
        0.5
      );
    }
  }

  slow(duration = 2.5, amount = 0.45) {
    this.slowTimer = duration;
    this.slowAmount = amount;
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

    if (this.isFloatingUlt) {
      this.freezeTimer = 0;
      this.slowTimer = 0;
      this.position.lerp(this.targetPosition, Math.min(1.0, delta * 15));
      this.group.position.copy(this.position);
      this.rightArm.rotation.set(-2.8, 0, 0.4);
      this.leftArm.rotation.set(-2.8, 0, -0.4);
      this.head.rotation.x = -0.25;
      this.rightLeg.rotation.set(0.18, 0, 0.1);
      this.leftLeg.rotation.set(0.18, 0, -0.1);
      return;
    }

    if (this.freezeTimer > 0) this.freezeTimer -= delta;
    if (this.slowTimer > 0) this.slowTimer -= delta;

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

    // Animation thả rắm
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
        return;
      }
    }

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

    // Animation chém kiếm (đè lên tư thế tay phải), cùng kiểu với nhân vật chính
    if (this.slashTimer > 0) {
      this.slashTimer -= delta;
      const p = 1.0 - Math.max(0, this.slashTimer) / this.slashDuration;
      const ease = 1.0 - Math.pow(1.0 - p, 3);
      if (this.slashStep === 2) {
        this.rightArm.rotation.set(THREE.MathUtils.lerp(-0.3, -1.65, ease), 0, 0);
      } else {
        const side = this.slashStep === 1 ? -1 : 1;
        this.rightArm.rotation.set(-1.35, 0, side * THREE.MathUtils.lerp(1.5, -1.3, ease));
      }
      this.sword.rotation.x = Math.PI - 0.25;
    } else if (this.castTimer > 0 || this.isCasting) {
      if (this.castTimer > 0) {
        this.castTimer -= delta;
        if (this.castTimer <= 0) this.isCasting = false;
      }
      const p = this.castDuration ? 1.0 - Math.max(0, this.castTimer || 0) / this.castDuration : 0.5;
      const swing = Math.sin(p * Math.PI);
      const role = this.outfitIndex % 6;
      if (role === 0) {
        this.leftArm.rotation.set(-1.45 * swing, 0.45 * swing, -0.2);
        this.rightArm.rotation.set(-2.1 * swing, 0, -0.3 * swing);
        this.body.rotation.x = 0.25 * swing;
      } else if (role === 1) {
        this.body.rotation.y = p * Math.PI * 2;
        this.rightArm.rotation.set(-1.5, 0, 1.3 * swing);
        this.leftArm.rotation.set(-1.5, 0, -1.3 * swing);
      } else if (role === 2) {
        this.rightArm.rotation.set(-2.4 * swing, 0, 0.25);
        this.leftArm.rotation.set(-2.2 * swing, 0, -0.35);
        this.body.position.y += 0.35 * swing;
      } else if (role === 3) {
        this.rightArm.rotation.set(THREE.MathUtils.lerp(-2.7, -0.3, p), 0, -0.25);
        this.leftArm.rotation.set(-1.8 * swing, 0, -0.6 * swing);
        this.body.rotation.x = THREE.MathUtils.lerp(-0.3, 0.45, p);
      } else {
        this.leftArm.rotation.set(-1.6, 0.25, 0);
        this.rightArm.rotation.set(-1.6, -0.35, 0.5 * swing);
      }
    } else {
      this.sword.rotation.x = THREE.MathUtils.lerp(this.sword.rotation.x, Math.PI / 2, Math.min(1, delta * 12));
    }
  }

  destroy() {
    this.scene.remove(this.group);
    if (this.texture) this.texture.dispose();
  }
}
