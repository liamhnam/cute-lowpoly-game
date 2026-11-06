import * as THREE from 'three';
import { sound } from './audio.js';
import { getTerrainHeight } from './world.js';
import { createSword } from './sword.js';

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

    // Thời gian hồi chiêu của 5 kiếm chiêu (giây)
    this.cooldowns = {
      1: { current: 0, max: 4.0, name: 'Phi Kiếm Thuật', icon: '🗡️' },
      2: { current: 0, max: 5.0, name: 'Thuấn Bộ Trảm', icon: '💨' },
      3: { current: 0, max: 10.0, name: 'Kiếm Trận Hộ Thể', icon: '🌀' },
      4: { current: 0, max: 7.0, name: 'Thiên Kiếm Lạc', icon: '🌧️' },
      5: { current: 0, max: 9.0, name: 'Vạn Kiếm Quy Tông', icon: '⚔️' },
      // Tuyệt kỹ Kiếm Nộ: hồi chiêu bằng thời gian kiếm trận còn hoạt động
      6: { current: 0, max: 10.0, name: 'Đại Canh Kiếm Trận', icon: '⚡' },
    };

    this.onCooldownUpdate = null;
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
        this.castFlyingSword(targetPos, character, monsters);
        break;
      case 2:
        this.castBlinkSlash(targetPos, character, monsters);
        break;
      case 3:
        this.castSwordBarrier(character, monsters);
        break;
      case 4:
        this.castSwordRain(targetPos, monsters);
        break;
      case 5:
        this.castWanJianGuiZong(targetPos, monsters);
        break;
      case 6:
        this.castDaiCanhSwordArray(character, monsters);
        break;
    }

    return true;
  }

  // Gây sát thương lên một con quái kèm số sát thương nhảy lên
  damageMonster(monster, amount, text, textColor, sourcePos) {
    monster.takeDamage(amount, sourcePos);
    const hitPos = monster.position.clone();
    hitPos.y += monster.hitHeight * 0.7;
    this.damageTexts.spawn(text, hitPos, textColor);
    if (this.particles) this.particles.emitHitSparkles(hitPos, 10);
  }

  // Hướng ngang từ from tới to (dùng hướng mặc định nếu trùng điểm)
  static flatDirection(from, to) {
    const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
    return dir.lengthSq() > 0.0001 ? dir.normalize() : new THREE.Vector3(0, 0, -1);
  }

  // --- KIẾM CHIÊU 1: PHI KIẾM THUẬT ---
  // Phóng tiên kiếm bay thẳng xuyên qua quái, hết tầm thì quay về tay và xuyên thêm lần nữa
  castFlyingSword(targetPos, character, monsters) {
    const dir = PixelFXManager.flatDirection(character.position, targetPos);
    const sword = createSword(1.6);
    sword.visible = false;
    this.scene.add(sword);

    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    let elapsed = 0;
    let phase = 'windup'; // windup → out → back
    let hitSet = new Set();

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        if (phase === 'windup') {
          if (elapsed < 0.18) return true;
          phase = 'out';
          elapsed = 0;
          character.setSwordThrown(true);
          pos.copy(character.position).add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(dir, 0.8);
          sword.visible = true;
          sound.playSwordSlash();
        }

        let moveDir;
        let damage;
        if (phase === 'out') {
          moveDir = dir;
          damage = 60;
          pos.addScaledVector(dir, 36 * delta);
          if (elapsed >= 0.6) {
            phase = 'back';
            hitSet = new Set();
          }
        } else {
          const home = character.position.clone().add(new THREE.Vector3(0, 1.2, 0));
          moveDir = home.clone().sub(pos);
          const dist = moveDir.length();
          moveDir.normalize();
          damage = 40;
          if (dist < 1.2 || elapsed > 3.0) {
            this.scene.remove(sword);
            character.setSwordThrown(false);
            if (this.particles) this.particles.emitElementalParticles(home, 10, [0x1dd1a1, 0xffffff], [1, 3], 0.3, 0, 0.4);
            return false;
          }
          pos.addScaledVector(moveDir, Math.min(dist, 40 * delta));
        }

        // Mũi kiếm hướng theo đường bay, rung nhẹ như kiếm có linh tính
        sword.position.copy(pos);
        sword.quaternion.setFromUnitVectors(up, moveDir);
        sword.rotateY(Math.sin(elapsed * 30) * 0.3);

        if (this.particles && Math.random() < 0.7) {
          this.particles.emitElementalParticles(pos, 1, [0x1dd1a1, 0x7bed9f, 0xffffff], [0.2, 0.8], 0.3, 0, 0.4);
        }

        for (const monster of monsters) {
          if (monster.isDead || hitSet.has(monster)) continue;
          if (monster.checkCollision(pos, 1.2)) {
            hitSet.add(monster);
            this.damageMonster(monster, damage, `🗡️ -${damage}`, '#1dd1a1', pos);
            sound.playHit();
            if (this.controller) this.controller.addTrauma(0.05);
          }
        }
        return true;
      }
    });
  }

  // --- KIẾM CHIÊU 2: THUẤN BỘ TRẢM ---
  // Lướt chớp nhoáng 10m chém xuyên mọi quái trên đường, sau đó kiếm ngân nổ thêm một đợt
  castBlinkSlash(targetPos, character, monsters) {
    const dir = PixelFXManager.flatDirection(character.position, targetPos);
    const dashDuration = 0.22;
    const dashDistance = 10;
    const start = character.position.clone();
    character.startDash(dir, dashDistance, dashDuration);
    sound.playSwordSlash();
    if (this.onScreenFlash) this.onScreenFlash('sword');

    // Vệt kiếm quang thẳng tắp nối điểm đầu và điểm cuối
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0x7efff5,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const streak = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, dashDistance), streakMat);
    streak.position.copy(start).addScaledVector(dir, dashDistance / 2);
    streak.position.y += 1.0;
    streak.rotation.y = Math.atan2(dir.x, dir.z);
    streak.scale.z = 0.01;
    this.scene.add(streak);

    const hitMonsters = [];
    let elapsed = 0;
    let echoed = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        if (elapsed <= dashDuration + 0.02) {
          // Vệt kiếm kéo dài theo bước lướt, bóng ảnh để lại hạt ngọc
          streak.scale.z = Math.min(1, elapsed / dashDuration);
          streak.position.copy(start).addScaledVector(dir, (dashDistance * streak.scale.z) / 2);
          streak.position.y += 1.0;
          if (this.particles) {
            this.particles.emitElementalParticles(character.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 3, [0x7efff5, 0x1dd1a1, 0xffffff], [0.5, 2], 0.35, 0, 0.5);
          }

          for (const monster of monsters) {
            if (monster.isDead || hitMonsters.includes(monster)) continue;
            const d = Math.hypot(monster.position.x - character.position.x, monster.position.z - character.position.z);
            if (d <= monster.hitRadius + 1.4) {
              hitMonsters.push(monster);
              this.damageMonster(monster, 70, '💨 -70', '#7efff5', character.position);
              sound.playHit();
            }
          }
        } else {
          streakMat.opacity = Math.max(0, 0.9 - (elapsed - dashDuration) * 1.6);
        }

        // Kiếm ngân: đợt nổ trễ trên mọi quái vừa bị chém qua
        if (!echoed && elapsed >= dashDuration + 0.35) {
          echoed = true;
          if (hitMonsters.length > 0) {
            sound.playSwordSlash();
            if (this.controller) this.controller.addTrauma(0.25);
          }
          for (const monster of hitMonsters) {
            if (monster.isDead) continue;
            const p = monster.position.clone();
            p.y += 1.5;
            this.particles.emitShockwave(p, 0x7efff5, 4.0, 0.3);
            this.particles.emitElementalParticles(p, 14, [0x7efff5, 0xffffff], [3, 7], 0.4, 0, 0.6);
            this.damageMonster(monster, 40, '✦ -40 KIẾM NGÂN', '#ffffff', p);
          }
        }

        if (elapsed >= dashDuration + 0.6) {
          this.scene.remove(streak);
          streak.geometry.dispose();
          streakMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // --- KIẾM CHIÊU 3: KIẾM TRẬN HỘ THỂ ---
  // 6 thanh kiếm xoay quanh người 6 giây cắt mọi quái áp sát, hết giờ thì bắn tung ra bốn phía
  castSwordBarrier(character, monsters) {
    const count = 6;
    const radius = 2.4;
    const duration = 6.0;
    const up = new THREE.Vector3(0, 1, 0);
    const swords = [];

    for (let i = 0; i < count; i++) {
      const sword = createSword(1.1);
      this.scene.add(sword);
      swords.push({ mesh: sword, launched: false, dir: new THREE.Vector3(), hitSet: new Set() });
    }

    // Vòng trận pháp dưới chân
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7bed9f,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringGeo = new THREE.RingGeometry(radius - 0.12, radius + 0.12, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.scene.add(ring);

    sound.playSwordSummon();

    let elapsed = 0;
    let tickTimer = 0;
    let burst = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const center = character.position;

        if (elapsed < duration) {
          // Kiếm xoay vòng, mũi chĩa ra ngoài
          for (let i = 0; i < count; i++) {
            const angle = elapsed * 3.2 + (i / count) * Math.PI * 2;
            const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            const s = swords[i].mesh;
            s.position.set(center.x + out.x * radius, center.y + 1.0 + Math.sin(elapsed * 4 + i) * 0.15, center.z + out.z * radius);
            s.quaternion.setFromUnitVectors(up, out);
          }
          ring.position.set(center.x, center.y + 0.06, center.z);
          ring.rotation.y = -elapsed * 1.5;
          ringMat.opacity = 0.35 + Math.sin(elapsed * 6) * 0.15;

          // Mỗi 0.4s cắt mọi quái lọt vào vòng kiếm
          tickTimer -= delta;
          if (tickTimer <= 0) {
            tickTimer = 0.4;
            for (const monster of monsters) {
              if (monster.isDead) continue;
              const d = Math.hypot(monster.position.x - center.x, monster.position.z - center.z);
              if (d <= radius + monster.hitRadius + 0.4) {
                this.damageMonster(monster, 15, '🌀 -15', '#7bed9f', center);
                sound.playHit();
              }
            }
          }
          return true;
        }

        // Hết thời gian: kiếm bắn tung ra bốn phía
        if (!burst) {
          burst = true;
          this.scene.remove(ring);
          ringGeo.dispose();
          ringMat.dispose();
          sound.playSwordSlash();
          if (this.controller) this.controller.addTrauma(0.2);
          for (const s of swords) {
            s.dir.set(s.mesh.position.x - center.x, 0, s.mesh.position.z - center.z).normalize();
          }
        }

        for (const s of swords) {
          s.mesh.position.addScaledVector(s.dir, 30 * delta);
          for (const monster of monsters) {
            if (monster.isDead || s.hitSet.has(monster)) continue;
            if (monster.checkCollision(s.mesh.position, 1.0)) {
              s.hitSet.add(monster);
              this.damageMonster(monster, 35, '🌀 -35', '#7bed9f', s.mesh.position);
            }
          }
          if (this.particles && Math.random() < 0.5) {
            this.particles.emitElementalParticles(s.mesh.position, 1, [0x7bed9f, 0xffffff], [0.2, 0.8], 0.25, 0, 0.35);
          }
        }

        if (elapsed >= duration + 0.5) {
          for (const s of swords) this.scene.remove(s.mesh);
          return false;
        }
        return true;
      }
    });
  }

  // --- KIẾM CHIÊU 4: THIÊN KIẾM LẠC ---
  // Mưa kiếm trút xuống vùng mục tiêu, cuối cùng kiếm khí trấn áp đóng băng yêu ma
  castSwordRain(targetPos, monsters) {
    const cx = targetPos.x;
    const cz = targetPos.z;
    const cy = getTerrainHeight(cx, cz);
    const center = new THREE.Vector3(cx, cy, cz);
    const areaRadius = 7.5;
    const swordCount = 28;

    this.spawnTelegraph(center, 0x48dbfb, 2.8, areaRadius);

    const swords = [];
    for (let i = 0; i < swordCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * areaRadius;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      swords.push({
        mesh: null,
        target: new THREE.Vector3(x, getTerrainHeight(x, z), z),
        delay: 0.5 + (i / swordCount) * 2.0,
        state: 'waiting', // waiting → falling → embedded
        embedLife: 0.6,
      });
    }

    let elapsed = 0;
    let sealed = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        let alive = false;

        for (const s of swords) {
          if (s.state === 'waiting') {
            alive = true;
            if (elapsed < s.delay) continue;
            s.mesh = createSword(1.5);
            s.mesh.rotation.x = Math.PI; // Mũi kiếm chĩa xuống đất
            s.mesh.position.set(s.target.x, s.target.y + 16, s.target.z);
            this.scene.add(s.mesh);
            s.state = 'falling';
          } else if (s.state === 'falling') {
            alive = true;
            s.mesh.position.y -= 42 * delta;
            if (this.particles && Math.random() < 0.3) {
              this.particles.emitElementalParticles(s.mesh.position, 1, [0x48dbfb, 0xffffff], [0.2, 0.8], 0.25, 0, 0.35);
            }
            if (s.mesh.position.y <= s.target.y + 0.9) {
              s.mesh.position.y = s.target.y + 0.9;
              s.state = 'embedded';
              sound.playSwordSlash();
              this.particles.emitHitSparkles(s.target, 6);
              this.particles.emitShockwave(s.target, 0x48dbfb, 2.4, 0.2);
              for (const monster of monsters) {
                if (monster.isDead) continue;
                const d = Math.hypot(monster.position.x - s.target.x, monster.position.z - s.target.z);
                if (d <= monster.hitRadius + 2.0) {
                  this.damageMonster(monster, 20, '🌧️ -20', '#48dbfb', s.target);
                }
              }
            }
          } else if (s.state === 'embedded') {
            s.embedLife -= delta;
            if (s.embedLife < 0.25) s.mesh.scale.multiplyScalar(0.9);
            if (s.embedLife <= 0) {
              this.scene.remove(s.mesh);
              s.state = 'done';
            } else {
              alive = true;
            }
          }
        }

        // Kiếm khí trấn áp toàn vùng sau đợt kiếm cuối
        if (!sealed && elapsed >= 2.8) {
          sealed = true;
          if (this.onScreenFlash) this.onScreenFlash('sword');
          if (this.controller) this.controller.addTrauma(0.4);
          this.particles.emitShockwave(center, 0x48dbfb, areaRadius * 1.6, 0.6);
          this.particles.emitElementalParticles(center, 30, [0x48dbfb, 0xffffff, 0x7efff5], [4, 10], 0.7, 4, 1.0);
          this.dealDamageAOE(center, areaRadius, 40, '❄️ -40 TRẤN ÁP', '#48dbfb', monsters, 'freeze', 'ice');
        }

        return alive || !sealed;
      }
    });
  }

  // --- TUYỆT KỸ KIẾM NỘ: ĐẠI CANH KIẾM TRẬN ---
  // 36 lôi kiếm xoáy vòng liên tục quanh người suốt 10 giây như cơn lốc kiếm.
  // Bán kính quỹ đạo mỗi thanh co giãn từ 3m tới 30m để quét kín cả vùng, kiếm quét trúng quái là gây sát thương.
  castDaiCanhSwordArray(character, monsters) {
    const SWORD_COUNT = 36;
    const RANGE = 30;
    const MIN_RADIUS = 3;
    const DURATION = 10;
    const ORBIT_SPEED = 22; // tốc độ dài trên quỹ đạo (m/s)
    const MAX_SPIN = 4;     // giới hạn tốc độ góc khi kiếm ở gần tâm (rad/s)
    const INTRO = 0.6;      // thời gian kiếm bung từ người ra quỹ đạo
    const DAMAGE = 18;
    const HIT_INTERVAL = 0.5; // một thanh kiếm chém lại cùng một con sau ít nhất 0.5s
    const TRAIL_POINTS = 14;
    const up = new THREE.Vector3(0, 1, 0);

    sound.playSwordSummon();
    if (this.onScreenFlash) this.onScreenFlash('lightning');
    if (this.controller) this.controller.addTrauma(0.5);
    this.spawnTelegraph(character.position.clone(), 0xa29bfe, 1.2, RANGE);

    // Vòng ranh giới kiếm trận 30m đi theo người
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0xa29bfe,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const borderGeo = new THREE.RingGeometry(RANGE - 0.5, RANGE, 96);
    borderGeo.rotateX(-Math.PI / 2);
    const border = new THREE.Mesh(borderGeo, borderMat);
    this.scene.add(border);

    // Vệt sét: hai sợi lập loè (lõi trắng + viền tím) bám theo lịch sử vị trí kiếm
    const coreMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const glowMat = new THREE.LineBasicMaterial({ color: 0x8c7ae6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const makeStrand = (mat) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
      geo.setDrawRange(0, 0);
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.scene.add(line);
      return line;
    };

    const swords = [];
    for (let i = 0; i < SWORD_COUNT; i++) {
      const angle = (i / SWORD_COUNT) * Math.PI * 2;
      const mesh = createSword(1.3);
      mesh.position.copy(character.position);
      mesh.position.y += 1.5;
      this.scene.add(mesh);
      swords.push({
        mesh,
        vel: new THREE.Vector3(),
        angle,
        // Mỗi thanh co giãn bán kính với nhịp và pha riêng để luôn có kiếm ở mọi khoảng cách
        breathe: 0.45 + Math.random() * 0.35,
        radiusPhase: (i * 2.399) % (Math.PI * 2), // góc vàng: rải đều pha giữa các thanh
        hitTimers: new Map(),
        history: [],
        strands: [makeStrand(coreMat), makeStrand(glowMat)],
      });
    }

    const updateTrail = (s) => {
      s.history.unshift(s.mesh.position.clone());
      if (s.history.length > TRAIL_POINTS) s.history.pop();
      for (let k = 0; k < s.strands.length; k++) {
        const attr = s.strands[k].geometry.attributes.position;
        for (let j = 0; j < s.history.length; j++) {
          // Đuôi càng xa càng giật mạnh tạo hình tia sét zigzag
          const amp = j === 0 ? 0 : (0.12 + (j / TRAIL_POINTS) * 0.45) * (k === 0 ? 0.6 : 1.0);
          const p = s.history[j];
          attr.setXYZ(j, p.x + (Math.random() - 0.5) * amp, p.y + (Math.random() - 0.5) * amp, p.z + (Math.random() - 0.5) * amp);
        }
        attr.needsUpdate = true;
        s.strands[k].geometry.setDrawRange(0, s.history.length);
      }
    };

    let elapsed = 0;
    let lastHitSound = -1;
    const prevPos = new THREE.Vector3();

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const center = character.position;
        border.position.set(center.x, center.y + 0.1, center.z);
        borderMat.opacity = 0.2 + Math.sin(elapsed * 8) * 0.08;

        // Hết giờ: lôi kiếm vút lên trời tan biến
        if (elapsed >= DURATION) {
          const t = elapsed - DURATION;
          for (const s of swords) {
            s.vel.lerp(new THREE.Vector3(0, 40, 0), Math.min(1, delta * 6));
            s.mesh.position.addScaledVector(s.vel, delta);
            s.mesh.quaternion.setFromUnitVectors(up, s.vel.clone().normalize());
            s.mesh.scale.multiplyScalar(0.94);
            updateTrail(s);
          }
          coreMat.opacity = glowMat.opacity = Math.max(0, 0.9 - t * 1.5);
          if (t >= 0.6) {
            for (const s of swords) {
              this.scene.remove(s.mesh);
              for (const line of s.strands) {
                this.scene.remove(line);
                line.geometry.dispose();
              }
            }
            coreMat.dispose();
            glowMat.dispose();
            this.scene.remove(border);
            borderGeo.dispose();
            borderMat.dispose();
            return false;
          }
          return true;
        }

        for (let i = 0; i < swords.length; i++) {
          const s = swords[i];
          for (const [m, timer] of s.hitTimers) s.hitTimers.set(m, timer - delta);

          // Bán kính quỹ đạo co giãn giữa MIN_RADIUS và RANGE; lúc mở chiêu thì bung dần từ người ra
          let radius = MIN_RADIUS + (RANGE - MIN_RADIUS) * (0.5 - 0.5 * Math.cos(s.breathe * elapsed + s.radiusPhase));
          if (elapsed < INTRO) radius = THREE.MathUtils.lerp(1.0, radius, elapsed / INTRO);

          // Xoáy cùng chiều, tốc độ dài gần như đều nên kiếm ở xa không bị chậm
          s.angle += Math.min(MAX_SPIN, ORBIT_SPEED / Math.max(radius, 1)) * delta;

          prevPos.copy(s.mesh.position);
          const x = center.x + Math.cos(s.angle) * radius;
          const z = center.z + Math.sin(s.angle) * radius;
          // Bay nhấp nhô ngang tầm thân quái, không cắm xuống đất
          const y = Math.max(getTerrainHeight(x, z) + 0.6, center.y + 1.8 + Math.sin(elapsed * 2.2 + i * 0.7) * 1.2);
          s.mesh.position.set(x, y, z);

          // Mũi kiếm hướng theo chiều bay
          s.vel.subVectors(s.mesh.position, prevPos).divideScalar(Math.max(delta, 0.001));
          if (s.vel.lengthSq() > 0.0001) s.mesh.quaternion.setFromUnitVectors(up, s.vel.clone().normalize());
          updateTrail(s);

          if (this.particles && Math.random() < 0.15) {
            this.particles.emitElementalParticles(s.mesh.position, 1, [0xa29bfe, 0xffffff, 0x74b9ff], [0.3, 1.2], 0.2, 0, 0.3);
          }

          for (const monster of monsters) {
            if (monster.isDead || (s.hitTimers.get(monster) || 0) > 0) continue;
            if (monster.checkCollision(s.mesh.position, 0.9)) {
              s.hitTimers.set(monster, HIT_INTERVAL);
              this.damageMonster(monster, DAMAGE, `⚡ -${DAMAGE}`, '#a29bfe', s.mesh.position);
              if (this.particles) this.particles.emitShockwave(s.mesh.position, 0xa29bfe, 2.2, 0.2);
              if (elapsed - lastHitSound > 0.07) {
                lastHitSound = elapsed;
                sound.playSwordSlash();
                if (this.controller) this.controller.addTrauma(0.03);
              }
            }
          }
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

    // 2. Tiên kiếm ngọc bích dùng chung (dài ~2.4 đơn vị ở scale 1, như kiếm trận cũ)
    const createSwordMesh = (scale = 1.0) => createSword(scale * 1.9);

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
  dealDamageAOE(epicenter, radius, amount, text, textColor, monsters, statusEffect = null, elementType = 'neutral') {
    // 1. Tương tác với Vật thể môi trường (Làm văng, gãy cây, bể đá, bung hàng rào, nát hoa cỏ)
    if (this.world && this.world.interactWithArea) {
      const force = amount >= 150 ? 24 : (amount >= 120 ? 19 : 14);
      this.world.interactWithArea(epicenter, radius * 1.15, force, elementType);
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
