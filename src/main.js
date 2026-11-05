import * as THREE from 'three';
import { World } from './world.js';
import { Character } from './character.js';
import { ParticleSystem } from './particles.js';
import { ThirdPersonController } from './controller.js';
import { ProjectileSystem } from './projectiles.js';
import { Monster } from './monsters.js';
import { PixelFXManager } from './pixelfx.js';
import { sound } from './audio.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.clock = new THREE.Clock();
    this.monstersDefeated = 0;
    this.prevCooldowns = {};

    // Khí Huyết, Linh Lực & Cảnh Giới Tu Vi
    this.playerHp = 100;
    this.playerMaxHp = 100;
    this.playerMp = 100;
    this.playerMaxMp = 100;
    this.currentRealm = '🌟 Luyện Khí Tầng 1';

    this.initScene();
    this.initLights();
    this.initGameEntities();
    this.initUI();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();

    // Sương mù Tiên Khí Kinh Thành cổ kính
    const skyColor = new THREE.Color(0xdcebf8);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(skyColor, 75, 275);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      450
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
  }

  initLights() {
    // 1. Ánh sáng bầu trời phương Đông & phản xạ mặt đá kinh thành
    const hemiLight = new THREE.HemisphereLight(0xfff5e6, 0x475569, 0.95);
    this.scene.add(hemiLight);

    // 2. Thái Dương Hoàng Kim chiếu rọi góc nghiêng tạo bóng đổ điện ảnh sắc nét
    this.sunLight = new THREE.DirectionalLight(0xffeedb, 1.65);
    this.sunLight.position.set(42, 54, 32);
    this.sunLight.castShadow = true;

    // Tối ưu hóa bộ nhớ shadow map (1024x1024) & bán kính lọc mềm nhẹ mượt
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 170;

    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.024;
    this.sunLight.shadow.radius = 1.0;

    this.scene.add(this.sunLight);

    // 3. Nguồn sáng ngược sắc lam (Sky Rim Fill Light) tạo độ sâu thị giác
    this.skyRimLight = new THREE.DirectionalLight(0x74b9ff, 0.48);
    this.skyRimLight.position.set(-36, 28, -32);
    this.scene.add(this.skyRimLight);

    // 4. Ánh sáng môi trường tổng thể
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.28);
    this.scene.add(ambientLight);
  }

  initGameEntities() {
    // 1. Hệ thống hạt bụi, tia kiếm khí và sóng chấn động
    this.particles = new ParticleSystem(this.scene);

    // 2. Thế giới Kinh Thành Trung Hoa Cổ (Trường An Cổ Đô, Đại Lộ Chu Tước, Tửu Lầu, Đại Điện)
    this.world = new World(this.scene, this.particles);

    // 3. Nhân vật Bé Gấu Tu Tiên mang hồ lô và pháp bảo
    this.character = new Character(this.scene, this.particles);

    // 4. Hệ thống đạn súng Phi Tiên Đạn có vệt sáng & tương tác vật thể
    this.projectiles = new ProjectileSystem(this.scene, this.particles, this.world);

    // 5. Yêu Ma quấy nhiễu các phường thị Kinh Thành Cổ
    this.monsters = [
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(0, 0, 18), this.world),       // Trước Đại Điện Cung Đình
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(-65, 0, 45), this.world),     // Sân Thiên Kiếm Võ Quán (Tây Bắc)
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(70, 0, 45), this.world),      // Khuôn viên Thanh Vân Thư Viện (Đông Bắc)
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(-10, 0, -22), this.world),   // Phố Chợ Cổ Trung Tâm
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(12, 0, -4), this.world),     // Bờ Kênh Trà Quán
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(-24, 0, 10), this.world),    // Trước Tửu Lầu Nguyệt Lai
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(-55, 0, -65), this.world),   // Phố Rèn & Binh Khí (Tây Nam)
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(60, 0, -65), this.world),    // Khu Tơ Lụa & Dược Điếm (Đông Nam)
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(0, 0, -95), this.world),     // Nam Thành Chu Tước Môn
      new Monster(this.scene, this.particles, 'chomper', new THREE.Vector3(0, 0, 95), this.world),      // Bắc Thành Huyền Vũ Môn
    ];

    for (const monster of this.monsters) {
      monster.onDefeated = (m) => {
        this.monstersDefeated++;
        if (this.killBadge) {
          this.killBadge.textContent = `🎯 Trảm Yêu: ${this.monstersDefeated}`;
        }

        // Hồi phục 25 Linh lực khi hấp thụ Linh Phách yêu ma
        this.playerMp = Math.min(this.playerMaxMp, this.playerMp + 25);

        const name = m.type === 'golem' ? 'Thái Cổ Thạch Yêu' : 'Hắc Diễm Linh Thú';
        this.showNotification(`⚔️ Đã trảm sát ${name}! Hấp thụ Linh Phách (+25 Linh Lực)`);

        this.checkRealmBreakthrough();
      };
    }

    // 6. Hệ thống Kỹ Năng Đạo Pháp PixelFX
    this.pixelFX = new PixelFXManager(this.scene, this.world, this.particles);

    // 7. Bộ điều khiển góc nhìn thứ 3 tích hợp Rung lắc Camera (Trauma Shake)
    this.controller = new ThirdPersonController(
      this.camera,
      this.character,
      this.canvas,
      (muzzlePos, shootDir) => {
        this.projectiles.spawnBullet(muzzlePos, shootDir);
      },
      (skillNum, targetPos) => {
        // Kiểm tra tiêu hao Linh Lực (Mana)
        const manaCost = { 1: 15, 2: 20, 3: 20, 4: 25, 5: 35 };
        const cost = manaCost[skillNum] || 15;

        if (this.playerMp < cost) {
          this.showNotification(`⚠️ Linh lực không đủ (${Math.floor(this.playerMp)}/${cost})! Tĩnh tâm hồi khí...`);
          return false;
        }

        const success = this.pixelFX.castSkill(skillNum, targetPos, this.character, this.monsters);
        if (success) {
          this.playerMp -= cost;

          const names = {
            1: 'Xích Viêm Thiên Hỏa ☄️',
            2: 'Cửu Thiên Huyền Lôi ⚡',
            3: 'Huyền Băng Tuyệt Vực ❄️',
            4: 'Hám Địa Thần Thông 🌍',
            5: 'Vạn Kiếm Quy Tông ⚔️'
          };
          this.showNotification(`Thi triển [${names[skillNum]}]! (-${cost} Linh Lực)`);
        }
        return success;
      }
    );

    this.pixelFX.controller = this.controller;
    this.pixelFX.onScreenFlash = (type) => this.triggerScreenFlash(type);

    this.controller.onOutfitChange = (outfitName) => {
      this.showNotification(`Đã hoán đổi tiên bào: ${outfitName}`);
    };

    this.controller.onLockChange = (isLocked) => {
      const lockHint = document.getElementById('lock-hint');
      if (lockHint) {
        if (isLocked) {
          lockHint.classList.add('hidden');
        } else {
          lockHint.classList.remove('hidden');
        }
      }
    };
  }

  // Đột phá Cảnh Giới Tu Vi theo chiến tích
  checkRealmBreakthrough() {
    let newRealm = '🌟 Luyện Khí Tầng 1';
    if (this.monstersDefeated >= 8) newRealm = '⚡ Hóa Thần Tiên Tôn 👑';
    else if (this.monstersDefeated >= 5) newRealm = '✨ Nguyên Anh Chân Nhân';
    else if (this.monstersDefeated >= 3) newRealm = '🔥 Kim Đan Đại Đạo';
    else if (this.monstersDefeated >= 2) newRealm = '🌿 Trúc Cơ Kỳ';
    else if (this.monstersDefeated >= 1) newRealm = '🌱 Luyện Khí Viên Mãn';

    if (newRealm !== this.currentRealm) {
      this.currentRealm = newRealm;
      if (this.realmBadge) {
        this.realmBadge.textContent = newRealm;
      }
      this.triggerScreenFlash('sword');
      this.showNotification(`🎉 CHÚC MỪNG ĐẠO HỮU ĐỘT PHÁ CẢNH GIỚI: [${newRealm}]!`);
    }
  }

  triggerScreenFlash(type) {
    const flashEl = document.getElementById('screen-flash');
    if (!flashEl) return;
    flashEl.className = '';
    void flashEl.offsetWidth; // Buộc trình duyệt reflow CSS
    flashEl.classList.add(`flash-${type}`);
    setTimeout(() => {
      flashEl.className = '';
    }, 450);
  }

  initUI() {
    const enableAudio = () => {
      sound.init();
      sound.startBGM();
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('keydown', enableAudio);
    };
    window.addEventListener('click', enableAudio);
    window.addEventListener('keydown', enableAudio);

    const lockHint = document.getElementById('lock-hint');
    if (lockHint) {
      lockHint.addEventListener('click', () => {
        this.controller.requestLock();
      });
    }

    // Nút Bắn ảo
    const shootBtn = document.getElementById('btn-shoot');
    if (shootBtn) {
      shootBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.controller.triggerShoot();
      });
    }

    // Nút Âm thanh
    const soundBtn = document.getElementById('btn-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.init();
        const isMuted = sound.toggleMute();
        soundBtn.innerHTML = isMuted ? '🔇 Linh Âm: Tắt' : '🔊 Linh Âm: Bật';
        soundBtn.classList.toggle('active', !isMuted);
      });
    }

    // Nút Đổi trang phục
    const outfitBtn = document.getElementById('btn-outfit');
    if (outfitBtn) {
      outfitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = this.character.cycleOutfit();
        this.showNotification(`Đã hoán đổi tiên bào: ${name}`);
      });
    }

    // Nút Nhảy
    const jumpBtn = document.getElementById('btn-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.character.jump();
      });
    }

    // Nút Chụp ảnh lưu niệm
    const photoBtn = document.getElementById('btn-photo');
    if (photoBtn) {
      photoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.takeScreenshot();
      });
    }

    // Nút Toàn màn hình
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Gắn sự kiện click cho các ô kỹ năng trên HUD
    for (let i = 1; i <= 5; i++) {
      const slot = document.getElementById(`skill-slot-${i}`);
      if (slot) {
        slot.addEventListener('click', (e) => {
          e.stopPropagation();
          this.controller.triggerSkill(i);
        });
      }
    }

    // Cập nhật Cooldown trực quan trên thanh kỹ năng HUD
    this.pixelFX.onCooldownUpdate = (cds) => {
      for (const key in cds) {
        const cd = cds[key];
        const prev = this.prevCooldowns[key] || 0;
        const slot = document.getElementById(`skill-slot-${key}`);
        const cdOverlay = document.getElementById(`skill-cd-${key}`);
        const cdText = document.getElementById(`skill-text-${key}`);

        if (slot && cdOverlay && cdText) {
          if (cd.current > 0) {
            slot.classList.add('on-cooldown');
            const ratio = cd.current / cd.max;
            cdOverlay.style.height = `${ratio * 100}%`;
            cdText.textContent = cd.current.toFixed(1) + 's';
          } else {
            slot.classList.remove('on-cooldown');
            cdOverlay.style.height = '0%';
            cdText.textContent = key;

            // Hiệu ứng lóe sáng khi kỹ năng vừa hồi xong
            if (prev > 0) {
              slot.classList.add('skill-ready-flash');
              setTimeout(() => slot.classList.remove('skill-ready-flash'), 500);
            }
          }
        }
        this.prevCooldowns[key] = cd.current;
      }
    };

    // HUD Elements
    this.speedBadge = document.getElementById('hud-speed');
    this.stateBadge = document.getElementById('hud-state');
    this.killBadge = document.getElementById('hud-kills');
    this.realmBadge = document.getElementById('hud-realm');
    this.fpsBadge = document.getElementById('hud-fps');
    this.fps = 60;

    this.barHp = document.getElementById('bar-hp');
    this.textHp = document.getElementById('text-hp');
    this.barMp = document.getElementById('bar-mp');
    this.textMp = document.getElementById('text-mp');
  }

  showNotification(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
      }, 2800);
    }
  }

  takeScreenshot() {
    this.renderer.render(this.scene, this.camera);
    const dataURL = this.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'thanh-van-tien-gioi.png';
    link.href = dataURL;
    link.click();
    this.showNotification('📸 Đã ghi lại Tiên Ảnh vào bảo khố!');
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // Hồi phục Linh Lực tự nhiên (8 linh lực / giây)
    this.playerMp = Math.min(this.playerMaxMp, this.playerMp + delta * 8.0);

    // Cập nhật thanh Khí Huyết & Linh Lực trên HUD
    if (this.barHp && this.textHp) {
      const hpRatio = Math.max(0, this.playerHp / this.playerMaxHp);
      this.barHp.style.width = `${hpRatio * 100}%`;
      this.textHp.textContent = `${Math.round(this.playerHp)}/${this.playerMaxHp}`;
    }
    if (this.barMp && this.textMp) {
      const mpRatio = Math.max(0, this.playerMp / this.playerMaxMp);
      this.barMp.style.width = `${mpRatio * 100}%`;
      this.textMp.textContent = `${Math.round(this.playerMp)}/${this.playerMaxMp}`;
    }

    // 1. Cập nhật nhân vật & điều khiển
    this.controller.update(delta);

    // 2. Cập nhật đạn và va chạm với quái vật
    this.projectiles.update(delta, this.monsters);

    // 3. Cập nhật kỹ năng PixelFX & tàn phá địa hình
    this.pixelFX.update(delta);

    // 4. Cập nhật AI quái vật khổng lồ
    for (const monster of this.monsters) {
      monster.update(delta, this.character.position, this.camera);
    }

    // 5. Di chuyển ánh nắng mặt trời theo nhân vật
    this.sunLight.position.x = this.character.position.x + 35;
    this.sunLight.position.z = this.character.position.z + 30;
    this.sunLight.target.position.copy(this.character.position);
    this.sunLight.target.updateMatrixWorld();

    // 6. Cập nhật thế giới và hiệu ứng
    this.world.update(delta, elapsedTime);
    this.particles.update(delta, this.character.position);

    // 7. Cập nhật HUD & Giám sát FPS thời gian thực
    if (this.fpsBadge) {
      this.fps = THREE.MathUtils.lerp(this.fps, 1 / Math.max(delta, 0.001), 0.06);
      const rounded = Math.round(this.fps);
      this.fpsBadge.textContent = `⚡ ${rounded} FPS`;
      this.fpsBadge.style.color = rounded >= 55 ? '#2ed573' : (rounded >= 35 ? '#ffa502' : '#ff4757');
    }
    if (this.speedBadge) {
      const spdKmh = (this.character.speed * 2.2).toFixed(1);
      this.speedBadge.textContent = `${spdKmh} km/h`;
    }
    if (this.stateBadge) {
      let state = 'Đang Tĩnh Tọa (Idle)';
      if (!this.character.isGrounded) {
        state = 'Đạp Vân Phi Hành 🦘';
      } else if (this.character.isCasting) {
        const skillNames = {
          1: 'Xích Viêm 🔥',
          2: 'Huyền Lôi ⚡',
          3: 'Huyền Băng ❄️',
          4: 'Hám Địa 🌍',
          5: 'Vạn Kiếm ⚔️'
        };
        state = `Thi triển ${skillNames[this.character.castSkill] || 'Thần Thông'} ✨`;
      } else if (this.character.isMoving) {
        state = this.character.isSprinting ? 'Súc Địa Thành Thốn! ⚡' : 'Ngự Phong Hành 🚶';
      }
      this.stateBadge.textContent = state;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
