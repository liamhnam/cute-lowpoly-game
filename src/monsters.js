import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';

export class Monster {
  constructor(scene, particles, type = 'golem', spawnPos = new THREE.Vector3(), world = null) {
    this.scene = scene;
    this.particles = particles;
    this.type = type;
    this.world = world;

    this.group = new THREE.Group();
    this.position = spawnPos.clone();
    this.position.y = getTerrainHeight(this.position.x, this.position.z);
    this.group.position.copy(this.position);

    this.maxHp = 100;
    this.hp = this.maxHp;
    this.isDead = false;
    this.respawnTimer = 0;

    // AI & Vận động
    this.speed = this.type === 'golem' ? 2.2 : 2.8;
    this.rotationY = Math.random() * Math.PI * 2;
    this.walkAnimTime = Math.random() * 10;
    this.hitFlashTimer = 0;
    this.velocity = new THREE.Vector3();

    // Hiệu ứng trạng thái: Đóng băng & Đẩy lùi
    this.isFrozen = false;
    this.freezeTimer = 0;

    // Kích thước va chạm
    this.hitRadius = this.type === 'golem' ? 2.8 : 2.5;
    this.hitHeight = this.type === 'golem' ? 6.5 : 5.5;

    this.buildMesh();
    this.buildHealthBar();
    this.buildContactShadow();

    this.scene.add(this.group);
  }

  buildContactShadow() {
    const radius = this.type === 'golem' ? 2.5 : 1.7;
    const geo = new THREE.CircleGeometry(radius, 16);
    geo.rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(geo, this.shadowMat);
    this.scene.add(this.contactShadow);
  }

  buildMesh() {
    this.model = new THREE.Group();

    if (this.type === 'golem') {
      // 1. NGƯỜI ĐÁ KHỔNG LỒ RÊU PHONG (MOSS GOLEM)
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x7f8c8d,
        flatShading: true,
        roughness: 0.9,
      });
      const mossMat = new THREE.MeshStandardMaterial({
        color: 0x589b4a,
        flatShading: true,
        roughness: 0.85,
      });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

      this.damageableMaterials = [stoneMat, mossMat];

      // Thân mình đá tảng khổng lồ
      this.torso = new THREE.Group();
      this.torso.position.y = 3.2;

      const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 1), stoneMat);
      mainRock.scale.set(1.3, 1.1, 1.1);
      mainRock.castShadow = true;
      this.torso.add(mainRock);

      // Mảng rêu xanh trên vai
      const mossPatch = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), mossMat);
      mossPatch.position.set(0.6, 1.0, 0.4);
      mossPatch.scale.set(1.1, 0.5, 1.0);
      this.torso.add(mossPatch);

      // Bông hoa nhỏ mọc trên đầu đá
      const flowerMat = new THREE.MeshStandardMaterial({ color: 0xff6b8b, flatShading: true });
      const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), flowerMat);
      flower.position.set(0.5, 2.2, 0);
      this.torso.add(flower);

      // Đầu người đá
      this.head = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), stoneMat);
      this.head.position.set(0, 1.5, 0.5);
      this.head.castShadow = true;
      this.torso.add(this.head);

      // Đôi mắt phát sáng cam bí ẩn
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.15), eyeMat);
      eyeL.position.set(-0.4, 1.6, 1.45);
      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.15), eyeMat);
      eyeR.position.set(0.4, 1.6, 1.45);
      this.torso.add(eyeL);
      this.torso.add(eyeR);

      // Đạo Phù Vàng Phong Ấn (Yellow Daoist Talisman) dán trước trán Thạch Yêu
      const talismanGeo = new THREE.PlaneGeometry(0.35, 0.75);
      const talismanMat = new THREE.MeshBasicMaterial({ color: 0xffdd59, side: THREE.DoubleSide });
      const talisman = new THREE.Mesh(talismanGeo, talismanMat);
      talisman.position.set(0, 1.85, 1.62);
      talisman.rotation.x = -0.15;
      this.torso.add(talisman);

      const runeCinnabar = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.45), new THREE.MeshBasicMaterial({ color: 0xee5253, side: THREE.DoubleSide }));
      runeCinnabar.position.set(0, 1.85, 1.63);
      runeCinnabar.rotation.x = -0.15;
      this.torso.add(runeCinnabar);

      // Tay đá khổng lồ
      this.armL = new THREE.Group();
      this.armL.position.set(-2.2, 0.8, 0);
      const armLMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), stoneMat);
      armLMesh.scale.set(0.8, 1.6, 0.8);
      armLMesh.castShadow = true;
      this.armL.add(armLMesh);
      this.torso.add(this.armL);

      this.armR = new THREE.Group();
      this.armR.position.set(2.2, 0.8, 0);
      const armRMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), stoneMat);
      armRMesh.scale.set(0.8, 1.6, 0.8);
      armRMesh.castShadow = true;
      this.armR.add(armRMesh);
      this.torso.add(this.armR);

      this.model.add(this.torso);

      // Chân đá
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

    } else {
      // 2. KHỦNG LONG BÉO CHIBI KHỔNG LỒ (KING CHOMPER)
      const dinoMat = new THREE.MeshStandardMaterial({
        color: 0x9b59b6, // Tím pastel múp míp
        flatShading: true,
        roughness: 0.8,
      });
      const bellyMat = new THREE.MeshStandardMaterial({
        color: 0xf39c12, // Bụng vàng cam
        flatShading: true,
        roughness: 0.8,
      });
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xf1c40f, // Vương miện vàng óng
        metalness: 0.4,
        roughness: 0.3,
        flatShading: true,
      });

      this.damageableMaterials = [dinoMat, bellyMat];

      this.torso = new THREE.Group();
      this.torso.position.y = 2.8;

      // Thân mập tròn
      const dinoBody = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3, 1), dinoMat);
      dinoBody.scale.set(1.1, 1.25, 1.3);
      dinoBody.castShadow = true;
      this.torso.add(dinoBody);

      // Bụng vàng tròn
      const belly = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), bellyMat);
      belly.position.set(0, -0.3, 1.1);
      belly.scale.set(0.9, 1.1, 0.6);
      this.torso.add(belly);

      // Đầu to tròn
      this.head = new THREE.Group();
      this.head.position.set(0, 1.8, 0.8);
      const headMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), dinoMat);
      headMesh.castShadow = true;
      this.head.add(headMesh);

      // Vương miện nhỏ xinh trên đầu
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.45, 5), crownMat);
      crown.position.set(0, 1.6, 0);
      this.head.add(crown);

      // Mắt tròn xoe
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const eyeSparkle = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), eyeMat);
        eye.position.set(side * 0.9, 0.3, 1.1);
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeSparkle);
        spark.position.set(side * 0.95, 0.4, 1.3);
        this.head.add(eye);
        this.head.add(spark);
      }

      this.torso.add(this.head);

      // Đuôi mập
      this.tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.5, 6), dinoMat);
      this.tail.rotation.x = -Math.PI / 2.5;
      this.tail.position.set(0, -0.6, -2.2);
      this.torso.add(this.tail);

      this.model.add(this.torso);

      // Chân bự
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

    this.group.add(this.model);
  }

  buildHealthBar() {
    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.y = this.hitHeight + 0.8;

    // Nền thanh máu màu xám đen
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.75 });
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.38), bgMat);
    this.healthBarGroup.add(bgMesh);

    // Vạch máu màu xanh lá / đỏ
    this.barMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
    this.barMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.26), this.barMat);
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
      if (bulletPos.y >= this.position.y && bulletPos.y <= this.position.y + this.hitHeight) {
        return true;
      }
    }
    return false;
  }

  takeDamage(amount, hitPos) {
    if (this.isDead) return;

    this.hp -= amount;
    this.hitFlashTimer = 0.18;
    this.torso.position.z -= 0.35;

    // Cập nhật thanh máu
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    this.barMesh.scale.x = hpRatio;
    this.barMesh.position.x = -(1.0 - hpRatio) * 1.5;

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
    this.isFrozen = true;
    this.freezeTimer = duration;
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
    const dir = new THREE.Vector3().subVectors(this.position, fromPos);
    dir.y = 0;
    dir.normalize();
    this.velocity.x += dir.x * force;
    this.velocity.z += dir.z * force;
    this.velocity.y += force * 0.4;
    this.torso.position.z -= 0.6;
  }

  die() {
    this.isDead = true;
    this.respawnTimer = 9.0;
    sound.playMonsterDefeated();
    this.particles.emitMonsterDefeat(this.position.clone().add(new THREE.Vector3(0, 3, 0)));

    // Hiệu ứng vỡ vụn tảng đá bay theo vật lý khi Thạch Yêu bị hạ gục
    if (this.world && this.type === 'golem') {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, flatShading: true, roughness: 0.9 });
      for (let i = 0; i < 6; i++) {
        const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.5, 0), rockMat);
        chunk.position.copy(this.position);
        chunk.position.y += 1.5 + Math.random() * 2.0;
        chunk.castShadow = true;
        const dir = new THREE.Vector3((Math.random() - 0.5) * 2, 0.8, (Math.random() - 0.5) * 2).normalize();
        this.world.addDebris(chunk, dir, 7 + Math.random() * 5, 20, 4.2, 0.52);
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
    this.velocity.set(0, 0, 0);
    this.hp = this.maxHp;
    this.barMesh.scale.x = 1.0;
    this.barMesh.position.x = 0;
    this.barMat.color.setHex(0x2ecc71);

    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 30;
    this.position.x = Math.cos(angle) * dist;
    this.position.z = Math.sin(angle) * dist;
    this.position.y = getTerrainHeight(this.position.x, this.position.z);
    this.group.position.copy(this.position);

    this.model.scale.set(1, 1, 1);
    this.model.rotation.set(0, 0, 0);
    this.healthBarGroup.visible = true;

    sound.playMonsterRoar();
    this.particles.emitHitSparkles(this.position.clone().add(new THREE.Vector3(0, 2, 0)), 15);
  }

  update(delta, playerPos, camera) {
    // 1. Thanh máu luôn xoay về Camera (Billboard)
    if (camera && this.healthBarGroup) {
      this.healthBarGroup.quaternion.copy(camera.quaternion);
    }

    // 2. Xử lý trạng thái CHẾT & Hồi sinh
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

    // 3. Xử lý trạng thái BỊ ĐÓNG BĂNG
    if (this.isFrozen) {
      this.freezeTimer -= delta;
      if (this.freezeTimer <= 0) {
        this.isFrozen = false;
      }
      for (const mat of this.damageableMaterials) {
        mat.emissive.setHex(0x00d2d3); // Tỏa sáng xanh băng
      }
      // Rung rẩy vì cóng lạnh
      this.model.position.x = (Math.random() - 0.5) * 0.12;
      this.model.position.z = (Math.random() - 0.5) * 0.12;
      return; // Không di chuyển khi bị đóng băng!
    } else {
      this.model.position.x = 0;
      this.model.position.z = 0;
    }

    // 4. Hiệu ứng nhấp nháy khi bị bắn trúng
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      for (const mat of this.damageableMaterials) {
        mat.emissive.setHex(0xff3333);
      }
    } else {
      for (const mat of this.damageableMaterials) {
        mat.emissive.setHex(0x000000);
      }
    }

    // 5. Áp dụng phản lực Đẩy lùi (Knockback Velocity)
    if (this.velocity.lengthSq() > 0.01) {
      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;
      this.position.y += this.velocity.y * delta;

      this.velocity.x *= 0.88;
      this.velocity.z *= 0.88;
      this.velocity.y -= 24 * delta; // Trọng lực rơi lại đất
    }

    this.torso.position.z = THREE.MathUtils.lerp(this.torso.position.z, 0, delta * 6);

    // 6. AI DI CHUYỂN TỰ ĐỘNG & RƯỢT ĐUỔI BÉ GẤU
    const distToPlayer = playerPos ? this.position.distanceTo(playerPos) : 999;
    let targetAngle = this.rotationY;

    if (distToPlayer < 45 && distToPlayer > 3.8) {
      const dirX = playerPos.x - this.position.x;
      const dirZ = playerPos.z - this.position.z;
      targetAngle = Math.atan2(dirX, dirZ);

      this.position.x += Math.sin(this.rotationY) * this.speed * delta;
      this.position.z += Math.cos(this.rotationY) * this.speed * delta;
    } else {
      this.walkAnimTime += delta * 0.4;
      targetAngle += Math.sin(this.walkAnimTime) * 0.02;
      this.position.x += Math.sin(this.rotationY) * (this.speed * 0.5) * delta;
      this.position.z += Math.cos(this.rotationY) * (this.speed * 0.5) * delta;
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, -120, 120);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -120, 120);

    let rotDiff = targetAngle - this.rotationY;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    this.rotationY += rotDiff * Math.min(1.0, delta * 3.5);
    this.model.rotation.y = this.rotationY;

    // Cập nhật độ cao địa hình
    const groundY = getTerrainHeight(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
    }

    this.group.position.copy(this.position);

    // Cập nhật bóng đổ tiếp xúc mặt đất (Contact Shadow)
    if (this.contactShadow) {
      this.contactShadow.position.set(this.position.x, groundY + 0.025, this.position.z);
      const heightAbove = Math.max(0, this.position.y - groundY);
      this.shadowMat.opacity = this.isDead ? 0 : Math.max(0.04, 0.42 - heightAbove * 0.08);
      const s = Math.max(0.35, 1.0 - heightAbove * 0.1);
      this.contactShadow.scale.set(s, s, s);
    }
    const stepFreq = this.type === 'golem' ? 3.5 : 4.5;
    this.walkAnimTime += delta * stepFreq;
    const stepSwing = Math.sin(this.walkAnimTime) * 0.45;

    this.legL.rotation.x = stepSwing;
    this.legR.rotation.x = -stepSwing;

    if (this.type === 'golem') {
      this.armL.rotation.x = -stepSwing * 0.6;
      this.armR.rotation.x = stepSwing * 0.6;
      this.torso.rotation.z = Math.sin(this.walkAnimTime) * 0.05;
      this.torso.position.y = 3.2 + Math.abs(Math.sin(this.walkAnimTime)) * 0.2;
    } else {
      this.tail.rotation.y = Math.sin(this.walkAnimTime) * 0.25;
      this.head.rotation.z = Math.sin(this.walkAnimTime) * 0.06;
      this.torso.position.y = 2.8 + Math.abs(Math.sin(this.walkAnimTime)) * 0.25;
    }
  }
}
