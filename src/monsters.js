import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';

export class Monster {
  constructor(scene, particles, type = 'golem', spawnPos = new THREE.Vector3()) {
    this.scene = scene;
    this.particles = particles;
    this.type = type;

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

    // Kích thước va chạm
    this.hitRadius = this.type === 'golem' ? 2.8 : 2.5;
    this.hitHeight = this.type === 'golem' ? 6.5 : 5.5;

    this.buildMesh();
    this.buildHealthBar();

    this.scene.add(this.group);
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
    // Kiểm tra khoảng cách hình trụ
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
    this.hitFlashTimer = 0.15; // Chớp trắng
    this.torso.position.z -= 0.2; // Giật lùi nhẹ khi bị bắn

    // Cập nhật thanh máu
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    this.barMesh.scale.x = hpRatio;
    this.barMesh.position.x = -(1.0 - hpRatio) * 1.5; // Căn lề trái thanh máu

    if (hpRatio < 0.3) {
      this.barMat.color.setHex(0xe74c3c); // Đỏ khi sắp hết máu
    } else if (hpRatio < 0.6) {
      this.barMat.color.setHex(0xf39c12); // Vàng
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    this.isDead = true;
    this.respawnTimer = 9.0; // Hồi sinh sau 9s
    sound.playMonsterDefeated();
    this.particles.emitMonsterDefeat(this.position.clone().add(new THREE.Vector3(0, 3, 0)));

    if (this.onDefeated) {
      this.onDefeated(this);
    }
  }

  respawn() {
    this.isDead = false;
    this.hp = this.maxHp;
    this.barMesh.scale.x = 1.0;
    this.barMesh.position.x = 0;
    this.barMat.color.setHex(0x2ecc71);

    // Xuất hiện ở vị trí ngẫu nhiên trên đồng cỏ
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
      // Hiệu ứng ngã quỵ và thu nhỏ dần
      this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, -Math.PI / 2.2, delta * 5);
      this.model.scale.multiplyScalar(0.96);
      this.healthBarGroup.visible = false;

      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    // 3. Hiệu ứng nhấp nháy khi bị bắn trúng
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      for (const mat of this.damageableMaterials) {
        mat.emissive.setHex(0xff3333); // Phát sáng đỏ
      }
    } else {
      for (const mat of this.damageableMaterials) {
        mat.emissive.setHex(0x000000);
      }
    }

    this.torso.position.z = THREE.MathUtils.lerp(this.torso.position.z, 0, delta * 6);

    // 4. AI DI CHUYỂN TỰ ĐỘNG & RƯỢT ĐUỔI BÉ GẤU
    const distToPlayer = playerPos ? this.position.distanceTo(playerPos) : 999;
    let targetAngle = this.rotationY;

    if (distToPlayer < 45 && distToPlayer > 3.8) {
      // Khi bé gấu ở gần: Quái vật từ từ quay lại bước về phía gấu
      const dirX = playerPos.x - this.position.x;
      const dirZ = playerPos.z - this.position.z;
      targetAngle = Math.atan2(dirX, dirZ);

      // Bước tới
      this.position.x += Math.sin(this.rotationY) * this.speed * delta;
      this.position.z += Math.cos(this.rotationY) * this.speed * delta;
    } else {
      // Đi dạo tuần tra ngẫu nhiên
      this.walkAnimTime += delta * 0.4;
      targetAngle += Math.sin(this.walkAnimTime) * 0.02;
      this.position.x += Math.sin(this.rotationY) * (this.speed * 0.5) * delta;
      this.position.z += Math.cos(this.rotationY) * (this.speed * 0.5) * delta;
    }

    // Giới hạn trong khuôn viên đồng bằng
    this.position.x = THREE.MathUtils.clamp(this.position.x, -75, 75);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -75, 75);

    // Xoay mượt mà
    let rotDiff = targetAngle - this.rotationY;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    this.rotationY += rotDiff * Math.min(1.0, delta * 3.5);
    this.model.rotation.y = this.rotationY;

    // Cập nhật độ cao địa hình
    this.position.y = getTerrainHeight(this.position.x, this.position.z);
    this.group.position.copy(this.position);

    // 5. ANIMATION BƯỚC ĐI KHỔNG LỒ DẬM ĐẤT
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
