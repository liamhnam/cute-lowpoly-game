import * as THREE from 'three';

export class ThirdPersonController {
  constructor(camera, character, domElement, onShoot) {
    this.camera = camera;
    this.character = character;
    this.domElement = domElement;
    this.onShoot = onShoot;

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

    // Thông số Camera Orbit góc nhìn thứ 3
    this.cameraDistance = 8.5;
    this.minDistance = 4.0;
    this.maxDistance = 16.0;

    this.pitch = 0.28;
    this.yaw = 0.0;
    this.minPitch = -0.15;
    this.maxPitch = 1.25;

    // Smooth lerp camera
    this.currentCameraTarget = new THREE.Vector3();
    this.currentCameraPosition = new THREE.Vector3();

    // Fallback cho touch mobile
    this.isTouchDragging = false;
    this.prevTouchPos = { x: 0, y: 0 };

    this.initListeners();
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
    // 1. Theo dõi trạng thái khóa chuột (Pointer Lock)
    const onPointerLockChange = () => {
      this.isLocked =
        document.pointerLockElement === this.domElement ||
        document.mozPointerLockElement === this.domElement ||
        document.webkitPointerLockElement === this.domElement;

      if (this.onLockChange) {
        this.onLockChange(this.isLocked);
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mozpointerlockchange', onPointerLockChange);
    document.addEventListener('webkitpointerlockchange', onPointerLockChange);

    // Click vào canvas để kích hoạt Pointer Lock hoặc Bắn súng
    this.domElement.addEventListener('click', (e) => {
      if (!this.isLocked) {
        this.requestLock();
      } else {
        // Đã khóa chuột: Click chuột trái bắn súng
        if (e.button === 0) {
          this.triggerShoot();
        }
      }
    });

    // Mousedown để bắn súng phản hồi tức thì khi đang locked
    this.domElement.addEventListener('mousedown', (e) => {
      if (this.isLocked && e.button === 0) {
        this.triggerShoot();
      }
    });

    // 2. Di chuột tự do xoay camera (khi con trỏ đã khóa)
    window.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
      const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

      const sensitivity = 0.0032;
      this.yaw -= movementX * sensitivity;
      this.pitch += movementY * sensitivity;

      this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);
    });

    // Zoom chuột
    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance += e.deltaY * 0.005;
      this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance, this.minDistance, this.maxDistance);
    }, { passive: false });

    // 3. Phím bấm
    window.addEventListener('keydown', (e) => {
      this.handleKey(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      this.handleKey(e.code, false);
    });

    // 4. Hỗ trợ Touch trên thiết bị cảm ứng
    let touchStartDist = 0;
    this.domElement.addEventListener('touchstart', (e) => {
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
      this.isTouchDragging = false;
    });

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  triggerShoot() {
    this.character.triggerShootAnimation();

    // Hướng bắn theo tâm nhìn của Camera
    const shootDir = new THREE.Vector3();
    this.camera.getWorldDirection(shootDir);

    // Điểm xuất phát đạn từ nòng súng
    const muzzlePos = this.character.getMuzzleWorldPosition();

    if (this.onShoot) {
      this.onShoot(muzzlePos, shootDir);
    }
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
        if (isDown) this.triggerShoot();
        break;
      case 'KeyC':
        if (isDown && this.onOutfitChange) {
          const name = this.character.cycleOutfit();
          this.onOutfitChange(name);
        }
        break;
      case 'Escape':
        // Phím ESC sẽ nhả con trỏ chuột
        if (isDown) {
          this.exitLock();
        }
        break;
    }
  }

  update(delta) {
    // 1. Hướng di chuyển tương đối theo góc nhìn camera
    const moveInput = new THREE.Vector2(0, 0);
    if (this.keys.forward) moveInput.y += 1;
    if (this.keys.backward) moveInput.y -= 1;
    if (this.keys.left) moveInput.x -= 1;
    if (this.keys.right) moveInput.x += 1;

    let worldMoveVector = new THREE.Vector3(0, 0, 0);

    if (moveInput.lengthSq() > 0) {
      moveInput.normalize();

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
        .addScaledVector(right, moveInput.x)
        .normalize();
    }

    this.character.update(delta, worldMoveVector, this.keys.sprint);

    // 2. Cập nhật vị trí Camera theo nhân vật
    const targetLookAt = this.character.position.clone();
    targetLookAt.y += 1.45;

    const offsetX = Math.sin(this.yaw) * Math.cos(this.pitch) * this.cameraDistance;
    const offsetY = Math.sin(this.pitch) * this.cameraDistance;
    const offsetZ = Math.cos(this.yaw) * Math.cos(this.pitch) * this.cameraDistance;

    const targetCamPos = new THREE.Vector3(
      this.character.position.x + offsetX,
      this.character.position.y + offsetY + 1.2,
      this.character.position.z + offsetZ
    );

    if (this.currentCameraPosition.lengthSq() === 0) {
      this.currentCameraPosition.copy(targetCamPos);
      this.currentCameraTarget.copy(targetLookAt);
    } else {
      this.currentCameraPosition.lerp(targetCamPos, Math.min(1.0, delta * 9.0));
      this.currentCameraTarget.lerp(targetLookAt, Math.min(1.0, delta * 12.0));
    }

    this.camera.position.copy(this.currentCameraPosition);
    this.camera.lookAt(this.currentCameraTarget);
  }
}
