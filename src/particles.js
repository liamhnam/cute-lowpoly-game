import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.dustParticles = [];
    this.ambientPetals = [];
    this.sparkles = [];

    this.createDustPool();
    this.createAmbientPetals();
    this.createSparklePool();
  }

  createDustPool() {
    const dustGeo = new THREE.DodecahedronGeometry(0.12, 0);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xe0d6b6,
      transparent: true,
      opacity: 0.8,
    });

    this.dustGroup = new THREE.Group();
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat.clone());
      mesh.visible = false;
      this.dustGroup.add(mesh);
      this.dustParticles.push({
        mesh,
        life: 0,
        maxLife: 0.45,
        velocity: new THREE.Vector3(),
      });
    }
    this.scene.add(this.dustGroup);
  }

  createSparklePool() {
    const sparkGeo = new THREE.DodecahedronGeometry(0.18, 0);
    const colors = [0xffd32a, 0xff3f34, 0x0be881, 0x0fbcf9, 0xff5e57, 0xffa801];
    this.sparkleGroup = new THREE.Group();

    for (let i = 0; i < 60; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(sparkGeo, mat);
      mesh.visible = false;
      this.sparkleGroup.add(mesh);
      this.sparkles.push({
        mesh,
        life: 0,
        maxLife: 0.6,
        velocity: new THREE.Vector3(),
      });
    }
    this.scene.add(this.sparkleGroup);
  }

  createAmbientPetals() {
    const petalGeo = new THREE.PlaneGeometry(0.15, 0.15);
    const colors = [0xffb7b2, 0xffdac1, 0xe2f0cb, 0xb5ead7];
    this.petalGroup = new THREE.Group();

    for (let i = 0; i < 60; i++) {
      const col = colors[i % colors.length];
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });
      const mesh = new THREE.Mesh(petalGeo, mat);
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
        p.mesh.position.y += 0.05;
        p.mesh.scale.setScalar(0.7 + Math.random() * 0.5);
        p.velocity.set(
          (Math.random() - 0.5) * 0.8,
          0.6 + Math.random() * 0.6,
          (Math.random() - 0.5) * 0.8
        );
        break;
      }
    }
  }

  emitHitSparkles(pos, count = 8) {
    let spawned = 0;
    for (const s of this.sparkles) {
      if (!s.mesh.visible) {
        s.mesh.visible = true;
        s.life = s.maxLife;
        s.mesh.position.copy(pos);
        s.mesh.scale.setScalar(0.8 + Math.random() * 0.8);
        const speed = 4 + Math.random() * 5;
        s.velocity.set(
          (Math.random() - 0.5) * speed,
          1 + Math.random() * speed,
          (Math.random() - 0.5) * speed
        );
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  emitMonsterDefeat(pos) {
    this.emitHitSparkles(pos, 25);
  }

  update(delta, playerPos) {
    // Cập nhật bụi đất
    for (const p of this.dustParticles) {
      if (p.mesh.visible) {
        p.life -= delta;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          const progress = p.life / p.maxLife;
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.velocity.y -= 1.8 * delta;
          p.mesh.scale.multiplyScalar(0.97);
          p.mesh.material.opacity = progress * 0.8;
        }
      }
    }

    // Cập nhật hạt sao nổ
    for (const s of this.sparkles) {
      if (s.mesh.visible) {
        s.life -= delta;
        if (s.life <= 0) {
          s.mesh.visible = false;
        } else {
          const progress = s.life / s.maxLife;
          s.mesh.position.addScaledVector(s.velocity, delta);
          s.velocity.y -= 9.8 * delta; // Trọng lực rơi
          s.mesh.rotation.x += 10 * delta;
          s.mesh.rotation.y += 10 * delta;
          s.mesh.material.opacity = progress;
        }
      }
    }

    // Cập nhật cánh hoa bay quanh người chơi
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
