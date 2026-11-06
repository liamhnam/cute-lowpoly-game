import * as THREE from 'three';
import { sound } from './audio.js';

// Mảng lưu các hố va chạm / tàn phá địa hình
export const activeCraters = [];

// Hàm tính độ cao mặt đất kinh thành cổ mở rộng (300m x 300m)
export function getTerrainHeight(x, z) {
  let baseH = 0;

  // Lòng kênh đào chảy ngang qua thành ở z: [-20, -12] từ bờ Tây sang Đông (x: -128 đến 128)
  const distToCanalCenter = Math.abs(z - (-16));
  if (distToCanalCenter < 4.5 && Math.abs(x) < 128) {
    // 3 Cây Cầu Đá Nguyệt Nha: Cầu chính x: [-5.2, 5.2], Cầu Tây x: [-49, -41], Cầu Đông x: [41, 49]
    const onMainBridge = Math.abs(x) < 5.2;
    const onWestBridge = Math.abs(x - (-45)) < 4.2;
    const onEastBridge = Math.abs(x - 45) < 4.2;

    if (onMainBridge || onWestBridge || onEastBridge) {
      const bridgeArch = Math.cos((distToCanalCenter / 4.5) * (Math.PI / 2)) * 0.48;
      baseH = bridgeArch;
    } else {
      const canalBed = -Math.cos((distToCanalCenter / 4.5) * (Math.PI / 2)) * 1.35;
      baseH = canalBed;
    }
  } else {
    // Bên ngoài Đại Tường Thành viền map (|x| > 128 hoặc |z| > 128) nhấp nhô đồi núi
    if (Math.abs(x) > 128 || Math.abs(z) > 128) {
      const distOutside = Math.max(Math.abs(x) - 128, Math.abs(z) - 128);
      baseH = Math.sin(x * 0.08) * Math.cos(z * 0.08) * Math.min(6.0, distOutside * 0.55);
    }
  }

  // Tính độ lõm từ các vết nứt và hố kỹ năng thiên thạch / động đất
  for (let i = 0; i < activeCraters.length; i++) {
    const c = activeCraters[i];
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.radius) {
      const deform = c.depth * Math.pow(1.0 - d / c.radius, 2);
      baseH -= deform;
    }
  }

  return baseH;
}

export class World {
  constructor(scene, particles = null) {
    this.scene = scene;
    this.particles = particles;
    this.clouds = [];
    this.lanternLights = [];
    this.hangingLanterns = [];

    // Mảng quản lý các bộ phận nhà có thể phá hủy từng phần (MODULAR BUILDING DESTRUCTION)
    this.buildingParts = [];

    // Mảng quản lý các vật thể có thể tương tác & phá hủy trên đường phố
    this.trees = []; // Cây liễu rủ & cây đào sân đình
    this.rocks = []; // Vò rượu gốm Nữ Nhi Hồng, sư tử đá & non bộ
    this.fences = []; // Quầy sạp chợ, thùng gỗ, giá binh khí & lan can
    this.flowers = []; // Chậu hoa cúc, sen kênh đào
    this.debris = []; // Mảnh gốm, gỗ vụn, ngói vỡ, gạch đá văng theo vật lý

    // 1. Mặt sàn kinh thành rộng 300m & Kênh đào có 3 cầu đá
    this.createImperialGround();
    this.createCanalAndBridges();

    // 2. BỨC TƯỜNG THÀNH KHỔNG LỒ BAO QUANH VIỀN MAP (PERIMETER GREAT FORTRESS WALL)
    this.createPerimeterGreatWall();

    // 3. Tường Thành Nội Phủ & Nam Môn Nội Thành (z = -75)
    this.createInnerCityGate();

    // 4. Đại Điện Hoàng Cung & Hậu Cung Điện Các
    this.createImperialPalaceHall();
    this.createImperialRearCourts();

    // 5. CÁC KHU PHỐ CỔ NỘI THÀNH DÀY ĐẶC & CÁC CÔNG TRÌNH MÔ-ĐUN PHÁ HỦY ĐƯỢC
    this.createModularTavern();       // Tửu Lầu Nguyệt Lai (phá tường, cột, mái ngói, ban công)
    this.createModularTeaHouse();     // Trà Quán Cổ Phong (phá hiên, cột, mái, vách)
    this.createModularMarketShops();  // Dãy 3 Nhà Phố Cổ Hiệu Thuốc / Tiệm Rèn
    this.createModularEstateManor();  // Phủ Đệ Tiên Gia (phá tường bao, nguyệt môn, đình lâu)
    this.createBellTower();           // Tháp Chuông 3 tầng

    // Các Phường Thị Mới Phủ Kín Bản Đồ:
    this.createSouthWestDistrict();   // Khu Tây Nam (Phố Rèn, Binh Khí Điếm, Cư Xá Vĩnh An)
    this.createSouthEastDistrict();   // Khu Đông Nam (Phố Tơ Lụa, Tiệm Gốm, Dược Quán, Cư Xá Bình Khang)
    this.createNorthWestDistrict();   // Khu Tây Bắc (Thiên Kiếm Võ Quán, Linh Dược Các, Tứ Hợp Viện Tây Bắc, Phố Ẩm Thực)
    this.createNorthEastDistrict();   // Khu Đông Bắc (Thanh Vân Thư Viện, Vọng Nguyệt Lầu, Phủ Thượng Thư, Bảo Tiên Các)
    this.createWaterfrontStiltHouses();// Dãy Nhà Sàn & Cầu Tàu Ven Bờ Kênh Đào

    // 6. Mật Độ Đạo Cụ Đường Phố Dày Đặc (High-Density Props)
    this.createStreetLanterns();      // Cột đèn lồng đỏ có ánh sáng thực
    this.createMarketStalls();        // Quầy sạp chợ & thùng hàng gỗ
    this.createWineUrns();            // Chồng vò rượu Nữ Nhi Hồng
    this.createWeaponRacks();         // Giá binh khí đao kiếm
    this.createCourtyardTrees();      // Liễu rủ & đào tiên
    this.createStreetFlora();         // Chậu hoa cúc & sen nước
    this.createCitySkyClouds();       // Mây trời kinh thành

    // 7. Cập nhật toàn bộ toạ độ AABB thế giới cho mọi khối công trình phá hủy được
    this.refreshBuildingPartsBounds();
  }

  // --- 1. MẶT SÀN KINH THÀNH RỘNG LỚN (IMPERIAL GROUND 300m x 300m) ---
  createImperialGround() {
    const size = 300;
    const segments = 80; // Tối ưu hóa đa giác địa hình xuống 80x80 (nhẹ hơn 65% vertex processing)
    this.terrainGeometry = new THREE.PlaneGeometry(size, size, segments, segments);
    this.terrainGeometry.rotateX(-Math.PI / 2);

    const pos = this.terrainGeometry.attributes.position;
    const colors = [];

    const colAvenue = new THREE.Color(0xdcdde1);    // Đá xám trắng đại lộ Chu Tước
    const colAvenueEdge = new THREE.Color(0xb2bec3);// Viền đá đại lộ
    const colStreet = new THREE.Color(0x95a5a6);    // Đá phiến đường phố
    const colCrossStreet = new THREE.Color(0xa4b0be);// Đường cắt ngang bàn cờ
    const colCourtyard = new THREE.Color(0x636e72); // Sân gạch nội khu
    const colCanalBed = new THREE.Color(0x2f3640);  // Đáy kênh đào
    const colOutside = new THREE.Color(0x2ed573).lerp(new THREE.Color(0x57606f), 0.55); // Ngoại vi cỏ núi

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);

      let vertexCol;
      const isBridge = (Math.abs(x) < 5.2 || Math.abs(x - (-45)) < 4.2 || Math.abs(x - 45) < 4.2);
      const isCanal = Math.abs(z - (-16)) < 4.2 && Math.abs(x) < 128 && !isBridge;

      if (isCanal) {
        vertexCol = colCanalBed.clone();
      } else if (Math.abs(x) > 126 || Math.abs(z) > 126) {
        vertexCol = colOutside.clone();
      } else if (Math.abs(x) < 5.5 && Math.abs(z) <= 126) {
        // Trục Đại Lộ Chu Tước trung tâm
        vertexCol = Math.abs(x) < 4.6 ? colAvenue.clone() : colAvenueEdge.clone();
      } else if (Math.abs(z - (-105)) < 3.2 || Math.abs(z - (-50)) < 3.2 || Math.abs(z - 40) < 3.2 || Math.abs(x - (-75)) < 3.2 || Math.abs(x - 75) < 3.2) {
        // Tuyến phố ngang dọc ô bàn cờ nối các phường thị
        vertexCol = colCrossStreet.clone();
      } else if (Math.abs(x) < 122 && Math.abs(z) < 122) {
        vertexCol = (Math.abs(x) > 30 || Math.abs(z) > 30) ? colCourtyard.clone() : colStreet.clone();
      } else {
        vertexCol = colStreet.clone();
      }

      colors.push(vertexCol.r, vertexCol.g, vertexCol.b);
    }

    this.terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.terrainGeometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.76,
      metalness: 0.14,
    });

    this.terrainMesh = new THREE.Mesh(this.terrainGeometry, material);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  // --- 2. KÊNH ĐÀO MỞ RỘNG (270m) & 3 CÂY CẦU ĐÁ NGUYỆT NHA ---
  createCanalAndBridges() {
    this.waterGeometry = new THREE.PlaneGeometry(270, 8.4, 32, 4); // Tối ưu vertex nước xuống 32x4
    this.waterGeometry.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0abde3,
      roughness: 0.08,
      metalness: 0.65,
      transparent: true,
      opacity: 0.88,
      flatShading: true,
    });
    this.waterMesh = new THREE.Mesh(this.waterGeometry, waterMat);
    this.waterMesh.position.set(0, -0.38, -16);
    this.scene.add(this.waterMesh);

    // 3 Cây Cầu Đá: Cầu Chính ở giữa (x: 0), Cầu Tây (x: -45), Cầu Đông (x: 45)
    const bridgeXPositions = [0, -45, 45];
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, flatShading: true, roughness: 0.7 });
    const railingMat = new THREE.MeshStandardMaterial({ color: 0xb2bec3, flatShading: true, roughness: 0.6 });

    for (const bx of bridgeXPositions) {
      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(bx, 0, -16);
      const isMain = bx === 0;
      const bWidth = isMain ? 10.4 : 7.6;

      const bridgeFloor = new THREE.Mesh(new THREE.BoxGeometry(bWidth, 0.4, 9.0), stoneMat);
      bridgeFloor.position.y = 0.25;
      bridgeFloor.receiveShadow = true;
      bridgeGroup.add(bridgeFloor);
      this.registerBuildingPart(bridgeFloor, 160, 'wall', 'masonry', `bridge_${bx}`);

      for (const side of [-bWidth / 2, bWidth / 2]) {
        const railMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, 9.0), railingMat);
        railMesh.position.set(side, 0.7, 0);
        railMesh.castShadow = true;
        bridgeGroup.add(railMesh);
        this.registerBuildingPart(railMesh, 70, 'wall', 'masonry', `bridge_${bx}_rail_${side > 0 ? 'r' : 'l'}`);

        for (const zOffset of [-4.2, -1.4, 1.4, 4.2]) {
          const postGroup = new THREE.Group();
          postGroup.position.set(side, 0.75, zOffset);

          const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.42), stoneMat);
          post.castShadow = true;
          postGroup.add(post);

          const sphereCap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), stoneMat);
          sphereCap.position.y = 0.63;
          postGroup.add(sphereCap);

          bridgeGroup.add(postGroup);

          this.fences.push({
            group: postGroup,
            mesh: postGroup,
            pos: new THREE.Vector3(bx + side, 0.75, -16 + zOffset),
            radius: 1.0,
            hp: 40,
            isBroken: false,
          });
        }
      }

      this.scene.add(bridgeGroup);
    }
  }

  // --- TẠO TƯỜNG PHÂN ĐOẠN CÓ THỂ BỊ BẮN SẬP TỪNG MẢNG (MODULAR SEGMENTED WALL) ---
  buildSegmentedWall(parentGroup, x1, z1, x2, z2, wallH, wallThick, segLength, wallMat, buildingId, hp = 140) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const totalDist = Math.hypot(dx, dz);
    const numSegs = Math.max(1, Math.round(totalDist / segLength));
    const segLen = totalDist / numSegs;
    const angle = Math.atan2(dz, dx);

    for (let i = 0; i < numSegs; i++) {
      const t = (i + 0.5) / numSegs;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;

      const segMesh = new THREE.Mesh(new THREE.BoxGeometry(segLen * 0.98, wallH, wallThick), wallMat);
      segMesh.position.set(px, wallH / 2, pz);
      segMesh.rotation.y = -angle;
      segMesh.castShadow = true;
      segMesh.receiveShadow = true;

      // 2 đao xỉ tường (lỗ châu mai) gắn liền vào đỉnh từng phân đoạn để khi tường sập thì lỗ châu mai sập theo
      for (const mxOffset of [-segLen * 0.25, segLen * 0.25]) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(segLen * 0.38, 1.2, 0.8), wallMat);
        merlon.position.set(mxOffset, wallH / 2 + 0.6, wallThick / 2 - 0.4);
        merlon.castShadow = true;
        segMesh.add(merlon);
      }

      parentGroup.add(segMesh);

      this.registerBuildingPart(segMesh, hp, 'wall', 'masonry', `${buildingId}_seg_${i}`);
    }
  }

  // --- 2. BỨC TƯỜNG THÀNH KHỔNG LỒ BAO QUANH VIỀN MAP (PERIMETER GREAT FORTRESS WALL) ---
  createPerimeterGreatWall() {
    this.perimeterWallGroup = new THREE.Group();

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x57606f, flatShading: true, roughness: 0.88 });
    const woodGateMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, flatShading: true, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, flatShading: true, roughness: 0.45 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.85, roughness: 0.25 });

    const wallH = 9.5;
    const wallThick = 6.4;
    const W = 126; // Tọa độ viền map bao bọc (+/- 126m)

    // 1. TƯỜNG THÀNH PHÍA NAM (Z = -126) & CHU TƯỚC ĐẠI MÔN (SOUTH GATE)
    this.buildSegmentedWall(this.perimeterWallGroup, -125, -W, -13, -W, wallH, wallThick, 14, wallMat, 'south_wall_w', 150);
    this.buildSegmentedWall(this.perimeterWallGroup, 13, -W, 125, -W, wallH, wallThick, 14, wallMat, 'south_wall_e', 150);

    // Vòm Cổng Nam (Chu Tước Môn rộng 20m)
    const sGateL = new THREE.Mesh(new THREE.BoxGeometry(6.0, wallH + 1.5, wallThick + 2.0), wallMat);
    sGateL.position.set(-10, (wallH + 1.5) / 2, -W);
    sGateL.castShadow = true;
    this.perimeterWallGroup.add(sGateL);
    this.registerBuildingPart(sGateL, 160, 'wall', 'masonry', 'south_gate');

    const sGateR = new THREE.Mesh(new THREE.BoxGeometry(6.0, wallH + 1.5, wallThick + 2.0), wallMat);
    sGateR.position.set(10, (wallH + 1.5) / 2, -W);
    sGateR.castShadow = true;
    this.perimeterWallGroup.add(sGateR);
    this.registerBuildingPart(sGateR, 160, 'wall', 'masonry', 'south_gate');

    const sGateArch = new THREE.Mesh(new THREE.BoxGeometry(26, 4.2, wallThick + 2.0), wallMat);
    sGateArch.position.set(0, wallH + 1.0, -W);
    sGateArch.castShadow = true;
    this.perimeterWallGroup.add(sGateArch);
    this.registerBuildingPart(sGateArch, 180, 'eave', 'masonry', 'south_gate');

    // Cánh cửa thành son đỏ Nam Môn
    const sDoorL = new THREE.Mesh(new THREE.BoxGeometry(6.2, 8.2, 0.5), woodGateMat);
    sDoorL.position.set(-3.8, 4.1, -W - 0.4);
    sDoorL.rotation.y = 0.4;
    sDoorL.castShadow = true;
    this.perimeterWallGroup.add(sDoorL);
    this.registerBuildingPart(sDoorL, 90, 'gate', 'wood', 'south_gate');

    const sDoorR = new THREE.Mesh(new THREE.BoxGeometry(6.2, 8.2, 0.5), woodGateMat);
    sDoorR.position.set(3.8, 4.1, -W - 0.4);
    sDoorR.rotation.y = -0.4;
    sDoorR.castShadow = true;
    this.perimeterWallGroup.add(sDoorR);
    this.registerBuildingPart(sDoorR, 90, 'gate', 'wood', 'south_gate');

    // Thành Lầu Cổng Nam 2 tầng uy nghiêm
    const sTowerBase = new THREE.Mesh(new THREE.BoxGeometry(22, 4.5, 9.5), woodGateMat);
    sTowerBase.position.set(0, wallH + 5.2, -W);
    sTowerBase.castShadow = true;
    this.perimeterWallGroup.add(sTowerBase);
    this.registerBuildingPart(sTowerBase, 160, 'wall', 'wood', 'south_gate_tower');

    const sRoof1 = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 13.5), roofMat);
    sRoof1.position.set(0, wallH + 8.0, -W);
    sRoof1.castShadow = true;
    this.perimeterWallGroup.add(sRoof1);
    this.registerBuildingPart(sRoof1, 140, 'eave', 'tile', 'south_gate_tower');

    const sTowerUpper = new THREE.Mesh(new THREE.BoxGeometry(16, 3.8, 7.5), woodGateMat);
    sTowerUpper.position.set(0, wallH + 10.4, -W);
    this.perimeterWallGroup.add(sTowerUpper);
    this.registerBuildingPart(sTowerUpper, 120, 'wall', 'wood', 'south_gate_tower');

    const sRoof2 = new THREE.Mesh(new THREE.BoxGeometry(20, 1.6, 11.5), roofMat);
    sRoof2.position.set(0, wallH + 12.8, -W);
    sRoof2.castShadow = true;
    this.perimeterWallGroup.add(sRoof2);
    this.registerBuildingPart(sRoof2, 140, 'eave', 'tile', 'south_gate_tower');

    const sSign = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.8, 0.2), goldMat);
    sSign.position.set(0, wallH + 3.8, -W + wallThick / 2 + 1.2);
    this.perimeterWallGroup.add(sSign);

    // 2. TƯỜNG THÀNH PHÍA BẮC (Z = +126) & HUYỀN VŨ ĐẠI MÔN (NORTH GATE)
    this.buildSegmentedWall(this.perimeterWallGroup, -125, W, -13, W, wallH, wallThick, 14, wallMat, 'north_wall_w', 150);
    this.buildSegmentedWall(this.perimeterWallGroup, 13, W, 125, W, wallH, wallThick, 14, wallMat, 'north_wall_e', 150);

    const nGateL = new THREE.Mesh(new THREE.BoxGeometry(6.0, wallH + 1.5, wallThick + 2.0), wallMat);
    nGateL.position.set(-10, (wallH + 1.5) / 2, W);
    this.perimeterWallGroup.add(nGateL);
    this.registerBuildingPart(nGateL, 160, 'wall', 'masonry', 'north_gate');

    const nGateR = new THREE.Mesh(new THREE.BoxGeometry(6.0, wallH + 1.5, wallThick + 2.0), wallMat);
    nGateR.position.set(10, (wallH + 1.5) / 2, W);
    this.perimeterWallGroup.add(nGateR);
    this.registerBuildingPart(nGateR, 160, 'wall', 'masonry', 'north_gate');

    const nGateArch = new THREE.Mesh(new THREE.BoxGeometry(26, 4.2, wallThick + 2.0), wallMat);
    nGateArch.position.set(0, wallH + 1.0, W);
    this.perimeterWallGroup.add(nGateArch);
    this.registerBuildingPart(nGateArch, 180, 'eave', 'masonry', 'north_gate');

    const nTower = new THREE.Mesh(new THREE.BoxGeometry(20, 5.0, 9.0), woodGateMat);
    nTower.position.set(0, wallH + 5.5, W);
    this.perimeterWallGroup.add(nTower);
    this.registerBuildingPart(nTower, 160, 'wall', 'wood', 'north_gate_tower');

    const nRoof = new THREE.Mesh(new THREE.BoxGeometry(24, 1.8, 13.0), roofMat);
    nRoof.position.set(0, wallH + 8.6, W);
    this.perimeterWallGroup.add(nRoof);
    this.registerBuildingPart(nRoof, 140, 'eave', 'tile', 'north_gate_tower');

    const nSign = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.8, 0.2), goldMat);
    nSign.position.set(0, wallH + 3.8, W - wallThick / 2 - 1.2);
    this.perimeterWallGroup.add(nSign);

    // 3. TƯỜNG THÀNH PHÍA TÂY (X = -126) & BẠCH HỔ THỦY MÔN (WEST WATER GATE)
    this.buildSegmentedWall(this.perimeterWallGroup, -W, -125, -W, -24, wallH, wallThick, 14, wallMat, 'west_wall_s', 150);
    this.buildSegmentedWall(this.perimeterWallGroup, -W, -8, -W, 125, wallH, wallThick, 14, wallMat, 'west_wall_n', 150);

    const wWaterArch = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 1.5, 4.5, 18), wallMat);
    wWaterArch.position.set(-W, wallH + 1.0, -16);
    this.perimeterWallGroup.add(wWaterArch);
    this.registerBuildingPart(wWaterArch, 180, 'eave', 'masonry', 'west_water_gate');

    const wWaterTower = new THREE.Mesh(new THREE.BoxGeometry(8.5, 4.0, 16), woodGateMat);
    wWaterTower.position.set(-W, wallH + 5.0, -16);
    this.perimeterWallGroup.add(wWaterTower);
    this.registerBuildingPart(wWaterTower, 150, 'wall', 'wood', 'west_water_tower');

    const wWaterRoof = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.5, 20), roofMat);
    wWaterRoof.position.set(-W, wallH + 7.6, -16);
    this.perimeterWallGroup.add(wWaterRoof);
    this.registerBuildingPart(wWaterRoof, 130, 'eave', 'tile', 'west_water_tower');

    // 4. TƯỜNG THÀNH PHÍA ĐÔNG (X = +126) & THANH LONG THỦY MÔN (EAST WATER GATE)
    this.buildSegmentedWall(this.perimeterWallGroup, W, -125, W, -24, wallH, wallThick, 14, wallMat, 'east_wall_s', 150);
    this.buildSegmentedWall(this.perimeterWallGroup, W, -8, W, 125, wallH, wallThick, 14, wallMat, 'east_wall_n', 150);

    const eWaterArch = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 1.5, 4.5, 18), wallMat);
    eWaterArch.position.set(W, wallH + 1.0, -16);
    this.perimeterWallGroup.add(eWaterArch);
    this.registerBuildingPart(eWaterArch, 180, 'eave', 'masonry', 'east_water_gate');

    const eWaterTower = new THREE.Mesh(new THREE.BoxGeometry(8.5, 4.0, 16), woodGateMat);
    eWaterTower.position.set(W, wallH + 5.0, -16);
    this.perimeterWallGroup.add(eWaterTower);
    this.registerBuildingPart(eWaterTower, 150, 'wall', 'wood', 'east_water_tower');

    const eWaterRoof = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.5, 20), roofMat);
    eWaterRoof.position.set(W, wallH + 7.6, -16);
    this.perimeterWallGroup.add(eWaterRoof);
    this.registerBuildingPart(eWaterRoof, 130, 'eave', 'tile', 'east_water_tower');

    // 5. TỨ ĐẠI GIÁC LÂU (4 GRAND CORNER WATCHTOWERS & BASTIONS)
    const cornerCoords = [
      { x: -W, z: -W },
      { x: W, z: -W },
      { x: -W, z: W },
      { x: W, z: W },
    ];

    for (const cc of cornerCoords) {
      const bastionGroup = new THREE.Group();
      bastionGroup.position.set(cc.x, 0, cc.z);

      const bBase = new THREE.Mesh(new THREE.BoxGeometry(16, wallH + 2.0, 16), wallMat);
      bBase.position.y = (wallH + 2.0) / 2;
      bBase.castShadow = true;
      bastionGroup.add(bBase);
      this.registerBuildingPart(bBase, 180, 'wall', 'masonry', `corner_${cc.x}_${cc.z}_base`);

      for (let t = 0; t < 2; t++) {
        const rad = 5.6 - t * 1.2;
        const ty = wallH + 2.0 + t * 4.6;

        const bFloor = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.9, rad, 3.8, 8), woodGateMat);
        bFloor.position.y = ty + 1.9;
        bFloor.castShadow = true;
        bastionGroup.add(bFloor);
        this.registerBuildingPart(bFloor, 130, 'wall', 'wood', `corner_${cc.x}_${cc.z}_${t}`);

        const bRoof = new THREE.Mesh(new THREE.ConeGeometry(rad * 1.6, 1.6, 8), roofMat);
        bRoof.position.y = ty + 4.5;
        bRoof.castShadow = true;
        bastionGroup.add(bRoof);
        this.registerBuildingPart(bRoof, 110, 'eave', 'tile', `corner_${cc.x}_${cc.z}_${t}`);
      }

      this.perimeterWallGroup.add(bastionGroup);
    }

    // 6. Đao xỉ tường (lỗ châu mai) đã được tích hợp trực tiếp vào từng phân đoạn trong buildSegmentedWall
    // để khi tường sập thì các lỗ châu mai tự động vỡ vụn và nổ theo, không bị lơ lửng trên trời.

    // 7. THÁP CANH TRUNG ĐOẠN (8 INTERMEDIATE BASTION TOWERS)
    const midTowerSpots = [
      { x: -65, z: -W }, { x: 65, z: -W },
      { x: -65, z: W },  { x: 65, z: W },
      { x: -W, z: -65 }, { x: -W, z: 55 },
      { x: W, z: -65 },  { x: W, z: 55 },
    ];

    for (const mt of midTowerSpots) {
      const midTower = new THREE.Group();
      midTower.position.set(mt.x, 0, mt.z);

      const mtBase = new THREE.Mesh(new THREE.BoxGeometry(9.0, wallH + 1.0, 9.0), wallMat);
      mtBase.position.y = (wallH + 1.0) / 2;
      mtBase.castShadow = true;
      midTower.add(mtBase);
      this.registerBuildingPart(mtBase, 150, 'wall', 'masonry', `mid_tower_${mt.x}_${mt.z}_base`);

      const mtRoom = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.2, 7.0), woodGateMat);
      mtRoom.position.y = wallH + 2.6;
      midTower.add(mtRoom);
      this.registerBuildingPart(mtRoom, 100, 'wall', 'wood', `mid_tower_${mt.x}_${mt.z}`);

      const mtRoof = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.2, 9.5), roofMat);
      mtRoof.position.y = wallH + 4.6;
      mtRoof.castShadow = true;
      midTower.add(mtRoof);
      this.registerBuildingPart(mtRoof, 90, 'eave', 'tile', `mid_tower_${mt.x}_${mt.z}`);

      this.perimeterWallGroup.add(midTower);
    }

    this.scene.add(this.perimeterWallGroup);
  }

  // --- 3. TƯỜNG THÀNH NỘI PHỦ & NAM MÔN NỘI THÀNH (z = -75) ---
  createInnerCityGate() {
    this.wallGroup = new THREE.Group();
    const wallZ = -75;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x636e72, flatShading: true, roughness: 0.88 });
    const woodGateMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, flatShading: true, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, flatShading: true, roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.8, roughness: 0.3 });

    // Đoạn tường thành bên Tây (-x) dài 110m phân đoạn
    this.buildSegmentedWall(this.wallGroup, -118, wallZ, -8, wallZ, 8.5, 6.0, 14, wallMat, 'inner_wall_w', 130);

    // Đoạn tường thành bên Đông (+x) dài 110m phân đoạn
    this.buildSegmentedWall(this.wallGroup, 8, wallZ, 118, wallZ, 8.5, 6.0, 14, wallMat, 'inner_wall_e', 130);

    // Cổng Thành Chính ở giữa (rộng 16m)
    const gatePostW = new THREE.Mesh(new THREE.BoxGeometry(4.5, 9.5, 7.0), wallMat);
    gatePostW.position.set(-7.5, 4.75, wallZ);
    gatePostW.castShadow = true;
    this.wallGroup.add(gatePostW);
    this.registerBuildingPart(gatePostW, 140, 'wall', 'masonry', 'inner_gate');

    const gatePostE = new THREE.Mesh(new THREE.BoxGeometry(4.5, 9.5, 7.0), wallMat);
    gatePostE.position.set(7.5, 4.75, wallZ);
    gatePostE.castShadow = true;
    this.wallGroup.add(gatePostE);
    this.registerBuildingPart(gatePostE, 140, 'wall', 'masonry', 'inner_gate');

    const archTop = new THREE.Mesh(new THREE.BoxGeometry(19.0, 3.5, 7.0), wallMat);
    archTop.position.set(0, 8.0, wallZ);
    archTop.castShadow = true;
    this.wallGroup.add(archTop);
    this.registerBuildingPart(archTop, 150, 'eave', 'masonry', 'inner_gate');

    // 2 Cánh cửa gỗ son lớn sơn đỏ hé mở
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6.2, 0.4), woodGateMat);
    doorL.position.set(-3.2, 3.1, wallZ - 0.5);
    doorL.rotation.y = 0.45;
    doorL.castShadow = true;
    this.wallGroup.add(doorL);
    this.registerBuildingPart(doorL, 80, 'gate', 'wood', 'inner_gate');

    const doorR = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6.2, 0.4), woodGateMat);
    doorR.position.set(3.2, 3.1, wallZ - 0.5);
    doorR.rotation.y = -0.45;
    doorR.castShadow = true;
    this.wallGroup.add(doorR);
    this.registerBuildingPart(doorR, 80, 'gate', 'wood', 'inner_gate');

    // Thành Lầu 2 tầng uy nghiêm
    const towerPillars = new THREE.Mesh(new THREE.BoxGeometry(15.0, 3.8, 5.5), wallMat);
    towerPillars.position.set(0, 11.4, wallZ);
    towerPillars.castShadow = true;
    this.wallGroup.add(towerPillars);
    this.registerBuildingPart(towerPillars, 120, 'wall', 'wood', 'inner_gate_tower');

    const roof1 = new THREE.Mesh(new THREE.BoxGeometry(18.0, 1.0, 7.5), roofMat);
    roof1.position.y = 13.8;
    roof1.position.z = wallZ;
    roof1.castShadow = true;
    this.wallGroup.add(roof1);
    this.registerBuildingPart(roof1, 100, 'eave', 'tile', 'inner_gate_tower');

    const towerTop = new THREE.Mesh(new THREE.BoxGeometry(11.0, 3.0, 4.5), woodGateMat);
    towerTop.position.set(0, 15.6, wallZ);
    this.wallGroup.add(towerTop);
    this.registerBuildingPart(towerTop, 100, 'wall', 'wood', 'inner_gate_tower');

    const roof2 = new THREE.Mesh(new THREE.BoxGeometry(14.0, 1.0, 6.5), roofMat);
    roof2.position.set(0, 17.5, wallZ);
    roof2.castShadow = true;
    this.wallGroup.add(roof2);
    this.registerBuildingPart(roof2, 100, 'eave', 'tile', 'inner_gate_tower');

    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.2, 0.15), goldMat);
    signBoard.position.set(0, 8.8, wallZ + 3.6);
    this.wallGroup.add(signBoard);

    this.scene.add(this.wallGroup);
  }

  // --- 4. ĐẠI ĐIỆN HOÀNG CUNG CỔNG BẮC (IMPERIAL PALACE HALL) ---
  createImperialPalaceHall() {
    this.palaceGroup = new THREE.Group();
    const pz = 65;
    this.palaceGroup.position.set(0, 0, pz);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, flatShading: true, roughness: 0.7 });
    const redColMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, flatShading: true, roughness: 0.5 });
    const goldRoofMat = new THREE.MeshStandardMaterial({
      color: 0xf39c12,
      flatShading: true,
      roughness: 0.35,
      metalness: 0.3,
    });

    // Bệ đá 3 tầng
    for (let l = 0; l < 3; l++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(32 - l * 3.0, 0.6, 22 - l * 2.5), stoneMat);
      step.position.y = 0.3 + l * 0.6;
      step.receiveShadow = true;
      this.palaceGroup.add(step);
      this.registerBuildingPart(step, 180, 'wall', 'masonry', `palace_step_${l}`);
    }

    const stairs = new THREE.Mesh(new THREE.BoxGeometry(10.0, 1.8, 5.0), stoneMat);
    stairs.position.set(0, 0.9, -11.5);
    stairs.rotation.x = 0.35;
    this.palaceGroup.add(stairs);
    this.registerBuildingPart(stairs, 150, 'wall', 'masonry', 'palace_stairs');

    // Cột trụ sơn son đỏ
    for (let c = -5; c <= 5; c += 2) {
      const colFront = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 6.4, 8), redColMat);
      colFront.position.set(c * 2.3, 4.8, -8.0);
      colFront.castShadow = true;
      this.palaceGroup.add(colFront);
      this.registerBuildingPart(colFront, 85, 'pillar', 'wood', 'palace_main');
    }

    const palaceWalls = new THREE.Mesh(new THREE.BoxGeometry(24.0, 6.4, 15.0), redColMat);
    palaceWalls.position.set(0, 4.8, 0);
    palaceWalls.castShadow = true;
    this.palaceGroup.add(palaceWalls);
    this.registerBuildingPart(palaceWalls, 160, 'wall', 'masonry', 'palace_main');

    // Mái ngói hoàng kim
    const eaveLower = new THREE.Mesh(new THREE.BoxGeometry(28.0, 1.4, 19.0), goldRoofMat);
    eaveLower.position.y = 8.5;
    eaveLower.castShadow = true;
    this.palaceGroup.add(eaveLower);
    this.registerBuildingPart(eaveLower, 140, 'eave', 'tile', 'palace_main');

    const upperWall = new THREE.Mesh(new THREE.BoxGeometry(18.0, 3.0, 12.0), redColMat);
    upperWall.position.y = 10.4;
    this.palaceGroup.add(upperWall);
    this.registerBuildingPart(upperWall, 120, 'wall', 'masonry', 'palace_main');

    const eaveUpper = new THREE.Mesh(new THREE.BoxGeometry(22.0, 2.0, 16.0), goldRoofMat);
    eaveUpper.position.y = 12.6;
    eaveUpper.castShadow = true;
    this.palaceGroup.add(eaveUpper);
    this.registerBuildingPart(eaveUpper, 140, 'eave', 'tile', 'palace_main');

    // Cặp Sư Tử Đá Hộ Vệ (Stone Lions) trước thềm
    const lionMat = new THREE.MeshStandardMaterial({ color: 0x95a5a6, flatShading: true });
    for (const lx of [-6.0, 6.0]) {
      const lionGroup = new THREE.Group();
      lionGroup.position.set(lx, 1.8, -12.5);

      const lPedestal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.6), stoneMat);
      lionGroup.add(lPedestal);

      const lBody = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), lionMat);
      lBody.position.set(0, 0.8, 0);
      lionGroup.add(lBody);

      const lHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), lionMat);
      lHead.position.set(0, 1.4, -0.3);
      lionGroup.add(lHead);

      this.palaceGroup.add(lionGroup);
      this.rocks.push({
        mesh: lionGroup,
        pos: new THREE.Vector3(lx, 2.5, pz - 12.5),
        scale: new THREE.Vector3(1, 1, 1),
        radius: 1.4,
        hp: 120,
        isBroken: false,
      });
    }

    // Đèn lồng điện các
    for (const lx of [-5.5, 5.5]) {
      const palaceLight = new THREE.PointLight(0xffaa33, 2.2, 18, 1.8);
      palaceLight.position.set(lx, 4.2, -7.5);
      this.palaceGroup.add(palaceLight);
      this.lanternLights.push(palaceLight);
    }

    this.scene.add(this.palaceGroup);
  }

  // --- HỆ THỐNG ĐĂNG KÝ BỘ PHẬN NHÀ CÓ THỂ BỊ BẮN BỂ TỪNG PHẦN ---
  registerBuildingPart(mesh, hp = 80, partType = 'wall', debrisType = 'masonry', buildingId = 'building') {
    // Tối ưu hóa shadow pass: Chỉ mái hiên chính (eave) và cổng lớn (gate) mới đổ bóng
    mesh.castShadow = (partType === 'eave' || partType === 'gate');
    mesh.receiveShadow = (partType === 'wall' || partType === 'eave');

    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const radius = Math.max(size.x, size.y, size.z) * 0.6;

    const part = {
      mesh,
      box,
      center,
      radius,
      hp,
      maxHp: hp,
      isBroken: false,
      partType,     // 'wall', 'pillar', 'eave', 'balcony', 'gate'
      debrisType,   // 'masonry', 'wood', 'tile'
      buildingId,
    };

    this.buildingParts.push(part);
    return part;
  }

  // Cập nhật lại bounding box và bán kính cho mọi bộ phận sau khi toàn bộ nhóm đối tượng đã add vào Scene
  refreshBuildingPartsBounds() {
    this.scene.updateMatrixWorld(true);
    for (let i = 0; i < this.buildingParts.length; i++) {
      const part = this.buildingParts[i];
      if (part.mesh && !part.isBroken) {
        part.mesh.updateMatrixWorld(true);
        part.box.setFromObject(part.mesh);
        part.box.getCenter(part.center);
        const size = new THREE.Vector3();
        part.box.getSize(size);
        part.radius = Math.max(size.x, size.y, size.z) * 0.55;
      }
    }
  }

  // --- 5. TỬU LẦU NGUYỆT LAI PHÂN RÃ THEO MODULE (MODULAR DESTRUCTIBLE TAVERN) ---
  createModularTavern() {
    this.tavernGroup = new THREE.Group();
    const tx = -24;
    const tz = 8;
    this.tavernGroup.position.set(tx, 0, tz);

    const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, flatShading: true, roughness: 0.8 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0x962d22, flatShading: true, roughness: 0.6 });
    const darkTileRoof = new THREE.MeshStandardMaterial({ color: 0x2c3e50, flatShading: true, roughness: 0.4 });
    const whiteWallMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, flatShading: true, roughness: 0.85 });

    // Tầng 1: 4 Cột gỗ chịu lực (Phá cột sẽ làm sập mái phía trên!)
    const pillarPositions = [
      { x: -5.2, z: -4.2 }, { x: 5.2, z: -4.2 },
      { x: -5.2, z: 4.2 },  { x: 5.2, z: 4.2 },
    ];
    for (const pp of pillarPositions) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 3.8, 6), woodDarkMat);
      pillar.position.set(pp.x, 1.9, pp.z);
      this.tavernGroup.add(pillar);
      this.registerBuildingPart(pillar, 65, 'pillar', 'wood', 'tavern');
    }

    // Tường Tầng 1 (Chia làm 4 mảng vách độc lập: Mặt tiền, Vách Trái, Vách Phải, Vách Sau)
    // 1. Mảng Tường Mặt Tiền (Front Facade)
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(10.2, 3.6, 0.4), whiteWallMat);
    frontWall.position.set(0, 1.9, 4.0);
    this.tavernGroup.add(frontWall);
    this.registerBuildingPart(frontWall, 80, 'wall', 'masonry', 'tavern');

    // 2. Mảng Tường Vách Trái (Left Wall)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 8.2), whiteWallMat);
    leftWall.position.set(-5.0, 1.9, 0);
    this.tavernGroup.add(leftWall);
    this.registerBuildingPart(leftWall, 80, 'wall', 'masonry', 'tavern');

    // 3. Mảng Tường Vách Phải (Right Wall)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 8.2), whiteWallMat);
    rightWall.position.set(5.0, 1.9, 0);
    this.tavernGroup.add(rightWall);
    this.registerBuildingPart(rightWall, 80, 'wall', 'masonry', 'tavern');

    // 4. Mảng Tường Vách Sau (Back Wall)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(10.2, 3.6, 0.4), whiteWallMat);
    backWall.position.set(0, 1.9, -4.0);
    this.tavernGroup.add(backWall);
    this.registerBuildingPart(backWall, 80, 'wall', 'masonry', 'tavern');

    // Mái ngói tầng 1 (4 Mảng ngói hiên: Trước, Sau, Trái, Phải)
    const eaveFront = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.8, 2.5), darkTileRoof);
    eaveFront.position.set(0, 4.0, 4.6);
    this.tavernGroup.add(eaveFront);
    this.registerBuildingPart(eaveFront, 70, 'eave', 'tile', 'tavern');

    const eaveBack = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.8, 2.5), darkTileRoof);
    eaveBack.position.set(0, 4.0, -4.6);
    this.tavernGroup.add(eaveBack);
    this.registerBuildingPart(eaveBack, 70, 'eave', 'tile', 'tavern');

    const eaveSides = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.8, 10.8), darkTileRoof);
    eaveSides.position.set(0, 4.0, 0);
    this.tavernGroup.add(eaveSides);
    this.registerBuildingPart(eaveSides, 90, 'eave', 'tile', 'tavern');

    // Tầng 2 Tửu Lầu
    // Ban công gỗ đỏ tầng 2 (Destructible Balcony)
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.85, 0.25), redMat);
    balcony.position.set(0, 4.8, 4.2);
    this.tavernGroup.add(balcony);
    this.registerBuildingPart(balcony, 55, 'balcony', 'wood', 'tavern');

    // Khối tường phòng ngủ tầng 2
    const floor2Room = new THREE.Mesh(new THREE.BoxGeometry(9.4, 3.2, 7.6), whiteWallMat);
    floor2Room.position.set(0, 5.8, 0);
    this.tavernGroup.add(floor2Room);
    this.registerBuildingPart(floor2Room, 95, 'wall', 'masonry', 'tavern');

    // Mái ngói lớn trên đỉnh Tửu lầu
    const roofUpper = new THREE.Mesh(new THREE.BoxGeometry(11.8, 1.3, 10.0), darkTileRoof);
    roofUpper.position.set(0, 7.8, 0);
    this.tavernGroup.add(roofUpper);
    this.registerBuildingPart(roofUpper, 85, 'eave', 'tile', 'tavern');

    // Cờ Rượu "TỬU" (酒)
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 5), woodDarkMat);
    flagPole.position.set(4.5, 3.5, 5.2);
    flagPole.rotation.z = -0.3;

    this.wineFlag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xee5253, side: THREE.DoubleSide })
    );
    this.wineFlag.position.set(0.8, 0.9, 0);
    flagPole.add(this.wineFlag);
    this.tavernGroup.add(flagPole);
    this.registerBuildingPart(flagPole, 35, 'pillar', 'wood', 'tavern_flag');

    const tavernLight = new THREE.PointLight(0xff7722, 1.8, 14, 1.8);
    tavernLight.position.set(2.5, 3.2, 5.0);
    this.tavernGroup.add(tavernLight);
    this.lanternLights.push(tavernLight);

    this.scene.add(this.tavernGroup);
  }

  // --- 6. TRÀ QUÁN PHÂN RÃ THEO MODULE (MODULAR DESTRUCTIBLE TEA HOUSE) ---
  createModularTeaHouse() {
    this.teaHouseGroup = new THREE.Group();
    const hx = 24;
    const hz = 8;
    this.teaHouseGroup.position.set(hx, 0, hz);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, flatShading: true });
    const greenTileRoof = new THREE.MeshStandardMaterial({ color: 0x16a085, flatShading: true, roughness: 0.4 });
    const plasterMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, flatShading: true });

    // Khối vách tường chính
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(10.5, 4.0, 8.5), plasterMat);
    mainBody.position.y = 2.0;
    this.teaHouseGroup.add(mainBody);
    this.registerBuildingPart(mainBody, 90, 'wall', 'masonry', 'tea_house');

    // 3 Cột chống hiên trà phía trước (Phá cột sẽ làm sập mái hiên xanh!)
    for (const vx of [-4.5, 0, 4.5]) {
      const vPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.4, 6), woodMat);
      vPillar.position.set(vx, 1.7, 6.2);
      this.teaHouseGroup.add(vPillar);
      this.registerBuildingPart(vPillar, 55, 'pillar', 'wood', 'tea_house');
    }

    // Mái ngói hiên xanh ngọc bích
    const teaRoof = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.9, 11.8), greenTileRoof);
    teaRoof.position.y = 4.4;
    this.teaHouseGroup.add(teaRoof);
    this.registerBuildingPart(teaRoof, 75, 'eave', 'tile', 'tea_house');

    this.scene.add(this.teaHouseGroup);
  }

  // --- 7. DÃY 3 NHÀ PHỐ CỔ BUÔN BÁN (MODULAR ROW SHOPS - PHÁ ĐƯỢC TỪNG CĂN) ---
  createModularMarketShops() {
    this.shopsGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, flatShading: true });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, flatShading: true });
    const tileColors = [0x2c3e50, 0x962d22, 0x16a085];

    // 3 Căn nhà phố cổ liền kề phía Tây (x: -24, z: -36 đến -48)
    for (let s = 0; s < 3; s++) {
      const shopZ = -34 - s * 6.8;
      const shop = new THREE.Group();
      shop.position.set(-22, 0, shopZ);

      // Thân nhà gạch
      const body = new THREE.Mesh(new THREE.BoxGeometry(9.0, 3.5, 5.8), brickMat);
      body.position.y = 1.75;
      shop.add(body);
      this.registerBuildingPart(body, 80, 'wall', 'masonry', `shop_${s}`);

      // Cột hiên gỗ
      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 5), woodMat);
      postL.position.set(4.4, 1.6, 2.7);
      shop.add(postL);
      this.registerBuildingPart(postL, 50, 'pillar', 'wood', `shop_${s}`);

      const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 5), woodMat);
      postR.position.set(4.4, 1.6, -2.7);
      shop.add(postR);
      this.registerBuildingPart(postR, 50, 'pillar', 'wood', `shop_${s}`);

      // Mái ngói cong cổ phong
      const sRoofMat = new THREE.MeshStandardMaterial({ color: tileColors[s], flatShading: true, roughness: 0.4 });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.85, 7.2), sRoofMat);
      roof.position.y = 3.8;
      shop.add(roof);
      this.registerBuildingPart(roof, 70, 'eave', 'tile', `shop_${s}`);

      this.shopsGroup.add(shop);
    }

    this.scene.add(this.shopsGroup);
  }

  // --- 8. PHỦ ĐỆ TIÊN GIA & TƯỜNG BAO HOA ĐÌNH (MODULAR ESTATE MANOR) ---
  createModularEstateManor() {
    this.manorGroup = new THREE.Group();
    const mx = 28;
    const mz = -36;
    this.manorGroup.position.set(mx, 0, mz);

    const wallWhiteMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, flatShading: true });
    const tileCapMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, flatShading: true });

    // 4 Đoạn tường bao hoa đình xung quanh phủ đệ (Bắn bể từng đoạn!)
    const wallSegments = [
      { x: 0, z: 12, sx: 22, sz: 0.6, label: 'wall_front' },
      { x: 0, z: -12, sx: 22, sz: 0.6, label: 'wall_back' },
      { x: -11, z: 0, sx: 0.6, sz: 24, label: 'wall_left' },
      { x: 11, z: 0, sx: 0.6, sz: 24, label: 'wall_right' },
    ];

    for (const ws of wallSegments) {
      const segMesh = new THREE.Mesh(new THREE.BoxGeometry(ws.sx, 2.6, ws.sz), wallWhiteMat);
      segMesh.position.set(ws.x, 1.3, ws.z);
      this.manorGroup.add(segMesh);

      const capMesh = new THREE.Mesh(new THREE.BoxGeometry(ws.sx + (ws.sz > 1 ? 0.3 : 0), 0.25, ws.sz + (ws.sx > 1 ? 0.3 : 0)), tileCapMat);
      capMesh.position.set(ws.x, 2.65, ws.z);
      this.manorGroup.add(capMesh);

      this.registerBuildingPart(segMesh, 75, 'wall', 'masonry', `manor_${ws.label}`);
      this.registerBuildingPart(capMesh, 50, 'eave', 'tile', `manor_${ws.label}`);
    }

    // Cổng vòm Nguyệt Môn tròn (Moon Gate Arch)
    const moonGateFrame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.4, 0.8), wallWhiteMat);
    moonGateFrame.position.set(0, 1.7, 12);
    this.manorGroup.add(moonGateFrame);
    this.registerBuildingPart(moonGateFrame, 80, 'gate', 'masonry', 'manor_gate');

    this.scene.add(this.manorGroup);
  }

  // --- 9. THÁP CHUÔNG 3 TẦNG KINH THÀNH (BELL TOWER / PAGODA) ---
  createBellTower() {
    this.bellTower = new THREE.Group();
    const bx = -48;
    const bz = 40;
    this.bellTower.position.set(bx, 0, bz);

    const stoneBaseMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, flatShading: true });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, flatShading: true });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, flatShading: true });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 1.6, 8), stoneBaseMat);
    base.position.y = 0.8;
    this.bellTower.add(base);
    this.registerBuildingPart(base, 150, 'wall', 'masonry', 'bell_base');

    for (let l = 0; l < 3; l++) {
      const radius = 4.2 - l * 0.8;
      const height = 3.4;
      const y = 1.6 + l * 4.4;

      const floor = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, height, 8), woodMat);
      floor.position.y = y + height / 2;
      this.bellTower.add(floor);
      this.registerBuildingPart(floor, 90, 'wall', 'wood', `bell_tier_${l}`);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.55, 1.2, 8), roofMat);
      roof.position.y = y + height + 0.6;
      this.bellTower.add(roof);
      this.registerBuildingPart(roof, 75, 'eave', 'tile', `bell_roof_${l}`);
    }

    this.scene.add(this.bellTower);
  }

  // --- HẬU CUNG ĐIỆN CÁC & NGỰ HOA VIÊN (IMPERIAL REAR COURTS) ---
  createImperialRearCourts() {
    this.rearCourtsGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, flatShading: true, roughness: 0.7 });
    const redColMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, flatShading: true, roughness: 0.5 });
    const goldRoofMat = new THREE.MeshStandardMaterial({ color: 0xf39c12, flatShading: true, roughness: 0.35, metalness: 0.3 });

    // 1. Đông Noãn Các & Tây Noãn Các (East & West Imperial Pavilions at x: +/-34, z: 92)
    for (const side of [-34, 34]) {
      const pav = new THREE.Group();
      pav.position.set(side, 0, 92);

      const base = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 11), stoneMat);
      base.position.y = 0.6;
      pav.add(base);
      this.registerBuildingPart(base, 150, 'wall', 'masonry', `noancac_${side}_base`);

      for (const cx of [-5.5, 0, 5.5]) {
        for (const cz of [-4.2, 4.2]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 4.6, 6), redColMat);
          col.position.set(cx, 3.5, cz);
          pav.add(col);
          this.registerBuildingPart(col, 70, 'pillar', 'wood', `noancac_${side}`);
        }
      }

      const walls = new THREE.Mesh(new THREE.BoxGeometry(11, 4.2, 8.5), redColMat);
      walls.position.y = 3.3;
      pav.add(walls);
      this.registerBuildingPart(walls, 95, 'wall', 'masonry', `noancac_${side}`);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 1.4, 12.5), goldRoofMat);
      roof.position.y = 5.8;
      roof.castShadow = true;
      pav.add(roof);
      this.registerBuildingPart(roof, 85, 'eave', 'tile', `noancac_${side}`);

      this.rearCourtsGroup.add(pav);
    }

    // 2. Ngự Lộ (Đường đá Hoàng Gia nối ra Bắc Môn Huyền Vũ Môn)
    const royalAvenue = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 38), stoneMat);
    royalAvenue.position.set(0, 0.18, 98);
    this.rearCourtsGroup.add(royalAvenue);
    this.registerBuildingPart(royalAvenue, 180, 'wall', 'masonry', 'royal_avenue');

    this.scene.add(this.rearCourtsGroup);
  }

  // --- HÀM TẠO NHÀ PHỐ CỔ MÔ-ĐUN HÓA ĐỘC LẬP (MODULAR SHOP / HOUSE BUILDER) ---
  buildModularShopHouse(options) {
    const {
      x = 0, z = 0,
      width = 8.5, depth = 6.5, height = 3.6,
      stories = 1,
      wallColor = 0xf5f6fa,
      roofColor = 0x2c3e50,
      pillarColor = 0x4a2e18,
      rot = 0,
      id = 'shop',
      hasAwning = false,
      awningColor = 0xe74c3c
    } = options;

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rot;

    const woodMat = new THREE.MeshStandardMaterial({ color: pillarColor, flatShading: true, roughness: 0.8 });
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, flatShading: true, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, flatShading: true, roughness: 0.45 });

    // 1. Cột gỗ chịu lực 4 góc
    const pX = width / 2 - 0.35;
    const pZ = depth / 2 - 0.35;
    const pCoords = [
      { x: -pX, z: -pZ }, { x: pX, z: -pZ },
      { x: -pX, z: pZ },  { x: pX, z: pZ }
    ];

    for (let i = 0; i < pCoords.length; i++) {
      const c = pCoords[i];
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, height, 6), woodMat);
      pillar.position.set(c.x, height / 2, c.z);
      group.add(pillar);
      this.registerBuildingPart(pillar, 60, 'pillar', 'wood', id);
    }

    // 2. Vách tường 4 mặt
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(width - 0.6, height - 0.2, 0.35), wallMat);
    frontWall.position.set(0, height / 2, pZ);
    group.add(frontWall);
    this.registerBuildingPart(frontWall, 75, 'wall', 'masonry', id);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width - 0.6, height - 0.2, 0.35), wallMat);
    backWall.position.set(0, height / 2, -pZ);
    group.add(backWall);
    this.registerBuildingPart(backWall, 75, 'wall', 'masonry', id);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, height - 0.2, depth - 0.6), wallMat);
    leftWall.position.set(-pX, height / 2, 0);
    group.add(leftWall);
    this.registerBuildingPart(leftWall, 75, 'wall', 'masonry', id);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, height - 0.2, depth - 0.6), wallMat);
    rightWall.position.set(pX, height / 2, 0);
    group.add(rightWall);
    this.registerBuildingPart(rightWall, 75, 'wall', 'masonry', id);

    // 3. Mái ngói hiên chính
    const eaveY = height + 0.4;
    const eaveRoof = new THREE.Mesh(new THREE.BoxGeometry(width + 2.0, 0.85, depth + 2.0), roofMat);
    eaveRoof.position.set(0, eaveY, 0);
    eaveRoof.castShadow = true;
    group.add(eaveRoof);
    this.registerBuildingPart(eaveRoof, 70, 'eave', 'tile', id);

    if (stories === 2) {
      const floor2Height = 3.0;
      const f2Room = new THREE.Mesh(new THREE.BoxGeometry(width - 1.2, floor2Height, depth - 1.2), wallMat);
      f2Room.position.set(0, eaveY + floor2Height / 2 + 0.3, 0);
      group.add(f2Room);
      this.registerBuildingPart(f2Room, 85, 'wall', 'masonry', id);

      const roof2 = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, 0.95, depth + 1.2), roofMat);
      roof2.position.set(0, eaveY + floor2Height + 0.6, 0);
      roof2.castShadow = true;
      group.add(roof2);
      this.registerBuildingPart(roof2, 75, 'eave', 'tile', id);
    }

    if (hasAwning) {
      const awningMat = new THREE.MeshStandardMaterial({ color: awningColor, flatShading: true });
      const awning = new THREE.Mesh(new THREE.BoxGeometry(width - 1.5, 0.15, 1.8), awningMat);
      awning.position.set(0, 2.2, pZ + 1.0);
      awning.rotation.x = -0.22;
      group.add(awning);
      this.registerBuildingPart(awning, 45, 'eave', 'wood', id);
    }

    this.scene.add(group);
    return group;
  }

  // --- HÀM TẠO TỨ HỢP VIỆN TRUYỀN THỐNG (SIHEYUAN COMPOUND) ---
  buildSiheyuanCompound(cx, cz, id, roofColor = 0x2c3e50, wallColor = 0xf5f6fa) {
    const compound = new THREE.Group();
    compound.position.set(cx, 0, cz);

    const wallWhiteMat = new THREE.MeshStandardMaterial({ color: wallColor, flatShading: true });
    const tileCapMat = new THREE.MeshStandardMaterial({ color: roofColor, flatShading: true });

    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(15, 4.4, 6.8), wallWhiteMat);
    mainHall.position.set(0, 2.2, -9.5);
    compound.add(mainHall);
    this.registerBuildingPart(mainHall, 95, 'wall', 'masonry', `${id}_main`);

    const mainRoof = new THREE.Mesh(new THREE.BoxGeometry(17, 1.2, 8.8), tileCapMat);
    mainRoof.position.set(0, 4.7, -9.5);
    mainRoof.castShadow = true;
    compound.add(mainRoof);
    this.registerBuildingPart(mainRoof, 85, 'eave', 'tile', `${id}_main`);

    for (const side of [-8.5, 8.5]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.4, 11), wallWhiteMat);
      wing.position.set(side, 1.7, 0);
      compound.add(wing);
      this.registerBuildingPart(wing, 80, 'wall', 'masonry', `${id}_wing_${side}`);

      const wingRoof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.85, 12.8), tileCapMat);
      wingRoof.position.set(side, 3.6, 0);
      wingRoof.castShadow = true;
      compound.add(wingRoof);
      this.registerBuildingPart(wingRoof, 70, 'eave', 'tile', `${id}_wing_${side}`);
    }

    const southWing = new THREE.Mesh(new THREE.BoxGeometry(14, 3.2, 4.8), wallWhiteMat);
    southWing.position.set(0, 1.6, 9.5);
    compound.add(southWing);
    this.registerBuildingPart(southWing, 80, 'wall', 'masonry', `${id}_south`);

    const southRoof = new THREE.Mesh(new THREE.BoxGeometry(16, 0.85, 6.4), tileCapMat);
    southRoof.position.set(0, 3.4, 9.5);
    compound.add(southRoof);
    this.registerBuildingPart(southRoof, 70, 'eave', 'tile', `${id}_south`);

    const tableMat = new THREE.MeshStandardMaterial({ color: 0x95a5a6, flatShading: true });
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.75, 8), tableMat);
    table.position.set(0, 0.38, 0);
    compound.add(table);
    this.registerBuildingPart(table, 60, 'wall', 'masonry', `${id}_table`);

    this.scene.add(compound);
  }

  // --- HÀM TẠO THIÊN KIẾM VÕ QUÁN (MARTIAL ARTS ACADEMY) ---
  buildMartialAcademy(cx, cz, id) {
    const academy = new THREE.Group();
    academy.position.set(cx, 0, cz);

    const redMat = new THREE.MeshStandardMaterial({ color: 0x962d22, flatShading: true });
    const tealRoof = new THREE.MeshStandardMaterial({ color: 0x16a085, flatShading: true });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a381e, flatShading: true });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.8 });

    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(18, 5.5, 12), redMat);
    mainHall.position.set(0, 2.75, -8);
    mainHall.castShadow = true;
    academy.add(mainHall);
    this.registerBuildingPart(mainHall, 130, 'wall', 'masonry', id);

    for (const px of [-7.5, -2.5, 2.5, 7.5]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 5.2, 6), woodMat);
      pillar.position.set(px, 2.6, -1.2);
      academy.add(pillar);
      this.registerBuildingPart(pillar, 75, 'pillar', 'wood', id);
    }

    const lowerRoof = new THREE.Mesh(new THREE.BoxGeometry(21, 1.2, 15), tealRoof);
    lowerRoof.position.set(0, 5.8, -8);
    lowerRoof.castShadow = true;
    academy.add(lowerRoof);
    this.registerBuildingPart(lowerRoof, 100, 'eave', 'tile', id);

    const upperWall = new THREE.Mesh(new THREE.BoxGeometry(13, 2.8, 8.5), redMat);
    upperWall.position.set(0, 7.6, -8);
    academy.add(upperWall);
    this.registerBuildingPart(upperWall, 100, 'wall', 'masonry', id);

    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(16, 1.4, 11), tealRoof);
    upperRoof.position.set(0, 9.4, -8);
    upperRoof.castShadow = true;
    academy.add(upperRoof);
    this.registerBuildingPart(upperRoof, 100, 'eave', 'tile', id);

    const sign = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.5, 0.2), goldMat);
    sign.position.set(0, 4.6, -1.8);
    academy.add(sign);
    this.registerBuildingPart(sign, 50, 'wall', 'wood', id);

    for (let i = 0; i < 4; i++) {
      const dummyX = -5.0 + i * 3.3;
      const dummyGroup = new THREE.Group();
      dummyGroup.position.set(dummyX, 0, 7.5);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 6), woodMat);
      post.position.y = 1.1;
      post.castShadow = true;
      dummyGroup.add(post);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.12), woodMat);
      armL.position.set(-0.35, 1.5, 0);
      dummyGroup.add(armL);

      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.12), woodMat);
      armR.position.set(0.35, 1.3, 0);
      dummyGroup.add(armR);

      academy.add(dummyGroup);

      this.fences.push({
        group: dummyGroup,
        mesh: post,
        pos: new THREE.Vector3(cx + dummyX, 1.1, cz + 7.5),
        radius: 1.2,
        hp: 40,
        isBroken: false,
      });
    }

    this.scene.add(academy);
  }

  // --- HÀM TẠO THANH VÂN THƯ VIỆN (ACADEMY & LIBRARY) ---
  buildAcademyLibrary(cx, cz, id) {
    const library = new THREE.Group();
    library.position.set(cx, 0, cz);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, flatShading: true });
    const blueRoofMat = new THREE.MeshStandardMaterial({ color: 0x2980b9, flatShading: true, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(17, 6.0, 10.5), stoneMat);
    body.position.set(0, 3.0, 0);
    body.castShadow = true;
    library.add(body);
    this.registerBuildingPart(body, 120, 'wall', 'masonry', id);

    for (const px of [-6.5, -2.2, 2.2, 6.5]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 5.8, 6), woodMat);
      col.position.set(px, 2.9, 5.8);
      library.add(col);
      this.registerBuildingPart(col, 65, 'pillar', 'wood', id);
    }

    const eave1 = new THREE.Mesh(new THREE.BoxGeometry(20, 1.1, 13.5), blueRoofMat);
    eave1.position.set(0, 6.2, 0.6);
    eave1.castShadow = true;
    library.add(eave1);
    this.registerBuildingPart(eave1, 95, 'eave', 'tile', id);

    const topRoom = new THREE.Mesh(new THREE.BoxGeometry(12, 2.8, 7.5), stoneMat);
    topRoom.position.set(0, 8.0, 0);
    library.add(topRoom);
    this.registerBuildingPart(topRoom, 90, 'wall', 'masonry', id);

    const topRoof = new THREE.Mesh(new THREE.BoxGeometry(15, 1.4, 10), blueRoofMat);
    topRoof.position.set(0, 9.8, 0);
    topRoof.castShadow = true;
    library.add(topRoof);
    this.registerBuildingPart(topRoof, 85, 'eave', 'tile', id);

    this.scene.add(library);
  }

  // --- HÀM TẠO THÁP LẦU BÁT GIÁC / LINH DƯỢC CÁC (PAVILION TOWER) ---
  buildPavilionTower(x, z, tiers = 3, roofColor = 0x8e44ad, id = 'pavilion') {
    const tower = new THREE.Group();
    tower.position.set(x, 0, z);

    const stoneBaseMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, flatShading: true });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, flatShading: true });
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, flatShading: true, roughness: 0.4 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.5, 1.5, 8), stoneBaseMat);
    base.position.y = 0.75;
    tower.add(base);
    this.registerBuildingPart(base, 140, 'wall', 'masonry', `${id}_base`);

    for (let l = 0; l < tiers; l++) {
      const radius = 4.2 - l * 0.75;
      const height = 3.2;
      const y = 1.5 + l * 4.2;

      const floor = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, height, 8), woodMat);
      floor.position.y = y + height / 2;
      tower.add(floor);
      this.registerBuildingPart(floor, 85, 'wall', 'wood', `${id}_tier_${l}`);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.55, 1.2, 8), roofMat);
      roof.position.y = y + height + 0.6;
      roof.castShadow = true;
      tower.add(roof);
      this.registerBuildingPart(roof, 75, 'eave', 'tile', `${id}_roof_${l}`);
    }

    this.scene.add(tower);
  }

  // --- HÀM TẠO NHÀ SÀN & CẦU TÀU VEN BỜ KÊNH (WATERFRONT STILT HOUSE) ---
  buildWaterfrontStiltHouse(x, z, rot, id) {
    const stiltHouse = new THREE.Group();
    stiltHouse.position.set(x, 0, z);
    stiltHouse.rotation.y = rot;

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a381e, flatShading: true, roughness: 0.85 });
    const thatchMat = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, flatShading: true });

    for (const sx of [-3.2, 3.2]) {
      for (const sz of [-2.4, 2.4]) {
        const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.5, 5), woodMat);
        stilt.position.set(sx, 0.4, sz);
        stiltHouse.add(stilt);
        this.registerBuildingPart(stilt, 50, 'pillar', 'wood', id);
      }
    }

    const deck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.35, 6.2), woodMat);
    deck.position.y = 1.9;
    stiltHouse.add(deck);
    this.registerBuildingPart(deck, 80, 'wall', 'wood', id);

    const hut = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.0, 4.8), woodMat);
    hut.position.set(0, 3.4, 0);
    stiltHouse.add(hut);
    this.registerBuildingPart(hut, 70, 'wall', 'wood', id);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.85, 6.2), thatchMat);
    roof.position.set(0, 5.1, 0);
    roof.castShadow = true;
    stiltHouse.add(roof);
    this.registerBuildingPart(roof, 60, 'eave', 'tile', id);

    const boat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 3.6), woodMat);
    boat.position.set(3.8, -0.2, 2.0);
    boat.rotation.y = 0.3;
    stiltHouse.add(boat);
    this.registerBuildingPart(boat, 60, 'wall', 'wood', `${id}_boat`);

    this.scene.add(stiltHouse);
  }

  // --- KHU TÂY NAM (PHỐ RÈN, BINH KHÍ ĐIẾM & CƯ XÁ VĨNH AN) ---
  createSouthWestDistrict() {
    const sWestSpots = [
      { x: -32, z: -105, col: 0x2c3e50, s: 2, id: 'sw_shop_0' },
      { x: -48, z: -105, col: 0x8b5a2b, s: 1, id: 'sw_shop_1' },
      { x: -64, z: -105, col: 0x16a085, s: 2, id: 'sw_shop_2' },
      { x: -80, z: -105, col: 0x2c3e50, s: 1, id: 'sw_shop_3' },
    ];
    for (const sp of sWestSpots) {
      this.buildModularShopHouse({
        x: sp.x, z: sp.z,
        width: 8.5, depth: 6.4,
        stories: sp.s,
        roofColor: sp.col,
        id: sp.id,
        hasAwning: true,
        awningColor: 0xe74c3c
      });
    }

    for (let i = 0; i < 3; i++) {
      const fx = -38 - i * 16;
      this.buildModularShopHouse({
        x: fx, z: -85,
        width: 8.8, depth: 6.8,
        stories: 1,
        wallColor: 0xdcdde1,
        roofColor: 0x3d3d3d,
        id: `sw_forge_${i}`
      });
    }

    const resZ = [-95, -78, -61, -44];
    for (let i = 0; i < resZ.length; i++) {
      this.buildModularShopHouse({
        x: -88, z: resZ[i],
        width: 7.8, depth: 6.0,
        stories: (i % 2 === 0 ? 2 : 1),
        wallColor: 0xecf0f1,
        roofColor: 0x2c3e50,
        rot: Math.PI / 2,
        id: `sw_res_${i}`
      });
    }
  }

  // --- KHU ĐÔNG NAM (PHỐ TƠ LỤA, TIỆM GỐM, DƯỢC ĐIẾM & CƯ XÁ BÌNH KHANG) ---
  createSouthEastDistrict() {
    const sEastSpots = [
      { x: 32, z: -105, col: 0x9b59b6, s: 2, id: 'se_shop_0' },
      { x: 48, z: -105, col: 0x16a085, s: 1, id: 'se_shop_1' },
      { x: 64, z: -105, col: 0x2c3e50, s: 2, id: 'se_shop_2' },
      { x: 80, z: -105, col: 0xc0392b, s: 1, id: 'se_shop_3' },
    ];
    for (const sp of sEastSpots) {
      this.buildModularShopHouse({
        x: sp.x, z: sp.z,
        width: 8.5, depth: 6.4,
        stories: sp.s,
        roofColor: sp.col,
        id: sp.id,
        hasAwning: true,
        awningColor: 0x3498db
      });
    }

    for (let i = 0; i < 3; i++) {
      const fx = 38 + i * 16;
      this.buildModularShopHouse({
        x: fx, z: -85,
        width: 8.8, depth: 6.8,
        stories: 2,
        wallColor: 0xf5f6fa,
        roofColor: 0x16a085,
        id: `se_silk_${i}`
      });
    }

    const resZ = [-95, -78, -61, -44];
    for (let i = 0; i < resZ.length; i++) {
      this.buildModularShopHouse({
        x: 88, z: resZ[i],
        width: 7.8, depth: 6.0,
        stories: (i % 2 === 0 ? 1 : 2),
        wallColor: 0xf5f6fa,
        roofColor: 0x2c3e50,
        rot: -Math.PI / 2,
        id: `se_res_${i}`
      });
    }
  }

  // --- KHU TÂY BẮC (THIÊN KIẾM VÕ QUÁN, LINH DƯỢC CÁC, TỨ HỢP VIỆN TÂY BẮC) ---
  createNorthWestDistrict() {
    this.buildMartialAcademy(-75, 40, 'martial_academy');
    this.buildPavilionTower(-75, 85, 3, 0x8e44ad, 'alchemy_tower');
    this.buildSiheyuanCompound(-42, 82, 'nw_siheyuan', 0x2c3e50);

    const upperZ = [28, 44, 60];
    for (let i = 0; i < upperZ.length; i++) {
      this.buildModularShopHouse({
        x: -24, z: upperZ[i],
        width: 8.2, depth: 6.2,
        stories: (i === 1 ? 2 : 1),
        roofColor: (i === 0 ? 0x962d22 : 0x2c3e50),
        id: `nw_culinary_${i}`
      });
    }

    this.buildModularShopHouse({ x: -75, z: 12, width: 8.0, depth: 6.0, stories: 1, roofColor: 0x16a085, id: 'nw_manor_1' });
    this.buildModularShopHouse({ x: -95, z: 62, width: 8.5, depth: 6.5, stories: 2, roofColor: 0x2c3e50, id: 'nw_manor_2' });
  }

  // --- KHU ĐÔNG BẮC (THANH VÂN THƯ VIỆN, VỌNG NGUYỆT LẦU, PHỦ THƯỢNG THƯ) ---
  createNorthEastDistrict() {
    this.buildAcademyLibrary(75, 40, 'academy_library');
    this.buildPavilionTower(48, 40, 3, 0x16a085, 'moon_tower');
    this.buildSiheyuanCompound(78, 85, 'ne_siheyuan', 0x2c3e50);

    this.buildModularShopHouse({
      x: 42, z: 82,
      width: 9.2, depth: 7.0,
      stories: 2,
      wallColor: 0xf5f6fa,
      roofColor: 0x8854d0,
      id: 'ne_treasure_vault'
    });

    const upperZ = [28, 44, 60];
    for (let i = 0; i < upperZ.length; i++) {
      this.buildModularShopHouse({
        x: 24, z: upperZ[i],
        width: 8.2, depth: 6.2,
        stories: (i === 1 ? 2 : 1),
        roofColor: (i === 1 ? 0x2980b9 : 0x2c3e50),
        id: `ne_antique_${i}`
      });
    }

    this.buildModularShopHouse({ x: 75, z: 12, width: 8.0, depth: 6.0, stories: 1, roofColor: 0x9b59b6, id: 'ne_manor_1' });
    this.buildModularShopHouse({ x: 95, z: 62, width: 8.5, depth: 6.5, stories: 2, roofColor: 0x2c3e50, id: 'ne_manor_2' });
  }

  // --- DÃY NHÀ SÀN & CẦU TÀU VEN BỜ KÊNH ĐÀO ĐÔNG - TÂY ---
  createWaterfrontStiltHouses() {
    this.buildWaterfrontStiltHouse(-72, -23, 0, 'stilt_west_1');
    this.buildWaterfrontStiltHouse(-95, -23, 0.15, 'stilt_west_2');

    this.buildWaterfrontStiltHouse(72, -23, 0, 'stilt_east_1');
    this.buildWaterfrontStiltHouse(95, -23, -0.15, 'stilt_east_2');
  }

  // --- 10. CỘT ĐÈN LỒNG ĐỎ DỌC ĐẠI LỘ CÓ ÁNH SÁNG THỰC (32+ LANTERNS) ---
  createStreetLanterns() {
    this.lanternGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, flatShading: true });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xff3838,
      emissive: 0xff3838,
      emissiveIntensity: 1.6, // Tỏa sáng đỏ rực rỡ không tốn GPU per-pixel lighting
      flatShading: true,
      roughness: 0.4,
    });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.3 });

    // Dãy cột đèn lồng trải dài từ Nam Môn viền thành (z = -116) đến trước Đại Điện (z = +62)
    const lanternZCoords = [-116, -102, -88, -74, -60, -46, -32, -8, 6, 20, 34, 48, 62];

    for (let i = 0; i < lanternZCoords.length; i++) {
      const z = lanternZCoords[i];
      for (const side of [-6.0, 6.0]) {
        const poleGroup = new THREE.Group();
        poleGroup.position.set(side, 0, z);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.8, 6), woodMat);
        pole.position.y = 1.9;
        poleGroup.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1), woodMat);
        const armDir = side < 0 ? 1 : -1;
        arm.position.set(armDir * 0.4, 3.6, 0);
        poleGroup.add(arm);

        const lanternPivot = new THREE.Group();
        lanternPivot.position.set(armDir * 0.75, 3.55, 0);

        const lantern = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), lanternMat);
        lantern.scale.set(1.0, 1.25, 1.0);
        lantern.position.y = -0.55;
        lanternPivot.add(lantern);

        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 6), goldMat);
        cap.position.y = 0;
        lanternPivot.add(cap);

        const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 4), lanternMat);
        tassel.position.y = -1.25;
        lanternPivot.add(tassel);

        poleGroup.add(lanternPivot);
        this.hangingLanterns.push({ pivot: lanternPivot, phase: (i + side) * 0.8 });

        // Chỉ tạo 2 nguồn sáng điểm đại diện ở trung tâm cầu kênh đào để giữ mượt tuyệt đối 60 FPS
        if (i === 7 && side > 0) {
          const pLight = new THREE.PointLight(0xff7722, 1.8, 18, 1.8);
          pLight.position.set(armDir * 0.75, 2.9, 0);
          poleGroup.add(pLight);
          this.lanternLights.push(pLight);
        }

        this.lanternGroup.add(poleGroup);

        this.fences.push({
          group: poleGroup,
          mesh: pole,
          pos: new THREE.Vector3(side, 1.9, z),
          radius: 1.4,
          isBroken: false,
          isLantern: true,
        });
      }
    }

    this.scene.add(this.lanternGroup);
  }

  // --- 11. QUẦY SẠP CHỢ & THÙNG GỖ HÀNG HÓA DÀY ĐẶC (MARKET DISTRICT) ---
  createMarketStalls() {
    this.marketGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, flatShading: true });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xa0522d, flatShading: true, roughness: 0.9 });
    const clothColors = [0xe74c3c, 0x3498db, 0xf39c12, 0x27ae60, 0x9b59b6];

    const stallSpots = [
      { x: -10.5, z: -26, rot: 0.15 }, { x: 10.5, z: -26, rot: -0.15 },
      { x: -10.5, z: -8, rot: 0 },     { x: 10.5, z: -8, rot: 0 },
      { x: -11.0, z: 18, rot: 0.1 },   { x: 11.0, z: 18, rot: -0.1 },
      { x: -11.0, z: 32, rot: -0.05 }, { x: 11.0, z: 32, rot: 0.05 },
      { x: -16.0, z: -2, rot: 0.4 },   { x: 16.0, z: -2, rot: -0.4 },
      { x: -32.0, z: 8, rot: 0 },      { x: -38.0, z: 8, rot: 0.2 },
    ];

    for (let i = 0; i < stallSpots.length; i++) {
      const spot = stallSpots[i];
      const stall = new THREE.Group();
      stall.position.set(spot.x, 0, spot.z);
      stall.rotation.y = spot.rot;

      const table = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 1.5), woodMat);
      table.position.y = 0.42;
      stall.add(table);

      for (const cx of [-1.3, 1.3]) {
        for (const cz of [-0.65, 0.65]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 5), woodMat);
          post.position.set(cx, 1.1, cz);
          stall.add(post);
        }
      }

      const col = clothColors[i % clothColors.length];
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.15, 1.9),
        new THREE.MeshStandardMaterial({ color: col, flatShading: true })
      );
      canopy.position.y = 2.2;
      canopy.rotation.x = -0.15;
      canopy.castShadow = true; // Chỉ mái bạt sạp chợ mới đổ bóng
      stall.add(canopy);

      // Thùng hàng gỗ đặt cạnh sạp
      for (let c = 0; c < 2; c++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), crateMat);
        crate.position.set(1.8, 0.4 + c * 0.75, 0.2 * (c === 0 ? 1 : -1));
        stall.add(crate);
      }

      this.fences.push({
        group: stall,
        mesh: table,
        pos: new THREE.Vector3(spot.x, 0.8, spot.z),
        radius: 2.4,
        hp: 35,
        isBroken: false,
      });

      this.marketGroup.add(stall);
    }

    this.scene.add(this.marketGroup);
  }

  // --- 12. GIÁ BINH KHÍ ĐAO KIẾM (WEAPON RACKS - DESTRUCTIBLE) ---
  createWeaponRacks() {
    this.rackGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a381e, flatShading: true });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x95a5a6, metalness: 0.8, roughness: 0.3 });

    const rackSpots = [
      { x: -14, z: -10 }, { x: 14, z: -10 },
      { x: -8, z: 24 },   { x: 8, z: 24 },
      { x: -14, z: 38 },  { x: 14, z: 38 },
    ];

    for (const rs of rackSpots) {
      const rack = new THREE.Group();
      rack.position.set(rs.x, 0, rs.z);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.4), woodMat);
      frame.position.y = 0.8;
      frame.castShadow = true;
      rack.add(frame);

      // 4 Cây trường thương cắm trên giá
      for (let s = -3; s <= 3; s += 2) {
        const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), woodMat);
        spear.position.set(s * 0.3, 1.3, 0);
        spear.rotation.z = 0.1 * s;
        rack.add(spear);

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 4), steelMat);
        tip.position.set(s * 0.3, 2.6, 0);
        rack.add(tip);
      }

      this.rackGroup.add(rack);

      this.fences.push({
        group: rack,
        mesh: frame,
        pos: new THREE.Vector3(rs.x, 0.8, rs.z),
        radius: 1.8,
        hp: 30,
        isBroken: false,
      });
    }

    this.scene.add(this.rackGroup);
  }

  // --- 13. CHỒNG VÒ RƯỢU GỐM NỮ NHI HỒNG (45+ WINE URNS) ---
  createWineUrns() {
    this.urnGroup = new THREE.Group();
    const ceramicMat = new THREE.MeshStandardMaterial({
      color: 0x8b3a1a,
      roughness: 0.5,
      metalness: 0.1,
      flatShading: true,
    });
    const redClothMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, flatShading: true });

    const urnClusters = [
      { x: -18.5, z: 6.5, count: 6 },
      { x: -20.5, z: 10.5, count: 5 },
      { x: 19.0, z: 6.2, count: 5 },
      { x: -14.0, z: -30.0, count: 4 },
      { x: 14.0, z: -30.0, count: 4 },
      { x: -16.0, z: -45.0, count: 5 },
      { x: 16.0, z: -45.0, count: 5 },
      { x: -8.0, z: -10.0, count: 4 },
      { x: 8.0, z: -10.0, count: 4 },
    ];

    for (const uc of urnClusters) {
      for (let i = 0; i < uc.count; i++) {
        const ox = (i % 3) * 0.65 - 0.6;
        const oz = Math.floor(i / 3) * 0.65 - 0.3;
        const ux = uc.x + ox;
        const uz = uc.z + oz;
        const uy = getTerrainHeight(ux, uz);

        const urn = new THREE.Group();
        urn.position.set(ux, uy, uz);

        const belly = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), ceramicMat);
        belly.scale.set(1.0, 1.15, 1.0);
        belly.position.y = 0.42;
        urn.add(belly);

        const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.18, 8), ceramicMat);
        mouth.position.y = 0.85;
        urn.add(mouth);

        const redCap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), redClothMat);
        redCap.position.y = 0.96;
        urn.add(redCap);

        this.urnGroup.add(urn);

        this.rocks.push({
          mesh: urn,
          pos: new THREE.Vector3(ux, uy + 0.45, uz),
          scale: new THREE.Vector3(1, 1, 1),
          radius: 0.65,
          hp: 25,
          isBroken: false,
          isWineUrn: true,
          oreColor: 0xd35400,
        });
      }
    }

    this.scene.add(this.urnGroup);
  }

  // --- 14. CÂY LIỄU RỦ VEN KÊNH & ĐÀO SÂN ĐÌNH (40+ WILLOWS & 25+ PEACH TREES) ---
  createCourtyardTrees() {
    this.treeGroup = new THREE.Group();

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a381e, flatShading: true, roughness: 0.9 });
    const willowLeafMat = new THREE.MeshStandardMaterial({ color: 0x27ae60, flatShading: true, roughness: 0.7 });
    const peachBlossomMat = new THREE.MeshStandardMaterial({ color: 0xff7675, flatShading: true, roughness: 0.7 });

    // Hàng liễu rủ dọc hai bên bờ kênh đào trải dài x: -110 đến +110
    for (let x = -110; x <= 110; x += 11) {
      if (Math.abs(x) < 7 || Math.abs(x - (-45)) < 6 || Math.abs(x - 45) < 6) continue;

      for (const zOffset of [-21, -11]) {
        const singleTree = new THREE.Group();
        singleTree.position.set(x + (Math.random() - 0.5) * 2, 0, zOffset);

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, 2.8, 5), trunkMat);
        trunk.position.y = 1.4;
        trunk.rotation.z = (Math.random() - 0.5) * 0.2;
        trunk.castShadow = true;
        singleTree.add(trunk);

        const canopies = [];
        const mainCanopy = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.6, 6), willowLeafMat);
        mainCanopy.position.y = 3.2;
        mainCanopy.rotation.x = Math.PI;
        mainCanopy.castShadow = true;
        singleTree.add(mainCanopy);
        canopies.push(mainCanopy);

        const subCanopy = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.0, 6), willowLeafMat);
        subCanopy.position.set(0.4, 2.8, 0.3);
        subCanopy.rotation.x = Math.PI;
        singleTree.add(subCanopy);
        canopies.push(subCanopy);

        this.treeGroup.add(singleTree);

        this.trees.push({
          group: singleTree,
          pos: new THREE.Vector3(singleTree.position.x, 0, zOffset),
          scale: 1.1,
          hp: 45,
          isBroken: false,
          treeType: 'willow',
          folColor: 0x27ae60,
          canopies,
          apples: [],
          wobbleAngle: 0,
          wobbleAxis: new THREE.Vector3(1, 0, 0),
          wobbleVel: 0,
        });
      }
    }

    // Cây hoa đào trong sân đình các phủ đệ
    const peachSpots = [
      { x: -14, z: 24 }, { x: 14, z: 24 },
      { x: -28, z: 16 }, { x: 28, z: 16 },
      { x: -36, z: -25 }, { x: 36, z: -25 },
      { x: -18, z: 50 }, { x: 18, z: 50 },
    ];

    for (const ps of peachSpots) {
      const peachTree = new THREE.Group();
      peachTree.position.set(ps.x, 0, ps.z);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 2.4, 5), trunkMat);
      trunk.position.y = 1.2;
      peachTree.add(trunk);

      const canopies = [];
      for (let l = 0; l < 3; l++) {
        const blossom = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 - l * 0.3, 1), peachBlossomMat);
        blossom.position.set((l - 1) * 0.5, 2.6 + l * 0.6, (l % 2) * 0.4);
        blossom.castShadow = true;
        peachTree.add(blossom);
        canopies.push(blossom);
      }

      this.treeGroup.add(peachTree);

      this.trees.push({
        group: peachTree,
        pos: new THREE.Vector3(ps.x, 0, ps.z),
        scale: 1.2,
        hp: 45,
        isBroken: false,
        treeType: 'peach',
        folColor: 0xff7675,
        canopies,
        apples: [],
        wobbleAngle: 0,
        wobbleAxis: new THREE.Vector3(1, 0, 0),
        wobbleVel: 0,
      });
    }

    this.scene.add(this.treeGroup);
  }

  // --- 15. CHẬU HOA CÚC & SEN NƯỚC (30+ CHẬU HOA) ---
  createStreetFlora() {
    this.flowerGroup = new THREE.Group();
    const potMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, flatShading: true });
    const flowerColors = [0xf1c40f, 0xe74c3c, 0xff9ff3, 0x00cec9];

    for (let z = -55; z <= 55; z += 12) {
      for (const side of [-5.2, 5.2]) {
        const potGroup = new THREE.Group();
        potGroup.position.set(side, 0, z);

        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.45, 6), potMat);
        pot.position.y = 0.22;
        potGroup.add(pot);

        const col = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        const bloom = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.38, 0),
          new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 0.6 })
        );
        bloom.position.y = 0.55;
        potGroup.add(bloom);

        this.flowerGroup.add(potGroup);

        this.flowers.push({
          group: potGroup,
          pos: new THREE.Vector3(side, 0.3, z),
          color: col,
          radius: 0.6,
          isBroken: false,
        });
      }
    }

    this.scene.add(this.flowerGroup);
  }

  // --- 16. MÂY TRỜI KINH THÀNH (24+ CLOUDS) ---
  createCitySkyClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.9,
      transparent: true,
      opacity: 0.88,
    });

    const cloudCount = 24;
    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const numPuffs = 4 + Math.floor(Math.random() * 4);

      for (let j = 0; j < numPuffs; j++) {
        const puffSize = 3.2 + Math.random() * 2.8;
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(puffSize, 1), cloudMat);
        puff.position.set(
          (j - numPuffs / 2) * 2.6 + (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.0,
          (Math.random() - 0.5) * 1.6
        );
        cloud.add(puff);
      }

      cloud.position.set(
        (Math.random() - 0.5) * 260,
        28 + Math.random() * 15,
        (Math.random() - 0.5) * 260
      );
      cloud.userData.speed = 0.6 + Math.random() * 0.9;

      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  // --- TÀN PHÁ & LÀM NỨT GẠCH ĐÁ KINH THÀNH KHI DÙNG KỸ NĂNG ---
  deformTerrain(centerX, centerZ, radius, depth, type = 'fire') {
    activeCraters.push({
      x: centerX,
      z: centerZ,
      radius: radius,
      depth: depth,
      type: type,
    });

    if (activeCraters.length > 50) {
      activeCraters.shift();
    }

    const pos = this.terrainGeometry.attributes.position;
    const colorAttr = this.terrainGeometry.attributes.color;

    const burnColor = new THREE.Color(
      type === 'fire' ? 0x1e1514 :
      type === 'lightning' ? 0x241d2e :
      type === 'ice' ? 0xecf0f1 :
      0x2c2621
    );

    const glowBorder = new THREE.Color(
      type === 'fire' ? 0xe74c3c :
      type === 'lightning' ? 0x00d2d3 :
      type === 'ice' ? 0x74b9ff :
      0x785336
    );

    let affectedCount = 0;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const dist = Math.hypot(vx - centerX, vz - centerZ);

      if (dist < radius) {
        affectedCount++;
        const factor = Math.pow(1.0 - dist / radius, 2);
        const newY = pos.getY(i) - depth * factor;
        pos.setY(i, newY);

        const curR = colorAttr.getX(i);
        const curG = colorAttr.getY(i);
        const curB = colorAttr.getZ(i);
        const currentColor = new THREE.Color(curR, curG, curB);

        const mixRatio = factor * 0.92;
        const targetColor = dist < radius * 0.4 ? burnColor : glowBorder;
        currentColor.lerp(targetColor, mixRatio);

        colorAttr.setXYZ(i, currentColor.r, currentColor.g, currentColor.b);
      }
    }

    if (affectedCount > 0) {
      pos.needsUpdate = true;
      colorAttr.needsUpdate = true;
      this.terrainGeometry.computeVertexNormals();
    }
  }

  // --- VẬT LÝ MẢNH VỠ BAY TỨ TUNG (DEBRIS PHYSICS CÓ ĐỘ NẢY RESTITUTION & MA SÁT) ---
  addDebris(mesh, impulseDir, speed, gravity = 20, life = 3.6, restitution = 0.52, isBurning = false) {
    mesh.castShadow = false; // Tắt shadow cho mảnh vỡ để bảo vệ FPS tối đa

    // Giới hạn mảnh vỡ tối đa 160 mảnh
    while (this.debris.length >= 160) {
      const old = this.debris.shift();
      this.scene.remove(old.mesh);
    }

    this.scene.add(mesh);
    const vel = impulseDir.clone().normalize().multiplyScalar(speed);
    vel.y += speed * (0.35 + Math.random() * 0.45);

    this.debris.push({
      mesh,
      vel,
      gravity,
      restitution,
      isBurning,
      burnTimer: 0,
      rotVel: new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      ),
      life,
      maxLife: life,
    });
  }

  // HÀM XÓA OBJECT AN TOÀN TRUY TÌM ĐÚNG PARENT VÀ ẨN NGAY LẬP TỨC
  safeRemoveObject(obj) {
    if (!obj) return;
    obj.visible = false;
    if (obj.parent) {
      obj.parent.remove(obj);
    } else {
      this.scene.remove(obj);
    }
  }

  // --- PHÁ HỦY TỪNG BỘ PHẬN NHÀ (MODULAR BUILDING DESTRUCTION SYSTEM) ---
  breakBuildingPart(part, epicenter, force, isFire = false) {
    if (part.isBroken) return;
    part.isBroken = true;

    // 1. Tách hoặc ẩn mesh bộ phận
    this.safeRemoveObject(part.mesh);

    const impulseDir = part.center.clone().sub(epicenter).normalize();
    if (impulseDir.lengthSq() < 0.001) {
      impulseDir.set((Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2).normalize();
    }

    const isHugeBlast = force >= 35 || isFire;
    const debrisMultiplier = isHugeBlast ? 2.2 : 1.0;
    const launchSpeed = isHugeBlast ? force * 1.25 + 8 : force * 0.9 + 4;

    // 2. Âm thanh & Mảnh vỡ tùy loại vật liệu (Ngói, Gạch vôi, Gỗ)
    if (part.debrisType === 'tile') {
      sound.playRockShatter();
      const tileColor = isHugeBlast ? 0x221105 : 0x2c3e50;
      const tileMat = new THREE.MeshStandardMaterial({
        color: tileColor,
        emissive: isHugeBlast ? 0xff4757 : 0x000000,
        emissiveIntensity: isHugeBlast ? 0.35 : 0.0,
        flatShading: true,
        roughness: 0.4
      });
      const count = Math.round(7 * debrisMultiplier);
      for (let i = 0; i < count; i++) {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.75), tileMat);
        tile.position.copy(part.center);
        tile.position.add(new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.4));
        const dir = impulseDir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6, (Math.random() - 0.5) * 1.6)).normalize();
        this.addDebris(tile, dir, launchSpeed * (0.8 + Math.random() * 0.35), 22, 3.8, 0.42, isHugeBlast);
      }
      if (this.particles) {
        this.particles.emitSmoke(part.center, isHugeBlast ? 12 : 5, isHugeBlast ? 0x222222 : 0x7f8c8d, 1.3, isHugeBlast);
        this.particles.emitDust(part.center);
      }
    } else if (part.debrisType === 'masonry') {
      sound.playRockShatter();
      const brickColor = isHugeBlast ? 0x4a3c31 : 0xdcdde1;
      const masonryMat = new THREE.MeshStandardMaterial({
        color: brickColor,
        emissive: isHugeBlast ? 0xff3838 : 0x000000,
        emissiveIntensity: isHugeBlast ? 0.4 : 0.0,
        flatShading: true,
        roughness: 0.8
      });
      const count = Math.round(8 * debrisMultiplier);
      for (let i = 0; i < count; i++) {
        const brick = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + Math.random() * 0.4, 0), masonryMat);
        brick.position.copy(part.center);
        brick.position.add(new THREE.Vector3((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.8));
        const dir = impulseDir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.85, (Math.random() - 0.5) * 1.8)).normalize();
        this.addDebris(brick, dir, launchSpeed * (0.85 + Math.random() * 0.4), 20, 4.2, 0.55, isHugeBlast);
      }
      if (this.particles) {
        this.particles.emitSmoke(part.center, isHugeBlast ? 16 : 8, isHugeBlast ? 0x111111 : 0x95a5a6, 1.5, isHugeBlast);
        this.particles.emitShockwave(part.center, isHugeBlast ? 0xff4757 : 0xdcdde1, isHugeBlast ? 6.5 : 3.0, 0.4);
      }
    } else if (part.debrisType === 'wood') {
      sound.playWoodBreak();
      const woodColor = isHugeBlast ? 0x2b1d0c : 0x6d4c41;
      const woodMat = new THREE.MeshStandardMaterial({
        color: woodColor,
        emissive: isHugeBlast ? 0xff6b4a : 0x000000,
        emissiveIntensity: isHugeBlast ? 0.3 : 0.0,
        flatShading: true
      });
      const count = Math.round(6 * debrisMultiplier);
      for (let i = 0; i < count; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 1.4 + Math.random() * 0.8), woodMat);
        plank.position.copy(part.center);
        plank.position.add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.2));
        const dir = impulseDir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.95, (Math.random() - 0.5) * 1.8)).normalize();
        this.addDebris(plank, dir, launchSpeed * (0.9 + Math.random() * 0.35), 18, 3.6, 0.45, isHugeBlast);
      }
      if (this.particles) {
        this.particles.emitDust(part.center);
        if (isHugeBlast) this.particles.emitSmoke(part.center, 8, 0x222222, 1.2, true);
      }

      // Phản ứng dây chuyền: Nếu phá sập CỘT CHỊU LỰC, làm sập các mảng mái ngói phía trên nó!
      if (part.partType === 'pillar') {
        for (const otherPart of this.buildingParts) {
          if (!otherPart.isBroken && otherPart.buildingId === part.buildingId && otherPart.partType === 'eave') {
            const hDist = Math.hypot(otherPart.center.x - part.center.x, otherPart.center.z - part.center.z);
            if (hDist < 5.0 && otherPart.center.y > part.center.y) {
              otherPart.hp -= 55;
              if (otherPart.hp <= 0) {
                this.breakBuildingPart(otherPart, part.center, force * 0.85, isFire);
              }
            }
          }
        }
      }
    }

    // Sập dây chuyền mảng lớn nếu lực nổ cực đại
    if (isHugeBlast) {
      for (const otherPart of this.buildingParts) {
        if (!otherPart.isBroken && otherPart.buildingId === part.buildingId && otherPart !== part) {
          const d = otherPart.center.distanceTo(part.center);
          if (d < 6.8) {
            otherPart.hp -= 40;
            if (otherPart.hp <= 0) {
              this.breakBuildingPart(otherPart, part.center, force * 0.75, isFire);
            }
          }
        }
      }
    }
  }

  // PHÁ HỦY / GÃY CÂY
  breakTree(tree, epicenter, force, elementType = 'neutral') {
    if (tree.isBroken) return;
    tree.isBroken = true;

    sound.playWoodBreak();

    const impulseDir = tree.pos.clone().sub(epicenter).normalize();
    if (impulseDir.lengthSq() < 0.001) {
      impulseDir.set((Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2).normalize();
    }

    const stumpMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, flatShading: true });
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 0.6, 5), stumpMat);
    stump.position.copy(tree.pos);
    stump.position.y += 0.3;
    stump.castShadow = true;
    this.scene.add(stump);

    const trunkLog = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.8 * tree.scale, 5), stumpMat);
    trunkLog.position.copy(tree.pos);
    trunkLog.position.y += 1.3;
    trunkLog.castShadow = true;
    this.addDebris(trunkLog, impulseDir, force * 0.95 + 4, 18, 3.8, 0.48, force >= 35);

    for (const canopy of tree.canopies) {
      const worldPos = new THREE.Vector3();
      canopy.getWorldPosition(worldPos);

      const canMat = new THREE.MeshStandardMaterial({ color: tree.folColor, flatShading: true });
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85 * tree.scale, 0), canMat);
      chunk.position.copy(worldPos);
      chunk.castShadow = true;

      const scatterDir = impulseDir.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.8, (Math.random() - 0.5) * 1.2)
      ).normalize();

      this.addDebris(chunk, scatterDir, force * 1.1 + 5, 14, 3.2, 0.35, force >= 35);
    }

    if (this.particles) {
      this.particles.emitElementalParticles(tree.pos, force >= 35 ? 'fire' : 'ice', 18);
      this.particles.emitDust(tree.pos);
    }

    this.safeRemoveObject(tree.group);
  }

  // PHÁ HỦY / BỂ VÒ RƯỢU NỮ NHI HỒNG & SƯ TỬ ĐÁ
  breakRock(rock, epicenter, force, elementType = 'neutral') {
    if (rock.isBroken) return;
    rock.isBroken = true;

    sound.playRockShatter();

    const impulseDir = rock.pos.clone().sub(epicenter).normalize();
    if (impulseDir.lengthSq() < 0.001) impulseDir.set(0, 1, 0);

    const shardCount = force >= 35 ? 14 : 8;
    const shardMat = new THREE.MeshStandardMaterial({
      color: rock.isWineUrn ? 0x8b3a1a : 0x95a5a6,
      roughness: 0.6,
      flatShading: true,
      emissive: force >= 35 ? 0xff4757 : 0x000000,
      emissiveIntensity: force >= 35 ? 0.4 : 0.0,
    });

    for (let i = 0; i < shardCount; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), shardMat);
      shard.position.copy(rock.pos);
      shard.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6));
      shard.castShadow = true;

      const sDir = impulseDir.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 1.8, Math.random() * 1.2, (Math.random() - 0.5) * 1.8)
      ).normalize();

      this.addDebris(shard, sDir, force * 1.1 + 6, 22, 3.2, 0.6, force >= 35);
    }

    if (this.particles) {
      if (rock.isWineUrn && this.particles.emitWineSplash) {
        this.particles.emitWineSplash(rock.pos, 22);
      } else {
        this.particles.emitElementalParticles(rock.pos, 'fire', 16);
      }
      this.particles.emitShockwave(rock.pos, 0xd35400, 3.2, 0.45);
    }

    this.safeRemoveObject(rock.mesh);
  }

  // PHÁ HỦY QUẦY SẠP CHỢ, CỘT ĐÈN LỒNG & THÙNG GỖ
  breakFence(fence, epicenter, force) {
    if (fence.isBroken) return;
    fence.isBroken = true;

    sound.playWoodBreak();

    const impulseDir = fence.pos.clone().sub(epicenter).normalize();
    if (impulseDir.lengthSq() < 0.001) impulseDir.set(0, 1, 0);

    const fMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      flatShading: true,
      emissive: force >= 35 ? 0xff6b4a : 0x000000,
      emissiveIntensity: force >= 35 ? 0.35 : 0.0,
    });
    const chunkCount = force >= 35 ? 8 : 4;
    for (let i = 0; i < chunkCount; i++) {
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.25), fMat);
      chunk.position.copy(fence.pos);
      chunk.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6));
      chunk.castShadow = true;
      const cDir = impulseDir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.85, (Math.random() - 0.5) * 1.6)).normalize();
      this.addDebris(chunk, cDir, force * 0.95 + 5, 20, 3.2, 0.45, force >= 35);
    }

    if (fence.isLantern && this.particles) {
      this.particles.emitElementalParticles(fence.pos, 'fire', 18);
      this.particles.emitDust(fence.pos);
    }

    // Xóa triệt để toàn bộ nhóm đạo cụ (Group)
    const target = fence.group || fence.mesh;
    this.safeRemoveObject(target);
    if (fence.mesh && fence.mesh !== target) {
      this.safeRemoveObject(fence.mesh);
    }
  }

  // PHÁ HỦY CHẬU HOA CÚC
  breakFlower(flower, epicenter, force) {
    if (flower.isBroken) return;
    flower.isBroken = true;

    if (this.particles) {
      this.particles.emitElementalParticles(flower.pos, force >= 35 ? 'fire' : 'ice', 12);
    }

    this.safeRemoveObject(flower.group);
  }

  // TƯƠNG TÁC TÀN PHÁ TRONG BÁN KÍNH (HỖ TRỢ PHÁ NHÀ TỪNG PHẦN)
  interactWithArea(epicenter, radius, force = 12, elementType = 'neutral') {
    const ex = epicenter.x, ey = epicenter.y, ez = epicenter.z;
    const isExtreme = force >= 35;
    const effRadius = isExtreme ? radius * 1.45 : radius;

    // 1. Phá hủy từng bộ phận nhà (Modular Building Parts) với AABB pre-filter siêu tốc
    for (let i = 0; i < this.buildingParts.length; i++) {
      const part = this.buildingParts[i];
      if (part.isBroken) continue;

      const totalR = effRadius + part.radius;
      if (Math.abs(part.center.x - ex) > totalR ||
          Math.abs(part.center.z - ez) > totalR ||
          Math.abs(part.center.y - ey) > totalR) {
        continue;
      }

      const d = part.center.distanceTo(epicenter);
      if (d < totalR) {
        const distRatio = Math.min(1, d / totalR);
        const dmg = isExtreme
          ? force * 22.0 * Math.max(0.4, 1.0 - distRatio * 0.7) // Cực mạnh, quét sạch mọi công trình trúng đòn
          : force * (1.0 - distRatio) * 8.5;
        part.hp -= dmg;

        // Cơ chế hư hại từng phần / Cháy xém trước khi sập
        if (part.hp > 0 && (elementType === 'fire' || isExtreme) && !part.isScorched) {
          part.isScorched = true;
          if (part.mesh && part.mesh.material) {
            try {
              part.mesh.material = part.mesh.material.clone();
              part.mesh.material.emissive = new THREE.Color(0x771a00);
              part.mesh.material.emissiveIntensity = 0.75;
              part.mesh.material.roughness = 0.95;
            } catch (e) {}
          }
          if (this.particles) {
            this.particles.emitSmoke(part.center, 5, 0x111111, 1.3, true);
          }
        }

        if (part.hp <= 0) {
          this.breakBuildingPart(part, epicenter, force * (1 - distRatio) + 6, elementType === 'fire' || isExtreme);
        }
      }
    }

    // 2. Cây liễu & cây đào
    for (const tree of this.trees) {
      if (!tree.isBroken) {
        const d = tree.pos.distanceTo(epicenter);
        if (d < effRadius) {
          this.breakTree(tree, epicenter, force * (1 - d / effRadius) + 6, elementType);
        } else if (d < effRadius * 1.5) {
          const pushDir = tree.pos.clone().sub(epicenter).normalize();
          tree.wobbleAxis.crossVectors(pushDir, new THREE.Vector3(0, 1, 0)).normalize();
          tree.wobbleVel = (1 - d / (effRadius * 1.5)) * 0.6;
        }
      }
    }

    // 3. Vò rượu Nữ Nhi Hồng & Sư tử đá
    for (const rock of this.rocks) {
      if (!rock.isBroken) {
        const d = rock.pos.distanceTo(epicenter);
        if (d < effRadius) {
          this.breakRock(rock, epicenter, force * (1 - d / effRadius) + 6, elementType);
        }
      }
    }

    // 4. Quầy sạp chợ, cột đèn lồng, thùng gỗ, giá đao kiếm
    for (const fence of this.fences) {
      if (!fence.isBroken) {
        const d = fence.pos.distanceTo(epicenter);
        if (d < effRadius) {
          this.breakFence(fence, epicenter, force * 0.95 + 6);
        }
      }
    }

    // 5. Chậu hoa cúc
    for (const flower of this.flowers) {
      if (!flower.isBroken) {
        const d = flower.pos.distanceTo(epicenter);
        if (d < effRadius * 1.15) {
          this.breakFlower(flower, epicenter, force * 0.8 + 4);
        }
      }
    }
  }

  // KIỂM TRA VA CHẠM CỦA ĐẠN BLASTER VỚI MÔI TRƯỜNG & TỪNG PHẦN NHÀ
  checkBulletCollision(bulletPos, bulletRadius = 0.35, damage = 25) {
    const bx = bulletPos.x, by = bulletPos.y, bz = bulletPos.z;

    // 1. Va chạm từng mảng nhà với AABB pre-filter
    for (let i = 0; i < this.buildingParts.length; i++) {
      const part = this.buildingParts[i];
      if (part.isBroken) continue;

      const maxR = part.radius + bulletRadius;
      if (Math.abs(part.center.x - bx) > maxR ||
          Math.abs(part.center.z - bz) > maxR ||
          Math.abs(part.center.y - by) > maxR) {
        continue;
      }

      const d = part.center.distanceTo(bulletPos);
      if (d < maxR || (part.box && part.box.containsPoint(bulletPos))) {
        part.hp -= damage;
        if (part.hp <= 0) {
          this.breakBuildingPart(part, bulletPos, 8);
        } else {
          if (this.particles) this.particles.emitDust(bulletPos);
          sound.playHit();
        }
        return { hit: true, pos: bulletPos.clone() };
      }
    }

    // 2. Va chạm cây
    for (const tree of this.trees) {
      if (!tree.isBroken) {
        const d = Math.hypot(bulletPos.x - tree.pos.x, bulletPos.z - tree.pos.z);
        if (d < 1.2 * tree.scale && bulletPos.y > tree.pos.y && bulletPos.y < tree.pos.y + 4.5 * tree.scale) {
          tree.hp -= damage;
          if (tree.hp <= 0) {
            this.breakTree(tree, bulletPos, 8, 'neutral');
          }
          return { hit: true, pos: bulletPos.clone() };
        }
      }
    }

    // 3. Va chạm vò rượu & sư tử đá
    for (const rock of this.rocks) {
      if (!rock.isBroken) {
        const d = rock.pos.distanceTo(bulletPos);
        if (d < rock.radius + bulletRadius) {
          rock.hp -= damage;
          if (rock.hp <= 0) {
            this.breakRock(rock, bulletPos, 10, 'neutral');
          }
          return { hit: true, pos: bulletPos.clone() };
        }
      }
    }

    // 4. Va chạm quầy sạp / cột đèn lồng / giá vũ khí
    for (const fence of this.fences) {
      if (!fence.isBroken) {
        const d = fence.pos.distanceTo(bulletPos);
        if (d < fence.radius + bulletRadius) {
          this.breakFence(fence, bulletPos, 6);
          return { hit: true, pos: bulletPos.clone() };
        }
      }
    }

    return { hit: false };
  }

  // CẬP NHẬT CHU KỲ FRAME THẾ GIỚI
  update(delta, time) {
    // 1. Mây trôi trên kinh thành
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * delta;
      if (cloud.position.x > 140) cloud.position.x = -140;
    }

    // 2. Gợn sóng nước kênh đào động (tối ưu hóa GPU flatShading không tính lại normals trên CPU)
    if (this.waterGeometry) {
      const wpos = this.waterGeometry.attributes.position;
      for (let i = 0; i < wpos.count; i++) {
        const vx = wpos.getX(i);
        const vy = wpos.getY(i);
        const wave1 = Math.sin(time * 2.4 + vx * 0.35 + vy * 0.5) * 0.07;
        wpos.setZ(i, wave1);
      }
      wpos.needsUpdate = true;
    }

    // 3. Đèn lồng đỏ đung đưa trong gió
    for (const hl of this.hangingLanterns) {
      hl.pivot.rotation.z = Math.sin(time * 2.2 + hl.phase) * 0.09;
      hl.pivot.rotation.x = Math.cos(time * 1.7 + hl.phase) * 0.06;
    }

    // 4. Ánh sáng đèn lồng chớp nháy ấm áp
    for (let i = 0; i < this.lanternLights.length; i++) {
      const light = this.lanternLights[i];
      light.intensity = 1.6 + Math.sin(time * 5.5 + i * 1.9) * 0.28 + (Math.random() - 0.5) * 0.08;
    }

    // 5. Cờ vải "TỬU" phấp phới trong gió
    if (this.wineFlag) {
      this.wineFlag.rotation.y = Math.sin(time * 3.8) * 0.22;
      this.wineFlag.rotation.z = Math.cos(time * 2.8) * 0.08;
    }

    // 6. Cập nhật cây cối đung đưa hồi phục
    for (const tree of this.trees) {
      if (!tree.isBroken) {
        if (Math.abs(tree.wobbleVel) > 0.001) {
          tree.wobbleAngle += tree.wobbleVel;
          tree.wobbleVel *= 0.88;
          tree.wobbleAngle *= 0.88;
          tree.group.setRotationFromAxisAngle(tree.wobbleAxis, tree.wobbleAngle);
        } else {
          tree.group.rotation.z = Math.sin(time * 1.6 + tree.pos.x * 0.2) * 0.035;
        }
      }
    }

    // 7. Cập nhật vật lý mảnh vỡ (Multi-bounce Debris Physics)
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= delta;

      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debris.splice(i, 1);
        continue;
      }

      d.vel.y -= d.gravity * delta;
      d.mesh.position.addScaledVector(d.vel, delta);

      d.mesh.rotation.x += d.rotVel.x * delta;
      d.mesh.rotation.y += d.rotVel.y * delta;
      d.mesh.rotation.z += d.rotVel.z * delta;

      const groundH = getTerrainHeight(d.mesh.position.x, d.mesh.position.z);
      if (d.mesh.position.y < groundH + 0.15) {
        d.mesh.position.y = groundH + 0.15;
        if (d.vel.y < -3.8 && this.particles) {
          this.particles.emitDust(d.mesh.position);
        }
        d.vel.y = -d.vel.y * (d.restitution || 0.52);
        d.vel.x *= 0.78;
        d.vel.z *= 0.78;
        d.rotVel.multiplyScalar(0.75);
      }

      // Mảnh vỡ cháy bốc tàn lửa than hồng và khói mỏng
      if (d.isBurning && this.particles) {
        d.burnTimer = (d.burnTimer || 0) + delta;
        if (d.burnTimer > 0.14) {
          d.burnTimer = 0;
          if (Math.random() < 0.6) {
            this.particles.emitElementalParticles(d.mesh.position, 1, [0xff4757, 0xffa502], [2, 5], 0.35, 0, 0.4);
          }
        }
      }

      const fadeRatio = d.life / d.maxLife;
      if (fadeRatio < 0.3) {
        d.mesh.scale.multiplyScalar(1 - delta * 3.0);
      }
    }
  }
}
