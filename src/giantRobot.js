import * as THREE from 'three';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';

// ============================================================================
// CHIẾN THẦN CƠ GIÁP KHỔNG LỒ X20 (GIANT TITAN MECHA NAMCAM)
// ============================================================================
// Mô hình Robot khổng lồ cao ~36.5m (gấp 20 lần nhân vật 1.8m).
// 7 bộ phận bay vào từ ngoài bản đồ / tầng bình lưu để hợp thể:
// 1. Chân Trái Thủy Lực (Left Leg & Stomping Sole)
// 2. Chân Phải Thủy Lực (Right Leg & Stomping Sole)
// 3. Khung Thân, Lò Phản Ứng & Buồng Lái (Torso, Cockpit & Reactor)
// 4. Cánh Tay Trái & Đại Thủ Thiết Quyền (Left Arm & Crushing Fist)
// 5. Cánh Tay Phải & Búa Thủy Lực Trọng Kích (Right Arm & Seismic Gauntlet)
// 6. Cặp Động Cơ Phản Lực Khổng Lồ (Twin Thruster Backpack)
// 7. Đầu Cơ Giáp Chiến Thần & Mũ Kính Visor (Titan Head & Visor)
//
// Đòn đánh thường: Đạp Chân Đại Địa & Nện Thiết Quyền Thủy Lực gây chấn động
// và biến dạng địa hình thật (Terrain Deform Craters).
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
    this.group.name = 'GiantRobot_NAMCAM';
    this.scene.add(this.group);

    this.isActive = false;
    this.isAssembling = false;
    this.caster = null;
    this.monsters = [];

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

    // Lưu các vật liệu để giải phóng bộ nhớ khi kết thúc
    this.materials = [];
    this.geometries = [];

    // Tạo vật liệu & dựng khung xương 3D chi tiết
    this.initMaterials();
    this.buildRobotModel();

    // Ẩn nhóm chính trong khi đang bay vào hợp thể
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

  initMaterials() {
    // 1. Giáp chính màu xanh rêu quân đội Việt Nam
    this.armorPrimaryMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0x244222,
      roughness: 0.45,
      metalness: 0.35,
      flatShading: true,
    }));

    // 2. Giáp thứ cấp xanh rêu sáng (camo highlight)
    this.armorHighlightMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0x366333,
      roughness: 0.4,
      metalness: 0.3,
      flatShading: true,
    }));

    // 3. Khung thép hợp kim công nghiệp đen xám (Chassis & Joints)
    this.darkSteelMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0x181e24,
      roughness: 0.35,
      metalness: 0.7,
      flatShading: true,
    }));

    // 4. Thanh Piston thủy lực chrome sáng bóng
    this.chromePistonMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.18,
      metalness: 0.88,
    }));

    // 5. Viền & sọc cảnh báo vàng cam (Hazard Stripes / Decals)
    this.hazardYellowMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.4,
      flatShading: true,
    }));

    // 6. Ngôi Sao Vàng Năm Cánh (Vietnam Army Emblem)
    this.goldStarMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xd97706,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.85,
    }));

    // 7. Kính buồng lái & Visor mắt phát sáng Neon Cyan
    this.cockpitGlassMat = this.registerMat(new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 1.1,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    }));

    // 8. Lõi lò phản ứng lượng tử phát sáng rực rỡ
    this.reactorCoreMat = this.registerMat(new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    }));

    // 9. Ngọn lửa phản lực động cơ (Thruster Jet Flame)
    this.thrusterFlameMat = this.registerMat(new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
    }));
  }

  // ==========================================================================
  // DỰNG TOÀN BỘ MÔ HÌNH 3D CHI TIẾT CỦA CHIẾN THẦN CƠ GIÁP X20
  // ==========================================================================
  buildRobotModel() {
    // ------------------------------------------------------------------------
    // 1. KHUNG HÔNG & KHỚP EO (PELVIS & WAIST) - Gốc tọa độ y=0 tại mặt đất
    // ------------------------------------------------------------------------
    this.pelvisGroup = new THREE.Group();
    this.pelvisGroup.position.set(0, 16.5, 0); // Đặt ở độ cao ~16.5m
    this.group.add(this.pelvisGroup);

    // Khối khung xương hông chính
    const pelvisCore = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(5.2, 3.2, 4.4)),
      this.darkSteelMat
    );
    this.pelvisGroup.add(pelvisCore);

    // Tấm giáp háng chữ V phía trước
    const groinArmor = new THREE.Mesh(
      this.registerGeo(new THREE.ConeGeometry(2.4, 2.8, 4)),
      this.armorPrimaryMat
    );
    groinArmor.rotation.y = Math.PI / 4;
    groinArmor.rotation.x = Math.PI;
    groinArmor.position.set(0, -0.6, 2.3);
    this.pelvisGroup.add(groinArmor);

    // Váy giáp hông 2 bên (Side Hip Armor Skirts)
    for (const side of [-1, 1]) {
      const hipSkirt = new THREE.Group();
      hipSkirt.position.set(side * 3.0, -0.4, 0);

      const skirtPlate = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.8, 3.8, 3.6)),
        this.armorPrimaryMat
      );
      skirtPlate.rotation.z = side * 0.12;
      hipSkirt.add(skirtPlate);

      // Sọc cảnh báo vàng trên váy giáp
      const hazardStripe = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.85, 0.6, 3.2)),
        this.hazardYellowMat
      );
      hazardStripe.rotation.z = side * 0.12;
      hazardStripe.position.y = -0.5;
      hipSkirt.add(hazardStripe);

      this.pelvisGroup.add(hipSkirt);
    }

    // ------------------------------------------------------------------------
    // 2. KHUNG THÂN & LÒ PHẢN ỨNG (TORSO & COCKPIT)
    // ------------------------------------------------------------------------
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 2.2, 0); // Nối tiếp trên hông
    this.pelvisGroup.add(this.torsoGroup);

    // Bụng khớp nối linh hoạt (Abdominal segmented plates)
    for (let i = 0; i < 2; i++) {
      const abPlate = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(4.2 - i * 0.4, 1.2, 3.6)),
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

    // Khung Lồng Ngực Chính Khổng Lồ (Main Chest Chassis)
    const chestGroup = new THREE.Group();
    chestGroup.position.set(0, 4.8, 0);
    this.torsoGroup.add(chestGroup);

    const chestCenter = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(7.6, 5.6, 6.2)),
      this.armorPrimaryMat
    );
    chestGroup.add(chestCenter);

    // Tấm giáp ngực dốc phía trước (Angled Front Armor Plate)
    const frontArmor = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(6.6, 4.4, 1.8)),
      this.armorHighlightMat
    );
    frontArmor.position.set(0, 0.4, 3.4);
    frontArmor.rotation.x = -0.22;
    chestGroup.add(frontArmor);

    // Lõi Lò Phản Ứng Lượng Tử Trung Tâm (Quantum Reactor Core)
    const reactorHousing = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(1.9, 1.9, 0.8, 12)),
      this.darkSteelMat
    );
    reactorHousing.rotation.x = Math.PI / 2;
    reactorHousing.position.set(0, 0.2, 4.3);
    chestGroup.add(reactorHousing);

    this.reactorGlow = new THREE.Mesh(
      this.registerGeo(new THREE.SphereGeometry(1.35, 16, 16)),
      this.reactorCoreMat
    );
    this.reactorGlow.position.set(0, 0.2, 4.45);
    chestGroup.add(this.reactorGlow);

    // Vành hào quang lò phản ứng
    const reactorRing = new THREE.Mesh(
      this.registerGeo(new THREE.TorusGeometry(1.65, 0.15, 8, 24)),
      this.hazardYellowMat
    );
    reactorRing.position.set(0, 0.2, 4.5);
    chestGroup.add(reactorRing);

    // NGÔI SAO VÀNG NĂM CÁNH QUÂN ĐỘI VIỆT NAM TRÊN NGỰC
    const starMesh = this.buildStarMesh(1.8, 0.4);
    starMesh.position.set(0, 2.3, 4.1);
    chestGroup.add(starMesh);

    // BUỒNG LÁI CƠ GIÁP (COCKPIT & PILOT HOUSING)
    // Nằm ở phần trên ngực, vòm kính quan sát phát sáng
    const cockpitCanopy = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(4.2, 2.0, 3.2)),
      this.cockpitGlassMat
    );
    cockpitCanopy.position.set(0, 3.2, 2.2);
    cockpitCanopy.rotation.x = -0.35;
    chestGroup.add(cockpitCanopy);

    // Khung kim loại bảo vệ kính buồng lái
    for (const side of [-1, 1]) {
      const rollBar = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.35, 2.2, 0.35)),
        this.darkSteelMat
      );
      rollBar.position.set(side * 1.5, 3.2, 2.25);
      rollBar.rotation.x = -0.35;
      chestGroup.add(rollBar);
    }

    // ------------------------------------------------------------------------
    // 3. ĐẦU CƠ GIÁP CHIẾN THẦN (TITAN MECHA HEAD & VISOR)
    // ------------------------------------------------------------------------
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 5.8, 0.5);
    chestGroup.add(this.headGroup);

    // Cổ xoay cơ khí
    const neckMesh = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(1.6, 1.8, 1.2, 10)),
      this.darkSteelMat
    );
    neckMesh.position.y = -0.6;
    this.headGroup.add(neckMesh);

    // Hộp sọ đầu cơ giáp
    const headSkull = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.0, 2.4, 3.2)),
      this.armorPrimaryMat
    );
    headSkull.position.y = 1.0;
    this.headGroup.add(headSkull);

    // Mũ cối bảo vệ cảm biến cách điệu mecha (Military Helmet Crest)
    const helmetDome = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(2.3, 2.6, 1.0, 10)),
      this.armorHighlightMat
    );
    helmetDome.position.set(0, 2.2, 0);
    this.headGroup.add(helmetDome);

    const helmetRim = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(2.8, 2.8, 0.3, 10)),
      this.hazardYellowMat
    );
    helmetRim.position.set(0, 1.7, 0.2);
    this.headGroup.add(helmetRim);

    // Sao Vàng mini trên trán mũ cối
    const headStar = this.buildStarMesh(0.7, 0.2);
    headStar.position.set(0, 2.25, 2.0);
    this.headGroup.add(headStar);

    // Kính ngắm quang học Neon Visor (Glowing Eye Sensor Bar)
    this.headVisor = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(2.2, 0.6, 0.8)),
      this.cockpitGlassMat
    );
    this.headVisor.position.set(0, 1.1, 1.6);
    this.headGroup.add(this.headVisor);

    // Cặp ăng-ten tác chiến vát nghiêng 2 bên tai
    for (const side of [-1, 1]) {
      const antenna = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(0.1, 0.25, 3.2, 6)),
        this.hazardYellowMat
      );
      antenna.position.set(side * 1.8, 2.6, -0.6);
      antenna.rotation.z = -side * 0.45;
      antenna.rotation.x = -0.3;
      this.headGroup.add(antenna);
    }

    // ------------------------------------------------------------------------
    // 4. BA LÔ ĐỘNG CƠ PHẢN LỰC ĐÔI (TWIN THRUSTER BACKPACK)
    // ------------------------------------------------------------------------
    this.backpackGroup = new THREE.Group();
    this.backpackGroup.position.set(0, 0.4, -3.8);
    chestGroup.add(this.backpackGroup);

    const backpackChassis = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(6.4, 6.2, 2.4)),
      this.darkSteelMat
    );
    this.backpackGroup.add(backpackChassis);

    // Cặp loa xả phản lực khổng lồ (Dual Jet Engines)
    this.thrusterFlames = [];
    for (const side of [-1, 1]) {
      const nozzleGroup = new THREE.Group();
      nozzleGroup.position.set(side * 2.2, -1.8, -1.2);

      const nozzleHousing = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(1.3, 1.6, 3.2, 12)),
        this.armorPrimaryMat
      );
      nozzleHousing.rotation.x = Math.PI / 4;
      nozzleGroup.add(nozzleHousing);

      const nozzleBell = new THREE.Mesh(
        this.registerGeo(new THREE.CylinderGeometry(1.6, 1.8, 0.8, 12, 1, true)),
        this.darkSteelMat
      );
      nozzleBell.rotation.x = Math.PI / 4;
      nozzleBell.position.set(0, -1.2, -1.2);
      nozzleGroup.add(nozzleBell);

      // Ngọn lửa phụt phản lực
      const flameMesh = new THREE.Mesh(
        this.registerGeo(new THREE.ConeGeometry(1.4, 4.8, 10)),
        this.thrusterFlameMat
      );
      flameMesh.rotation.x = -Math.PI * 0.75;
      flameMesh.position.set(0, -2.6, -2.6);
      nozzleGroup.add(flameMesh);
      this.thrusterFlames.push(flameMesh);

      this.backpackGroup.add(nozzleGroup);
    }

    // ------------------------------------------------------------------------
    // 5. CÁNH TAY TRÁI (LEFT ARM & CRUSHING FIST)
    // ------------------------------------------------------------------------
    this.leftShoulderGroup = new THREE.Group();
    this.leftShoulderGroup.position.set(-5.6, 1.8, 0);
    chestGroup.add(this.leftShoulderGroup);

    // Khối Giáp Vai Khổng Lồ (Shoulder Pauldron)
    const shoulderLMesh = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.6, 3.8, 4.4)),
      this.armorPrimaryMat
    );
    this.leftShoulderGroup.add(shoulderLMesh);

    // Ống phóng tên lửa mini trên đỉnh vai
    for (let r = -1; r <= 1; r += 2) {
      for (let c = -1; c <= 1; c += 2) {
        const podTube = new THREE.Mesh(
          this.registerGeo(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 8)),
          this.darkSteelMat
        );
        podTube.position.set(r * 0.8, 2.0, c * 0.9);
        this.leftShoulderGroup.add(podTube);

        const warhead = new THREE.Mesh(
          this.registerGeo(new THREE.SphereGeometry(0.3, 8, 8)),
          this.hazardYellowMat
        );
        warhead.position.set(r * 0.8, 2.4, c * 0.9);
        this.leftShoulderGroup.add(warhead);
      }
    }

    // Khớp xoay cánh tay trái
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.6, -2.2, 0);
    this.leftShoulderGroup.add(this.leftArmGroup);

    // Bắp tay trái (Bicep)
    const bicepL = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(2.4, 4.6, 2.6)),
      this.darkSteelMat
    );
    bicepL.position.y = -2.0;
    this.leftArmGroup.add(bicepL);

    // Cẳng tay trái & Bàn tay đấm (Forearm & Crushing Fist)
    this.leftForearmGroup = new THREE.Group();
    this.leftForearmGroup.position.set(0, -4.6, 0);
    this.leftArmGroup.add(this.leftForearmGroup);

    const forearmL = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.2, 5.2, 3.4)),
      this.armorPrimaryMat
    );
    forearmL.position.y = -2.2;
    this.leftForearmGroup.add(forearmL);

    // Nắm Đấm Thép Bên Trái (Left Steel Fist)
    const fistL = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.4, 3.2, 3.6)),
      this.darkSteelMat
    );
    fistL.position.y = -5.8;
    this.leftForearmGroup.add(fistL);

    // 4 Khớp ngón tay bọc giáp vàng
    for (let f = 0; f < 4; f++) {
      const knuckle = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.7, 1.4, 0.9)),
        this.hazardYellowMat
      );
      knuckle.position.set(-1.05 + f * 0.7, -6.6, 1.2);
      this.leftForearmGroup.add(knuckle);
    }

    // ------------------------------------------------------------------------
    // 6. CÁNH TAY PHẢI (RIGHT ARM & SEISMIC HYDRAULIC GAUNTLET)
    // ------------------------------------------------------------------------
    this.rightShoulderGroup = new THREE.Group();
    this.rightShoulderGroup.position.set(5.6, 1.8, 0);
    chestGroup.add(this.rightShoulderGroup);

    const shoulderRMesh = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.6, 3.8, 4.4)),
      this.armorPrimaryMat
    );
    this.rightShoulderGroup.add(shoulderRMesh);

    // Khớp xoay cánh tay phải
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.6, -2.2, 0);
    this.rightShoulderGroup.add(this.rightArmGroup);

    const bicepR = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(2.4, 4.6, 2.6)),
      this.darkSteelMat
    );
    bicepR.position.y = -2.0;
    this.rightArmGroup.add(bicepR);

    // Cẳng tay phải tích hợp PISTON THỦY LỰC ĐỊA CHẤN (Seismic Ram)
    this.rightForearmGroup = new THREE.Group();
    this.rightForearmGroup.position.set(0, -4.6, 0);
    this.rightArmGroup.add(this.rightForearmGroup);

    const forearmR = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.6, 5.6, 3.8)),
      this.armorPrimaryMat
    );
    forearmR.position.y = -2.2;
    this.rightForearmGroup.add(forearmR);

    // Piston trợ lực thủy lực ngoại cỡ trên lưng cẳng tay
    const seismicCylinder = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(0.85, 0.85, 4.6, 10)),
      this.darkSteelMat
    );
    seismicCylinder.position.set(0, -2.0, -2.0);
    this.rightForearmGroup.add(seismicCylinder);

    this.seismicPistonRod = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(0.55, 0.55, 3.8, 10)),
      this.chromePistonMat
    );
    this.seismicPistonRod.position.set(0, -3.8, -2.0);
    this.rightForearmGroup.add(this.seismicPistonRod);

    // NẮM ĐẤM THỦY LỰC ĐỊA CHẤN KHỔNG LỒ (HEAVY SEISMIC IMPACT FIST)
    this.rightFist = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(4.2, 3.8, 4.2)),
      this.darkSteelMat
    );
    this.rightFist.position.y = -6.2;
    this.rightForearmGroup.add(this.rightFist);

    // 4 Cọc búa chấn động vàng trên đốt ngón tay
    for (let f = 0; f < 4; f++) {
      const ramKnuckle = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(0.85, 1.8, 1.2)),
        this.hazardYellowMat
      );
      ramKnuckle.position.set(-1.3 + f * 0.88, -7.2, 1.4);
      this.rightForearmGroup.add(ramKnuckle);
    }

    // ------------------------------------------------------------------------
    // 7. ĐÔI CHÂN TRỤ & BÀN CHÂN ĐẠI ĐỊA (LEGS & STOMPING FEET)
    // ------------------------------------------------------------------------
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-2.8, -1.4, 0);
    this.pelvisGroup.add(this.leftLegGroup);

    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(2.8, -1.4, 0);
    this.pelvisGroup.add(this.rightLegGroup);

    // Dựng 2 chân hoàn chỉnh đối xứng
    this.buildLeg(this.leftLegGroup, -1);
    this.buildLeg(this.rightLegGroup, 1);
  }

  // Dựng 1 chân hoàn chỉnh gồm đùi, khớp gối có khiên giáp, bắp chân, bàn chân đạp đất
  buildLeg(parentGroup, side) {
    // 1. Đùi (Thigh)
    const thighMesh = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.0, 7.2, 3.4)),
      this.armorPrimaryMat
    );
    thighMesh.position.y = -3.6;
    parentGroup.add(thighMesh);

    // Thanh piston thủy lực bên hông đùi
    const thighPiston = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(0.3, 0.3, 5.8, 8)),
      this.chromePistonMat
    );
    thighPiston.position.set(side * 1.8, -3.6, 0);
    parentGroup.add(thighPiston);

    // 2. Khớp Gối (Knee Joint & High-Rise Knee Shield)
    const kneeGroup = new THREE.Group();
    kneeGroup.position.set(0, -7.2, 0);
    parentGroup.add(kneeGroup);

    const kneeJoint = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 10)),
      this.darkSteelMat
    );
    kneeJoint.rotation.z = Math.PI / 2;
    kneeGroup.add(kneeJoint);

    // Tấm giáp che khớp gối vươn nhọn phía trước
    const kneeShield = new THREE.Mesh(
      this.registerGeo(new THREE.ConeGeometry(2.2, 3.2, 4)),
      this.hazardYellowMat
    );
    kneeShield.rotation.y = Math.PI / 4;
    kneeShield.rotation.x = 0.45;
    kneeShield.position.set(0, 0.6, 1.8);
    kneeGroup.add(kneeShield);

    // 3. Cẳng Chân & Bắp Chân (Calf & Shin)
    const calfMesh = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.4, 7.4, 3.8)),
      this.armorPrimaryMat
    );
    calfMesh.position.y = -4.0;
    kneeGroup.add(calfMesh);

    // Động cơ phản lực hỗ trợ bật nhảy phía sau bắp chân
    const calfThruster = new THREE.Mesh(
      this.registerGeo(new THREE.CylinderGeometry(0.7, 0.9, 2.2, 8)),
      this.darkSteelMat
    );
    calfThruster.rotation.x = -0.3;
    calfThruster.position.set(0, -3.8, -2.2);
    kneeGroup.add(calfThruster);

    // 4. BÀN CHÂN ĐẠI ĐỊA KHỔNG LỒ (HEAVY STOMPING FOOT) - ~4.2m rộng x 7.2m dài!
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -7.8, 0.6);
    kneeGroup.add(footGroup);

    // Khối đế bàn chân
    const soleBase = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(4.4, 1.6, 7.4)),
      this.darkSteelMat
    );
    soleBase.position.y = -0.5;
    footGroup.add(soleBase);

    // 3 Móng vuốt xẻ rãnh bám đất phía trước bàn chân
    for (let c = -1; c <= 1; c++) {
      const toeClaw = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(1.2, 1.4, 2.2)),
        this.hazardYellowMat
      );
      toeClaw.position.set(c * 1.4, -0.4, 4.4);
      toeClaw.rotation.x = 0.25;
      footGroup.add(toeClaw);
    }

    // Gót chân chống giật lùi (Heel Anchor Stabilizer)
    const heelSpur = new THREE.Mesh(
      this.registerGeo(new THREE.BoxGeometry(3.6, 1.8, 2.2)),
      this.armorPrimaryMat
    );
    heelSpur.position.set(0, -0.2, -4.2);
    heelSpur.rotation.x = -0.3;
    footGroup.add(heelSpur);

    // Lưu lại tham chiếu chân để gán hoạt ảnh bước đi và dậm nện
    if (side < 0) {
      this.leftFootMesh = footGroup;
      this.leftKneeGroup = kneeGroup;
    } else {
      this.rightFootMesh = footGroup;
      this.rightKneeGroup = kneeGroup;
    }
  }

  // Dựng lưới Ngôi Sao Vàng Năm Cánh chuẩn tỷ lệ
  buildStarMesh(radius, thickness) {
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
      depth: thickness,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: thickness * 0.2,
      bevelThickness: thickness * 0.2,
    };
    const starGeo = this.registerGeo(new THREE.ExtrudeGeometry(starShape, extrudeSettings));
    const starMesh = new THREE.Mesh(starGeo, this.goldStarMat);
    return starMesh;
  }

  // ==========================================================================
  // QUY TRÌNH HỢP THỂ TỪ NGOÀI KHÔNG GIAN (ATMOSPHERIC ASSEMBLY SEQUENCE)
  // ==========================================================================
  startAssembly(targetPos, caster, monsters, onComplete) {
    this.caster = caster;
    this.monsters = monsters;
    this.isAssembling = true;
    this.isActive = false;

    // Tọa độ mục tiêu hạ cánh của Robot
    const groundY = getTerrainHeight(targetPos.x, targetPos.z);
    this.deployPos = new THREE.Vector3(targetPos.x, groundY, targetPos.z);
    this.group.position.copy(this.deployPos);

    // Hướng nhìn của Robot theo hướng của nhân vật
    if (caster) {
      this.group.rotation.y = caster.rotationY || 0;
    }

    // 1. Tạo Vòng Trận Địa Hologram Khóa Tọa Độ Thả Cơ Giáp (Target Landing Beacon)
    const beaconGroup = new THREE.Group();
    beaconGroup.position.copy(this.deployPos);
    this.scene.add(beaconGroup);

    const beaconRingGeo = this.registerGeo(new THREE.RingGeometry(8.0, 9.5, 36));
    const beaconRingMat = this.registerMat(new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    }));
    const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.15;
    beaconGroup.add(beaconRing);

    // Cột sáng định vị vút tận mây trời
    const beamGeo = this.registerGeo(new THREE.CylinderGeometry(4.5, 6.0, 120, 24, 1, true));
    const beamMat = this.registerMat(new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }));
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 60;
    beaconGroup.add(beam);

    // Thông báo toàn server
    this.damageTexts.spawn('⚠️ KHỞI ĐỘNG HỢP THỂ: CHIẾN THẦN CƠ GIÁP X20!', this.deployPos.clone().add(new THREE.Vector3(0, 8.0, 0)), '#00f2fe');
    if (sound.playThunder) sound.playThunder();

    // 2. TẠO 7 BỘ PHẬN BAY TỪ NGOÀI KHÔNG GIAN LAO XUỐNG
    // Mỗi bộ phận bắt đầu ở vị trí cao 90m - 140m và cách xa 120m - 160m ngoài map
    const partsData = [
      { id: 'legL', delay: 0.0, flightTime: 0.85, start: new THREE.Vector3(-140, 110, -90), target: new THREE.Vector3(0, 0, 0), color: 0x244222 },
      { id: 'legR', delay: 0.15, flightTime: 0.85, start: new THREE.Vector3(140, 110, -90), target: new THREE.Vector3(0, 0, 0), color: 0x244222 },
      { id: 'torso', delay: 0.55, flightTime: 0.9, start: new THREE.Vector3(0, 150, -160), target: new THREE.Vector3(0, 0, 0), color: 0x366333 },
      { id: 'armL', delay: 1.1, flightTime: 0.85, start: new THREE.Vector3(-160, 95, 120), target: new THREE.Vector3(0, 0, 0), color: 0x181e24 },
      { id: 'armR', delay: 1.25, flightTime: 0.85, start: new THREE.Vector3(160, 95, 120), target: new THREE.Vector3(0, 0, 0), color: 0x181e24 },
      { id: 'backpack', delay: 1.6, flightTime: 0.8, start: new THREE.Vector3(0, 120, 150), target: new THREE.Vector3(0, 0, 0), color: 0x00f2fe },
      { id: 'head', delay: 1.9, flightTime: 0.75, start: new THREE.Vector3(0, 160, 0), target: new THREE.Vector3(0, 0, 0), color: 0xffd700 },
    ];

    const flyingMeshes = [];
    for (const p of partsData) {
      const pGroup = new THREE.Group();
      pGroup.position.copy(p.start);

      // Đại diện tạm thời của bộ phận đang bay với luồng lửa phản lực bao bọc
      const boxSize = p.id === 'torso' ? 7.0 : p.id.startsWith('leg') ? 5.5 : 4.0;
      const partBody = new THREE.Mesh(
        this.registerGeo(new THREE.BoxGeometry(boxSize, boxSize * 1.2, boxSize)),
        this.armorPrimaryMat
      );
      pGroup.add(partBody);

      // Đuôi lửa phản lực bao quanh bộ phận
      const flameTrail = new THREE.Mesh(
        this.registerGeo(new THREE.ConeGeometry(boxSize * 0.9, boxSize * 3.2, 10)),
        this.thrusterFlameMat
      );
      flameTrail.rotation.x = Math.PI / 2;
      flameTrail.position.z = -boxSize * 1.8;
      pGroup.add(flameTrail);

      this.scene.add(pGroup);
      flyingMeshes.push({ ...p, mesh: pGroup, arrived: false });
    }

    let elapsed = 0;
    const totalAssemblyTime = 2.95;

    // Vòng lặp cập nhật quá trình bay & lắp ráp
    const assemblyEffect = {
      update: (delta) => {
        elapsed += delta;

        // Xoay vòng trận địa định vị
        beaconRing.rotation.z += delta * 3.5;
        beamMat.opacity = Math.sin(elapsed * 12) * 0.2 + 0.35;

        // Cập nhật từng bộ phận đang lao tới
        for (const item of flyingMeshes) {
          if (elapsed >= item.delay && !item.arrived) {
            const t = Math.min(1.0, (elapsed - item.delay) / item.flightTime);
            // Đường cong bay lao dốc có gia tốc rơi
            const ease = t * t * (3 - 2 * t);
            item.mesh.position.lerpVectors(item.start, this.deployPos, ease);

            // Bắn tia lửa & khói hạt
            if (this.particles && Math.random() < 0.6) {
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

            // Khi bộ phận chạm điểm khóa
            if (t >= 1.0) {
              item.arrived = true;
              this.scene.remove(item.mesh);

              // Hiệu ứng chốt khóa cơ khí (Mechanical Lock Impact)
              if (sound.playGiantSwordImpact) sound.playGiantSwordImpact();
              if (this.controller) this.controller.addTrauma(0.35);
              if (this.particles) {
                this.particles.emitShockwave(this.deployPos, 0x00f2fe, 12, 0.4);
                this.particles.emitHitSparkles(this.deployPos.clone().add(new THREE.Vector3(0, 5, 0)), 18);
              }
            }
          }
        }

        // HỢP THỂ HOÀN TẤT
        if (elapsed >= totalAssemblyTime) {
          // Xóa hiệu ứng định vị
          this.scene.remove(beaconGroup);
          beaconRingGeo.dispose();
          beaconRingMat.dispose();
          beamGeo.dispose();
          beamMat.dispose();

          for (const item of flyingMeshes) {
            if (item.mesh.parent) this.scene.remove(item.mesh);
          }

          // Kích hoạt Robot chính thức
          this.activatePilotMode(onComplete);
          return false; // Kết thúc effect trong PixelFXManager
        }

        return true;
      },
    };

    this.pixelFX.activeEffects.push(assemblyEffect);
  }

  // ==========================================================================
  // KÍCH HOẠT TRẠNG THÁI ĐIỀU KHIỂN CƠ GIÁP (PILOT MODE)
  // ==========================================================================
  activatePilotMode(onComplete) {
    this.isAssembling = false;
    this.isActive = true;
    this.group.visible = true;
    this.timeLeft = this.duration;

    // Gán cờ cho nhân vật
    if (this.caster) {
      this.caster.isMechaActive = true;
      this.caster.giantRobot = this;
      this.caster.isInvulnerable = true; // Cơ giáp khổng lồ siêu bền
      // Đưa nhân vật vào vị trí buồng lái trên cao
      this.caster.position.copy(this.deployPos);
    }

    // Nổ sóng xung kích đại địa khi toàn bộ hệ thống kích hoạt
    if (sound.playThunder) sound.playThunder();
    if (sound.playRockShatter) sound.playRockShatter();
    if (this.controller) this.controller.addTrauma(0.85);

    if (this.particles) {
      this.particles.emitShockwave(this.deployPos, 0xffd700, 36.0, 0.9);
      this.particles.emitShockwave(this.deployPos, 0x00f2fe, 24.0, 0.65);
      this.particles.emitElementalParticles(
        this.deployPos.clone().add(new THREE.Vector3(0, 2, 0)),
        50,
        [0xffd700, 0x00f2fe, 0xffffff],
        [3, 8],
        0.8,
        8,
        1.2
      );
    }

    // Thông báo xuất hiện oanh liệt
    this.damageTexts.spawn('🤖 CHIẾN THẦN CƠ GIÁP HỢP THỂ HOÀN TẤT!', this.deployPos.clone().add(new THREE.Vector3(0, 18.0, 0)), '#ffd700');
    this.damageTexts.spawn('💥 SỨC MẠNH X20: ĐẠP & NỆN ĐẠI ĐỊA!', this.deployPos.clone().add(new THREE.Vector3(0, 14.5, 0)), '#ff4757');

    if (onComplete) onComplete();
  }

  // ==========================================================================
  // CƠ CHẾ ĐÁNH THƯỜNG: ĐẠP CHÂN ĐẠI ĐỊA & NỆN THIẾT QUYỀN THỦY LỰC
  // ==========================================================================
  triggerAttack(monsters) {
    if (!this.isActive || this.isAttacking || this.attackCooldown > 0) return false;

    this.isAttacking = true;
    this.attackTime = 0;
    this.attackCooldown = 1.45; // Đòn đánh chậm có sức nặng
    this.attackType = this.attackCombo === 0 ? 'stomp' : 'slam';
    this.attackCombo = (this.attackCombo + 1) % 2;

    this.monsters = monsters || this.monsters;

    // Rung nhẹ khi bắt đầu dồn lực
    if (this.controller) this.controller.addTrauma(0.2);

    return true;
  }

  // Thực thi gây sát thương nổ & biến dạng địa hình khi đòn chạm đất
  executeImpact() {
    const forward = new THREE.Vector3(
      -Math.sin(this.group.rotation.y),
      0,
      -Math.cos(this.group.rotation.y)
    ).normalize();

    // Điểm nện cách robot 8m - 12m phía trước
    const dist = this.attackType === 'stomp' ? 7.5 : 10.5;
    const impactPoint = this.group.position.clone().addScaledVector(forward, dist);
    impactPoint.y = getTerrainHeight(impactPoint.x, impactPoint.z);

    const isStomp = this.attackType === 'stomp';
    const damage = isStomp ? 580 : 680;
    const radius = isStomp ? 14.0 : 16.5;
    const damageText = isStomp ? '💥 -580 ĐẠP NÁT ĐẠI ĐỊA!' : '⚡ -680 NỆN THIẾT QUYỀN!';
    const textColor = isStomp ? '#f59e0b' : '#ff4757';

    // 1. TÀN PHÁ & BIẾN DẠNG ĐỊA HÌNH THẬT (TẠO HỐ LÕM SÂU 1.8m - 2.2m)
    if (this.world && this.world.deformTerrain) {
      this.world.deformTerrain(
        impactPoint.x,
        impactPoint.z,
        radius * 0.95,
        isStomp ? 1.8 : 2.2,
        isStomp ? 'earth' : 'fire'
      );
    }

    // 2. Âm thanh rung trời chuyển đất
    if (sound.playGiantSwordImpact) sound.playGiantSwordImpact();
    if (sound.playRockShatter) sound.playRockShatter();
    if (!isStomp && sound.playThunder) sound.playThunder();

    // 3. Rung lắc camera cực mạnh (Trauma Shake)
    if (this.controller) this.controller.addTrauma(isStomp ? 0.65 : 0.85);

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

    // 5. GÂY SÁT THƯƠNG DIỆN RỘNG (AOE DAMAGE) LÊN QUÁI VẬT & NGƯỜI CHƠI
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
  // ==========================================================================
  update(delta) {
    if (!this.isActive) return;

    this.animTime += delta;
    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    // Đếm ngược thời gian duy trì
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
        // Đòn Đạp Chân: Nâng chân trái cao 8m rồi dậm cực mạnh xuống
        if (progress < 0.4) {
          const up = progress / 0.4;
          this.leftLegGroup.position.y = -1.4 + up * 6.5;
          this.leftLegGroup.rotation.x = -up * 0.85;
          this.torsoGroup.rotation.x = up * 0.15;
        } else if (progress < 0.55) {
          // Hạ chân dậm mạnh xuống
          const down = (progress - 0.4) / 0.15;
          this.leftLegGroup.position.y = 5.1 - down * 6.5;
          this.leftLegGroup.rotation.x = -0.85 + down * 0.85;
          if (progress >= 0.5 && !this.hasImpacted) {
            this.hasImpacted = true;
            this.executeImpact();
          }
        } else {
          // Khôi phục thế đứng
          this.leftLegGroup.position.y = -1.4;
          this.leftLegGroup.rotation.x = 0;
          this.torsoGroup.rotation.x = 0;
        }
      } else {
        // Đòn Nện Nắm Đấm Thủy Lực: Vung tay phải lên cao rồi nện cắm xuống đất
        if (progress < 0.42) {
          const up = progress / 0.42;
          this.rightArmGroup.rotation.x = -up * 1.9;
          this.torsoGroup.rotation.y = up * 0.35;
          if (this.seismicPistonRod) this.seismicPistonRod.position.y = -3.8 - up * 1.2;
        } else if (progress < 0.58) {
          const slam = (progress - 0.42) / 0.16;
          this.rightArmGroup.rotation.x = -1.9 + slam * 2.8; // Nện sâu xuống phía trước
          this.torsoGroup.rotation.x = slam * 0.35;
          if (progress >= 0.52 && !this.hasImpacted) {
            this.hasImpacted = true;
            this.executeImpact();
          }
        } else {
          const recover = (progress - 0.58) / 0.42;
          this.rightArmGroup.rotation.x = 0.9 - recover * 0.9;
          this.torsoGroup.rotation.x = 0.35 - recover * 0.35;
          this.torsoGroup.rotation.y = 0.35 - recover * 0.35;
          if (this.seismicPistonRod) this.seismicPistonRod.position.y = -5.0 + recover * 1.2;
        }
      }

      if (progress >= 1.0) {
        this.isAttacking = false;
        this.hasImpacted = false;
        this.leftLegGroup.position.y = -1.4;
        this.leftLegGroup.rotation.x = 0;
        this.rightArmGroup.rotation.x = 0;
        this.torsoGroup.rotation.x = 0;
        this.torsoGroup.rotation.y = 0;
      }
      return;
    }

    // 4. HOẠT ẢNH BƯỚC ĐI CỦA ROBOT (HEAVY WALKING CYCLE)
    const isMoving = this.caster && (this.caster.speed > 0.1 || (this.caster.velocity && this.caster.velocity.lengthSq() > 0.1));
    if (isMoving) {
      this.walkCycle += delta * 2.8; // Bước sải dài, chậm rãi đầy uy lực
      const legSwing = Math.sin(this.walkCycle) * 0.42;

      this.leftLegGroup.rotation.x = legSwing;
      this.rightLegGroup.rotation.x = -legSwing;

      // Cánh tay đung đưa theo nhịp bước
      this.leftArmGroup.rotation.x = -legSwing * 0.6;
      this.rightArmGroup.rotation.x = legSwing * 0.6;

      // Hông nhún nhẹ theo từng bước
      this.pelvisGroup.position.y = 16.5 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.45;

      // Bụi & chấn động mỗi khi bước chân chạm đất
      if (Math.abs(legSwing) > 0.38 && Math.random() < 0.25) {
        if (sound.playFootstep) sound.playFootstep(true);
        if (this.controller) this.controller.addTrauma(0.06);
        if (this.particles) {
          const stepFootPos = this.group.position.clone();
          this.particles.emitElementalParticles(stepFootPos, 4, [0x8d5b4c, 0xcfd8dc], [1, 3], 0.2, 0, 0.4);
        }
      }
    } else {
      // Đứng thở thủy lực (Idle Breathing)
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
    if (!this.isActive) return;
    this.isActive = false;

    // Trả lại trạng thái cho nhân vật
    if (this.caster) {
      this.caster.isMechaActive = false;
      this.caster.giantRobot = null;
      this.caster.isInvulnerable = false;
    }

    this.damageTexts.spawn('🚀 CHIẾN THẦN CƠ GIÁP VỀ CĂN CỨ!', this.group.position.clone().add(new THREE.Vector3(0, 16.0, 0)), '#00f2fe');

    // Hiệu ứng tên lửa phụt cực đại phóng robot vút lên trời
    let launchElapsed = 0;
    const launchDuration = 1.4;
    const startY = this.group.position.y;

    if (sound.playThunder) sound.playThunder();

    const launchEffect = {
      update: (delta) => {
        launchElapsed += delta;
        const progress = launchElapsed / launchDuration;

        // Vút lên trời theo hàm mũ gia tốc
        this.group.position.y = startY + Math.pow(progress, 3) * 160;

        if (this.particles) {
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
          this.destroy();
          return false;
        }
        return true;
      },
    };

    if (this.pixelFX && this.pixelFX.activeEffects) {
      this.pixelFX.activeEffects.push(launchEffect);
    } else {
      this.destroy();
    }
  }

  // Giải phóng toàn bộ Three.js tài nguyên khi kết thúc
  destroy() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    this.geometries = [];
    this.materials = [];
  }
}
