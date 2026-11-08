import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';
import { getGundamPanelTexture } from './textures.js';

// ============================================================================
// CHIẾN THẦN GUNDAM KHỔNG LỒ X20 (RX-78 TITAN GUNDAM MECHA)
// ============================================================================
// Mô hình Gundam Mobile Suit huyền thoại cao ~36.5m (gấp 20 lần nhân vật 1.8m).
// Phối màu chuẩn Mobile Suit Gundam: Trắng tinh khôi (Polar White), Xanh Cobalt (Cobalt Blue),
// Đỏ thẫm (Crimson Red), Vàng kim (Golden Yellow) và Xám nòng súng (Dark Gunmetal Frame).
// - Ăng-ten V-Fin vàng kim 4 cánh kinh điển với ngọc trán đỏ & cảm biến ngọc lục bảo.
// - Đôi mắt xanh lục Neon phát quang sắc sảo (Twin Glowing Emerald Eyes) & cằm đỏ vát góc.
// - Lồng ngực xanh Cobalt với CẶP KHE HÚT GIÓ VÀNG KIM (Dual Golden Air Intake Vents).
// - Cặp váy giáp trước/hông/sau di động & Khối giáp háng đỏ góc cạnh (Red Crotch Block).
// - Balo phản lực đôi với CẶP CHUÔI KIẾM ÁNH SÁNG BEAM SABER & ngọn lửa hạt năng lượng GN.
// - Tay trái trang bị KHIÊN GUNDAM LỤC QUÂN (Gundam Defense Shield) chuẩn anime mecha.
// - Cặp chân dài thon gọn khí động học, bắp chân nở nang và BÀN CHÂN ĐỎ GUNDAM 2 KHÚC.
// ============================================================================

export class GiantRobot {
  constructor(scene, world, particles, damageTexts, controller, pixelFX) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;
    this.damageTexts = damageTexts;
    this.controller = controller;
    this.pixelFX = pixelFX;

    this.group = new THREE.Group();
    this.group.name = 'GiantRobot_GUNDAM';
    this.scene.add(this.group);

    // Trạng thái vòng đời: 'assembling' | 'active' | 'disengaging' | 'dead'
    this.state = 'assembling';
    this.isActive = false;
    this.isAssembling = false;
    this.isCloneRobot = false; // Đánh dấu robot của phân thân
    this.caster = null;
    this.monsters = [];
    this.onCompleteCallback = null;

    // Thời gian duy trì cơ giáp: 30 giây
    this.duration = 30.0;
    this.timeLeft = 30.0;
    this.attackCooldown = 0;
    this.attackCombo = 0; // 0: Đạp đất, 1: Nện nắm đấm

    // Trạng thái hoạt ảnh
    this.animTime = 0;
    this.walkCycle = 0;
    this.isAttacking = false;
    this.attackTime = 0;
    this.attackDuration = 1.35;
    this.attackType = 'stomp'; // 'stomp' | 'slam'
    this.hasImpacted = false;

    // Quá trình lắp ráp
    this.assemblyElapsed = 0;
    this.totalAssemblyTime = 1.55;
    this.flyingParts = [];
    this.beaconGroup = null;
    this.tractorBeam = null;
    this.tractorMat = null;
    this.deployPos = new THREE.Vector3();

    // Quá trình phóng tên lửa kết thúc
    this.disengageElapsed = 0;
    this.disengageDuration = 1.4;
    this.disengageStartY = 0;

    // Lưu các vật liệu & hình học để dispose sạch sẽ
    this.materials = [];
    this.geometries = [];

    // Tạo vật liệu & dựng khung xương 3D chi tiết
    this.initMaterials();
    this.buildRobotModel();

    // Ban đầu ẩn nhóm chính trong khi 7 mảnh đang bay vào hợp thể
    this.group.visible = false;
  }

  // Quản lý đăng ký tài nguyên để dispose sạch sẽ
  registerMat(mat) {
    this.materials.push(mat);
    return mat;
  }

  registerGeo(geo) {
    this.geometries.push(geo);
    return geo;
  }

  // ==========================================================================
  // VẬT LIỆU MÀU SẮC CHUẨN GUNDAM MECHA (POLAR WHITE, COBALT BLUE, CRIMSON RED)
  // ==========================================================================
  initMaterials() {
    // 1. Giáp chính trắng tinh khôi chuẩn Gundam (Gundam Polar White Panel Texture)
    this.armorPrimaryMat = this.registerMat(new THREE.MeshStandardMaterial({
      map: getGundamPanelTexture('white'),
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.18,
    }));

    // 2. Giáp ngực & balo xanh Cobalt Gundam (Gundam Cobalt Blue)
    this.armorBlueMat = this.registerMat(new THREE.MeshStandardMaterial({
      map: getGundamPanelTexture('blue'),
      color: 0x1e40af,
      roughness: 0.32,
      metalness: 0.28,
    }));
    this.armorHighlightMat = this.armorBlueMat; // Tương thích ngược

    // 3. Giáp đỏ thẫm kinh điển Gundam: Cằm, Háng, Bàn chân (Gundam Crimson Red)
    this.armorRedMat = this.registerMat(new THREE.MeshStandardMaterial({
      map: getGundamPanelTexture('red'),
      color: 0xdc2626,
      roughness: 0.32,
      metalness: 0.22,
    }));

    // 4. V-Fin & Khe hút gió màu Vàng Kim Gundam (Iconic V-Fin Gold / Yellow)
    this.goldVFinMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.85,
    }));
    this.goldStarMat = this.goldVFinMat; // Tương thích ngược
    this.hazardYellowMat = this.goldVFinMat;

    // 5. Khung sườn kim loại xám nòng súng / Titanium Inner Frame
    this.darkSteelMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.82,
    }));

    // 6. Xi-lanh thủy lực Piston Chrome sáng bóng (Hydraulic Chrome Pistons)
    this.chromePistonMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.08,
      metalness: 0.96,
    }));

    // 7. Đôi mắt quang học xanh ngọc lục bảo Neon (Gundam Glowing Twin Green Eyes)
    this.gundamEyeMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 2.5,
      roughness: 0.12,
      metalness: 0.1,
    }));

    // 8. Lõi lò phản ứng hạt nhân Minovsky / GN Drive phát sáng Cyan
    this.reactorCoreMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00d2d3,
      emissiveIntensity: 1.6,
      roughness: 0.15,
      metalness: 0.2,
    }));

    // 9. Kính vòm buồng lái cường lực màu lam ngọc trong suốt (Translucent Cockpit Glass)
    this.cockpitGlassMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.35,
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }));

    // 10. Lưỡi kiếm ánh sáng Beam Saber Plasma hồng rực (Hot Pink Beam Saber Blade)
    this.beamSaberMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff007f,
      emissiveIntensity: 2.8,
      roughness: 0.1,
      metalness: 0.1,
    }));

    // 11. Ngọn lửa hạt năng lượng GN phản lực động cơ Thruster (Cyan/Blue Energy Plume)
    this.thrusterFlameMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x00f2fe,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
    }));
  }

  // Dựng hình khối Ăng-ten V-Fin Hoàng Kim 4 Cánh chuẩn Gundam
  buildGundamVFin() {
    const vFinGroup = new THREE.Group();

    // Khối ngọc trán ngũ giác màu đỏ (Red Center Diamond Base)
    const centerGem = new THREE.Mesh(
      this.registerGeo(new THREE.ConeGeometry(0.55, 0.95, 5)),
      this.armorRedMat
    );
    centerGem.rotation.x = Math.PI;
    centerGem.position.set(0, 0, 0.45);
    vFinGroup.add(centerGem);

    // Cảm biến camera xanh ngọc lục bảo ngay trên trán
    const foreheadSensor = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(0.45, 0.55, 0.65)),
      this.gundamEyeMat
    );
    foreheadSensor.position.set(0, 0.65, 0.25);
    vFinGroup.add(foreheadSensor);

    // Cặp cánh V-Fin chính màu vàng vươn dài sắc lẹm
    for (const side of [-1, 1]) {
      const mainBlade = new THREE.Mesh(
        this.registerGeo(new THREE.ConeGeometry(0.32, 4.4, 4)),
        this.goldVFinMat
      );
      mainBlade.position.set(side * 1.6, 1.4, 0.25);
      mainBlade.rotation.z = -side * 1.05;
      mainBlade.rotation.y = side * 0.15;
      mainBlade.scale.set(0.65, 1.0, 0.18);
      vFinGroup.add(mainBlade);

      // Cặp cánh V-Fin phụ phía sau tạo độ sâu 3D
      const subBlade = new THREE.Mesh(
        this.registerGeo(new THREE.ConeGeometry(0.22, 2.4, 4)),
        this.goldVFinMat
      );
      subBlade.position.set(side * 1.0, 0.9, -0.2);
      subBlade.rotation.z = -side * 1.15;
      subBlade.scale.set(0.65, 1.0, 0.18);
      vFinGroup.add(subBlade);
    }

    return vFinGroup;
  }

  // Dựng hình khối Ngôi Sao Vàng Năm Cánh 3D
  buildStarMesh(radius = 1.6, depth = 0.35) {
    const starShape = new THREE.Shape();
    const points = 5;
    const innerRadius = radius * 0.42;

    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : innerRadius;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();

    const extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.12,
      bevelThickness: 0.12,
    };

    const starGeo = this.registerGeo(new THREE.ExtrudeGeometry(starShape, extrudeSettings));
    const starMesh = new THREE.Mesh(starGeo, this.goldVFinMat);
    return starMesh;
  }

  // ==========================================================================
  // XÂY DỰNG MÔ HÌNH 3D CHI TIẾT GUNDAM MOBILE SUIT X20 (~36.5M)
  // ==========================================================================
  buildRobotModel() {
    // ------------------------------------------------------------------------
    // 1. HỆ THỐNG KHUNG CHẬU & VÁY GIÁP GUNDAM (PELVIS & MOBILE SUIT SKIRTS)
    // Độ cao khớp háng: 16.5m
    // ------------------------------------------------------------------------
    this.pelvisGroup = new THREE.Group();
    this.pelvisGroup.position.set(0, 16.5, 0);
    this.group.add(this.pelvisGroup);

    // Khung sườn xương chậu Titanium chịu lực
    const pelvisChassis = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(5.8, 2.8, 4.2)),
      this.darkSteelMat
    );
    this.pelvisGroup.add(pelvisChassis);

    // Khối giáp háng trung tâm màu đỏ Gundam (Iconic Red Crotch Block)
    const crotchBlock = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(2.2, 3.4, 2.6)),
      this.armorRedMat
    );
    crotchBlock.position.set(0, -0.6, 2.0);
    crotchBlock.rotation.x = 0.22;
    this.pelvisGroup.add(crotchBlock);

    // Biểu tượng chữ V vàng kim dập nổi trên khối háng đỏ
    const crotchV = new THREE.Mesh(
      this.registerGeo(new THREE.ConeGeometry(0.35, 1.2, 4)),
      this.goldVFinMat
    );
    crotchV.position.set(0, -0.4, 3.35);
    crotchV.rotation.x = Math.PI / 1.35;
    this.pelvisGroup.add(crotchV);

    // Cặp váy giáp trước màu trắng viền xanh (Twin Front Skirt Armors)
    for (const side of [-1, 1]) {
      const frontSkirt = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(2.2, 3.8, 0.65)),
        this.armorPrimaryMat
      );
      frontSkirt.position.set(side * 1.85, -0.7, 2.15);
      frontSkirt.rotation.x = -0.25;
      frontSkirt.rotation.y = -side * 0.12;

      // Viền xanh cobalt phía chân váy
      const skirtTrim = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(2.25, 0.8, 0.7)),
        this.armorBlueMat
      );
      skirtTrim.position.y = -1.5;
      frontSkirt.add(skirtTrim);

      this.pelvisGroup.add(frontSkirt);
    }

    // Cặp váy giáp hông màu trắng có chốt sạc Beam Saber (Side Skirts)
    for (const side of [-1, 1]) {
      const sideSkirt = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.9, 4.2, 3.8)),
        this.armorPrimaryMat
      );
      sideSkirt.position.set(side * 3.3, -0.5, 0);
      sideSkirt.rotation.z = side * 0.15;

      // Hộp tiếp đạn / năng lượng gắn bên hông
      const ammoBox = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.95, 1.6, 2.2)),
        this.armorBlueMat
      );
      ammoBox.position.set(side * 0.1, -0.2, 0);
      sideSkirt.add(ammoBox);

      this.pelvisGroup.add(sideSkirt);
    }

    // Váy giáp sau với cặp ống xả phản lực phụ (Rear Skirt Armor)
    const rearSkirt = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(5.2, 3.6, 0.75)),
      this.armorPrimaryMat
    );
    rearSkirt.position.set(0, -0.6, -2.15);
    rearSkirt.rotation.x = 0.28;
    this.pelvisGroup.add(rearSkirt);

    // ------------------------------------------------------------------------
    // 2. KHUNG THÂN & LỒNG NGỰC XANH COBALT (TORSO & COCKPIT)
    // ------------------------------------------------------------------------
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 2.2, 0);
    this.pelvisGroup.add(this.torsoGroup);

    // Khối cơ bụng chuyển động đa tầng màu xám titan (Segmented Abdominal Section)
    for (let i = 0; i < 2; i++) {
      const abPlate = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(4.0 - i * 0.35, 1.25, 3.4)),
        this.darkSteelMat
      );
      abPlate.position.set(0, 0.8 + i * 1.3, 0);
      this.torsoGroup.add(abPlate);
    }

    // Piston thủy lực nối hông lên lồng ngực
    for (const side of [-1, 1]) {
      const torsoPistonCyl = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.35, 0.35, 2.8, 8)),
        this.darkSteelMat
      );
      torsoPistonCyl.position.set(side * 1.8, 1.2, -0.8);
      this.torsoGroup.add(torsoPistonCyl);

      const torsoPistonRod = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 8)),
        this.chromePistonMat
      );
      torsoPistonRod.position.set(side * 1.8, 1.6, -0.8);
      this.torsoGroup.add(torsoPistonRod);
    }

    // Khung Lồng Ngực Chính Xanh Cobalt Gundam (Gundam Cobalt Blue Chest)
    const chestGroup = new THREE.Group();
    chestGroup.position.set(0, 4.8, 0);
    this.torsoGroup.add(chestGroup);

    const chestCenter = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(7.6, 5.6, 6.2)),
      this.armorBlueMat
    );
    chestGroup.add(chestCenter);

    // Giáp cổ trắng dựng cao bảo vệ buồng lái (White Collar Armor Guards)
    for (const side of [-1, 1]) {
      const collarGuard = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(1.2, 2.4, 2.8)),
        this.armorPrimaryMat
      );
      collarGuard.position.set(side * 2.2, 3.2, 1.2);
      collarGuard.rotation.y = -side * 0.35;
      collarGuard.rotation.x = -0.15;
      chestGroup.add(collarGuard);
    }

    // CẶP KHE HÚT GIÓ VÀNG KIM KINH ĐIỂN CỦA GUNDAM (DUAL GOLDEN AIR INTAKE VENTS)
    for (const side of [-1, 1]) {
      const intakeGroup = new THREE.Group();
      intakeGroup.position.set(side * 2.2, 0.8, 3.4);

      // Khung viền ngoài khe hút gió màu vàng
      const intakeFrame = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(1.8, 2.4, 0.8)),
        this.goldVFinMat
      );
      intakeGroup.add(intakeFrame);

      // 3 Thanh nan tản nhiệt đen bên trong
      for (let l = 0; l < 3; l++) {
        const louver = new THREE.Mesh(
          this.registerGeo(new THREE.BoxGeometry(1.6, 0.16, 0.85)),
          this.darkSteelMat
        );
        louver.position.y = (l - 1) * 0.65;
        louver.rotation.x = 0.35;
        intakeGroup.add(louver);
      }
      chestGroup.add(intakeGroup);
    }

    // Nắp Buồng Lái Đỏ Vát Nhọn Trung Tâm (Gundam Red Cockpit Hatch)
    const cockpitHatch = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(2.4, 2.8, 1.8)),
      this.armorRedMat
    );
    cockpitHatch.position.set(0, 0.4, 3.8);
    cockpitHatch.rotation.x = -0.35;
    chestGroup.add(cockpitHatch);

    // Lõi Lò Phản Ứng Minovsky / GN Drive Trung Tâm
    const reactorHousing = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(1.6, 1.6, 0.8, 12)),
      this.darkSteelMat
    );
    reactorHousing.rotation.x = Math.PI / 2;
    reactorHousing.position.set(0, -1.2, 3.4);
    chestGroup.add(reactorHousing);

    this.reactorGlow = new THREE.Mesh(
      this.registerGeo(new THREE.SphereGeometry(1.15, 16, 16)),
      this.reactorCoreMat
    );
    this.reactorGlow.position.set(0, -1.2, 3.55);
    chestGroup.add(this.reactorGlow);

    // ------------------------------------------------------------------------
    // BUỒNG LÁI CƠ GIÁP NỘI THẤT HOÀN CHỈNH (COCKPIT & PILOT CABIN INTERIOR)
    // ------------------------------------------------------------------------
    const cockpitFloor = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(4.4, 0.4, 3.6)),
      this.darkSteelMat
    );
    cockpitFloor.position.set(0, 2.1, 2.0);
    chestGroup.add(cockpitFloor);

    // Ghế cơ trưởng điều khiển (Pilot Throne / Seat)
    const pilotChair = new THREE.Group();
    pilotChair.position.set(0, 2.3, 1.8);

    const seatBase = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(1.6, 0.4, 1.6)),
      this.darkSteelMat
    );
    pilotChair.add(seatBase);

    const seatBack = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(1.6, 2.2, 0.35)),
      this.armorBlueMat
    );
    seatBack.position.set(0, 1.1, -0.7);
    pilotChair.add(seatBack);

    for (const side of [-1, 1]) {
      const armRest = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.25, 0.6, 1.2)),
        this.goldVFinMat
      );
      armRest.position.set(side * 0.9, 0.6, 0);
      pilotChair.add(armRest);
    }
    chestGroup.add(pilotChair);

    // NODE TỌA ĐỘ VẬT LÝ GHẾ LÁI (PILOT POSITION)
    this.pilotSeatNode = new THREE.Object3D();
    this.pilotSeatNode.name = 'TitanPilotSeatNode';
    this.pilotSeatNode.position.set(0, 2.35, 1.8);
    chestGroup.add(this.pilotSeatNode);

    // NODE TỌA ĐỘ CAMERA BUỒNG LÁI 1ST-PERSON (COCKPIT CAMERA ANCHOR)
    this.cockpitCameraNode = new THREE.Object3D();
    this.cockpitCameraNode.name = 'TitanCockpitCameraNode';
    this.cockpitCameraNode.position.set(0, 3.45, 1.95);
    chestGroup.add(this.cockpitCameraNode);

    // Bảng điều khiển tác chiến chữ U (Control Console)
    const consolePanel = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(2.6, 0.8, 1.0)),
      this.darkSteelMat
    );
    consolePanel.position.set(0, 2.8, 2.9);
    consolePanel.rotation.x = -0.4;
    chestGroup.add(consolePanel);

    // Màn hình Radar Hologram phát sáng Neon Cyan
    const hudScreen = new THREE.Mesh(
      this.registerGeo(new THREE.PlaneGeometry(1.8, 0.6)),
      this.reactorCoreMat
    );
    hudScreen.position.set(0, 3.2, 2.75);
    hudScreen.rotation.x = -0.4;
    chestGroup.add(hudScreen);

    // Cặp cần gạt lái chiến đấu (Twin Flight Joysticks)
    for (const side of [-1, 1]) {
      const stick = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 6)),
        this.chromePistonMat
      );
      stick.position.set(side * 0.65, 3.1, 2.65);
      stick.rotation.x = 0.2;
      chestGroup.add(stick);

      const stickKnob = new THREE.Mesh(
        this.registerGeo(new THREE.SphereGeometry(0.12, 8, 8)),
        this.armorRedMat
      );
      stickKnob.position.set(side * 0.65, 3.4, 2.7);
      chestGroup.add(stickKnob);
    }

    // Kính vòm cường lực trong suốt (Translucent Canopy Glass, opacity 0.35)
    const cockpitCanopy = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(4.4, 2.4, 3.4)),
      this.cockpitGlassMat
    );
    cockpitCanopy.position.set(0, 3.3, 2.1);
    cockpitCanopy.rotation.x = -0.32;
    chestGroup.add(cockpitCanopy);

    // Khung kim loại bảo vệ kính buồng lái
    for (const side of [-1, 1]) {
      const rollBar = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.35, 2.5, 0.35)),
        this.darkSteelMat
      );
      rollBar.position.set(side * 1.8, 3.3, 2.15);
      rollBar.rotation.x = -0.32;
      chestGroup.add(rollBar);
    }

    // ------------------------------------------------------------------------
    // 3. ĐẦU THỦ GUNDAM HUYỀN THOẠI (TITAN GUNDAM HEAD & V-FIN)
    // ------------------------------------------------------------------------
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 5.8, 0.5);
    chestGroup.add(this.headGroup);

    // Cổ xoay cơ khí xám titan
    const neckMesh = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(1.4, 1.6, 1.2, 10)),
      this.darkSteelMat
    );
    neckMesh.position.y = -0.6;
    this.headGroup.add(neckMesh);

    // Mũ giáp chiến binh Gundam màu trắng góc cạnh (White Combat Helmet)
    const headHelmet = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(2.8, 2.6, 3.2)),
      this.armorPrimaryMat
    );
    headHelmet.position.y = 1.0;
    this.headGroup.add(headHelmet);

    // Gờ má giáp 2 bên vát góc khí động học
    for (const side of [-1, 1]) {
      const cheekGuard = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.45, 2.2, 2.0)),
        this.armorPrimaryMat
      );
      cheekGuard.position.set(side * 1.55, 0.7, 0.6);
      cheekGuard.rotation.y = side * 0.18;
      this.headGroup.add(cheekGuard);

      // Cặp nòng pháo máy Vulcan 60mm phòng không (Temple CIWS Vulcans)
      const vulcan = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.75, 6)),
        this.darkSteelMat
      );
      vulcan.position.set(side * 1.15, 1.9, 1.4);
      vulcan.rotation.x = Math.PI / 2;
      this.headGroup.add(vulcan);
    }

    // Mặt nạ trắng với 2 khe mang thở Gundam (Faceplate with Intake Slits)
    const faceplate = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(1.6, 1.2, 0.9)),
      this.armorPrimaryMat
    );
    faceplate.position.set(0, 0.45, 1.7);
    this.headGroup.add(faceplate);

    for (let s = -1; s <= 1; s += 2) {
      const ventSlit = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.45, 0.12, 0.95)),
        this.darkSteelMat
      );
      ventSlit.position.set(s * 0.4, 0.45, 1.72);
      this.headGroup.add(ventSlit);
    }

    // Khối cằm đỏ Gundam nhọn vút (Iconic Red Chin)
    const redChin = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(0.85, 0.75, 0.85)),
      this.armorRedMat
    );
    redChin.position.set(0, -0.15, 1.85);
    redChin.rotation.x = -0.35;
    this.headGroup.add(redChin);

    // Đôi mắt quang học xanh ngọc lục bảo phát sáng rực rỡ (Twin Glowing Green Eyes)
    const eyeBand = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(1.8, 0.45, 0.35)),
      this.darkSteelMat
    );
    eyeBand.position.set(0, 1.1, 1.6);
    this.headGroup.add(eyeBand);

    for (const side of [-1, 1]) {
      const eyeSlit = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.65, 0.22, 0.4)),
        this.gundamEyeMat
      );
      eyeSlit.position.set(side * 0.48, 1.1, 1.62);
      eyeSlit.rotation.z = -side * 0.18;
      this.headGroup.add(eyeSlit);
    }

    // ĂNG-TEN V-FIN HOÀNG KIM 4 CÁNH & CẢM BIẾN QUANG HỌC CHÍNH (ICONIC V-FIN)
    const vFinMesh = this.buildGundamVFin();
    vFinMesh.position.set(0, 1.75, 1.6);
    this.headGroup.add(vFinMesh);

    // Cảm biến camera sau đầu màu xanh ngọc
    const rearSensor = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(0.45, 0.55, 0.45)),
      this.gundamEyeMat
    );
    rearSensor.position.set(0, 2.1, -1.55);
    this.headGroup.add(rearSensor);

    // ------------------------------------------------------------------------
    // 4. BALO PHẢN LỰC ĐÔI & CẶP CHUÔI KIẾM ÁNH SÁNG BEAM SABER
    // (TWIN THRUSTER BACKPACK & DUAL BEAM SABERS)
    // ------------------------------------------------------------------------
    this.backpackGroup = new THREE.Group();
    this.backpackGroup.position.set(0, 0.4, -3.8);
    chestGroup.add(this.backpackGroup);

    // Thân balo màu xanh Cobalt & xám nòng súng
    const backpackChassis = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(6.4, 6.2, 2.4)),
      this.armorBlueMat
    );
    this.backpackGroup.add(backpackChassis);

    // CẶP CHUÔI KIẾM ÁNH SÁNG BEAM SABER CẮM NGHIÊNG TRÊN HAI VAI BALO
    for (const side of [-1, 1]) {
      const saberRack = new THREE.Group();
      saberRack.position.set(side * 2.4, 3.4, 0.2);
      saberRack.rotation.z = -side * 0.25;
      saberRack.rotation.x = -0.35;

      // Giá cắm kiếm
      const rackSocket = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.85, 1.0, 0.85)),
        this.armorPrimaryMat
      );
      saberRack.add(rackSocket);

      // Chuôi kiếm Beam Saber màu trắng viền vàng
      const saberHilt = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.24, 0.28, 3.4, 8)),
        this.armorPrimaryMat
      );
      saberHilt.position.y = 1.9;
      saberRack.add(saberHilt);

      const saberEmitter = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.45, 8)),
        this.goldVFinMat
      );
      saberEmitter.position.y = 3.6;
      saberRack.add(saberEmitter);

      this.backpackGroup.add(saberRack);
    }

    // Cánh ổn định khí động học vút nhọn phía sau balo
    for (const side of [-1, 1]) {
      const wingFin = new THREE.Mesh(
        this.registerGeo(new THREE.ConeGeometry(0.55, 3.8, 4)),
        this.armorPrimaryMat
      );
      wingFin.position.set(side * 3.4, 1.6, -0.6);
      wingFin.rotation.z = -side * 0.95;
      wingFin.rotation.x = -0.35;
      this.backpackGroup.add(wingFin);
    }

    // Cặp loa xả phản lực chính Vernier Thrusters viền Chrome sáng bóng
    this.thrusterFlames = [];
    for (const side of [-1, 1]) {
      const nozzleGroup = new THREE.Group();
      nozzleGroup.position.set(side * 2.2, -1.8, -1.2);

      const nozzleHousing = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(1.3, 1.6, 3.2, 12)),
        this.armorBlueMat
      );
      nozzleHousing.rotation.x = Math.PI / 4;
      nozzleGroup.add(nozzleHousing);

      const nozzleBell = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(1.6, 1.8, 0.8, 12, 1, true)),
        this.chromePistonMat
      );
      nozzleBell.rotation.x = Math.PI / 4;
      nozzleBell.position.set(0, -1.2, -1.2);
      nozzleGroup.add(nozzleBell);

      // Ngọn lửa hạt năng lượng GN phản lực màu Cyan/Blue rực sáng
      const flameMesh = new THREE.Mesh(
        this.registerGeo(new THREE.ConeGeometry(1.4, 5.2, 12)),
        this.thrusterFlameMat
      );
      flameMesh.rotation.x = -Math.PI * 0.75;
      flameMesh.position.set(0, -2.8, -2.8);
      nozzleGroup.add(flameMesh);
      this.thrusterFlames.push(flameMesh);

      this.backpackGroup.add(nozzleGroup);
    }

    // ------------------------------------------------------------------------
    // 5. CÁNH TAY TRÁI & KHIÊN GUNDAM LỤC QUÂN (LEFT ARM & GUNDAM SHIELD)
    // ------------------------------------------------------------------------
    this.leftArmGroup = this.buildArm(chestGroup, -1, 'shield');

    // ------------------------------------------------------------------------
    // 6. CÁNH TAY PHẢI & THIẾT QUYỀN TRỌNG LỰC (RIGHT ARM & HYPER GAUNTLET)
    // ------------------------------------------------------------------------
    this.rightArmGroup = this.buildArm(chestGroup, 1, 'fist');

    // ------------------------------------------------------------------------
    // 7. CẶP CHÂN GUNDAM KHÍ ĐỘNG HỌC & BÀN CHÂN ĐỎ KINH ĐIỂN
    // (LEFT & RIGHT LEGS & ICONIC RED FEET)
    // Chiều dài mỗi chân: ~16.5m
    // ------------------------------------------------------------------------
    this.leftLegGroup = this.buildLeg(-1);
    this.rightLegGroup = this.buildLeg(1);
  }

  // Dựng cánh tay cơ khí Gundam đồ sộ & Khiên Gundam
  buildArm(parent, side, armType) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 5.4, 2.2, 0);
    parent.add(shoulderPivot);

    // Giáp vai bản to Gundam màu trắng góc cạnh (Gundam Pauldron)
    const pauldron = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.6, 3.4, 4.4)),
      this.armorPrimaryMat
    );
    pauldron.position.set(side * 0.6, 0.4, 0);
    shoulderPivot.add(pauldron);

    // Nắp chụp giáp vai trên màu xanh Cobalt
    const shoulderCap = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.65, 0.6, 4.45)),
      this.armorBlueMat
    );
    shoulderCap.position.set(side * 0.6, 2.1, 0);
    shoulderPivot.add(shoulderCap);

    // Khe tản nhiệt vàng kim trên giáp vai ngoài
    const ventSlot = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(0.3, 1.4, 2.2)),
      this.goldVFinMat
    );
    ventSlot.position.set(side * 2.45, 0.4, 0);
    shoulderPivot.add(ventSlot);

    // Bắp tay trên màu trắng (Upper Arm Bicep)
    const upperArm = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(2.4, 4.4, 2.6)),
      this.armorPrimaryMat
    );
    upperArm.position.set(0, -2.6, 0);
    shoulderPivot.add(upperArm);

    // Piston thủy lực bắp tay mạ chrome
    const bicepPiston = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(0.3, 0.3, 3.6, 8)),
      this.chromePistonMat
    );
    bicepPiston.position.set(side * 0.9, -2.6, 1.0);
    shoulderPivot.add(bicepPiston);

    // Khớp cùi chỏ hình trụ tròn kép màu xám titan (Double-Jointed Elbow)
    const elbowJoint = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 10)),
      this.darkSteelMat
    );
    elbowJoint.rotation.z = Math.PI / 2;
    elbowJoint.position.set(0, -5.2, 0);
    shoulderPivot.add(elbowJoint);

    // Cẳng tay bọc giáp trắng (Forearm Gauntlet)
    const forearm = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.2, 4.6, 3.4)),
      this.armorPrimaryMat
    );
    forearm.position.set(0, -7.6, 0.4);
    shoulderPivot.add(forearm);

    // Nắp khớp đỏ ở cùi chỏ
    const elbowCap = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(1.6, 1.4, 1.2)),
      this.armorRedMat
    );
    elbowCap.position.set(0, -5.2, -1.3);
    shoulderPivot.add(elbowCap);

    if (armType === 'shield') {
      // TAY TRÁI: BÀN TAY CƠ KHÍ + KHIÊN GUNDAM LỤC QUÂN (GUNDAM DEFENSE SHIELD)
      const fistMesh = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(2.8, 3.0, 3.0)),
        this.darkSteelMat
      );
      fistMesh.position.set(0, -10.2, 0.4);
      shoulderPivot.add(fistMesh);

      // KHIÊN GUNDAM CHUẨN LỤC QUÂN / LIÊN BANG (GUNDAM HEXAGONAL SHIELD)
      const shieldGroup = new THREE.Group();
      shieldGroup.position.set(side * 2.2, -7.8, 0.8);
      shieldGroup.rotation.y = side * 0.35;

      // Nửa dưới khiên màu đỏ thẫm kinh điển
      const shieldLower = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.65, 8.5, 4.6)),
        this.armorRedMat
      );
      shieldLower.position.set(0, -1.2, 0);
      shieldGroup.add(shieldLower);

      // Nửa trên khiên màu xanh Cobalt
      const shieldUpper = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.7, 4.5, 4.65)),
        this.armorBlueMat
      );
      shieldUpper.position.set(0, 5.0, 0);
      shieldGroup.add(shieldUpper);

      // Viền khiên màu trắng vát góc khí động học
      const shieldTrim = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.75, 13.5, 0.7)),
        this.armorPrimaryMat
      );
      shieldTrim.position.set(0, 1.8, 2.3);
      shieldGroup.add(shieldTrim);

      // Khe ngắm bắn quan sát (Viewing Port) trên đỉnh khiên
      const viewSlot = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.85, 0.75, 2.4)),
        this.darkSteelMat
      );
      viewSlot.position.set(0, 5.4, 0);
      shieldGroup.add(viewSlot);

      // Ngôi Sao Vàng Năm Cánh / Chữ Thập Liên Bang trên nền khiên
      const shieldStar = this.buildStarMesh(1.4, 0.35);
      shieldStar.rotation.y = -Math.PI / 2;
      shieldStar.position.set(side * 0.4, 0.8, 0);
      shieldGroup.add(shieldStar);

      shoulderPivot.add(shieldGroup);

    } else {
      // TAY PHẢI: THIẾT QUYỀN NỆN ĐẤT + PISTON KHÍ NÉN ĐỊA CHẤN
      const fistMesh = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(3.4, 3.6, 3.6)),
        this.darkSteelMat
      );
      fistMesh.position.set(0, -10.4, 0.4);
      shoulderPivot.add(fistMesh);

      // 4 Đốt ngón tay kim loại màu vàng kim
      for (let f = 0; f < 4; f++) {
        const knuckle = new THREE.Mesh(
          this.registerGeo(new THREE.BoxGeometry(0.7, 1.5, 1.2)),
          this.goldVFinMat
        );
        knuckle.position.set((f - 1.5) * 0.8, -12.2, 1.4);
        shoulderPivot.add(knuckle);
      }

      // Nòng pháo hạt năng lượng trên mu bàn tay
      const beamGauntlet = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.4, 0.4, 2.2, 8)),
        this.darkSteelMat
      );
      beamGauntlet.position.set(0, -8.6, 2.2);
      beamGauntlet.rotation.x = Math.PI / 2;
      shoulderPivot.add(beamGauntlet);

      // Piston khí nén áp lực cao phục vụ hoạt ảnh nện đất (Seismic Impact Piston)
      this.seismicPistonRod = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.45, 0.45, 4.2, 8)),
        this.chromePistonMat
      );
      this.seismicPistonRod.position.set(0, -8.2, 2.4);
      shoulderPivot.add(this.seismicPistonRod);
    }

    return shoulderPivot;
  }

  // Dựng chân Gundam khí động học & Bàn chân đỏ kinh điển
  buildLeg(side) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 3.2, -1.4, 0);
    this.pelvisGroup.add(legGroup);

    // Khớp háng cơ khí hình cầu
    const hipSphere = new THREE.Mesh(
      this.registerGeo(new THREE.SphereGeometry(1.6, 12, 12)),
      this.darkSteelMat
    );
    legGroup.add(hipSphere);

    // Đùi Gundam màu trắng thon dài (Thigh Upper Leg)
    const thigh = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.2, 6.4, 3.6)),
      this.armorPrimaryMat
    );
    thigh.position.set(0, -3.8, 0);
    legGroup.add(thigh);

    // Cặp xi-lanh thủy lực đùi trước sau mạ chrome
    const thighPistonCyl = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(0.4, 0.4, 4.6, 8)),
      this.darkSteelMat
    );
    thighPistonCyl.position.set(side * 0.8, -3.8, 1.8);
    legGroup.add(thighPistonCyl);

    const thighPistonRod = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(0.25, 0.25, 4.2, 8)),
      this.chromePistonMat
    );
    thighPistonRod.position.set(side * 0.8, -3.4, 1.8);
    legGroup.add(thighPistonRod);

    // Khớp đầu gối 2 tầng cơ khí (Double-Hinged Knee Joint)
    const kneeJoint = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(1.7, 1.7, 3.4, 12)),
      this.darkSteelMat
    );
    kneeJoint.rotation.z = Math.PI / 2;
    kneeJoint.position.set(0, -7.2, 0);
    legGroup.add(kneeJoint);

    // GIÁP ĐẦU GỐI NHÔ CAO KHÍ ĐỘNG HỌC GUNDAM (GUNDAM KNEE CAP ARMOR)
    const kneeGuard = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(2.8, 3.4, 1.8)),
      this.armorPrimaryMat
    );
    kneeGuard.position.set(0, -7.0, 2.3);
    kneeGuard.rotation.x = -0.32;
    legGroup.add(kneeGuard);

    // Mũi nhọn xanh Cobalt trang trí đỉnh đầu gối
    const kneeChevron = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(1.6, 1.2, 1.9)),
      this.armorBlueMat
    );
    kneeChevron.position.set(0, -6.6, 2.35);
    kneeChevron.rotation.x = -0.32;
    legGroup.add(kneeChevron);

    // Cẳng chân Gundam trắng xòe rộng khí động học (Lower Leg Flared Calf)
    const lowerLeg = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.6, 6.2, 4.2)),
      this.armorPrimaryMat
    );
    lowerLeg.position.set(0, -10.6, 0);
    legGroup.add(lowerLeg);

    // Cặp nắp che động cơ phản lực Vernier 2 bên sườn bắp chân
    for (const lSide of [-1, 1]) {
      const calfThrusterCover = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.65, 3.2, 2.2)),
        this.armorBlueMat
      );
      calfThrusterCover.position.set(lSide * 1.95, -11.2, -0.4);
      calfThrusterCover.rotation.z = lSide * 0.18;
      legGroup.add(calfThrusterCover);

      const vernierBell = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.45, 0.65, 0.8, 8)),
        this.chromePistonMat
      );
      vernierBell.position.set(lSide * 2.1, -11.8, -0.4);
      vernierBell.rotation.z = lSide * Math.PI / 3;
      legGroup.add(vernierBell);
    }

    // Khối bảo vệ mắt cá chân màu trắng (Ankle Armor Guard)
    const ankleGuard = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(4.2, 1.4, 4.8)),
      this.armorPrimaryMat
    );
    ankleGuard.position.set(0, -13.4, 0.4);
    legGroup.add(ankleGuard);

    // BÀN CHÂN ĐỎ HUYỀN THOẠI CỦA GUNDAM 2 KHÚC (ICONIC RED GUNDAM FOOT)
    // 1. Mũi bàn chân đỏ vát góc nhọn khí động học
    const toeMesh = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(4.4, 2.2, 4.6)),
      this.armorRedMat
    );
    toeMesh.position.set(0, -14.4, 2.6);
    toeMesh.rotation.x = -0.08;
    legGroup.add(toeMesh);

    // 2. Gót bàn chân đỏ vững chãi phía sau
    const heelMesh = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(4.2, 2.2, 3.4)),
      this.armorRedMat
    );
    heelMesh.position.set(0, -14.4, -1.2);
    legGroup.add(heelMesh);

    // Móng đế giày xám nòng súng dẫm đất chịu lực (Stomping Sole Plate)
    const solePlate = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(4.6, 0.6, 8.4)),
      this.darkSteelMat
    );
    solePlate.position.set(0, -15.4, 1.2);
    legGroup.add(solePlate);

    return legGroup;
  }

  // ==========================================================================
  // HELPER LẤY VỊ TRÍ BUỒNG LÁI & GHẾ LÁI CHÍNH XÁC 100%
  // ==========================================================================
  getCockpitCameraPos(outVec = new THREE.Vector3()) {
    if (this.cockpitCameraNode) {
      this.cockpitCameraNode.getWorldPosition(outVec);
      return outVec;
    }
    outVec.copy(this.group.position);
    outVec.y += 27.2;
    return outVec;
  }

  getPilotSeatPos(outVec = new THREE.Vector3()) {
    if (this.pilotSeatNode) {
      this.pilotSeatNode.getWorldPosition(outVec);
      return outVec;
    }
    outVec.copy(this.group.position);
    outVec.y += 26.0;
    return outVec;
  }

  // ==========================================================================
  // KHỞI ĐỘNG HỢP THỂ: 7 MẢNH CƠ GIÁP TỪ KHÔNG GIAN LAO XUỐNG
  // ==========================================================================
  startAssembly(targetPos, caster, monsters, onComplete) {
    this.state = 'assembling';
    this.isAssembling = true;
    this.isActive = false;
    this.caster = caster;
    this.monsters = monsters || [];
    this.onCompleteCallback = onComplete;
    this.assemblyElapsed = 0;
    this.totalAssemblyTime = this.isCloneRobot ? 0.95 : 1.55;

    // Tọa độ mục tiêu hạ cánh của Robot
    const groundY = getTerrainHeight(targetPos.x, targetPos.z);
    this.deployPos.set(targetPos.x, groundY, targetPos.z);
    this.group.position.copy(this.deployPos);
    this.group.rotation.y = caster?.rotationY || 0;
    this.group.visible = false; // Ẩn thân chính khi các mảnh đang bay

    // Cho nhân vật vào trạng thái mecha & bất tử ngay lập tức
    if (this.caster) {
      if (this.caster.setMechaActive) {
        this.caster.setMechaActive(true);
      } else {
        this.caster.isMechaActive = true;
      }
      this.caster.giantRobot = this;
      this.caster.isInvulnerable = true;
      this.caster.position.copy(this.deployPos);
    }

    // 1. Tạo Vòng Trận Địa Hologram Khóa Tọa Độ Thả Cơ Giáp
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.position.copy(this.deployPos);
    this.scene.add(this.beaconGroup);

    const beaconRingGeo = this.registerGeo(new THREE.RingGeometry(8.0, 9.5, 36));
    const beaconRingMat = this.registerMat(new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    }));
    this.beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.y = 0.15;
    this.beaconGroup.add(this.beaconRing);

    // Cột sáng định vị vút tận mây trời
    const beamGeo = this.registerGeo(new THREE.CylinderGeometry(4.5, 6.0, 120, 24, 1, true));
    this.beamMat = this.registerMat(new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }));
    const beam = new THREE.Mesh(beamGeo, this.beamMat);
    beam.position.y = 60;
    this.beaconGroup.add(beam);

    // Thang máy ánh sáng phản trọng lực nâng Namcam vào buồng lái
    const tractorGeo = this.registerGeo(new THREE.CylinderGeometry(2.2, 3.2, 28, 16, 1, true));
    this.tractorMat = this.registerMat(new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }));
    this.tractorBeam = new THREE.Mesh(tractorGeo, this.tractorMat);
    this.tractorBeam.position.set(this.deployPos.x, this.deployPos.y + 14, this.deployPos.z);
    this.scene.add(this.tractorBeam);

    // Thông báo toàn server (chỉ khi là robot chính của người chơi)
    if (!this.isCloneRobot) {
      this.damageTexts.spawn('⚠️ KHỞI ĐỘNG HỢP THỂ: CHIẾN THẦN GUNDAM X20!', this.deployPos.clone().add(new THREE.Vector3(0, 8.0, 0)), '#00f2fe');
      if (sound.playThunder) sound.playThunder();
    }

    // 2. TẠO 7 BỘ PHẬN GUNDAM BAY TỪ KHÔNG GIAN LAO XUỐNG
    const partsData = [
      { id: 'legL', delay: 0.0, flightTime: 0.55, start: new THREE.Vector3(-120, 95, -70), color: 0xf8fafc },
      { id: 'legR', delay: 0.1, flightTime: 0.55, start: new THREE.Vector3(120, 95, -70), color: 0xf8fafc },
      { id: 'torso', delay: 0.3, flightTime: 0.55, start: new THREE.Vector3(0, 130, -110), color: 0x1e40af },
      { id: 'armL', delay: 0.5, flightTime: 0.5, start: new THREE.Vector3(-130, 85, 90), color: 0xdc2626 },
      { id: 'armR', delay: 0.65, flightTime: 0.5, start: new THREE.Vector3(130, 85, 90), color: 0xf8fafc },
      { id: 'backpack', delay: 0.8, flightTime: 0.45, start: new THREE.Vector3(0, 100, 120), color: 0x00f2fe },
      { id: 'head', delay: 0.95, flightTime: 0.45, start: new THREE.Vector3(0, 140, 0), color: 0xfbbf24 },
    ];

    this.flyingParts = [];
    for (const p of partsData) {
      const pGroup = new THREE.Group();
      pGroup.position.copy(p.start);

      const boxSize = p.id === 'torso' ? 7.0 : p.id.startsWith('leg') ? 5.5 : 4.0;
      const partBody = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(boxSize, boxSize * 1.2, boxSize)),
        this.armorPrimaryMat
      );
      pGroup.add(partBody);

      const flameTrail = new THREE.Mesh(
        this.registerGeo(new THREE.ConeGeometry(boxSize * 0.9, boxSize * 3.2, 10)),
        this.thrusterFlameMat
      );
      flameTrail.rotation.x = Math.PI / 2;
      flameTrail.position.z = -boxSize * 1.8;
      pGroup.add(flameTrail);

      this.scene.add(pGroup);
      this.flyingParts.push({ ...p, mesh: pGroup, arrived: false });
    }
  }

  // Cập nhật từng frame của quá trình hợp thể
  updateAssembly(delta) {
    this.assemblyElapsed += delta;

    // Xoay vòng trận địa định vị
    if (this.beaconRing) this.beaconRing.rotation.z += delta * 4;
    if (this.beamMat) this.beamMat.opacity = Math.sin(this.assemblyElapsed * 14) * 0.2 + 0.45;

    // Quá trình hút người chơi Namcam bay lên buồng lái
    if (this.assemblyElapsed >= 0.4 && this.caster) {
      const liftProgress = Math.min(1.0, (this.assemblyElapsed - 0.4) / 0.95);
      if (this.tractorMat) this.tractorMat.opacity = Math.sin(liftProgress * Math.PI) * 0.7;
      if (this.tractorBeam) this.tractorBeam.rotation.y += delta * 5;

      const groundY = this.deployPos.y;
      const curY = THREE.MathUtils.lerp(groundY, groundY + 26.7, liftProgress);
      this.caster.group.position.set(this.deployPos.x, curY, this.deployPos.z);
      this.caster.isGrounded = false;

      if (this.particles && Math.random() < 0.5) {
        this.particles.emitElementalParticles(
          this.caster.group.position,
          3,
          [0x00f2fe, 0xffd700, 0xffffff],
          [1, 3],
          0.2,
          2,
          0.4
        );
      }
    }

    // Cập nhật từng bộ phận đang lao tới
    for (const item of this.flyingParts) {
      if (this.assemblyElapsed >= item.delay && !item.arrived) {
        const t = Math.min(1.0, (this.assemblyElapsed - item.delay) / item.flightTime);
        const ease = t * t * (3 - 2 * t);
        item.mesh.position.lerpVectors(item.start, this.deployPos, ease);

        if (this.particles && Math.random() < 0.5) {
          this.particles.emitElementalParticles(
            item.mesh.position,
            4,
            [0x00f2fe, 0xffd700, 0xffffff],
            [2, 5],
            0.3,
            5,
            0.5
          );
        }

        if (t >= 1.0) {
          item.arrived = true;
          this.scene.remove(item.mesh);

          if (sound.playGiantSwordImpact) sound.playGiantSwordImpact();
          if (this.controller) this.controller.addTrauma(0.3);
          if (this.particles) {
            this.particles.emitShockwave(this.deployPos, 0x00f2fe, 12, 0.4);
            this.particles.emitHitSparkles(this.deployPos.clone().add(new THREE.Vector3(0, 5, 0)), 16);
          }
        }
      }
    }

    // HỢP THỂ HOÀN TẤT
    if (this.assemblyElapsed >= this.totalAssemblyTime) {
      this.cleanupAssemblyVisuals();
      this.activatePilotMode();
    }
  }

  cleanupAssemblyVisuals() {
    if (this.beaconGroup) {
      this.scene.remove(this.beaconGroup);
      this.beaconGroup = null;
    }
    if (this.tractorBeam) {
      this.scene.remove(this.tractorBeam);
      this.tractorBeam = null;
    }
    for (const item of this.flyingParts) {
      if (item.mesh.parent) this.scene.remove(item.mesh);
    }
    this.flyingParts = [];
  }

  // ==========================================================================
  // KÍCH HOẠT TRẠNG THÁI ĐIỀU KHIỂN CƠ GIÁP (PILOT MODE)
  // ==========================================================================
  activatePilotMode() {
    this.state = 'active';
    this.isAssembling = false;
    this.isActive = true;
    this.group.visible = true;
    this.timeLeft = this.duration;

    if (this.caster) {
      if (this.caster.setMechaActive) {
        this.caster.setMechaActive(true);
      } else {
        this.caster.isMechaActive = true;
      }
      this.caster.giantRobot = this;
      this.caster.isInvulnerable = true;
      this.caster.position.copy(this.deployPos);
    }

    // Nổ sóng xung kích đại địa khi toàn bộ hệ thống kích hoạt
    if (!this.isCloneRobot) {
      if (sound.playThunder) sound.playThunder();
      if (sound.playRockShatter) sound.playRockShatter();
      if (this.controller) this.controller.addTrauma(0.9);

      this.damageTexts.spawn('🤖 CHIẾN THẦN CƠ GIÁP HỢP THỂ HOÀN TẤT!', this.deployPos.clone().add(new THREE.Vector3(0, 18.0, 0)), '#ffd700');
      this.damageTexts.spawn('💥 ĐÃ VÀO BUỒNG LÁI! [Chuột Trái/F]: Đạp Đất & Nện Sấm Sét | [V]: Buồng Lái', this.deployPos.clone().add(new THREE.Vector3(0, 14.5, 0)), '#ff4757');
    } else {
      if (this.controller) this.controller.addTrauma(0.12);
    }

    if (this.particles) {
      this.particles.emitShockwave(this.deployPos, 0xffd700, this.isCloneRobot ? 18.0 : 36.0, 0.7);
      this.particles.emitShockwave(this.deployPos, 0x00f2fe, this.isCloneRobot ? 14.0 : 24.0, 0.5);
      this.particles.emitElementalParticles(
        this.deployPos.clone().add(new THREE.Vector3(0, 2, 0)),
        this.isCloneRobot ? 20 : 50,
        [0xffd700, 0x00f2fe, 0xffffff],
        [3, 8],
        0.8,
        8,
        1.2
      );
    }

    if (this.onCompleteCallback) {
      this.onCompleteCallback();
      this.onCompleteCallback = null;
    }
  }

  // ==========================================================================
  // CƠ CHẾ ĐÁNH THƯỜNG: ĐẠP CHÂN ĐẠI ĐỊA & NỆN THIẾT QUYỀN THỦY LỰC
  // ==========================================================================
  triggerAttack(monsters) {
    if (!this.isActive || this.isAttacking || this.attackCooldown > 0) return false;

    this.isAttacking = true;
    this.attackTime = 0;
    this.attackCooldown = 1.45;
    this.attackType = this.attackCombo === 0 ? 'stomp' : 'slam';
    this.attackCombo = (this.attackCombo + 1) % 2;
    this.hasImpacted = false;

    this.monsters = monsters || this.monsters;

    if (this.controller) this.controller.addTrauma(0.2);
    return true;
  }

  executeImpact() {
    const forward = new THREE.Vector3(
      -Math.sin(this.group.rotation.y),
      0,
      -Math.cos(this.group.rotation.y)
    ).normalize();

    const dist = this.attackType === 'stomp' ? 7.5 : 10.5;
    const impactPoint = this.group.position.clone().addScaledVector(forward, dist);
    impactPoint.y = getTerrainHeight(impactPoint.x, impactPoint.z);

    const isStomp = this.attackType === 'stomp';
    const damage = this.isCloneRobot ? (isStomp ? 320 : 380) : (isStomp ? 580 : 680);
    const radius = isStomp ? 14.0 : 17.5;
    const damageText = isStomp
      ? (this.isCloneRobot ? '💥 -320 GUNDAM ĐẠP ĐẤT!' : '💥 -580 GUNDAM ĐẠP NÁT ĐẠI ĐỊA!')
      : (this.isCloneRobot ? '⚡ -380 GUNDAM THIẾT QUYỀN!' : '⚡ -680 GUNDAM NỆN THIẾT QUYỀN!');
    const textColor = isStomp ? '#f59e0b' : '#ff4757';

    // 1. TÀN PHÁ & BIẾN DẠNG ĐỊA HÌNH THẬT
    if (this.world && this.world.deformTerrain) {
      this.world.deformTerrain(
        impactPoint.x,
        impactPoint.z,
        radius * 0.95,
        this.isCloneRobot ? (isStomp ? 1.0 : 1.4) : (isStomp ? 1.8 : 2.5),
        isStomp ? 'earth' : 'fire'
      );
    }

    // 2. Âm thanh rung trời chuyển đất
    if (!this.isCloneRobot || Math.random() < 0.25) {
      if (sound.playGiantSwordImpact) sound.playGiantSwordImpact();
      if (sound.playRockShatter) sound.playRockShatter();
      if (!isStomp && sound.playThunder) sound.playThunder();
    }

    // 3. Rung lắc camera cực mạnh
    if (this.controller) {
      this.controller.addTrauma(this.isCloneRobot ? (isStomp ? 0.08 : 0.12) : (isStomp ? 0.65 : 0.85));
    }

    // 4. Bùng nổ hạt & sóng xung kích
    if (this.particles) {
      this.particles.emitShockwave(impactPoint, isStomp ? 0xf59e0b : 0xff4757, radius, 0.7);
      this.particles.emitElementalParticles(
        impactPoint.clone().add(new THREE.Vector3(0, 1.5, 0)),
        40,
        isStomp ? [0xf59e0b, 0x8d5b4c, 0xffffff] : [0xff4757, 0xffd700, 0xffffff],
        [2, 7],
        0.7,
        7,
        1.0
      );
    }

    // 5. GÂY SÁT THƯƠNG DIỆN RỘNG (AOE DAMAGE)
    if (this.pixelFX && this.pixelFX.dealDamageAOE) {
      this.pixelFX.dealDamageAOE(
        impactPoint,
        radius,
        damage,
        damageText,
        textColor,
        this.monsters,
        isStomp ? 'slow' : 'knockback',
        isStomp ? 'earth' : 'fire',
        25.0,
        this.caster
      );
    }
  }

  // ==========================================================================
  // CẬP NHẬT HOẠT ẢNH & LOGIC HÀNG FRAME (UPDATE LOOP)
  // Luôn trả về TRUE khi robot còn tồn tại để PixelFX không bao giờ xóa nhầm!
  // ==========================================================================
  update(delta) {
    if (this.state === 'dead') {
      return false;
    }

    if (this.state === 'assembling') {
      this.updateAssembly(delta);
      return true;
    }

    if (this.state === 'active') {
      this.updateActive(delta);
      return true;
    }

    if (this.state === 'disengaging') {
      return this.updateDisengaging(delta);
    }

    return true;
  }

  updateActive(delta) {
    this.animTime += delta;
    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    this.timeLeft -= delta;
    if (this.timeLeft <= 0) {
      this.disengage();
      return;
    }

    // 1. Đồng bộ vị trí và góc quay theo người chơi
    if (this.caster) {
      const p = this.caster.position;
      const gY = getTerrainHeight(p.x, p.z);
      this.group.position.set(p.x, gY, p.z);
      this.group.rotation.y = this.caster.rotationY || 0;
    }

    // 2. Hoạt ảnh ngọn lửa phản lực phụt sáng nhấp nhô
    const flamePulse = 0.85 + Math.sin(this.animTime * 24) * 0.25;
    for (const f of this.thrusterFlames) {
      f.scale.set(flamePulse, flamePulse * 1.2, flamePulse);
    }
    if (this.reactorGlow) {
      const reactorPulse = 1.0 + Math.sin(this.animTime * 10) * 0.18;
      this.reactorGlow.scale.set(reactorPulse, reactorPulse, reactorPulse);
    }

    // 3. XỬ LÝ HOẠT ẢNH ĐÒN ĐÁNH THƯỜNG (STOMP / SLAM ANIMATION)
    if (this.isAttacking) {
      this.attackTime += delta;
      const progress = this.attackTime / this.attackDuration;

      if (this.attackType === 'stomp') {
        if (progress < 0.4) {
          const up = progress / 0.4;
          this.leftLegGroup.position.y = -1.4 + up * 6.5;
          this.leftLegGroup.rotation.x = -up * 0.85;
          this.torsoGroup.rotation.x = up * 0.15;
        } else if (progress < 0.55) {
          const down = (progress - 0.4) / 0.15;
          this.leftLegGroup.position.y = 5.1 - down * 6.5;
          this.leftLegGroup.rotation.x = -0.85 + down * 0.85;
          if (progress >= 0.5 && !this.hasImpacted) {
            this.hasImpacted = true;
            this.executeImpact();
          }
        } else {
          this.leftLegGroup.position.y = -1.4;
          this.leftLegGroup.rotation.x = 0;
          this.torsoGroup.rotation.x = 0;
        }
      } else {
        // ĐÒN NỆN THIẾT QUYỀN ĐỊA CHẤN: CÚI GẬP NGƯỜI, KHUỴU GỐI NỆN SÁT MẶT ĐẤT
        if (progress < 0.40) {
          // Giai đoạn 1: Khuỵu gối, hạ thấp trọng tâm, vặn người giương nắm đấm lên cao
          const up = progress / 0.40;
          const easeUp = up * up * (3 - 2 * up);

          // Xương chậu hạ thấp 7.5m (từ 16.5m xuống 9.0m)
          this.pelvisGroup.position.y = 16.5 - easeUp * 7.5;

          // Hai chân khuỵu gối choãi rộng tạo thế tấn vững chắc
          this.leftLegGroup.rotation.x = -easeUp * 0.75;
          this.leftLegGroup.rotation.z = -easeUp * 0.25;
          this.rightLegGroup.rotation.x = easeUp * 0.50;
          this.rightLegGroup.rotation.z = easeUp * 0.25;

          // Thân trên cúi gập về phía trước và vặn người lấy đà
          this.torsoGroup.rotation.x = easeUp * 0.70;
          this.torsoGroup.rotation.y = easeUp * 0.45;

          // Cánh tay phải giương cao tột độ ra sau vai nén lực thủy lực
          this.rightArmGroup.rotation.x = -easeUp * 2.35;
          this.rightArmGroup.rotation.z = easeUp * 0.35;
          if (this.seismicPistonRod) this.seismicPistonRod.position.y = -3.8 - easeUp * 1.5;

          // Tay trái dang rộng giữ thăng bằng
          this.leftArmGroup.rotation.x = easeUp * 0.50;
          this.leftArmGroup.rotation.z = -easeUp * 0.45;

          // Đầu cúi xuống khóa chặt mục tiêu dưới đất
          this.headGroup.rotation.x = easeUp * 0.45;
          this.headGroup.rotation.y = -easeUp * 0.25;

        } else if (progress < 0.56) {
          // Giai đoạn 2: CÚI RẠP NGƯỜI XUỐNG VÀ NỆN CẮM THẲNG THIẾT QUYỀN VÀO LÒNG ĐẤT
          const slam = (progress - 0.40) / 0.16;
          const easeSlam = slam * slam;

          // Trọng tâm hạ thấp kịch sàn (8.0m)
          this.pelvisGroup.position.y = 9.0 - easeSlam * 1.0;

          // Hai chân gập sâu
          this.leftLegGroup.rotation.x = -0.75 - easeSlam * 0.20;
          this.leftLegGroup.rotation.z = -0.25;
          this.rightLegGroup.rotation.x = 0.50 + easeSlam * 0.25;
          this.rightLegGroup.rotation.z = 0.25;

          // THÂN TRÊN CÚI GẬP SÂU HẲN XUỐNG ĐẤT (~77 ĐỘ)
          this.torsoGroup.rotation.x = 0.70 + easeSlam * 0.65; // Đạt 1.35 rad
          this.torsoGroup.rotation.y = 0.45 - easeSlam * 0.65;

          // NẮM ĐẤM THỦY LỰC LAO VÚT XUỐNG CẮM THẲNG VÀO MẶT ĐẤT
          this.rightArmGroup.rotation.x = -2.35 + easeSlam * 3.75; // Đạt +1.40 rad
          this.rightArmGroup.rotation.z = 0.35 - easeSlam * 0.45;

          // Tay trái giật mạnh ra sau giữ thăng bằng
          this.leftArmGroup.rotation.x = 0.50 - easeSlam * 1.35;
          this.leftArmGroup.rotation.z = -0.45 + easeSlam * 0.20;

          // Đầu nhìn cắm thẳng vào điểm nện
          this.headGroup.rotation.x = 0.45 + easeSlam * 0.35;
          this.headGroup.rotation.y = 0;

          // Ngọn lửa phản lực sau lưng phụt cực đại ép quả đấm xuống đất
          for (const f of this.thrusterFlames) {
            f.scale.set(2.4, 2.8, 2.4);
          }

          if (progress >= 0.52 && !this.hasImpacted) {
            this.hasImpacted = true;
            if (this.seismicPistonRod) this.seismicPistonRod.position.y = -5.4;
            this.executeImpact();
          }

        } else if (progress < 0.68) {
          // Giai đoạn 3: GIỮ THẾ NỆN ĐẤT (IMPACT HOLD) - Nắm đấm găm sâu vào lòng đất
          this.pelvisGroup.position.y = 8.0;
          this.torsoGroup.rotation.x = 1.35;
          this.torsoGroup.rotation.y = -0.20;
          this.rightArmGroup.rotation.x = 1.40;
          this.rightArmGroup.rotation.z = -0.10;
          this.leftArmGroup.rotation.x = -0.85;
          this.leftLegGroup.rotation.x = -0.95;
          this.leftLegGroup.rotation.z = -0.25;
          this.rightLegGroup.rotation.x = 0.75;
          this.rightLegGroup.rotation.z = 0.25;
          this.headGroup.rotation.x = 0.80;
          if (this.seismicPistonRod) this.seismicPistonRod.position.y = -5.4;

        } else {
          // Giai đoạn 4: ĐỨNG DẬY VÀ KHÔI PHỤC THẾ THỦ
          const recover = (progress - 0.68) / 0.32;
          const easeRec = Math.sin(recover * Math.PI * 0.5);

          this.pelvisGroup.position.y = 8.0 + easeRec * 8.5;
          this.torsoGroup.rotation.x = 1.35 * (1.0 - easeRec);
          this.torsoGroup.rotation.y = -0.20 * (1.0 - easeRec);
          this.rightArmGroup.rotation.x = 1.40 * (1.0 - easeRec);
          this.rightArmGroup.rotation.z = -0.10 * (1.0 - easeRec);
          this.leftArmGroup.rotation.x = -0.85 * (1.0 - easeRec);
          this.leftArmGroup.rotation.z = -0.25 * (1.0 - easeRec);
          this.leftLegGroup.rotation.x = -0.95 * (1.0 - easeRec);
          this.leftLegGroup.rotation.z = -0.25 * (1.0 - easeRec);
          this.rightLegGroup.rotation.x = 0.75 * (1.0 - easeRec);
          this.rightLegGroup.rotation.z = 0.25 * (1.0 - easeRec);
          this.headGroup.rotation.x = 0.80 * (1.0 - easeRec);

          if (this.seismicPistonRod) this.seismicPistonRod.position.y = -5.4 + easeRec * 1.6;
        }
      }

      if (progress >= 1.0) {
        this.isAttacking = false;
        this.hasImpacted = false;
        this.pelvisGroup.position.y = 16.5;
        this.leftLegGroup.position.set(-3.2, -1.4, 0);
        this.leftLegGroup.rotation.set(0, 0, 0);
        this.rightLegGroup.position.set(3.2, -1.4, 0);
        this.rightLegGroup.rotation.set(0, 0, 0);
        this.rightArmGroup.rotation.set(0, 0, 0);
        this.leftArmGroup.rotation.set(0, 0, 0);
        this.torsoGroup.rotation.set(0, 0, 0);
        this.headGroup.rotation.set(0, 0, 0);
        if (this.seismicPistonRod) this.seismicPistonRod.position.y = -3.8;
      }
      return;
    }

    // 4. HOẠT ẢNH BƯỚC ĐI CỦA ROBOT (HEAVY WALKING CYCLE)
    const isMoving = this.caster && (this.caster.speed > 0.1 || (this.caster.velocity && this.caster.velocity.lengthSq() > 0.1));
    if (isMoving) {
      this.walkCycle += delta * 2.8;
      const legSwing = Math.sin(this.walkCycle) * 0.42;

      this.leftLegGroup.rotation.x = legSwing;
      this.rightLegGroup.rotation.x = -legSwing;

      this.leftArmGroup.rotation.x = -legSwing * 0.6;
      this.rightArmGroup.rotation.x = legSwing * 0.6;

      this.pelvisGroup.position.y = 16.5 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.45;

      if (Math.abs(legSwing) > 0.38 && Math.random() < 0.25) {
        if (sound.playFootstep) sound.playFootstep(true);
        if (this.controller) this.controller.addTrauma(0.06);
        if (this.particles) {
          const stepFootPos = this.group.position.clone();
          this.particles.emitElementalParticles(stepFootPos, 4, [0x8d5b4c, 0xcfd8dc], [1, 3], 0.2, 0, 0.4);
        }
      }
    } else {
      this.leftLegGroup.rotation.x = 0;
      this.rightLegGroup.rotation.x = 0;
      this.leftArmGroup.rotation.x = 0;
      this.rightArmGroup.rotation.x = 0;
      this.pelvisGroup.position.y = 16.5 + Math.sin(this.animTime * 1.8) * 0.25;
      this.torsoGroup.rotation.x = Math.sin(this.animTime * 1.8) * 0.03;
    }
  }

  // ==========================================================================
  // KẾT THÚC CƠ GIÁP & PHÓNG TÊN LỬA VỀ TẦNG BÌNH LƯU (DISENGAGE)
  // ==========================================================================
  disengage() {
    if (this.state !== 'active') return;
    this.state = 'disengaging';
    this.isActive = false;

    if (this.caster) {
      if (this.caster.setMechaActive) {
        this.caster.setMechaActive(false);
      } else {
        this.caster.isMechaActive = false;
      }
      this.caster.giantRobot = null;
      this.caster.isInvulnerable = false;
      const gY = getTerrainHeight(this.caster.position.x, this.caster.position.z);
      this.caster.position.y = gY;
      this.caster.group.position.set(this.caster.position.x, gY, this.caster.position.z);
      this.caster.group.visible = true;
    }

    if (this.controller) {
      this.controller.isCockpitView = false;
    }

    // Khôi phục các khớp về tư thế thẳng đứng khi phóng lên trời
    this.isAttacking = false;
    this.pelvisGroup.position.y = 16.5;
    this.leftLegGroup.position.set(-3.2, -1.4, 0);
    this.leftLegGroup.rotation.set(0, 0, 0);
    this.rightLegGroup.position.set(3.2, -1.4, 0);
    this.rightLegGroup.rotation.set(0, 0, 0);
    this.rightArmGroup.rotation.set(0, 0, 0);
    this.leftArmGroup.rotation.set(0, 0, 0);
    this.torsoGroup.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    if (this.seismicPistonRod) this.seismicPistonRod.position.y = -3.8;

    if (!this.isCloneRobot) {
      this.damageTexts.spawn('🚀 CHIẾN THẦN CƠ GIÁP VỀ CĂN CỨ!', this.group.position.clone().add(new THREE.Vector3(0, 16.0, 0)), '#00f2fe');
      if (sound.playThunder) sound.playThunder();
    }

    this.disengageElapsed = 0;
    this.disengageDuration = 1.4;
    this.disengageStartY = this.group.position.y;
  }

  updateDisengaging(delta) {
    this.disengageElapsed += delta;
    const progress = this.disengageElapsed / this.disengageDuration;

    this.group.position.y = this.disengageStartY + Math.pow(progress, 3) * 180;

    if (this.particles && Math.random() < 0.6) {
      this.particles.emitElementalParticles(
        this.group.position.clone().add(new THREE.Vector3(0, 4, 0)),
        8,
        [0x00f2fe, 0xffd700, 0xffffff],
        [3, 8],
        0.5,
        6,
        0.8
      );
    }

    if (progress >= 1.0) {
      this.state = 'dead';
      this.destroy();
      return false; // PixelFX sẽ splice effect này ra
    }
    return true;
  }

  destroy() {
    this.cleanupAssemblyVisuals();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    this.geometries = [];
    this.materials = [];
  }
}
