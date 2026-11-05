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
    this.ctx.imageSmoothingEnabled = false; // Chuẩn pixel art

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

    if (progress < 0.85) {
      // 1. Viền ngoài khói đen xám dithered
      ctx.fillStyle = progress > 0.5 ? '#2f3542' : '#ff4757';
      ctx.beginPath();
      ctx.arc(center, center, currentR, 0, Math.PI * 2);
      ctx.fill();

      // 2. Lõi cam rực lửa
      ctx.fillStyle = '#ffa502';
      ctx.beginPath();
      ctx.arc(center, center, currentR * 0.72, 0, Math.PI * 2);
      ctx.fill();

      // 3. Tâm trắng sáng chói
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(center, center, currentR * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // 4. Các hạt tàn lửa bay bung ra dạng pixel vuông
      const sparkCount = 12;
      for (let i = 0; i < sparkCount; i++) {
        const angle = (i / sparkCount) * Math.PI * 2 + progress * 2;
        const dist = currentR * (0.8 + (i % 3) * 0.25);
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

    if (progress < 0.8) {
      // Sóng năng lượng điện hình tròn dưới đất
      const ringR = progress * (w / 2 - 4);
      ctx.strokeStyle = '#70a1ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // Các nhánh sét pixel ngoằn ngoèo từ tâm
      const branches = 6;
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

      // Tâm điện phát sáng xanh cyan
      ctx.fillStyle = '#00d2d3';
      ctx.fillRect(w / 2 - 3, h / 2 - 3, 6, 6);
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

    if (progress < 0.9) {
      // Vòng tròn hoa tuyết dithered
      ctx.strokeStyle = '#7ed6df';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, currentR, 0, Math.PI * 2);
      ctx.stroke();

      // Hoa tuyết 8 cánh
      const petals = 8;
      for (let i = 0; i < petals; i++) {
        const ang = (i / petals) * Math.PI * 2;
        const x1 = w / 2 + Math.cos(ang) * currentR;
        const y1 = h / 2 + Math.sin(ang) * currentR;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.floor(x1) - 2, Math.floor(y1) - 2, 4, 4);

        // Hạt tinh thể nhỏ phụ
        const x2 = w / 2 + Math.cos(ang + 0.2) * (currentR * 0.7);
        const y2 = h / 2 + Math.sin(ang + 0.2) * (currentR * 0.7);
        ctx.fillStyle = '#22a6b3';
        ctx.fillRect(Math.floor(x2) - 1, Math.floor(y2) - 1, 2, 2);
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

    if (progress < 0.85) {
      // 3 vòng sóng địa chấn cách đều
      for (let ring = 0; ring < 3; ring++) {
        const r = Math.max(0, (progress - ring * 0.15) * maxR);
        if (r > 0) {
          ctx.strokeStyle = ring === 0 ? '#4b382a' : '#785336';
          ctx.lineWidth = 3 - ring;
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Các vết nứt đất pixel màu nâu đậm
      const cracks = 6;
      ctx.strokeStyle = '#2d2013';
      ctx.lineWidth = 2;
      for (let c = 0; c < cracks; c++) {
        const angle = (c / cracks) * Math.PI * 2 + 0.3;
        const len = progress * maxR * 0.9;
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
}

// Lớp hiển thị số sát thương nhảy lên kiểu Retro Pixel Art Floating Text
class FloatingDamageText {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];

    for (let i = 0; i < 20; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;

      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(3.2, 1.3, 1);
      sprite.visible = false;
      this.scene.add(sprite);

      this.pool.push({ sprite, canvas, ctx, texture, life: 0, maxLife: 1.2, velY: 2.5 });
    }
  }

  spawn(text, position, color = '#ff4757') {
    for (const item of this.pool) {
      if (!item.sprite.visible) {
        item.sprite.visible = true;
        item.life = item.maxLife;
        item.sprite.position.copy(position);
        item.sprite.position.y += 1.5;

        // Vẽ chữ pixel art retro
        const ctx = item.ctx;
        ctx.clearRect(0, 0, 160, 64);
        ctx.font = 'bold 26px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Viền đen đậm chuẩn pixel font
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeText(text, 80, 32);

        // Màu chữ nổi bật
        ctx.fillStyle = color;
        ctx.fillText(text, 80, 32);

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
          item.sprite.material.opacity = Math.min(1.0, item.life / (item.maxLife * 0.4));
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
    this.activeEffects = [];
    this.damageTexts = new FloatingDamageText(scene);

    // Thời gian hồi chiêu của 4 kỹ năng (giây)
    this.cooldowns = {
      1: { current: 0, max: 4.0, name: 'Thiên Thạch Lửa', icon: '☄️' },
      2: { current: 0, max: 3.0, name: 'Sấm Sét Giáng Trần', icon: '⚡' },
      3: { current: 0, max: 5.0, name: 'Bão Băng Địa Cực', icon: '❄️' },
      4: { current: 0, max: 6.0, name: 'Địa Chấn Long Trời', icon: '🌍' },
    };

    this.onCooldownUpdate = null;
  }

  // KÍCH HOẠT KỸ NĂNG THEO PHÍM SỐ [1], [2], [3], [4]
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
    }

    return true;
  }

  // --- KỸ NĂNG 1: THIÊN THẠCH HỎA NGỤC (METEOR STRIKE) ---
  castMeteorStrike(targetPos, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const startY = impactY + 35;
    const startX = impactX - 22;
    const startZ = impactZ - 22;

    // Khối thiên thạch pixel lao xuống
    const meteorGroup = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff3838 });
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), coreMat);
    meteorGroup.add(core);

    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa502, transparent: true, opacity: 0.8 });
    const flame = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), flameMat);
    meteorGroup.add(flame);

    meteorGroup.position.set(startX, startY, startZ);
    this.scene.add(meteorGroup);

    let progress = 0;
    const fallDuration = 0.55; // Lao xuống trong 0.55s

    const fx = {
      update: (delta) => {
        progress += delta / fallDuration;

        if (progress < 1.0) {
          meteorGroup.position.x = THREE.MathUtils.lerp(startX, impactX, progress);
          meteorGroup.position.y = THREE.MathUtils.lerp(startY, impactY, progress);
          meteorGroup.position.z = THREE.MathUtils.lerp(startZ, impactZ, progress);
          meteorGroup.rotation.x += 12 * delta;
          meteorGroup.rotation.y += 12 * delta;
          this.particles.emitHitSparkles(meteorGroup.position, 2);
          return true;
        }

        // CHẠM ĐẤT: NỔ TUNG & TÀN PHÁ ĐỊA HÌNH!
        this.scene.remove(meteorGroup);
        sound.playMeteorExplosion();

        // 1. Tàn phá địa hình (Lõm đất 1.8m, cháy than dung nham)
        this.world.deformTerrain(impactX, impactZ, 9.5, 1.8, 'fire');

        // 2. Tạo hiệu ứng vụ nổ Pixel Art trên mặt đất
        this.spawnGroundDecalEffect('fire', new THREE.Vector3(impactX, impactY + 0.1, impactZ), 14, 1.2);

        // 3. Gây sát thương diện rộng AOE lên Quái vật
        this.dealDamageAOE(new THREE.Vector3(impactX, impactY, impactZ), 10.0, 110, '🔥 -110 CRIT!', '#ff4757', monsters);

        this.particles.emitMonsterDefeat(new THREE.Vector3(impactX, impactY + 1, impactZ));
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

    // Cột sét 3D sáng chói đánh thẳng từ trời xuống
    const boltGeo = new THREE.CylinderGeometry(0.35, 0.7, 45, 6);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    const boltMesh = new THREE.Mesh(boltGeo, boltMat);
    boltMesh.position.set(impactX, impactY + 22.5, impactZ);
    this.scene.add(boltMesh);

    // Vỏ hồ quang xanh tím bao quanh
    const arcGeo = new THREE.CylinderGeometry(0.8, 1.4, 45, 6);
    const arcMat = new THREE.MeshBasicMaterial({ color: 0x00d2d3, transparent: true, opacity: 0.5 });
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.position.set(impactX, impactY + 22.5, impactZ);
    this.scene.add(arcMesh);

    // 1. Tàn phá địa hình (Vết nứt nẻ sấm sét)
    this.world.deformTerrain(impactX, impactZ, 7.5, 1.1, 'lightning');

    // 2. Hiệu ứng Pixel Sét lan tỏa trên mặt đất
    this.spawnGroundDecalEffect('lightning', new THREE.Vector3(impactX, impactY + 0.1, impactZ), 11, 0.9);

    // 3. Sát thương cao lên Quái vật
    this.dealDamageAOE(new THREE.Vector3(impactX, impactY, impactZ), 8.0, 140, '⚡ -140 SHOCK!', '#00d2d3', monsters);

    let boltLife = 0.28;
    this.activeEffects.push({
      update: (delta) => {
        boltLife -= delta;
        if (boltLife > 0) {
          boltMesh.material.opacity = boltLife / 0.28;
          arcMesh.material.opacity = (boltLife / 0.28) * 0.5;
          boltMesh.scale.x = 0.7 + Math.random() * 0.6;
          return true;
        }
        this.scene.remove(boltMesh);
        this.scene.remove(arcMesh);
        return false;
      }
    });
  }

  // --- KỸ NĂNG 3: BÃO BĂNG ĐỊA CỰC (FROST NOVA) ---
  castFrostNova(targetPos, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);

    sound.playFrostNova();

    // 1. Tàn phá địa hình (Đóng băng tuyết trắng vĩnh cửu)
    this.world.deformTerrain(impactX, impactZ, 11.0, 0.4, 'ice');

    // 2. Hiệu ứng Pixel Băng lan tỏa
    this.spawnGroundDecalEffect('ice', new THREE.Vector3(impactX, impactY + 0.1, impactZ), 15, 1.4);

    // 3. Nhô lên các cột băng nhọn tinh thể low-poly
    const iceGroup = new THREE.Group();
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x7ed6df,
      roughness: 0.2,
      metalness: 0.4,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
    });

    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2;
      const dist = 3.0 + Math.random() * 4.5;
      const ix = impactX + Math.cos(ang) * dist;
      const iz = impactZ + Math.sin(ang) * dist;
      const iy = getTerrainHeight(ix, iz);

      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.2, 5), iceMat);
      spike.position.set(ix, iy + 1.6, iz);
      spike.rotation.x = (Math.random() - 0.5) * 0.4;
      spike.rotation.z = (Math.random() - 0.5) * 0.4;
      spike.castShadow = true;
      iceGroup.add(spike);
    }
    this.scene.add(iceGroup);

    // 4. Sát thương & làm chậm quái vật
    this.dealDamageAOE(new THREE.Vector3(impactX, impactY, impactZ), 11.5, 80, '❄️ -80 FROZEN!', '#7ed6df', monsters);

    let iceLife = 2.4;
    this.activeEffects.push({
      update: (delta) => {
        iceLife -= delta;
        if (iceLife <= 0.6) {
          iceGroup.scale.multiplyScalar(0.96);
        }
        if (iceLife <= 0) {
          this.scene.remove(iceGroup);
          return false;
        }
        return true;
      }
    });
  }

  // --- KỸ NĂNG 4: ĐỊA CHẤN LONG TRỜI (EARTH STOMP) ---
  castEarthquake(targetPos, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);

    sound.playEarthquake();

    // 1. Tàn phá địa hình mạnh mẽ (Lõm sâu 2.2m, nứt toác đá nẻ)
    this.world.deformTerrain(impactX, impactZ, 13.0, 2.2, 'earth');

    // 2. Hiệu ứng sóng địa chấn Pixel
    this.spawnGroundDecalEffect('earth', new THREE.Vector3(impactX, impactY + 0.12, impactZ), 18, 1.5);

    // 3. Văng các tảng đá vụn low-poly bay tung lên trời
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x574b40, flatShading: true });
    const flyingRocks = [];

    for (let i = 0; i < 14; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.4, 0), rockMat);
      const rx = impactX + (Math.random() - 0.5) * 6;
      const rz = impactZ + (Math.random() - 0.5) * 6;
      rock.position.set(rx, impactY + 0.5, rz);
      this.scene.add(rock);

      flyingRocks.push({
        mesh: rock,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 9,
          6 + Math.random() * 7,
          (Math.random() - 0.5) * 9
        ),
        rotVel: (Math.random() - 0.5) * 8,
      });
    }

    // 4. Sát thương cực lớn
    this.dealDamageAOE(new THREE.Vector3(impactX, impactY, impactZ), 13.5, 170, '💥 -170 SMASH!', '#e67e22', monsters);

    let quakeLife = 1.4;
    this.activeEffects.push({
      update: (delta) => {
        quakeLife -= delta;
        for (const r of flyingRocks) {
          r.mesh.position.addScaledVector(r.vel, delta);
          r.vel.y -= 18 * delta; // Trọng lực mạnh
          r.mesh.rotation.x += r.rotVel * delta;
          r.mesh.rotation.y += r.rotVel * delta;
        }

        if (quakeLife <= 0) {
          for (const r of flyingRocks) {
            this.scene.remove(r.mesh);
          }
          return false;
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

        if (progress >= 1.0) {
          this.scene.remove(mesh);
          return false;
        }
        return true;
      }
    });
  }

  // XỬ LÝ SÁT THƯƠNG DIỆN RỘNG (AOE)
  dealDamageAOE(epicenter, radius, amount, text, textColor, monsters) {
    if (!monsters) return;

    for (const monster of monsters) {
      if (!monster.isDead) {
        const dist = monster.position.distanceTo(epicenter);
        if (dist <= radius + monster.hitRadius) {
          monster.takeDamage(amount, epicenter);
          // Hiển thị số sát thương pixel float
          const hitPos = monster.position.clone();
          hitPos.y += monster.hitHeight * 0.7;
          this.damageTexts.spawn(text, hitPos, textColor);
          this.particles.emitHitSparkles(hitPos, 14);
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
