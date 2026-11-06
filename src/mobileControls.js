import * as THREE from 'three';
import { sound } from './audio.js';

/**
 * MobileControlsManager
 * Quản lý Cần Gạt Ảo Bát Quái, Vùng Vuốt Xoay Camera 3D, Cụm Nút Chiến Đấu
 * & Thanh Kỹ Năng Đạo Pháp tối ưu tuyệt đối cho thiết bị di động (iOS / Android / Tablet).
 */
export class MobileControlsManager {
  constructor(game, controller, character, pixelFX) {
    this.game = game;
    this.controller = controller;
    this.character = character;
    this.pixelFX = pixelFX;

    // Nhận diện thiết bị di động / cảm ứng
    this.isTouchDevice = (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );

    this.isEnabled = this.isTouchDevice;

    // Trạng thái Joystick
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickPos = { x: 0, y: 0 };
    this.joystickVector = new THREE.Vector2(0, 0);
    this.maxJoystickRadius = 52;
    this.isSprinting = false;

    // Trạng thái Camera Touch Look
    this.cameraTouchId = null;
    this.cameraTouchPrev = { x: 0, y: 0 };
    this.pinchTouchIds = null;
    this.pinchStartDist = 0;

    // Trạng thái Auto-fire cho nút Pháp Kích khi giữ ngón tay
    this.isShootingHeld = false;

    // DOM Elements
    this.container = null;
    this.joystickZone = null;
    this.joystickBase = null;
    this.joystickThumb = null;
    this.sprintTag = null;
    this.cameraZone = null;

    this.init();
  }

  init() {
    this.createMobileDOMElements();
    this.bindJoystickEvents();
    this.bindCameraTouchEvents();
    this.bindActionButtons();
    this.bindSkillSlotsTouch();
    this.setupOrientationHandler();

    // Cập nhật class trên document.body
    this.updateVisibility();
  }

  // Tạo toàn bộ cấu trúc giao diện mobile phong cách Cổ Phong Bát Quái
  createMobileDOMElements() {
    const container = document.createElement('div');
    container.id = 'mobile-controls-root';
    container.className = 'mobile-controls-root';

    container.innerHTML = `
      <!-- VÙNG CẦN GẠT ẢO BÁT QUÁI (GÓC DƯỚI BÊN TRÁI, KHÔNG PHỦ KHU VỰC SKILL) -->
      <div id="mobile-joystick-touchzone" class="mobile-touchzone joystick-touchzone">
        <div id="mobile-joystick-base" class="joystick-base">
          <div class="joystick-bagua-ring"></div>
          <div class="joystick-notch notch-n"></div>
          <div class="joystick-notch notch-s"></div>
          <div class="joystick-notch notch-e"></div>
          <div class="joystick-notch notch-w"></div>
          <div class="joystick-notch notch-ne"></div>
          <div class="joystick-notch notch-nw"></div>
          <div class="joystick-notch notch-se"></div>
          <div class="joystick-notch notch-sw"></div>
          <div id="mobile-joystick-thumb" class="joystick-thumb">
            <div class="thumb-core">☯</div>
          </div>
          <div id="mobile-sprint-tag" class="sprint-tag">SÚC ĐỊA ⚡</div>
        </div>
      </div>

      <!-- VÙNG VUỐT XOAY CAMERA 3D (GÓC TRÊN BÊN PHẢI) -->
      <div id="mobile-camera-touchzone" class="mobile-touchzone camera-touchzone">
      </div>

      <!-- CỤM NÚT HÀNH ĐỘNG DI ĐỘNG PHONG CÁCH TIÊN BẢO (GÓC DƯỚI BÊN PHẢI) -->
      <div id="mobile-action-cluster" class="mobile-action-cluster">
        <!-- Nút Đổi Tiên Bào (Hoán Y) -->
        <button id="btn-m-outfit" class="m-btn m-btn-sm btn-outfit" title="Hoán Y">
          <span class="m-icon">🎨</span>
          <span class="m-label">Y PHỤC</span>
        </button>

        <!-- Nút Lướt / Súc Địa Thành Thốn -->
        <button id="btn-m-sprint" class="m-btn m-btn-md btn-sprint" title="Súc Địa Thành Thốn">
          <span class="m-icon">⚡</span>
          <span class="m-label">SÚC ĐỊA</span>
        </button>

        <!-- Nút Đạp Vân (Nhảy) -->
        <button id="btn-m-jump" class="m-btn m-btn-lg btn-jump" title="Đạp Vân Phi Hành">
          <span class="m-icon">🦘</span>
          <span class="m-label">ĐẠP VÂN</span>
        </button>

        <!-- Nút Pháp Kích Chính (Tấn công thường / Chém kiếm & kiếm khí) -->
        <button id="btn-m-shoot" class="m-btn m-btn-xl btn-shoot" title="Kiếm Pháp (Nhấn: chém · Giữ rồi thả: phóng kiếm khí)">
          <div class="shoot-ripple"></div>
          <span class="m-icon">⚔️</span>
          <span class="m-label">PHÁP KÍCH</span>
        </button>
      </div>

      <!-- BANNER GỢI Ý XOAY NGANG MÀN HÌNH (CHO THIẾT BỊ DỌC) -->
      <div id="mobile-orientation-banner" class="mobile-orientation-banner">
        <div class="orientation-content">
          <span class="rotate-icon">🔄</span>
          <span>Xoay ngang màn hình (Landscape) để góc nhìn kinh thành bao la & chơi đã nhất!</span>
          <button id="btn-close-orientation" class="btn-close-banner">✕</button>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    this.container = container;
    this.joystickZone = document.getElementById('mobile-joystick-touchzone');
    this.joystickBase = document.getElementById('mobile-joystick-base');
    this.joystickThumb = document.getElementById('mobile-joystick-thumb');
    this.sprintTag = document.getElementById('mobile-sprint-tag');
    this.cameraZone = document.getElementById('mobile-camera-touchzone');
  }

  // Xử lý sự kiện Cần gạt ảo (Touch Joystick)
  bindJoystickEvents() {
    if (!this.joystickZone) return;

    const onTouchStart = (e) => {
      if (!this.isEnabled) return;

      // Kiểm tra nếu điểm chạm trúng Skill Bar hoặc các nút bấm thì nhường quyền
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el && (el.closest('.skill-bar-container') || el.closest('.skill-slot') || el.closest('.m-btn') || el.closest('.action-btn'))) {
          return;
        }
      }

      e.preventDefault();
      e.stopPropagation();

      // Chỉ bắt touch đầu tiên chạm vào vùng joystick
      if (this.joystickTouchId === null && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        this.joystickTouchId = touch.identifier;
        this.joystickActive = true;

        const touchX = touch.clientX;
        const touchY = touch.clientY;

        this.joystickCenter = { x: touchX, y: touchY };
        this.joystickPos = { x: touchX, y: touchY };

        // Đặt vị trí base ngay tại chỗ ngón tay chạm xuống
        this.joystickBase.style.left = `${touchX}px`;
        this.joystickBase.style.top = `${touchY}px`;
        this.joystickBase.classList.add('active');
        this.joystickThumb.style.transform = 'translate(-50%, -50%)';

        this.triggerHaptic(10);
      }
    };

    const onTouchMove = (e) => {
      if (!this.isEnabled || !this.joystickActive) return;
      e.preventDefault();
      e.stopPropagation();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          const dx = touch.clientX - this.joystickCenter.x;
          const dy = touch.clientY - this.joystickCenter.y;
          const dist = Math.hypot(dx, dy);

          const clampedDist = Math.min(dist, this.maxJoystickRadius);
          const angle = Math.atan2(dy, dx);

          const thumbX = Math.cos(angle) * clampedDist;
          const thumbY = Math.sin(angle) * clampedDist;

          this.joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;

          // Chuẩn hóa vector di chuyển (-1 đến +1)
          const normX = thumbX / this.maxJoystickRadius;
          const normY = -thumbY / this.maxJoystickRadius;

          this.joystickVector.set(normX, normY);

          // Tự kích hoạt Súc Địa (Sprint) khi đẩy hết hành trình cần gạt (> 78%)
          const distRatio = clampedDist / this.maxJoystickRadius;
          const shouldSprint = distRatio > 0.78;
          if (shouldSprint !== this.isSprinting) {
            this.isSprinting = shouldSprint;
            this.joystickBase.classList.toggle('sprinting', shouldSprint);
            if (shouldSprint) this.triggerHaptic(15);
          }

          // Truyền vector sang ThirdPersonController
          this.controller.setJoystickInput(normX, normY, this.isSprinting);
          break;
        }
      }
    };

    const onTouchEnd = (e) => {
      if (!this.isEnabled) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          this.resetJoystick();
          break;
        }
      }
    };

    this.joystickZone.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  resetJoystick() {
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.isSprinting = false;
    this.joystickVector.set(0, 0);

    if (this.joystickBase) {
      this.joystickBase.classList.remove('active', 'sprinting');
      this.joystickThumb.style.transform = 'translate(-50%, -50%)';
      this.joystickBase.style.left = '';
      this.joystickBase.style.top = '';
    }

    if (this.controller) {
      this.controller.setJoystickInput(0, 0, false);
    }
  }

  // Xử lý Vuốt Xoay Camera 3D (Dual-touch / Multi-touch)
  bindCameraTouchEvents() {
    if (!this.cameraZone) return;

    const onTouchStart = (e) => {
      if (!this.isEnabled) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Kiểm tra nếu chạm vào thanh kỹ năng hoặc nút bấm thì bỏ qua
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el && (el.closest('.skill-bar-container') || el.closest('.skill-slot') || el.closest('.m-btn') || el.closest('.action-btn'))) {
          continue;
        }

        e.preventDefault();

        if (this.cameraTouchId === null) {
          // Ngón đầu tiên trong vùng camera
          this.cameraTouchId = touch.identifier;
          this.cameraTouchPrev = { x: touch.clientX, y: touch.clientY };
        } else if (this.pinchTouchIds === null) {
          // Ngón thứ hai bắt đầu pinch zoom
          this.pinchTouchIds = [this.cameraTouchId, touch.identifier];
          const touch1 = Array.from(e.touches).find(t => t.identifier === this.cameraTouchId);
          if (touch1) {
            this.pinchStartDist = Math.hypot(
              touch1.clientX - touch.clientX,
              touch1.clientY - touch.clientY
            );
          }
        }
      }
    };

    const onTouchMove = (e) => {
      if (!this.isEnabled) return;
      e.preventDefault();

      // Nếu đang pinch 2 ngón để zoom xa gần
      if (this.pinchTouchIds && e.touches.length >= 2) {
        const t1 = Array.from(e.touches).find(t => t.identifier === this.pinchTouchIds[0]);
        const t2 = Array.from(e.touches).find(t => t.identifier === this.pinchTouchIds[1]);

        if (t1 && t2) {
          const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const diff = this.pinchStartDist - dist;
          if (this.controller) {
            this.controller.zoomCamera(diff * 0.015);
          }
          this.pinchStartDist = dist;
          return;
        }
      }

      // Xoay góc nhìn 1 ngón tay (Yaw & Pitch)
      if (this.cameraTouchId !== null) {
        const touch = Array.from(e.touches).find(t => t.identifier === this.cameraTouchId);
        if (touch) {
          const deltaX = touch.clientX - this.cameraTouchPrev.x;
          const deltaY = touch.clientY - this.cameraTouchPrev.y;

          const sensitivity = 0.0055;
          if (this.controller) {
            this.controller.rotateCamera(-deltaX * sensitivity, deltaY * sensitivity);
          }

          this.cameraTouchPrev = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const onTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.cameraTouchId) {
          this.cameraTouchId = null;
        }
        if (this.pinchTouchIds && this.pinchTouchIds.includes(touch.identifier)) {
          this.pinchTouchIds = null;
        }
      }
    };

    this.cameraZone.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  // Gắn sự kiện các nút hành động (Pháp Kích, Đạp Vân, Súc Địa, Hoán Y)
  bindActionButtons() {
    const shootBtn = document.getElementById('btn-m-shoot');
    const jumpBtn = document.getElementById('btn-m-jump');
    const sprintBtn = document.getElementById('btn-m-sprint');
    const outfitBtn = document.getElementById('btn-m-outfit');

    // 1. Nút Pháp Kích (Nhấn: chém · Giữ rồi thả: phóng kiếm khí tụ lực)
    if (shootBtn) {
      const startShooting = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerHaptic(18);
        shootBtn.classList.add('pressed');

        if (this.controller) {
          this.controller.beginAttackHold();
        }
      };

      const stopShooting = (e) => {
        e.preventDefault();
        e.stopPropagation();
        shootBtn.classList.remove('pressed');
        if (this.controller) {
          this.controller.releaseAttackHold();
        }
      };

      shootBtn.addEventListener('touchstart', startShooting, { passive: false });
      shootBtn.addEventListener('touchend', stopShooting, { passive: false });
      shootBtn.addEventListener('touchcancel', stopShooting, { passive: false });
      shootBtn.addEventListener('mousedown', startShooting);
      shootBtn.addEventListener('mouseup', stopShooting);
      shootBtn.addEventListener('mouseleave', stopShooting);
    }

    // 2. Nút Đạp Vân (Nhảy)
    if (jumpBtn) {
      const triggerJump = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerHaptic(20);
        jumpBtn.classList.add('pressed');
        setTimeout(() => jumpBtn.classList.remove('pressed'), 180);

        if (this.character) {
          this.character.jump();
        }
      };

      jumpBtn.addEventListener('touchstart', triggerJump, { passive: false });
      jumpBtn.addEventListener('mousedown', triggerJump);
    }

    // 3. Nút Súc Địa (Sprint Toggle)
    if (sprintBtn) {
      const toggleSprint = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerHaptic(15);
        this.isSprinting = !this.isSprinting;
        sprintBtn.classList.toggle('active', this.isSprinting);

        if (this.controller) {
          this.controller.setJoystickInput(
            this.joystickVector.x,
            this.joystickVector.y,
            this.isSprinting
          );
        }

        if (this.game) {
          this.game.showNotification(
            this.isSprinting ? '⚡ Đã kích hoạt [Súc Địa Thành Thốn]!' : '🚶 Trở về [Ngự Phong Hành]'
          );
        }
      };

      sprintBtn.addEventListener('touchstart', toggleSprint, { passive: false });
      sprintBtn.addEventListener('mousedown', toggleSprint);
    }

    // 4. Nút Hoán Y (Đổi tiên phục)
    if (outfitBtn) {
      const cycleOutfit = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerHaptic(12);
        outfitBtn.classList.add('pressed');
        setTimeout(() => outfitBtn.classList.remove('pressed'), 180);

        if (this.character) {
          const name = this.character.cycleOutfit();
          if (this.game) {
            this.game.showNotification(`Đã hoán đổi tiên bào: ${name}`);
          }
        }
      };

      outfitBtn.addEventListener('touchstart', cycleOutfit, { passive: false });
      outfitBtn.addEventListener('mousedown', cycleOutfit);
    }
  }

  // Tối ưu hóa 3 ô Kỹ Năng Tông Môn cho cảm ứng tuyệt đối chính xác
  bindSkillSlotsTouch() {
    for (let i = 1; i <= 4; i++) {
      const slot = document.getElementById(`skill-slot-${i}`);
      if (slot) {
        let lastCast = 0;
        const executeSkill = (e) => {
          const now = Date.now();
          if (now - lastCast < 200) return; // Tránh double-fire
          lastCast = now;

          e.preventDefault();
          e.stopPropagation();

          this.triggerHaptic(30);
          slot.classList.add('touch-active');
          setTimeout(() => slot.classList.remove('touch-active'), 220);

          if (this.controller) {
            this.controller.triggerSkill(i);
          }
        };

        slot.addEventListener('touchstart', executeSkill, { passive: false });
        slot.addEventListener('pointerdown', executeSkill, { passive: false });
        slot.addEventListener('click', executeSkill);
      }
    }
  }

  // Xử lý thông báo xoay màn hình ngang (Landscape)
  setupOrientationHandler() {
    const banner = document.getElementById('mobile-orientation-banner');
    const closeBtn = document.getElementById('btn-close-banner');

    if (closeBtn && banner) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        banner.style.display = 'none';
      });
    }

    const checkOrientation = () => {
      if (!banner) return;
      const isPortrait = window.innerHeight > window.innerWidth;
      if (this.isEnabled && isPortrait && window.innerWidth < 768) {
        banner.classList.add('visible');
        clearTimeout(this.bannerTimer);
        this.bannerTimer = setTimeout(() => {
          banner.classList.remove('visible');
        }, 5000);
      } else {
        banner.classList.remove('visible');
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
  }

  triggerHaptic(ms = 15) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (err) {}
    }
  }

  // Bật/tắt chế độ Mobile Controls
  toggle(enable = !this.isEnabled) {
    this.isEnabled = enable;
    this.updateVisibility();
    return this.isEnabled;
  }

  updateVisibility() {
    if (this.container) {
      this.container.style.display = this.isEnabled ? 'block' : 'none';
    }

    document.body.classList.toggle('mobile-ui-active', this.isEnabled);

    // Ẩn hướng dẫn chuột desktop khi ở chế độ mobile
    const lockHint = document.getElementById('lock-hint');
    if (lockHint) {
      if (this.isEnabled) {
        lockHint.classList.add('hidden');
      }
    }

    // Ẩn bảng phím WASD máy tính khi ở chế độ mobile
    const controlsHelp = document.querySelector('.controls-help');
    if (controlsHelp) {
      controlsHelp.style.display = this.isEnabled ? 'none' : 'grid';
    }

    // Đổi nhãn nút toggle trên top-bar nếu có
    const toggleBtn = document.getElementById('btn-mobile-toggle');
    if (toggleBtn) {
      toggleBtn.innerHTML = this.isEnabled ? '📱 Phím Ảo: Bật' : '📱 Phím Ảo: Tắt';
      toggleBtn.classList.toggle('active', this.isEnabled);
    }
  }
}
