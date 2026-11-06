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
    const dustGeo = new THREE.DodecahedronGeometry(0.16, 0);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xe0d6b6,
      transparent: true,
      opacity: 0.8,
    });

    this.dustGroup = new THREE.Group();
    for (let i = 0; i < 50; i++) {
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
    const sparkGeo = new THREE.DodecahedronGeometry(0.25, 0);
    this.sparkleGroup = new THREE.Group();

    for (let i = 0; i < 280; i++) {
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
        rotSpeed: 10,
      });
    }
    this.scene.add(this.sparkleGroup);
  }

  createShockwavePool() {
    this.shockwaveGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.5, 1.2, 32);
    ringGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffa502,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.shockwaveGroup.add(mesh);
      this.shockwaves.push({
        mesh,
        mat,
        life: 0,
        maxLife: 0.6,
        maxRadius: 18,
        currentRadius: 0.5,
      });
    }
    this.scene.add(this.shockwaveGroup);
  }

  createSmokePool() {
    const smokeGeo = new THREE.DodecahedronGeometry(0.55, 1);
    this.smokeGroup = new THREE.Group();

    for (let i = 0; i < 90; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(smokeGeo, mat);
      mesh.visible = false;
      this.smokeGroup.add(mesh);
      this.smokeParticles.push({
        mesh,
        mat,
        life: 0,
        maxLife: 1.2,
        startColor: new THREE.Color(0xff4757),
        endColor: new THREE.Color(0x1a1a1a),
        isFiery: false,
        velocity: new THREE.Vector3(),
        growRate: 2.2,
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

  emitElementalParticles(pos, count = 15, colors = [0xffffff], speedRange = [4, 9], maxLife = 0.65, gravity = 9.8, scaleMul = 1.0) {
    let spawned = 0;
    for (const s of this.sparkles) {
      if (!s.mesh.visible) {
        s.mesh.visible = true;
        s.life = maxLife;
        s.maxLife = maxLife;
        s.gravity = gravity;

        const col = colors[Math.floor(Math.random() * colors.length)];
        s.mat.color.setHex(col);

        s.mesh.position.copy(pos);
        s.mesh.position.x += (Math.random() - 0.5) * 0.4;
        s.mesh.position.y += (Math.random() - 0.5) * 0.4;
        s.mesh.position.z += (Math.random() - 0.5) * 0.4;

        s.mesh.scale.setScalar((0.8 + Math.random() * 0.6) * scaleMul);

        const spd = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.25) * Math.PI;

        s.velocity.set(
          Math.cos(theta) * Math.cos(phi) * spd,
          Math.sin(phi) * spd + 1.5,
          Math.sin(theta) * Math.cos(phi) * spd
        );

        s.rotSpeed = (Math.random() - 0.5) * 20;

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  emitShockwave(pos, color = 0xffa502, maxRadius = 14, maxLife = 0.55) {
    for (const sw of this.shockwaves) {
      if (!sw.mesh.visible) {
        sw.mesh.visible = true;
        sw.life = maxLife;
        sw.maxLife = maxLife;
        sw.maxRadius = maxRadius;
        sw.currentRadius = 0.5;
        sw.mat.color.setHex(color);
        sw.mesh.position.copy(pos);
        sw.mesh.position.y += 0.12;
        sw.mesh.scale.set(0.5, 0.5, 0.5);
        break;
      }
    }
  }

  emitSmoke(pos, count = 6, color = 0x555555, maxLife = 1.2, isFiery = false) {
    let spawned = 0;
    for (const sm of this.smokeParticles) {
      if (!sm.mesh.visible) {
        sm.mesh.visible = true;
        sm.life = maxLife;
        sm.maxLife = maxLife;
        sm.isFiery = isFiery;
        if (isFiery) {
          sm.startColor.setHex(0xff5722);
          sm.endColor.setHex(0x1a1a1a);
          sm.mat.color.copy(sm.startColor);
        } else {
          sm.mat.color.setHex(color);
        }
        sm.mesh.position.copy(pos);
        sm.mesh.position.x += (Math.random() - 0.5) * 1.2;
        sm.mesh.position.z += (Math.random() - 0.5) * 1.2;
        sm.mesh.scale.setScalar(0.7 + Math.random() * 0.5);
        sm.velocity.set(
          (Math.random() - 0.5) * 2.2,
          2.0 + Math.random() * 2.5,
          (Math.random() - 0.5) * 2.2
        );
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  // CỘT KHÓI NẤM KHỔNG LỒ (MUSHROOM CLOUD) CHO THIÊN THẠCH CHIÊU 1
  emitMushroomExplosion(pos, height = 18, radius = 16) {
    // 1. Thân cột khói lửa bốc vút thẳng lên cao
    const stemCount = 18;
    for (let i = 0; i < stemCount; i++) {
      const hProg = i / stemCount;
      const smokePos = pos.clone();
      smokePos.y += hProg * height * 0.65;
      smokePos.x += (Math.random() - 0.5) * 2.5;
      smokePos.z += (Math.random() - 0.5) * 2.5;
      this.emitSmoke(smokePos, 2, 0xff4757, 1.8 + Math.random() * 0.8, true);
    }

    // 2. Mũ nấm bung nở xòe rộng trên đỉnh
    const capCount = 24;
    for (let i = 0; i < capCount; i++) {
      const ang = (i / capCount) * Math.PI * 2;
      const r = 2.0 + Math.random() * (radius * 0.6);
      const capPos = pos.clone();
      capPos.y += height * 0.75 + (Math.random() - 0.5) * 3.5;
      capPos.x += Math.cos(ang) * r;
      capPos.z += Math.sin(ang) * r;
      this.emitSmoke(capPos, 2, 0x222222, 2.2 + Math.random() * 1.0, Math.random() > 0.4);
    }

    // 3. Tia lửa than hồng bung tỏa xung quanh
    this.emitElementalParticles(
      pos,
      50,
      [0xffffff, 0xffd32a, 0xff4757, 0xff6b81, 0xffa502],
      [12, 28],
      1.5,
      14,
      1.6
    );
  }

  emitWineSplash(pos, count = 18) {
    let spawned = 0;
    const wineColors = [0x8b0000, 0x9b111e, 0x67000d, 0xff6b81];
    for (const s of this.sparkles) {
      if (!s.mesh.visible) {
        s.mesh.visible = true;
        s.life = 0.55;
        s.maxLife = 0.55;
        s.gravity = 14;
        s.mat.color.setHex(wineColors[Math.floor(Math.random() * wineColors.length)]);
        s.mesh.position.copy(pos);
        s.mesh.scale.setScalar(0.45 + Math.random() * 0.4);

        const spd = 5 + Math.random() * 8;
        const ang = Math.random() * Math.PI * 2;
        s.velocity.set(
          Math.cos(ang) * spd,
          4 + Math.random() * 6,
          Math.sin(ang) * spd
        );
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  emitHitSparkles(pos, count = 10) {
    this.emitElementalParticles(pos, count, [0xffd32a, 0xff4757, 0x0be881, 0x0fbcf9, 0xffffff], [5, 12], 0.6, 9.8, 1.0);
  }

  emitMonsterDefeat(pos) {
    this.emitElementalParticles(pos, 45, [0xffd700, 0xff4757, 0x54a0ff, 0x1dd1a1, 0xffffff], [8, 18], 1.2, 8.0, 1.4);
    this.emitShockwave(pos, 0xffd700, 16, 0.7);
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
          s.mesh.rotation.x += s.rotSpeed * delta;
          s.mesh.rotation.y += s.rotSpeed * delta;
          s.mesh.material.opacity = Math.min(1.0, progress * 1.5);
        }
      }
    }

    // 3. Cập nhật sóng xung kích
    for (const sw of this.shockwaves) {
      if (sw.mesh.visible) {
        sw.life -= delta;
        if (sw.life <= 0) {
          sw.mesh.visible = false;
        } else {
          const prog = 1.0 - sw.life / sw.maxLife;
          const currentR = THREE.MathUtils.lerp(0.5, sw.maxRadius, Math.pow(prog, 0.45));
          sw.mesh.scale.set(currentR, currentR, currentR);
          sw.mat.opacity = (1.0 - prog) * 0.85;
        }
      }
    }

    // 4. Cập nhật khói lửa cuộn trào
    for (const sm of this.smokeParticles) {
      if (sm.mesh.visible) {
        sm.life -= delta;
        if (sm.life <= 0) {
          sm.mesh.visible = false;
        } else {
          const prog = 1.0 - sm.life / sm.maxLife;
          sm.mesh.position.addScaledVector(sm.velocity, delta);
          sm.velocity.y += 0.8 * delta; // Khói nóng bốc lên
          sm.velocity.x *= 0.96;
          sm.velocity.z *= 0.96;

          // Phình to dần
          sm.mesh.scale.multiplyScalar(1.0 + sm.growRate * delta);

          if (sm.isFiery) {
            sm.mat.color.copy(sm.startColor).lerp(sm.endColor, prog);
          }

          sm.mat.opacity = (1.0 - prog) * 0.75;
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
