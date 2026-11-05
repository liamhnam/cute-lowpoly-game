import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.dustParticles = [];
    this.ambientPetals = [];
    this.sparkles = [];
    this.shockwaves = [];
    this.smokeParticles = [];

    this.createDustPool();
    this.createAmbientPetals();
    this.createSparklePool();
    this.createShockwavePool();
    this.createSmokePool();
  }

  createDustPool() {
    const dustGeo = new THREE.DodecahedronGeometry(0.14, 0);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xe0d6b6,
      transparent: true,
      opacity: 0.8,
    });

    this.dustGroup = new THREE.Group();
    for (let i = 0; i < 45; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat.clone());
      mesh.visible = false;
      this.dustGroup.add(mesh);
      this.dustParticles.push({
        mesh,
        life: 0,
        maxLife: 0.5,
        velocity: new THREE.Vector3(),
      });
    }
    this.scene.add(this.dustGroup);
  }

  createSparklePool() {
    const sparkGeo = new THREE.DodecahedronGeometry(0.2, 0);
    this.sparkleGroup = new THREE.Group();

    for (let i = 0; i < 180; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(sparkGeo, mat);
      mesh.visible = false;
      this.sparkleGroup.add(mesh);
      this.sparkles.push({
        mesh,
        mat,
        life: 0,
        maxLife: 0.7,
        gravity: 9.8,
        velocity: new THREE.Vector3(),
        initialScale: 1.0,
      });
    }
    this.scene.add(this.sparkleGroup);
  }

  createShockwavePool() {
    this.shockwaveGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.5, 1.2, 24);
    ringGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.shockwaveGroup.add(mesh);
      this.shockwaves.push({
        mesh,
        mat,
        life: 0,
        duration: 0.6,
        startScale: 0.5,
        targetScale: 12.0,
      });
    }
    this.scene.add(this.shockwaveGroup);
  }

  createSmokePool() {
    this.smokeGroup = new THREE.Group();
    const smokeGeo = new THREE.DodecahedronGeometry(0.35, 1);

    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(smokeGeo, mat);
      mesh.visible = false;
      this.smokeGroup.add(mesh);
      this.smokeParticles.push({
        mesh,
        mat,
        life: 0,
        maxLife: 1.0,
        velocity: new THREE.Vector3(),
        growRate: 1.8,
      });
    }
    this.scene.add(this.smokeGroup);
  }

  createAmbientPetals() {
    const petalGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const colors = [0xffb7b2, 0xffdac1, 0xe2f0cb, 0xf1c40f, 0xffbe76];
    this.petalGroup = new THREE.Group();

    for (let i = 0; i < 75; i++) {
      const col = colors[i % colors.length];
      const isGoldMote = col === 0xf1c40f;
      const geo = isGoldMote ? new THREE.DodecahedronGeometry(0.08, 0) : petalGeo;
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isGoldMote ? 0.9 : 0.75,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 60,
        1 + Math.random() * 8,
        (Math.random() - 0.5) * 60
      );
      this.petalGroup.add(mesh);
      this.ambientPetals.push({
        mesh,
        speedX: 0.8 + Math.random() * 0.5,
        speedY: -0.2 - Math.random() * 0.3,
        rotSpeed: (Math.random() - 0.5) * 3,
      });
    }
    this.scene.add(this.petalGroup);
  }

  emitDust(pos) {
    for (const p of this.dustParticles) {
      if (!p.mesh.visible) {
        p.mesh.visible = true;
        p.life = p.maxLife;
        p.mesh.position.copy(pos);
        p.mesh.position.y += 0.08;
        p.mesh.scale.setScalar(0.7 + Math.random() * 0.5);
        p.velocity.set(
          (Math.random() - 0.5) * 1.2,
          0.8 + Math.random() * 0.8,
          (Math.random() - 0.5) * 1.2
        );
        break;
      }
    }
  }

  // Phát sóng xung kích lan tỏa trên mặt đất
  emitShockwave(pos, color = 0xffffff, targetScale = 12, duration = 0.55) {
    for (const sw of this.shockwaves) {
      if (!sw.mesh.visible) {
        sw.mesh.visible = true;
        sw.life = 0;
        sw.duration = duration;
        sw.targetScale = targetScale;
        sw.mat.color.setHex(color);
        sw.mesh.position.copy(pos);
        sw.mesh.position.y += 0.12;
        sw.mesh.scale.setScalar(0.4);
        sw.mat.opacity = 0.9;
        break;
      }
    }
  }

  // Khói bốc lên mờ ảo
  emitSmoke(pos, count = 4, color = 0x666666, maxLife = 1.0) {
    let spawned = 0;
    for (const sm of this.smokeParticles) {
      if (!sm.mesh.visible) {
        sm.mesh.visible = true;
        sm.life = maxLife;
        sm.maxLife = maxLife;
        sm.mat.color.setHex(color);
        sm.mesh.position.copy(pos);
        sm.mesh.position.x += (Math.random() - 0.5) * 0.8;
        sm.mesh.position.z += (Math.random() - 0.5) * 0.8;
        sm.mesh.scale.setScalar(0.5 + Math.random() * 0.4);
        sm.velocity.set(
          (Math.random() - 0.5) * 1.2,
          1.2 + Math.random() * 1.6,
          (Math.random() - 0.5) * 1.2
        );
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  // Bọt rượu và tia nước đỏ văng tung tóe khi bể vò rượu
  emitWineSplash(pos, count = 18) {
    let spawned = 0;
    const wineColors = [0x962d22, 0xc0392b, 0xd63031, 0xe17055];
    for (const sp of this.sparkles) {
      if (!sp.mesh.visible) {
        sp.mesh.visible = true;
        sp.life = 0.5 + Math.random() * 0.4;
        sp.maxLife = sp.life;
        sp.gravity = 24.0;
        sp.initialScale = 0.8 + Math.random() * 0.5;

        const col = wineColors[Math.floor(Math.random() * wineColors.length)];
        sp.mat.color.setHex(col);

        sp.mesh.position.copy(pos);
        sp.mesh.position.y += 0.2;

        const angle = Math.random() * Math.PI * 2;
        const speed = 3.5 + Math.random() * 5.5;
        sp.velocity.set(
          Math.cos(angle) * speed,
          4.0 + Math.random() * 4.5,
          Math.sin(angle) * speed
        );

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  // Hệ thống hạt nguyên tố đa màu sắc (Lửa, Sấm Sét, Băng Tuyết, Đất Đá)
  emitElementalParticles(pos, count = 15, colors = [0xffffff], speedRange = [3, 8], lifeTime = 0.65, gravity = 10, scale = 1.0) {
    let spawned = 0;
    for (const s of this.sparkles) {
      if (!s.mesh.visible) {
        s.mesh.visible = true;
        s.life = lifeTime * (0.8 + Math.random() * 0.4);
        s.maxLife = s.life;
        s.gravity = gravity;
        s.initialScale = scale * (0.7 + Math.random() * 0.6);
        s.mesh.scale.setScalar(s.initialScale);

        const chosenColor = colors[Math.floor(Math.random() * colors.length)];
        s.mat.color.setHex(chosenColor);

        s.mesh.position.copy(pos);
        s.mesh.position.x += (Math.random() - 0.5) * 0.3;
        s.mesh.position.z += (Math.random() - 0.5) * 0.3;

        const spd = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
        const angleY = Math.random() * Math.PI * 2;
        const angleElevation = 0.2 + Math.random() * 1.2;

        s.velocity.set(
          Math.cos(angleY) * Math.cos(angleElevation) * spd,
          Math.sin(angleElevation) * spd,
          Math.sin(angleY) * Math.cos(angleElevation) * spd
        );

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  emitHitSparkles(pos, count = 8) {
    const rainbowColors = [0xffd32a, 0xff3f34, 0x0be881, 0x0fbcf9, 0xff5e57, 0xffa801];
    this.emitElementalParticles(pos, count, rainbowColors, [4, 9], 0.55, 9.8, 1.0);
  }

  emitMonsterDefeat(pos) {
    const victoryColors = [0xffd32a, 0xff3838, 0xff9f43, 0x54a0ff, 0x1dd1a1];
    this.emitElementalParticles(pos, 35, victoryColors, [6, 14], 0.9, 8.0, 1.4);
    this.emitShockwave(pos, 0xffd32a, 10, 0.6);
    this.emitSmoke(pos, 8, 0x888888, 1.2);
  }

  update(delta, playerPos) {
    // 1. Cập nhật bụi đất
    for (const p of this.dustParticles) {
      if (p.mesh.visible) {
        p.life -= delta;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          const progress = p.life / p.maxLife;
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.velocity.y -= 2.0 * delta;
          p.mesh.scale.multiplyScalar(0.96);
          p.mesh.material.opacity = progress * 0.8;
        }
      }
    }

    // 2. Cập nhật hạt tia lửa / nguyên tố
    for (const s of this.sparkles) {
      if (s.mesh.visible) {
        s.life -= delta;
        if (s.life <= 0) {
          s.mesh.visible = false;
        } else {
          const progress = s.life / s.maxLife;
          s.mesh.position.addScaledVector(s.velocity, delta);
          s.velocity.y -= s.gravity * delta;
          s.mesh.rotation.x += 12 * delta;
          s.mesh.rotation.y += 12 * delta;
          s.mesh.scale.setScalar(s.initialScale * progress);
          s.mat.opacity = Math.min(1.0, progress * 1.5);
        }
      }
    }

    // 3. Cập nhật sóng xung kích Shockwaves
    for (const sw of this.shockwaves) {
      if (sw.mesh.visible) {
        sw.life += delta;
        const progress = sw.life / sw.duration;
        if (progress >= 1.0) {
          sw.mesh.visible = false;
        } else {
          // Easing out quad
          const ease = 1 - Math.pow(1 - progress, 3);
          const currentScale = sw.startScale + ease * (sw.targetScale - sw.startScale);
          sw.mesh.scale.set(currentScale, currentScale, currentScale);
          sw.mat.opacity = (1.0 - progress) * 0.9;
        }
      }
    }

    // 4. Cập nhật khói bốc lên
    for (const sm of this.smokeParticles) {
      if (sm.mesh.visible) {
        sm.life -= delta;
        if (sm.life <= 0) {
          sm.mesh.visible = false;
        } else {
          const progress = sm.life / sm.maxLife;
          sm.mesh.position.addScaledVector(sm.velocity, delta);
          sm.velocity.x *= 0.96;
          sm.velocity.z *= 0.96;
          sm.mesh.scale.multiplyScalar(1.0 + sm.growRate * delta);
          sm.mat.opacity = progress * 0.6;
        }
      }
    }

    // 5. Cập nhật cánh hoa bay quanh người chơi
    for (const petal of this.ambientPetals) {
      const m = petal.mesh;
      m.position.x += petal.speedX * delta;
      m.position.y += petal.speedY * delta;
      m.rotation.z += petal.rotSpeed * delta;
      m.rotation.x += petal.rotSpeed * 0.5 * delta;

      if (playerPos) {
        if (m.position.x > playerPos.x + 35) m.position.x = playerPos.x - 35;
        if (m.position.x < playerPos.x - 35) m.position.x = playerPos.x + 35;
        if (m.position.z > playerPos.z + 35) m.position.z = playerPos.z - 35;
        if (m.position.z < playerPos.z - 35) m.position.z = playerPos.z + 35;
        if (m.position.y < 0.5) m.position.y = 8 + Math.random() * 4;
      }
    }
  }
}
