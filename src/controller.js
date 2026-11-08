import * as THREE from 'three';
import { getTerrainHeight } from './world.js';

// Giữ nút tấn công quá CHARGE_START giây thì bắt đầu tụ lực, đầy lực ở CHARGE_FULL giây
const CHARGE_START = 0.25;
const CHARGE_FULL = 1.2;
// Nhấp tiếp trong khoảng này thì nối sang nhát combo kế tiếp
const COMBO_WINDOW = 0.7;

export class ThirdPersonController {
  constructor(camera, character, domElement, onShoot, onCastSkill) {
    this.camera = camera;
    this.character = character;
    this.domElement = domElement;
    this.onShoot = onShoot;
    this.onCastSkill = onCastSkill;

    // Trạng thái Pointer Lock
    this.isLocked = false;
    this.onLockChange = null;

    // Trạng thái phím bấm
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
    };

    // Rung lắc Camera mượt mà (Screen Trauma / Shake)
    this.trauma = 0;

    // Hồi chiêu giữa hai đòn chém thường và combo 3 nhát
    this.attackCooldown = 0;
    this.comboStep = 0;
    this.comboTimer = 0;

    // Giữ nút tấn công để tụ lực kiếm khí
    this.isAttackHeld = false;
    this.attackHoldTime = 0;
    this.onChargedRelease = null;

    // Thông số Camera Orbit góc nhìn thứ 3
    // Đặt camera lùi xa hơn để nhân vật không che khuất khung cảnh;
    // màn hình dọc (điện thoại) có góc nhìn ngang hẹp nên lùi xa thêm chút nữa
    const isPortrait = window.innerHeight > window.innerWidth;
    this.cameraDistance = isPortrait ? 13.5 : 11.5;
    this.minDistance = 4.0;
    this.maxDistance = 20.0;

    this.pitch = 0.28;
    this.yaw = 0.0;
    this.minPitch = -0.15;
    this.maxPitch = 1.25;

    // Smooth lerp camera
    this.currentCameraTarget = new THREE.Vector3();
    this.currentCameraPosition = new THREE.Vector3();

    // Dữ liệu điều khiển cảm ứng di động (Mobile Joystick & Touch)
    this.joystickInput = new THREE.Vector2(0, 0);
    this.joystickSprint = false;
    this.isMobileActive = false;

    this.isTouchDragging = false;
    this.prevTouchPos = { x: 0, y: 0 };

    // Camera tự xoay theo hướng chạy khi dùng cần gạt ảo (giúp người chơi điện thoại)
    this.autoFollowCamera = false;
    this.cameraTouchActive = false;
    this.lastManualCameraTime = 0;

    // Hướng di chuyển do Auto Farm điều khiển (toạ độ thế giới); tay người chơi luôn được ưu tiên
    this.autoMoveWorld = new THREE.Vector3();
    this.autoSprint = false;
    this.onAutoToggle = null;

    this.initListeners();
  }

  setJoystickInput(x, y, isSprinting = false) {
    this.joystickInput.set(x, y);
    this.joystickSprint = isSprinting;
  }

  rotateCamera(deltaYaw, deltaPitch) {
    this.yaw += deltaYaw;
    this.pitch += deltaPitch;
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);
  }

  zoomCamera(deltaDist) {
    this.cameraDistance += deltaDist;
    this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance, this.minDistance, this.maxDistance);
  }

  // maxTrauma: giới hạn mức rung mà nguồn này được phép đẩy lên (không hạ mức rung đang có)
  addTrauma(amount, maxTrauma = 1.0) {
    if (this.trauma >= maxTrauma) return;
    this.trauma = Math.min(maxTrauma, this.trauma + amount);
  }

  requestLock() {
    if (!this.isLocked) {
      this.domElement.requestPointerLock =
        this.domElement.requestPointerLock ||
        this.domElement.mozRequestPointerLock ||
        this.domElement.webkitRequestPointerLock;

      if (this.domElement.requestPointerLock) {
        this.domElement.requestPointerLock();
      }
    }
  }

  exitLock() {
    if (this.isLocked) {
      document.exitPointerLock =
        document.exitPointerLock ||
        document.mozExitPointerLock ||
        document.webkitExitPointerLock;

      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    }
  }

  initListeners() {
    const onPointerLockChange = () => {
      this.isLocked =
        document.pointerLockElement === this.domElement ||
        document.mozPointerLockElement === this.domElement ||
        document.webkitPointerLockElement === this.domElement;

      if (!this.isLocked) this.cancelAttackHold();

      if (this.onLockChange) {
        this.onLockChange(this.isLocked);
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mozpointerlockchange', onPointerLockChange);
    document.addEventListener('webkitpointerlockchange', onPointerLockChange);

    this.domElement.addEventListener('click', (e) => {
      if (this.isMobileActive) return;
      // Khi đã khóa chuột, đòn đánh do sự kiện mousedown xử lý
      if (!this.isLocked) {
        this.requestLock();
      }
    });

    this.domElement.addEventListener('mousedown', (e) => {
      if (this.isMobileActive) return;
      if (this.isLocked && e.button === 0) {
        this.beginAttackHold();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isMobileActive) return;
      if (e.button === 0) {
        this.releaseAttackHold();
      }
    });

    window.addEventListener('blur', () => this.cancelAttackHold());

    // Di chuột xoay camera khi pointer locked
    window.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
      const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

      const sensitivity = 0.0032;
      if (movementX || movementY) this.lastManualCameraTime = performance.now();
      this.yaw -= movementX * sensitivity;
      this.pitch += movementY * sensitivity;

      this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);
    });

    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance += e.deltaY * 0.005;
      this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance, this.minDistance, this.maxDistance);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      this.handleKey(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      this.handleKey(e.code, false);
    });

    // Touch support (dự phòng khi không bật MobileControls)
    let touchStartDist = 0;
    this.domElement.addEventListener('touchstart', (e) => {
      if (this.isMobileActive) return;
      if (e.touches.length === 1) {
        this.isTouchDragging = true;
        this.prevTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    this.domElement.addEventListener('touchmove', (e) => {
      if (this.isMobileActive) return;
      if (e.touches.length === 1 && this.isTouchDragging) {
        const deltaX = e.touches[0].clientX - this.prevTouchPos.x;
        const deltaY = e.touches[0].clientY - this.prevTouchPos.y;
        this.yaw -= deltaX * 0.006;
        this.pitch += deltaY * 0.006;
        this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);
        this.prevTouchPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = touchStartDist - dist;
        this.cameraDistance += diff * 0.01;
        this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance, this.minDistance, this.maxDistance);
        touchStartDist = dist;
      }
    });

    this.domElement.addEventListener('touchend', () => {
      if (this.isMobileActive) return;
      this.isTouchDragging = false;
    });

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  getAttackForward() {
    return new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    ).normalize();
  }

  getAttackOrigin() {
    const origin = this.character.position.clone();
    origin.y += 1.0;
    return origin;
  }

  // Đòn đánh thường: combo 3 nhát chém kiếm theo hướng camera (tốc độ vung & lướt đâm theo môn phái)
  triggerShoot() {
    if (this.character.isDead || this.character.isFloatingUlt || this.attackCooldown > 0) return;

    const step = this.comboTimer > 0 ? (this.comboStep + 1) % 3 : 0;
    this.comboStep = step;
    this.comboTimer = COMBO_WINDOW;
    const speedMult = this.character.sectStats?.slashSpeedMult || 1.0;
    this.attackCooldown = (step === 2 ? 0.46 : 0.24) / speedMult;

    const forward = this.getAttackForward();
    this.character.triggerSlashAnimation(Math.atan2(forward.x, forward.z), step);
    const dashDist = (this.character.sectStats?.dashDist !== undefined) ? this.character.sectStats.dashDist : 1.6;
    if (step === 2 && !this.character.sectStats?.isRangedBasic) this.character.startDash(forward, dashDist, 0.15); // Nhát đâm lướt tới (chỉ cận chiến)
    this.addTrauma(step === 2 ? 0.16 : 0.08); // Rung nhẹ tạo cảm giác đầm tay

    if (this.onShoot) {
      this.onShoot(this.getAttackOrigin(), forward, step);
    }
  }

  // Nhấn giữ nút tấn công (chuột trái / F / J / nút Pháp Kích)
  beginAttackHold() {
    if (this.isAttackHeld || this.character.isDead) return; // bỏ qua auto-repeat của phím
    this.isAttackHeld = true;
    this.attackHoldTime = 0;
  }

  // Thả nút: nhấp nhanh thì chém, giữ đủ lâu thì phóng kiếm khí theo lực tụ
  releaseAttackHold() {
    if (!this.isAttackHeld) return;
    const holdTime = this.attackHoldTime;
    this.cancelAttackHold();

    if (holdTime < CHARGE_START) {
      this.triggerShoot();
      return;
    }

    const power = THREE.MathUtils.clamp((holdTime - CHARGE_START) / (CHARGE_FULL - CHARGE_START), 0, 1);
    const forward = this.getAttackForward();
    this.attackCooldown = 0.32;
    this.comboTimer = 0;
    this.character.triggerSlashAnimation(Math.atan2(forward.x, forward.z));
    this.addTrauma(0.12 + power * 0.25);

    if (this.onChargedRelease) {
      this.onChargedRelease(this.getAttackOrigin(), forward, power);
    }
  }

  cancelAttackHold() {
    this.isAttackHeld = false;
    this.attackHoldTime = 0;
    this.character.setChargeLevel(0, false);
  }

  // KÍCH HOẠT KỸ NĂNG VÀ TÍNH ĐIỂM RƠI MỤC TIÊU PHÍA TRƯỚC
  triggerSkill(skillNum, targetPosOverride = null) {
    if (this.character.isDead) return;
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    ).normalize();

    // Điểm ngắm rơi kỹ năng cách nhân vật khoảng 14m phía trước
    const targetPos = targetPosOverride
      ? targetPosOverride.clone()
      : this.character.position.clone().addScaledVector(forward, 14);
    targetPos.y = getTerrainHeight(targetPos.x, targetPos.z);

    if (this.onCastSkill) {
      const castSuccess = this.onCastSkill(skillNum, targetPos);
      if (castSuccess) {
        this.character.triggerSkillCast(skillNum);
        this.addTrauma(skillNum === 4 ? 0.4 : skillNum === 3 ? 0.3 : (skillNum === 2 ? 0.18 : 0.12));
      }
    }
  }

  // Người chơi có đang tự điều khiển di chuyển (phím WASD hoặc cần gạt) không
  hasManualMoveInput() {
    return this.keys.forward || this.keys.backward || this.keys.left || this.keys.right ||
      this.joystickInput.lengthSq() > 0.01;
  }

  handleKey(code, isDown) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = isDown;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = isDown;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isDown;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isDown;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = isDown;
        break;
      case 'Space':
        if (isDown) this.character.jump();
        break;
      case 'KeyF':
      case 'KeyJ':
        if (isDown) this.beginAttackHold();
        else this.releaseAttackHold();
        break;
      case 'KeyT':
        if (isDown && this.onAutoToggle) this.onAutoToggle();
        break;
      case 'KeyC':
        if (isDown && this.onOutfitChange) {
          const name = this.character.cycleOutfit();
          this.onOutfitChange(name);
        }
        break;
      case 'Escape':
        if (isDown) {
          this.exitLock();
          if (this.onEscape) this.onEscape();
        }
        break;

      // CÁC PHÍM KỸ NĂNG: [1], [2], [3] (hỗ trợ thêm [Q] cho 1, [E] cho 3)
      case 'Digit1':
      case 'Numpad1':
      case 'KeyQ':
        if (isDown) this.triggerSkill(1);
        break;
      case 'Digit2':
      case 'Numpad2':
        if (isDown) this.triggerSkill(2);
        break;
      case 'Digit3':
      case 'Numpad3':
      case 'KeyE':
      case 'KeyR':
        if (isDown) this.triggerSkill(3);
        break;
      case 'Digit4':
      case 'Numpad4':
        if (isDown) this.triggerSkill(4);
        break;
    }
  }

  update(delta) {
    if (this.attackCooldown > 0) this.attackCooldown -= delta;
    if (this.comboTimer > 0) this.comboTimer -= delta;

    if (this.isAttackHeld) {
      this.attackHoldTime += delta;
      if (this.attackHoldTime >= CHARGE_START) {
        const power = Math.min(1, (this.attackHoldTime - CHARGE_START) / (CHARGE_FULL - CHARGE_START));
        const forward = this.getAttackForward();
        this.character.setChargeLevel(power, true, Math.atan2(forward.x, forward.z));
      }
    }

    const moveInput = new THREE.Vector2(0, 0);
    if (!this.character.isDead && !this.character.isFloatingUlt) {
      if (this.keys.forward) moveInput.y += 1;
      if (this.keys.backward) moveInput.y -= 1;
      if (this.keys.left) moveInput.x -= 1;
      if (this.keys.right) moveInput.x += 1;

      // Tích hợp vector di chuyển từ Cần gạt ảo Mobile (Analog Joystick)
      if (this.joystickInput.lengthSq() > 0) {
        moveInput.x += this.joystickInput.x;
        moveInput.y += this.joystickInput.y;
      }
    }

    let worldMoveVector = new THREE.Vector3(0, 0, 0);

    if (moveInput.lengthSq() > 0) {
      if (moveInput.length() > 1) {
        moveInput.normalize();
      }

      const forward = new THREE.Vector3(
        -Math.sin(this.yaw),
        0,
        -Math.cos(this.yaw)
      ).normalize();

      const right = new THREE.Vector3(
        Math.cos(this.yaw),
        0,
        -Math.sin(this.yaw)
      ).normalize();

      worldMoveVector
        .addScaledVector(forward, moveInput.y)
        .addScaledVector(right, moveInput.x);
      
      if (worldMoveVector.length() > 1) {
        worldMoveVector.normalize();
      }
    }

    // Camera tự bám sau lưng khi chạy chéo/ngang bằng cần gạt (tạm dừng khi người chơi đang tự vuốt camera)
    if (
      this.autoFollowCamera &&
      this.isMobileActive &&
      !this.cameraTouchActive &&
      performance.now() - this.lastManualCameraTime > 600 &&
      this.joystickInput.lengthSq() > 0.04 &&
      this.joystickInput.y > -0.35
    ) {
      const strength = Math.min(1, this.joystickInput.length());
      const followRate = 1.5; // rad/s ở hướng ngang tối đa
      this.yaw -= this.joystickInput.x * strength * followRate * delta;
    }

    // Auto Farm: chỉ dùng hướng đi tự động khi người chơi không tự điều khiển
    if (worldMoveVector.lengthSq() === 0 && this.autoMoveWorld.lengthSq() > 0 &&
        !this.character.isDead && !this.character.isFloatingUlt) {
      worldMoveVector.copy(this.autoMoveWorld);
      if (worldMoveVector.length() > 1) worldMoveVector.normalize();
    }

    const isSprinting = this.keys.sprint || this.joystickSprint ||
      (this.autoSprint && worldMoveVector.lengthSq() > 0);
    this.character.update(delta, worldMoveVector, isSprinting);

    const isMecha = Boolean(this.character.isMechaActive || this.character.giantRobot?.isActive);
    const targetLookAt = this.character.position.clone();
    targetLookAt.y += isMecha ? 14.5 : 1.45;

    const actualCamDist = isMecha ? 38.0 : this.cameraDistance;

    const offsetX = Math.sin(this.yaw) * Math.cos(this.pitch) * actualCamDist;
    const offsetY = Math.sin(this.pitch) * actualCamDist;
    const offsetZ = Math.cos(this.yaw) * Math.cos(this.pitch) * actualCamDist;

    const targetCamPos = new THREE.Vector3(
      this.character.position.x + offsetX,
      this.character.position.y + offsetY + (isMecha ? 8.0 : 1.2),
      this.character.position.z + offsetZ
    );

    if (this.currentCameraPosition.lengthSq() === 0) {
      this.currentCameraPosition.copy(targetCamPos);
      this.currentCameraTarget.copy(targetLookAt);
    } else {
      this.currentCameraPosition.lerp(targetCamPos, Math.min(1.0, delta * 9.5));
      this.currentCameraTarget.lerp(targetLookAt, Math.min(1.0, delta * 12.5));
    }

    this.camera.position.copy(this.currentCameraPosition);
    this.camera.lookAt(this.currentCameraTarget);

    // Áp dụng Rung lắc Camera (Trauma Shake)
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - delta * 1.5);
      const shakeMag = this.trauma * this.trauma;
      const t = performance.now() * 0.055;
      const shakeX = (Math.sin(t * 1.1) + Math.cos(t * 2.3)) * 0.42 * shakeMag;
      const shakeY = (Math.cos(t * 1.4) + Math.sin(t * 2.7)) * 0.42 * shakeMag;
      const shakeZ = Math.sin(t * 1.8) * 0.3 * shakeMag;
      this.camera.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
    }
  }
}
