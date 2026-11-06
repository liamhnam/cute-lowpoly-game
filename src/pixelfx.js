import * as THREE from 'three';
import { sound } from './audio.js';
import { getTerrainHeight } from './world.js';

// --- PIXEL ART PROCEDURAL TEXTURE GENERATOR (Theo cảm hứng từ patch-gg/pixelfx) ---
// Vẽ các frame hiệu ứng pixel art trực tiếp lên canvas 2D nhỏ (nearest-neighbor)
// và bọc vào CanvasTexture để kết hợp 2D Pixel Art VFX vào thế giới 3D Low-Poly!

class PixelCanvasEffect {
  constructor(size = 64) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.size, this.size);
  }

  // Vẽ vụ nổ pixel fireball (Meteor explosion)
  drawFireExplosion(progress) {
    this.clear();
    const ctx = this.ctx;
    const center = this.size / 2;
    const maxR = (this.size / 2) - 4;
    const currentR = Math.sin(progress * Math.PI) * maxR;

    if (progress < 0.88) {
      // 1. Viền ngoài khói đen xám dithered
      ctx.fillStyle = progress > 0.5 ? '#2f3542' : '#ff4757';
      ctx.beginPath();
      ctx.arc(center, center, currentR, 0, Math.PI * 2);
      ctx.fill();

      // 2. Lõi cam rực lửa
      ctx.fillStyle = '#ffa502';
      ctx.beginPath();
      ctx.arc(center, center, currentR * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // 3. Tâm trắng sáng chói
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(center, center, currentR * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // 4. Các hạt tàn lửa bay bung ra dạng pixel vuông
      const sparkCount = 16;
      for (let i = 0; i < sparkCount; i++) {
        const angle = (i / sparkCount) * Math.PI * 2 + progress * 2.5;
        const dist = currentR * (0.8 + (i % 3) * 0.3);
        const px = Math.floor(center + Math.cos(angle) * dist);
        const py = Math.floor(center + Math.sin(angle) * dist);
        ctx.fillStyle = i % 2 === 0 ? '#ffda79' : '#ff5252';
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
    this.texture.needsUpdate = true;
  }

  // Vẽ luồng sấm sét phân nhánh pixel (Lightning Strike)
  drawLightning(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;

    if (progress < 0.85) {
      const ringR = progress * (w / 2 - 4);
      ctx.strokeStyle = '#70a1ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();

      const branches = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      for (let b = 0; b < branches; b++) {
        let curX = w / 2;
        let curY = h / 2;
        const baseAngle = (b / branches) * Math.PI * 2;
        const segs = 5;
        const segLen = ringR / segs;

        ctx.beginPath();
        ctx.moveTo(curX, curY);

        for (let s = 0; s < segs; s++) {
          const jitter = (Math.random() - 0.5) * 8;
          curX += Math.cos(baseAngle) * segLen + jitter;
          curY += Math.sin(baseAngle) * segLen + jitter;
          ctx.lineTo(Math.floor(curX), Math.floor(curY));
        }
        ctx.stroke();
      }

      ctx.fillStyle = '#00d2d3';
      ctx.fillRect(w / 2 - 4, h / 2 - 4, 8, 8);
    }
    this.texture.needsUpdate = true;
  }

  // Vẽ sóng băng tuyết mở rộng (Frost Nova)
  drawFrostNova(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const maxR = w / 2 - 2;
    const currentR = progress * maxR;

    if (progress < 0.92) {
      ctx.strokeStyle = '#7ed6df';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, currentR, 0, Math.PI * 2);
      ctx.stroke();

      const petals = 8;
      for (let i = 0; i < petals; i++) {
        const ang = (i / petals) * Math.PI * 2;
        const x1 = w / 2 + Math.cos(ang) * currentR;
        const y1 = h / 2 + Math.sin(ang) * currentR;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.floor(x1) - 2, Math.floor(y1) - 2, 5, 5);

        const x2 = w / 2 + Math.cos(ang + 0.25) * (currentR * 0.72);
        const y2 = h / 2 + Math.sin(ang + 0.25) * (currentR * 0.72);
        ctx.fillStyle = '#22a6b3';
        ctx.fillRect(Math.floor(x2) - 1, Math.floor(y2) - 1, 3, 3);
      }
    }
    this.texture.needsUpdate = true;
  }

  // Vẽ sóng chấn động địa chấn nứt đất (Earth Stomp)
  drawEarthquake(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const maxR = w / 2 - 4;

    if (progress < 0.88) {
      for (let ring = 0; ring < 3; ring++) {
        const r = Math.max(0, (progress - ring * 0.14) * maxR);
        if (r > 0) {
          ctx.strokeStyle = ring === 0 ? '#4b382a' : '#785336';
          ctx.lineWidth = 3 - ring;
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const cracks = 8;
      ctx.strokeStyle = '#2d2013';
      ctx.lineWidth = 2;
      for (let c = 0; c < cracks; c++) {
        const angle = (c / cracks) * Math.PI * 2 + 0.3;
        const len = progress * maxR * 0.95;
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(
          Math.floor(w / 2 + Math.cos(angle) * len),
          Math.floor(h / 2 + Math.sin(angle) * len)
        );
        ctx.stroke();
      }
    }
    this.texture.needsUpdate = true;
  }

  // Vẽ kiếm trận hoàng kim Pixel Art (Wan Jian Gui Zong Decal)
  drawSwordArray(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const maxR = w / 2 - 2;

    if (progress < 0.92) {
      // Vòng tròn kiếm trận bát quái
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, maxR * 0.9, 0, Math.PI * 2);
      ctx.stroke();

      // Vòng tròn nhỏ bên trong
      ctx.strokeStyle = '#ffa502';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, maxR * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      // 8 thanh kiếm pixel hướng vào tâm
      const blades = 8;
      ctx.fillStyle = '#ffffff';
      for (let b = 0; b < blades; b++) {
        const ang = (b / blades) * Math.PI * 2 + progress * 3;
        const x1 = w / 2 + Math.cos(ang) * (maxR * 0.75);
        const y1 = h / 2 + Math.sin(ang) * (maxR * 0.75);
        ctx.fillRect(Math.floor(x1) - 2, Math.floor(y1) - 2, 4, 4);

        // Hạt kiếm khí
        const x2 = w / 2 + Math.cos(ang + 0.2) * (maxR * 0.5);
        const y2 = h / 2 + Math.sin(ang + 0.2) * (maxR * 0.5);
        ctx.fillStyle = '#ffeaa7';
        ctx.fillRect(Math.floor(x2) - 1, Math.floor(y2) - 1, 2, 2);
      }
    }
    this.texture.needsUpdate = true;
  }
}

// Lớp hiển thị số sát thương nhảy lên kiểu Retro Pixel Art Floating Text
class FloatingDamageText {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];

    for (let i = 0; i < 25; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 70;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;

      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(3.4, 1.4, 1);
      sprite.visible = false;
      this.scene.add(sprite);

      this.pool.push({ sprite, canvas, ctx, texture, life: 0, maxLife: 1.3, velY: 2.8 });
    }
  }

  spawn(text, position, color = '#ff4757') {
    for (const item of this.pool) {
      if (!item.sprite.visible) {
        item.sprite.visible = true;
        item.life = item.maxLife;
        item.sprite.position.copy(position);
        item.sprite.position.y += 1.6;
        item.sprite.position.x += (Math.random() - 0.5) * 0.6;

        const ctx = item.ctx;
        ctx.clearRect(0, 0, 180, 70);
        ctx.font = 'bold 28px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 7;
        ctx.strokeText(text, 90, 35);

        ctx.fillStyle = color;
        ctx.fillText(text, 90, 35);

        item.texture.needsUpdate = true;
        break;
      }
    }
  }

  update(delta) {
    for (const item of this.pool) {
      if (item.sprite.visible) {
        item.life -= delta;
        if (item.life <= 0) {
          item.sprite.visible = false;
        } else {
          item.sprite.position.y += item.velY * delta;
          item.sprite.material.opacity = Math.min(1.0, item.life / (item.maxLife * 0.35));
        }
      }
    }
  }
}

export class PixelFXManager {
  constructor(scene, world, particles) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;
    this.controller = null; // Sẽ được liên kết từ main.js
    this.onScreenFlash = null; // Callback flash hiệu ứng màn hình
    this.activeEffects = [];
    this.damageTexts = new FloatingDamageText(scene);

    // Thời gian hồi chiêu của 5 kỹ năng (giây)
    this.cooldowns = {
      1: { current: 0, max: 4.0, name: 'Thiên Thạch Lửa', icon: '☄️' },
      2: { current: 0, max: 3.0, name: 'Sấm Sét Giáng Trần', icon: '⚡' },
      3: { current: 0, max: 5.0, name: 'Bão Băng Địa Cực', icon: '❄️' },
      4: { current: 0, max: 6.0, name: 'Địa Chấn Long Trời', icon: '🌍' },
      5: { current: 0, max: 9.0, name: 'Vạn Kiếm Quy Tông', icon: '⚔️' },
    };

    this.onCooldownUpdate = null;
    this.remotePlayers = [];
    this.onHitPlayer = null;
  }

  // VÒNG CHỈ ĐIỂM MA PHÁP DƯỚI ĐẤT (TARGETING TELEGRAPH RUNE)
  spawnTelegraph(position, color, duration, radius = 6.0) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y += 0.08;

    // Vòng ngoài xoay thu nhỏ dần
    const ringGeo = new THREE.RingGeometry(radius * 0.9, radius, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    // Tâm ma pháp nhấp nháy
    const coreGeo = new THREE.CircleGeometry(radius * 0.3, 16);
    coreGeo.rotateX(-Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    this.scene.add(group);

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const progress = elapsed / duration;
        if (progress >= 1.0) {
          this.scene.remove(group);
          return false;
        }

        group.rotation.y += delta * 4;
        const scale = THREE.MathUtils.lerp(1.2, 0.85, progress);
        ringMesh.scale.set(scale, scale, scale);
        coreMat.opacity = (Math.sin(elapsed * 16) * 0.25 + 0.5) * (1.0 - progress);
        ringMat.opacity = 0.85 * (1.0 - progress * 0.4);
        return true;
      }
    });
  }

  isSkillOnCooldown(skillIndex) {
    const s = this.cooldowns[skillIndex];
    return s && s.current > 0;
  }

  // KÍCH HOẠT KỸ NĂNG THEO PHÍM SỐ [1], [2], [3], [4], [5]
  castSkill(skillIndex, targetPos, character, monsters) {
    const skill = this.cooldowns[skillIndex];
    if (!skill || skill.current > 0) return false;

    // Kích hoạt thời gian hồi chiêu
    skill.current = skill.max;

    switch (skillIndex) {
      case 1:
        this.castMeteorStrike(targetPos, monsters);
        break;
      case 2:
        this.castThunderStrike(targetPos, monsters);
        break;
      case 3:
        this.castFrostNova(targetPos, monsters);
        break;
      case 4:
        this.castEarthquake(targetPos, monsters);
        break;
      case 5:
        this.castWanJianGuiZong(targetPos, monsters);
        break;
    }

    return true;
  }

  // --- KỸ NĂNG 1: THIÊN THẠCH HỎA NGỤC (METEOR STRIKE) ---
  castMeteorStrike(targetPos, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const fallDuration = 0.62;

    // 1. Chỉ điểm vòng ma pháp lửa trên mặt đất (bán kính rộng 14m)
    this.spawnTelegraph(new THREE.Vector3(impactX, impactY, impactZ), 0xff4757, fallDuration, 14.0);

    const startY = impactY + 45;
    const startX = impactX - 28;
    const startZ = impactZ - 28;

    // 2. Khối thiên thạch khổng lồ 3 tầng lõi phát sáng rực rỡ
    const meteorGroup = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), coreMat);
    meteorGroup.add(core);

    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff4757, transparent: true, opacity: 0.92 });
    const flame = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), flameMat);
    meteorGroup.add(flame);

    const outerMat = new THREE.MeshBasicMaterial({ color: 0xffa502, transparent: true, opacity: 0.8 });
    const outer = new THREE.Mesh(new THREE.DodecahedronGeometry(3.8, 1), outerMat);
    meteorGroup.add(outer);

    // Điểm sáng động cực lớn chiếu rọi địa hình khi thiên thạch bay tới
    const meteorLight = new THREE.PointLight(0xff4757, 6.0, 48);
    meteorGroup.add(meteorLight);

    meteorGroup.position.set(startX, startY, startZ);
    this.scene.add(meteorGroup);

    let progress = 0;
    let trailTimer = 0;

    const fx = {
      update: (delta) => {
        progress += delta / fallDuration;
        trailTimer += delta;

        if (progress < 1.0) {
          meteorGroup.position.x = THREE.MathUtils.lerp(startX, impactX, progress);
          meteorGroup.position.y = THREE.MathUtils.lerp(startY, impactY, progress);
          meteorGroup.position.z = THREE.MathUtils.lerp(startZ, impactZ, progress);
          meteorGroup.rotation.x += 16 * delta;
          meteorGroup.rotation.y += 16 * delta;

          // Hạt đuôi lửa dày đặc cuồn cuộn
          if (trailTimer > 0.02) {
            trailTimer = 0;
            this.particles.emitElementalParticles(
              meteorGroup.position,
              7,
              [0xff4757, 0xffa502, 0xffd32a, 0xffffff],
              [3, 8],
              0.5,
              0,
              1.2
            );
          }
          return true;
        }

        // --- CHẠM ĐẤT: NỔ TUNG SIÊU BÙNG NỔ HOÀNG TRÁNG! ---
        this.scene.remove(meteorGroup);
        sound.playMeteorExplosion();

        if (this.controller) {
          this.controller.addTrauma(1.0); // Rung giật màn hình cực đại
        }
        if (this.onScreenFlash) {
          this.onScreenFlash('fire');
        }

        const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

        // 1. Tàn phá địa hình sâu 3.4m, bán kính 16m
        this.world.deformTerrain(impactX, impactZ, 16.0, 3.4, 'fire');

        // 2. Cột khói nấm cuồn cuộn bốc cao 22m bung tỏa mũ nấm 18m
        if (this.particles.emitMushroomExplosion) {
          this.particles.emitMushroomExplosion(hitPos, 22, 18);
        }

        // 3. Ba tầng sóng xung kích cực đại (Triple Shockwaves)
        this.particles.emitShockwave(hitPos, 0xff4757, 26, 0.75);
        this.particles.emitShockwave(hitPos, 0xffa502, 18, 0.55);
        this.particles.emitShockwave(hitPos, 0xffffff, 11, 0.35);

        // 4. Quả cầu lửa nổ bung phồng to cực đại (Blast Fireball Dome phình tới 16m)
        const blastGeo = new THREE.SphereGeometry(1.0, 14, 14);
        const blastMat = new THREE.MeshBasicMaterial({
          color: 0xffa502,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        });
        const blastMesh = new THREE.Mesh(blastGeo, blastMat);
        blastMesh.position.copy(hitPos);
        blastMesh.position.y += 1.8;
        this.scene.add(blastMesh);

        let blastLife = 0.45;
        this.activeEffects.push({
          update: (dt) => {
            blastLife -= dt;
            if (blastLife <= 0) {
              this.scene.remove(blastMesh);
              return false;
            }
            const prog = 1.0 - blastLife / 0.45;
            const sc = THREE.MathUtils.lerp(2.0, 16.0, Math.pow(prog, 0.45));
            blastMesh.scale.set(sc, sc * 1.25, sc);
            blastMat.opacity = (1.0 - prog) * 0.95;
            return true;
          }
        });

        // 5. 32 khối đá magma bốc cháy văng tứ phía với vận tốc cực lớn
        const magmaRocks = [];
        const rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
        const rockMat = new THREE.MeshStandardMaterial({
          color: 0x3d1c06,
          emissive: 0xff4757,
          roughness: 0.5,
          flatShading: true,
        });

        for (let i = 0; i < 32; i++) {
          const rMesh = new THREE.Mesh(rockGeo, rockMat);
          rMesh.position.copy(hitPos);
          rMesh.position.y += 1.0;
          rMesh.scale.setScalar(0.7 + Math.random() * 0.9);
          this.scene.add(rMesh);

          const ang = Math.random() * Math.PI * 2;
          const spd = 12 + Math.random() * 18;
          magmaRocks.push({
            mesh: rMesh,
            vel: new THREE.Vector3(
              Math.cos(ang) * spd,
              12 + Math.random() * 15,
              Math.sin(ang) * spd
            ),
            rot: (Math.random() - 0.5) * 16,
          });
        }

        let magmaLife = 2.0;
        this.activeEffects.push({
          update: (dt) => {
            magmaLife -= dt;
            for (const mr of magmaRocks) {
              mr.mesh.position.addScaledVector(mr.vel, dt);
              mr.vel.y -= 24 * dt;
              mr.mesh.rotation.x += mr.rot * dt;
              mr.mesh.rotation.y += mr.rot * dt;
            }
            if (magmaLife <= 0) {
              for (const mr of magmaRocks) this.scene.remove(mr.mesh);
              return false;
            }
            return true;
          }
        });

        // 6. Tàn lửa bùng lên và decal pixel art
        this.particles.emitSmoke(hitPos, 20, 0x111111, 2.0, true);
        this.particles.emitElementalParticles(hitPos, 65, [0xff4757, 0xffa502, 0xffd32a], [8, 22], 1.2, 12.0, 1.8);
        this.spawnGroundDecalEffect('fire', new THREE.Vector3(impactX, impactY + 0.15, impactZ), 20, 2.2);

        // 7. Sát thương cực đại và lực tàn phá vật thể cực lớn (Force = 60, Radius = 22m, Damage = 250)
        this.dealDamageAOE(hitPos, 22.0, 250, '🔥 -250 THIÊN ĐỊA DIỆT!', '#ff3838', monsters, 'knockback', 'fire', 60.0);

        // 8. BIỂN LỬA ÂM BỈ KÉO DÀI 4.5 GIÂY (LINGERING INFERNO)
        let fireFieldTimer = 4.5;
        let tickTimer = 0;
        this.activeEffects.push({
          update: (dt) => {
            fireFieldTimer -= dt;
            tickTimer += dt;

            // Mỗi 0.12s nhả khói lửa bập bùng trên miệng hố
            if (Math.random() < 0.65) {
              const rOffset = Math.random() * 7.5;
              const aOffset = Math.random() * Math.PI * 2;
              const fPos = hitPos.clone().add(new THREE.Vector3(Math.cos(aOffset) * rOffset, 0.2, Math.sin(aOffset) * rOffset));
              this.particles.emitElementalParticles(fPos, 2, [0xff4757, 0xffa502], [2, 6], 0.45, 0, 0.6);
            }

            // Mỗi 0.5s gây sát thương thiêu đốt cho kẻ địch trong tâm hố
            if (tickTimer >= 0.5) {
              tickTimer = 0;
              if (monsters) {
                for (const m of monsters) {
                  if (!m.isDead && m.position.distanceTo(hitPos) < 10.0) {
                    m.takeDamage(25, hitPos);
                    const mPos = m.position.clone();
                    mPos.y += m.hitHeight * 0.7;
                    this.damageTexts.spawn('🔥 -25 BURN', mPos, '#ff9f43');
                  }
                }
              }
            }

            return fireFieldTimer > 0;
          }
        });

        return false;
      }
    };

    this.activeEffects.push(fx);
  }

  // --- KỸ NĂNG 2: SẤM SÉT GIÁNG TRẦN (THUNDER STRIKE) ---
  castThunderStrike(targetPos, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);

    sound.playThunderStrike();

    if (this.controller) {
      this.controller.addTrauma(0.65); // Rung giật nhanh và bén
    }
    if (this.onScreenFlash) {
      this.onScreenFlash('lightning');
    }

    const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

    // 1. Tạo luồng sét gấp khúc phân nhánh Procedural (Jagged 3D Lightning Bolts)
    const lightningGroup = new THREE.Group();
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const arcMat = new THREE.MeshBasicMaterial({ color: 0x00d2d3, transparent: true, opacity: 0.75, depthWrite: false });

    const createLightningBranch = (start, end, segments = 8, jitter = 1.4, radius = 0.28) => {
      let prevPt = start.clone();
      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const curPt = new THREE.Vector3().lerpVectors(start, end, t);
        if (s < segments) {
          curPt.x += (Math.random() - 0.5) * jitter;
          curPt.z += (Math.random() - 0.5) * jitter;
        }

        const segLen = prevPt.distanceTo(curPt);
        const coreGeo = new THREE.CylinderGeometry(radius * 0.7, radius, segLen, 5);
        const arcGeo = new THREE.CylinderGeometry(radius * 1.8, radius * 2.2, segLen, 5);

        const meshCore = new THREE.Mesh(coreGeo, boltMat);
        const meshArc = new THREE.Mesh(arcGeo, arcMat);

        const mid = new THREE.Vector3().addVectors(prevPt, curPt).multiplyScalar(0.5);
        meshCore.position.copy(mid);
        meshArc.position.copy(mid);

        meshCore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curPt.clone().sub(prevPt).normalize());
        meshArc.quaternion.copy(meshCore.quaternion);

        lightningGroup.add(meshCore);
        lightningGroup.add(meshArc);

        prevPt = curPt;
      }
    };

    // Tia sét chính đánh thẳng từ tầng mây
    const skyPos = new THREE.Vector3(impactX, impactY + 48, impactZ);
    createLightningBranch(skyPos, hitPos, 10, 2.2, 0.35);

    // 2 tia sét phụ nhánh rẽ sang 2 bên
    const branch1End = hitPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
    branch1End.y = getTerrainHeight(branch1End.x, branch1End.z);
    createLightningBranch(new THREE.Vector3(impactX, impactY + 24, impactZ), branch1End, 6, 1.6, 0.2);

    const branch2End = hitPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
    branch2End.y = getTerrainHeight(branch2End.x, branch2End.z);
    createLightningBranch(new THREE.Vector3(impactX, impactY + 32, impactZ), branch2End, 6, 1.6, 0.2);

    // Đèn chớp xanh tím
    const strikeLight = new THREE.PointLight(0x00d2d3, 8.0, 35);
    strikeLight.position.set(impactX, impactY + 4, impactZ);
    lightningGroup.add(strikeLight);

    this.scene.add(lightningGroup);

    // 2. Tàn phá địa hình (Vết nứt sấm sét)
    this.world.deformTerrain(impactX, impactZ, 8.0, 1.2, 'lightning');

    // 3. Sóng điện giật lan tỏa
    this.particles.emitShockwave(hitPos, 0x00d2d3, 14, 0.4);
    this.particles.emitShockwave(hitPos, 0xffffff, 8, 0.25);
    this.particles.emitElementalParticles(hitPos, 35, [0x00d2d3, 0xffffff, 0x70a1ff], [6, 16], 0.7, 4.0, 1.2);

    // 4. Decal sét vẽ trên đất
    this.spawnGroundDecalEffect('lightning', new THREE.Vector3(impactX, impactY + 0.12, impactZ), 13, 1.0);

    // 5. Sát thương cao & chấn động
    this.dealDamageAOE(hitPos, 8.5, 145, '⚡ -145 SHOCK!', '#00d2d3', monsters, null, 'lightning');

    let boltLife = 0.25;
    this.activeEffects.push({
      update: (delta) => {
        boltLife -= delta;
        if (boltLife > 0) {
          boltMat.opacity = boltLife / 0.25;
          arcMat.opacity = (boltLife / 0.25) * 0.75;
          strikeLight.intensity = (boltLife / 0.25) * 8.0;
          return true;
        }
        this.scene.remove(lightningGroup);
        return false;
      }
    });
  }

  // --- KỸ NĂNG 3: BÃO BĂNG ĐỊA CỰC (FROST NOVA) ---
  castFrostNova(targetPos, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

    sound.playFrostNova();

    if (this.controller) {
      this.controller.addTrauma(0.45);
    }
    if (this.onScreenFlash) {
      this.onScreenFlash('frost');
    }

    // 1. Tàn phá địa hình (Đóng băng vĩnh cửu)
    this.world.deformTerrain(impactX, impactZ, 12.0, 0.5, 'ice');

    // 2. Sóng băng giá tỏa nhanh ra xung quanh
    this.particles.emitShockwave(hitPos, 0x7ed6df, 18, 0.7);
    this.particles.emitShockwave(hitPos, 0xffffff, 11, 0.45);

    // 3. Decal hoa tuyết pixel
    this.spawnGroundDecalEffect('ice', new THREE.Vector3(impactX, impactY + 0.12, impactZ), 17, 1.8);

    // 4. Các trụ băng tinh thể nhọn hoắt nhô bật lên từ lòng đất (Crystal Ice Spikes)
    const iceGroup = new THREE.Group();
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x7ed6df,
      roughness: 0.15,
      metalness: 0.3,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    });

    const spikes = [];
    const spikeCount = 14;

    for (let i = 0; i < spikeCount; i++) {
      const ang = (i / spikeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const dist = 2.5 + Math.random() * 5.5;
      const ix = impactX + Math.cos(ang) * dist;
      const iz = impactZ + Math.sin(ang) * dist;
      const iy = getTerrainHeight(ix, iz);

      const targetHeight = 2.8 + Math.random() * 2.2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.7, targetHeight, 5), iceMat);
      spike.position.set(ix, iy, iz);
      spike.rotation.x = (Math.random() - 0.5) * 0.35;
      spike.rotation.z = (Math.random() - 0.5) * 0.35;
      spike.scale.set(0.01, 0.01, 0.01);
      spike.castShadow = true;
      iceGroup.add(spike);

      spikes.push({ mesh: spike, targetScaleY: 1.0, currentScale: 0.01 });
    }

    // Vòng lốc xoáy tuyết bay quanh tâm (Blizzard Swirl)
    const snowParticles = [];
    for (let i = 0; i < 28; i++) {
      const pMesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.2, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
      );
      this.scene.add(pMesh);
      snowParticles.push({
        mesh: pMesh,
        angle: Math.random() * Math.PI * 2,
        dist: 2 + Math.random() * 6,
        height: 0.5 + Math.random() * 4,
        rotSpeed: 3 + Math.random() * 4,
      });
    }

    this.scene.add(iceGroup);

    // 5. Đóng băng quái vật & Gây sát thương
    this.dealDamageAOE(hitPos, 12.0, 95, '❄️ -95 FROZEN!', '#7ed6df', monsters, 'freeze', 'ice');

    let iceLife = 2.6;
    this.activeEffects.push({
      update: (delta) => {
        iceLife -= delta;

        // Hiệu ứng mọc trồi lên nảy nhẹ
        for (const sp of spikes) {
          if (sp.currentScale < 1.0) {
            sp.currentScale = Math.min(1.0, sp.currentScale + delta * 5.0);
            sp.mesh.scale.set(sp.currentScale, sp.currentScale, sp.currentScale);
          }
        }

        // Lốc tuyết xoay tròn
        for (const sp of snowParticles) {
          sp.angle += sp.rotSpeed * delta;
          sp.mesh.position.set(
            impactX + Math.cos(sp.angle) * sp.dist,
            impactY + sp.height,
            impactZ + Math.sin(sp.angle) * sp.dist
          );
        }

        // Khi hết hạn: Vỡ vụn thành các tinh thể lấp lánh!
        if (iceLife <= 0.4) {
          iceGroup.scale.multiplyScalar(0.94);
        }

        if (iceLife <= 0) {
          this.scene.remove(iceGroup);
          for (const sp of snowParticles) this.scene.remove(sp.mesh);
          this.particles.emitElementalParticles(hitPos, 35, [0x7ed6df, 0xffffff], [3, 8], 0.7, 6.0, 1.1);
          return false;
        }
        return true;
      }
    });
  }

  // --- KỸ NĂNG 4: ĐỊA CHẤN LONG TRỜI (EARTH STOMP / CATACLYSM) ---
  castEarthquake(targetPos, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

    sound.playEarthquake();

    if (this.controller) {
      this.controller.addTrauma(0.95); // Chấn động cực mạnh và rung lâu
    }
    if (this.onScreenFlash) {
      this.onScreenFlash('earth');
    }

    // 1. Tàn phá địa hình cực mạnh (Hố sâu 2.5m, vết nứt nẻ nham thạch)
    this.world.deformTerrain(impactX, impactZ, 14.0, 2.5, 'earth');

    // 2. 3 đợt sóng chấn động liên tiếp
    this.particles.emitShockwave(hitPos, 0xe67e22, 20, 0.85);
    setTimeout(() => this.particles.emitShockwave(hitPos, 0x8d5b4c, 14, 0.65), 120);
    setTimeout(() => this.particles.emitShockwave(hitPos, 0xd35400, 8, 0.45), 240);

    // 3. Decal chấn động pixel
    this.spawnGroundDecalEffect('earth', new THREE.Vector3(impactX, impactY + 0.14, impactZ), 20, 1.8);

    // 4. Các phiến đá kiến tạo dựng đứng trồi lên từ lòng đất (Tectonic Slabs)
    const slabGroup = new THREE.Group();
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x634d3b,
      roughness: 0.9,
      flatShading: true,
    });

    const slabCount = 8;
    for (let i = 0; i < slabCount; i++) {
      const ang = (i / slabCount) * Math.PI * 2;
      const dist = 5.0 + Math.random() * 3.5;
      const sx = impactX + Math.cos(ang) * dist;
      const sz = impactZ + Math.sin(ang) * dist;
      const sy = getTerrainHeight(sx, sz);

      const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.8, 0.8), slabMat);
      slabMesh.position.set(sx, sy + 1.2, sz);
      slabMesh.rotation.y = ang + Math.PI / 2;
      slabMesh.rotation.x = (Math.random() - 0.5) * 0.4;
      slabMesh.rotation.z = (Math.random() - 0.5) * 0.4;
      slabMesh.castShadow = true;
      slabGroup.add(slabMesh);
    }
    this.scene.add(slabGroup);

    // 5. Bão đá vụn bay tung lên trời (Rock Avalanche)
    const flyingRocks = [];
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x574b40, flatShading: true });

    for (let i = 0; i < 22; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.45, 0), rockMat);
      const rx = impactX + (Math.random() - 0.5) * 7;
      const rz = impactZ + (Math.random() - 0.5) * 7;
      rock.position.set(rx, impactY + 0.6, rz);
      this.scene.add(rock);

      flyingRocks.push({
        mesh: rock,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          8 + Math.random() * 9,
          (Math.random() - 0.5) * 12
        ),
        rotVel: (Math.random() - 0.5) * 10,
      });
    }

    // 6. Bụi đất mù mịt
    this.particles.emitSmoke(hitPos, 16, 0x795548, 1.5);
    this.particles.emitElementalParticles(hitPos, 40, [0xe67e22, 0xd35400, 0x8d5b4c], [5, 14], 0.85, 14.0, 1.2);

    // 7. Đẩy lùi và gây sát thương khủng khiếp
    this.dealDamageAOE(hitPos, 14.0, 180, '💥 -180 SMASH!', '#e67e22', monsters, 'knockback', 'earth');

    let quakeLife = 1.8;
    this.activeEffects.push({
      update: (delta) => {
        quakeLife -= delta;
        for (const r of flyingRocks) {
          r.mesh.position.addScaledVector(r.vel, delta);
          r.vel.y -= 22 * delta;
          r.mesh.rotation.x += r.rotVel * delta;
          r.mesh.rotation.y += r.rotVel * delta;
        }

        if (quakeLife <= 0.5) {
          slabGroup.scale.multiplyScalar(0.96);
        }

        if (quakeLife <= 0) {
          for (const r of flyingRocks) this.scene.remove(r.mesh);
          this.scene.remove(slabGroup);
          return false;
        }
        return true;
      }
    });
  }

  // --- KỸ NĂNG 5: VẠN KIẾM QUY TÔNG (WAN JIAN GUI ZONG) ---
  castWanJianGuiZong(targetPos, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

    sound.playSwordSummon();

    if (this.onScreenFlash) {
      this.onScreenFlash('sword');
    }

    // 1. Chỉ điểm kiếm trận hoàng kim trên mặt đất
    this.spawnTelegraph(hitPos, 0xffd700, 1.8, 14.0);
    this.spawnGroundDecalEffect('sword', new THREE.Vector3(impactX, impactY + 0.14, impactZ), 20, 2.8);

    // 2. Tạo hình học thanh kiếm tiên (Xianxia Flying Sword)
    const swordBladeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffd700,
      emissiveIntensity: 0.9,
      metalness: 0.8,
      roughness: 0.2,
      flatShading: true,
    });
    const swordHiltMat = new THREE.MeshStandardMaterial({
      color: 0xd63031,
      roughness: 0.5,
    });
    const swordGuardMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      metalness: 0.9,
      roughness: 0.1,
    });

    const createSwordMesh = (scale = 1.0) => {
      const g = new THREE.Group();
      // Lưỡi kiếm 2 mang sắc bén
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale, 2.2 * scale, 0.05 * scale), swordBladeMat);
      blade.position.y = 1.1 * scale;
      blade.castShadow = true;
      g.add(blade);

      // Mũi kiếm nhọn
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11 * scale, 0.45 * scale, 4), swordBladeMat);
      tip.position.y = 2.4 * scale;
      tip.rotation.y = Math.PI / 4;
      g.add(tip);

      // Chuôi kiếm
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.08 * scale, 0.12 * scale), swordGuardMat);
      guard.position.y = 0.02 * scale;
      g.add(guard);

      // Cán kiếm
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.6 * scale, 5), swordHiltMat);
      hilt.position.y = -0.32 * scale;
      g.add(hilt);

      return g;
    };

    // 3. Khởi tạo 32 thanh kiếm bay lơ lửng xoay tròn trên không trung (Sword Mandala Formation)
    const swordCount = 32;
    const swords = [];
    const swordContainer = new THREE.Group();
    this.scene.add(swordContainer);

    for (let i = 0; i < swordCount; i++) {
      const sword = createSwordMesh(0.9);
      const tier = i % 2;
      const ringRadius = tier === 0 ? 5.0 + Math.random() * 2.0 : 9.5 + Math.random() * 3.0;
      const angle = (i / swordCount) * Math.PI * 4;
      const height = impactY + 18 + Math.random() * 8;

      sword.position.set(
        impactX + Math.cos(angle) * ringRadius,
        height,
        impactZ + Math.sin(angle) * ringRadius
      );
      sword.rotation.x = Math.PI; // Mũi kiếm chĩa xuống đất
      sword.rotation.z = (Math.random() - 0.5) * 0.3;

      swordContainer.add(sword);

      swords.push({
        mesh: sword,
        initPos: sword.position.clone(),
        targetPos: new THREE.Vector3(
          impactX + (Math.random() - 0.5) * 11,
          impactY,
          impactZ + (Math.random() - 0.5) * 11
        ),
        delay: 0.3 + (i / swordCount) * 1.1,
        plunged: false,
        embedded: false,
        embedLife: 0.6,
      });
    }

    // 4. Thanh Thiên Kiếm Khổng Lồ (Colossal Divine Finisher Greatsword)
    const giantSword = createSwordMesh(4.8);
    giantSword.position.set(impactX, impactY + 55, impactZ);
    giantSword.rotation.x = Math.PI;
    giantSword.visible = false;
    this.scene.add(giantSword);

    let elapsed = 0;
    let giantPlunged = false;
    let giantEmbedded = false;
    let giantLife = 2.0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        // Cập nhật 32 thanh kiếm bay
        for (const s of swords) {
          if (elapsed < s.delay) {
            // Đang lơ lửng xoay tròn tụ kiếm khí
            s.mesh.rotation.y += delta * 6;
            s.mesh.position.y += Math.sin(elapsed * 10 + s.delay) * 0.05;
          } else if (!s.plunged) {
            // Lao vút xuống mục tiêu xé gió
            s.mesh.lookAt(s.targetPos);
            s.mesh.rotateX(Math.PI / 2);

            const dist = s.mesh.position.distanceTo(s.targetPos);
            const speed = 48.0;
            s.mesh.position.lerp(s.targetPos, Math.min(1.0, (speed * delta) / Math.max(0.1, dist)));

            // Vệt kiếm khí
            if (Math.random() < 0.4 && this.particles) {
              this.particles.emitElementalParticles(
                s.mesh.position,
                2,
                [0xffd700, 0xffffff],
                [1, 3],
                0.25,
                0,
                0.5
              );
            }

            if (dist < 1.0) {
              s.plunged = true;
              s.embedded = true;
              s.mesh.position.copy(s.targetPos);

              sound.playSwordSlash();
              if (this.controller) this.controller.addTrauma(0.06);

              // Cắm kiếm nổ tia sáng
              if (this.particles) {
                this.particles.emitHitSparkles(s.targetPos, 8);
                this.particles.emitShockwave(s.targetPos, 0xffd700, 3.0, 0.25);
              }

              // Sát thương rỉa liên hoàn nhiều đợt
              this.dealDamageAOE(s.targetPos, 3.5, 25, '⚔️ -25', '#ffd700', monsters, null, 'lightning');
            }
          } else if (s.embedded) {
            s.embedLife -= delta;
            s.mesh.scale.multiplyScalar(0.95);
            if (s.embedLife <= 0) {
              s.embedded = false;
              swordContainer.remove(s.mesh);
            }
          }
        }

        // Cập nhật Thiên Kiếm Khổng Lồ (Finisher Sword at 1.4s)
        if (elapsed >= 1.4 && !giantPlunged) {
          giantSword.visible = true;
          const giantDist = giantSword.position.y - impactY;
          giantSword.position.y -= 75 * delta;

          if (this.particles) {
            this.particles.emitElementalParticles(
              giantSword.position,
              4,
              [0xffd700, 0xfff0a0, 0xffffff],
              [2, 6],
              0.3,
              0,
              1.2
            );
          }

          if (giantDist <= 2.5) {
            giantPlunged = true;
            giantEmbedded = true;
            giantSword.position.y = impactY + 1.5;

            // ĐÒN KẾT LIỄU CHẤN ĐỘNG TRỜI ĐẤT!
            sound.playGiantSwordImpact();

            if (this.controller) {
              this.controller.addTrauma(0.92);
            }
            if (this.onScreenFlash) {
              this.onScreenFlash('sword');
            }

            // Tàn phá địa hình & chấn động
            this.world.deformTerrain(impactX, impactZ, 13.0, 2.2, 'lightning');

            // Sóng xung kích kiếm khí khổng lồ
            this.particles.emitShockwave(hitPos, 0xffd700, 22, 0.85);
            this.particles.emitShockwave(hitPos, 0xffffff, 14, 0.5);
            this.particles.emitElementalParticles(hitPos, 50, [0xffd700, 0xffffff, 0xff9f43], [8, 18], 0.95, 6, 1.6);

            // Sát thương cực đại kết liễu
            this.dealDamageAOE(hitPos, 14.5, 240, '⚔️ -240 VẠN KIẾM!', '#ffd700', monsters, 'knockback', 'lightning');
          }
        }

        // Hết vòng đời thiên kiếm
        if (giantEmbedded) {
          giantLife -= delta;
          giantSword.rotation.z = Math.sin(elapsed * 24) * 0.05;

          if (giantLife <= 0.5) {
            giantSword.scale.multiplyScalar(0.94);
          }

          if (giantLife <= 0) {
            this.scene.remove(giantSword);
            this.scene.remove(swordContainer);
            this.particles.emitElementalParticles(hitPos, 35, [0xffd700, 0xffffff], [4, 10], 0.7, 5, 1.2);
            return false;
          }
        }

        return true;
      }
    });
  }

  // TẠO HIỆU ỨNG PIXEL ART VẼ BẰNG CANVAS ĐẶT NẰM TRÊN MẶT ĐẤT
  spawnGroundDecalEffect(type, position, size, duration) {
    const pixelCanvas = new PixelCanvasEffect(64);
    const planeGeo = new THREE.PlaneGeometry(size, size);
    planeGeo.rotateX(-Math.PI / 2);

    const planeMat = new THREE.MeshBasicMaterial({
      map: pixelCanvas.texture,
      transparent: true,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.position.copy(position);
    this.scene.add(mesh);

    let elapsed = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const progress = Math.min(1.0, elapsed / duration);

        if (type === 'fire') pixelCanvas.drawFireExplosion(progress);
        else if (type === 'lightning') pixelCanvas.drawLightning(progress);
        else if (type === 'ice') pixelCanvas.drawFrostNova(progress);
        else if (type === 'earth') pixelCanvas.drawEarthquake(progress);
        else if (type === 'sword') pixelCanvas.drawSwordArray(progress);

        if (progress >= 1.0) {
          this.scene.remove(mesh);
          return false;
        }
        return true;
      }
    });
  }

  // XỬ LÝ SÁT THƯƠNG DIỆN RỘNG (AOE), TƯƠNG TÁC MÔI TRƯỜNG & HIỆU ỨNG TRẠNG THÁI
  dealDamageAOE(epicenter, radius, amount, text, textColor, monsters, statusEffect = null, elementType = 'neutral', customForce = null) {
    // 1. Tương tác với Vật thể môi trường (Làm văng, gãy cây, bể đá, bung hàng rào, sập tường, vỡ ngói)
    if (this.world && this.world.interactWithArea) {
      const force = customForce !== null ? customForce : (amount >= 200 ? 55 : (amount >= 150 ? 25 : (amount >= 120 ? 19 : 14)));
      this.world.interactWithArea(epicenter, radius * 1.15, force, elementType);
    }

    // 2. Gây sát thương PvP diện rộng lên người chơi khác
    if (this.remotePlayers && this.remotePlayers.length > 0) {
      for (const rp of this.remotePlayers) {
        if (!rp.isDead) {
          const dist = rp.position.distanceTo(epicenter);
          if (dist <= radius + 0.85) {
            if (this.onHitPlayer) {
              this.onHitPlayer(rp.id, amount, rp.position.clone().add(new THREE.Vector3(0, 1.2, 0)), elementType);
            }
            if (this.damageTexts) {
              const hitPos = rp.position.clone().add(new THREE.Vector3(0, 1.8, 0));
              this.damageTexts.spawn(text, hitPos, textColor);
            }
            if (this.particles) {
              this.particles.emitHitSparkles(rp.position, 16);
            }
          }
        }
      }
    }

    if (!monsters) return;

    for (const monster of monsters) {
      if (!monster.isDead) {
        const dist = monster.position.distanceTo(epicenter);
        if (dist <= radius + monster.hitRadius) {
          monster.takeDamage(amount, epicenter);

          // Áp dụng trạng thái khống chế
          if (statusEffect === 'freeze' && monster.freeze) {
            monster.freeze(2.8);
          } else if (statusEffect === 'knockback' && monster.knockback) {
            monster.knockback(epicenter, 14);
          }

          const hitPos = monster.position.clone();
          hitPos.y += monster.hitHeight * 0.7;
          this.damageTexts.spawn(text, hitPos, textColor);
          this.particles.emitHitSparkles(hitPos, 16);
        }
      }
    }
  }

  update(delta) {
    // 1. Cập nhật thời gian hồi chiêu
    for (const key in this.cooldowns) {
      const cd = this.cooldowns[key];
      if (cd.current > 0) {
        cd.current = Math.max(0, cd.current - delta);
      }
    }

    if (this.onCooldownUpdate) {
      this.onCooldownUpdate(this.cooldowns);
    }

    // 2. Cập nhật các hiệu ứng PixelFX đang diễn ra
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const alive = this.activeEffects[i].update(delta);
      if (!alive) {
        this.activeEffects.splice(i, 1);
      }
    }

    // 3. Cập nhật số sát thương nhảy lên
    this.damageTexts.update(delta);
  }
}
