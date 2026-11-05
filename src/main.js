import * as THREE from 'three';
import { World } from './world.js';
import { Character } from './character.js';
import { ParticleSystem } from './particles.js';
import { ThirdPersonController } from './controller.js';
import { ProjectileSystem } from './projectiles.js';
import { Monster } from './monsters.js';
import { sound } from './audio.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.clock = new THREE.Clock();
    this.monstersDefeated = 0;

    this.initScene();
    this.initLights();
    this.initGameEntities();
    this.initUI();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();

    const skyColor = new THREE.Color(0xd4efff);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(skyColor, 45, 150);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  initLights() {
    const hemiLight = new THREE.HemisphereLight(0xfffae6, 0x76a760, 0.85);
    this.scene.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5d6, 1.4);
    this.sunLight.position.set(40, 60, 30);
    this.sunLight.castShadow = true;

    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 160;

    const d = 45;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;

    this.scene.add(this.sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambientLight);
  }

  initGameEntities() {
    // 1. Hệ thống hạt bụi và sao nổ
    this.particles = new ParticleSystem(this.scene);

    // 2. Thế giới đồng bằng, cây cối, cỏ lay động
    this.world = new World(this.scene);

    // 3. Nhân vật gấu trang bị súng Blaster
    this.character = new Character(this.scene, this.particles);

    // 4. Hệ thống đạn súng
    this.projectiles = new ProjectileSystem(this.scene, this.particles);

    // 5. Quái vật khổng lồ trên đồng bằng
    this.monsters = [
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(26, 0, 22)),
      new Monster(this.scene, this.particles, 'dino', new THREE.Vector3(-28, 0, -20)),
      new Monster(this.scene, this.particles, 'golem', new THREE.Vector3(-18, 0, 32)),
    ];

    // Sự kiện khi hạ gục quái vật
    for (const monster of this.monsters) {
      monster.onDefeated = (m) => {
        this.monstersDefeated++;
        if (this.killBadge) {
          this.killBadge.textContent = `🎯 Hạ gục: ${this.monstersDefeated}`;
        }
        const name = m.type === 'golem' ? 'Người Đá Moss Golem' : 'King Chomper Chibi';
        this.showNotification(`💥 Đã bắn hạ ${name}! (+100 Điểm)`);
      };
    }

    // 6. Bộ điều khiển góc nhìn thứ 3 (Di chuột xoay camera, ESC nhả chuột)
    this.controller = new ThirdPersonController(
      this.camera,
      this.character,
      this.canvas,
      (muzzlePos, shootDir) => {
        this.projectiles.spawnBullet(muzzlePos, shootDir);
      }
    );

    this.controller.onOutfitChange = (outfitName) => {
      this.showNotification(`Đã đổi trang phục: ${outfitName}`);
    };

    // Theo dõi trạng thái khóa chuột để hiển thị Banner
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

  initUI() {
    const enableAudio = () => {
      sound.init();
      sound.startBGM();
      window.removeEventListener('click', enableAudio);
      window.removeEventListener('keydown', enableAudio);
    };
    window.addEventListener('click', enableAudio);
    window.addEventListener('keydown', enableAudio);

    // Bấm vào banner gợi ý khóa chuột để bắt đầu
    const lockHint = document.getElementById('lock-hint');
    if (lockHint) {
      lockHint.addEventListener('click', () => {
        this.controller.requestLock();
      });
    }

    // Nút Bắn ảo cho màn hình cảm ứng / chuột
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
        soundBtn.innerHTML = isMuted ? '🔇 Âm thanh: Tắt' : '🔊 Âm thanh: Bật';
        soundBtn.classList.toggle('active', !isMuted);
      });
    }

    // Nút Đổi trang phục
    const outfitBtn = document.getElementById('btn-outfit');
    if (outfitBtn) {
      outfitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = this.character.cycleOutfit();
        this.showNotification(`Đã đổi trang phục: ${name}`);
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

    // HUD Elements
    this.speedBadge = document.getElementById('hud-speed');
    this.stateBadge = document.getElementById('hud-state');
    this.killBadge = document.getElementById('hud-kills');
  }

  showNotification(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
      }, 2600);
    }
  }

  takeScreenshot() {
    this.renderer.render(this.scene, this.camera);
    const dataURL = this.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'cozy-bear-blaster.png';
    link.href = dataURL;
    link.click();
    this.showNotification('📸 Đã chụp và lưu lại khoảnh khắc!');
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

    // 1. Cập nhật nhân vật & điều khiển
    this.controller.update(delta);

    // 2. Cập nhật đạn và va chạm với quái vật
    this.projectiles.update(delta, this.monsters);

    // 3. Cập nhật AI quái vật khổng lồ
    for (const monster of this.monsters) {
      monster.update(delta, this.character.position, this.camera);
    }

    // 4. Di chuyển ánh nắng mặt trời theo nhân vật
    this.sunLight.position.x = this.character.position.x + 35;
    this.sunLight.position.z = this.character.position.z + 30;
    this.sunLight.target.position.copy(this.character.position);
    this.sunLight.target.updateMatrixWorld();

    // 5. Cập nhật thế giới và hiệu ứng
    this.world.update(delta, elapsedTime);
    this.particles.update(delta, this.character.position);

    // 6. Cập nhật HUD
    if (this.speedBadge) {
      const spdKmh = (this.character.speed * 2.2).toFixed(1);
      this.speedBadge.textContent = `${spdKmh} km/h`;
    }
    if (this.stateBadge) {
      let state = 'Đang nghỉ ngơi (Idle)';
      if (!this.character.isGrounded) {
        state = 'Đang nhảy cao 🦘';
      } else if (this.character.isMoving) {
        state = this.character.isSprinting ? 'Chạy nước rút! ⚡' : 'Đang di chuyển 🚶';
      }
      this.stateBadge.textContent = state;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
