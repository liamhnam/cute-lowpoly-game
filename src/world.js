import * as THREE from 'three';

// Mảng lưu các hố va chạm / tàn phá địa hình
export const activeCraters = [];

// Hàm tính độ cao địa hình mượt mà + tính thêm các hố thiên thạch / động đất
export function getTerrainHeight(x, z) {
  const hill1 = Math.sin(x * 0.035) * Math.cos(z * 0.035) * 2.8;
  const hill2 = Math.sin(x * 0.08 + z * 0.05) * 1.0;
  const hill3 = Math.cos(x * 0.02 - z * 0.03) * 1.5;
  const distFromCenter = Math.sqrt(x * x + z * z);
  const flattenFactor = Math.min(1.0, distFromCenter / 15.0);
  let baseH = (hill1 + hill2 + hill3) * flattenFactor;

  // Tính độ lõm từ các vết nứt và hố thiên thạch
  for (const c of activeCraters) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.radius) {
      const deform = c.depth * Math.pow(1.0 - d / c.radius, 2);
      baseH -= deform;
    }
  }

  return baseH;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.grassMaterial = null;
    this.grassData = []; // Lưu tọa độ từng ngọn cỏ để tương tác

    this.createTerrain();
    this.createGrassField();
    this.createTrees();
    this.createFlowers();
    this.createRocks();
    this.createFences();
    this.createClouds();
  }

  createTerrain() {
    const size = 180;
    const segments = 120;
    this.terrainGeometry = new THREE.PlaneGeometry(size, size, segments, segments);
    this.terrainGeometry.rotateX(-Math.PI / 2);

    const pos = this.terrainGeometry.attributes.position;
    const colors = [];
    const colorLow = new THREE.Color(0x7dc269);
    const colorMid = new THREE.Color(0x8dd477);
    const colorHigh = new THREE.Color(0xa7e68c);
    const colorValley = new THREE.Color(0x6ab557);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);

      let vertexCol;
      if (y > 2.0) {
        vertexCol = colorHigh.clone().lerp(colorMid, (y - 2.0) / 3.0);
      } else if (y > 0.0) {
        vertexCol = colorMid.clone().lerp(colorLow, y / 2.0);
      } else {
        vertexCol = colorValley.clone();
      }
      colors.push(vertexCol.r, vertexCol.g, vertexCol.b);
    }

    this.terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.terrainGeometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.85,
      metalness: 0.05,
    });

    this.terrainMesh = new THREE.Mesh(this.terrainGeometry, material);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  // HÀM TÀN PHÁ & BIẾN DẠNG ĐỊA HÌNH KHI DÙNG KỸ NĂNG
  deformTerrain(centerX, centerZ, radius, depth, type = 'fire') {
    activeCraters.push({
      x: centerX,
      z: centerZ,
      radius: radius,
      depth: depth,
      type: type,
    });

    // Giới hạn số hố lưu trong bộ nhớ
    if (activeCraters.length > 50) {
      activeCraters.shift();
    }

    const pos = this.terrainGeometry.attributes.position;
    const colorAttr = this.terrainGeometry.attributes.color;

    // Bảng màu cháy xém theo nguyên tố
    const burnColor = new THREE.Color(
      type === 'fire' ? 0x241715 : // Đen than dung nham
      type === 'lightning' ? 0x2d1a3a : // Tím đen sấm sét
      type === 'ice' ? 0xdff9fb : // Trắng tuyết băng giá
      0x38281a // Nâu nứt đất nẻ
    );

    const glowBorder = new THREE.Color(
      type === 'fire' ? 0xe74c3c : // Viền đỏ cam nóng chảy
      type === 'lightning' ? 0x00d2d3 : // Viền xanh điện
      type === 'ice' ? 0x7ed6df : // Viền xanh băng
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

        // Biến đổi màu mặt đất tại vết nổ
        const curR = colorAttr.getX(i);
        const curG = colorAttr.getY(i);
        const curB = colorAttr.getZ(i);
        const currentColor = new THREE.Color(curR, curG, curB);

        // Gradient từ tâm hố ra rìa
        const mixRatio = factor * 0.95;
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

    // Thổi bay / ép rạp cỏ trong bán kính va chạm
    this.flattenGrass(centerX, centerZ, radius);
  }

  flattenGrass(centerX, centerZ, radius) {
    if (!this.grassInstanced || !this.grassData) return;
    const dummy = new THREE.Object3D();
    let updated = false;

    for (let i = 0; i < this.grassData.length; i++) {
      const g = this.grassData[i];
      if (g.alive) {
        const d = Math.hypot(g.x - centerX, g.z - centerZ);
        if (d < radius * 1.1) {
          g.alive = false;
          dummy.position.set(g.x, -50, g.z); // Đưa cỏ xuống dưới lòng đất
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          this.grassInstanced.setMatrixAt(i, dummy.matrix);
          updated = true;
        }
      }
    }

    if (updated) {
      this.grassInstanced.instanceMatrix.needsUpdate = true;
    }
  }

  createGrassField() {
    const bladeGeo = new THREE.BufferGeometry();
    const w = 0.18;
    const h = 0.85;

    const vertices = new Float32Array([
      -w, 0, 0,
       w, 0, 0,
       0, h, 0,
       0, 0, -w,
       0, 0,  w,
       0, h,  0,
    ]);

    const normals = new Float32Array([
      0, 0, 1,   0, 0, 1,   0, 0, 1,
      1, 0, 0,   1, 0, 0,   1, 0, 0,
    ]);

    const isTip = new Float32Array([
      0, 0, 1,
      0, 0, 1
    ]);

    bladeGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    bladeGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    bladeGeo.setAttribute('isTip', new THREE.BufferAttribute(isTip, 1));

    this.grassMaterial = new THREE.MeshStandardMaterial({
      color: 0x86dd6e,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    this.grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      this.grassUniforms = shader.uniforms;

      shader.vertexShader = `
        attribute float isTip;
        uniform float uTime;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        if (isTip > 0.5) {
          vec4 worldInstance = instanceMatrix * vec4(position, 1.0);
          float wave = sin(uTime * 2.8 + worldInstance.x * 0.35 + worldInstance.z * 0.45);
          float wave2 = cos(uTime * 1.9 + worldInstance.z * 0.6);
          transformed.x += wave * 0.22;
          transformed.z += wave2 * 0.16;
        }
        `
      );
    };

    const count = 10000;
    this.grassInstanced = new THREE.InstancedMesh(bladeGeo, this.grassMaterial, count);
    this.grassInstanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const spread = 75;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread * 2;
      const z = (Math.random() - 0.5) * spread * 2;
      const y = getTerrainHeight(x, z);

      dummy.position.set(x, y, z);
      const scale = 0.7 + Math.random() * 0.6;
      dummy.scale.set(scale, scale * (0.8 + Math.random() * 0.4), scale);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.rotation.x = (Math.random() - 0.5) * 0.15;
      dummy.rotation.z = (Math.random() - 0.5) * 0.15;
      dummy.updateMatrix();

      this.grassInstanced.setMatrixAt(i, dummy.matrix);
      this.grassData.push({ x, z, y, alive: true });
    }

    this.grassInstanced.instanceMatrix.needsUpdate = true;
    this.scene.add(this.grassInstanced);
  }

  createTrees() {
    const treeGroup = new THREE.Group();
    const treeCount = 45;

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      flatShading: true,
      roughness: 0.9,
    });

    const foliageColors = [0x5eb354, 0x76c96b, 0x47a140, 0x90de7a, 0x55a86d];

    for (let i = 0; i < treeCount; i++) {
      const tX = (Math.random() - 0.5) * 140;
      const tZ = (Math.random() - 0.5) * 140;
      if (Math.hypot(tX, tZ) < 8) continue;

      const tY = getTerrainHeight(tX, tZ);
      const singleTree = new THREE.Group();
      singleTree.position.set(tX, tY, tZ);

      const treeType = Math.random() > 0.4 ? 'round' : 'pine';
      const treeScale = 0.8 + Math.random() * 0.6;
      singleTree.scale.set(treeScale, treeScale, treeScale);

      const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.2, 5);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      singleTree.add(trunk);

      const folColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
      const folMat = new THREE.MeshStandardMaterial({
        color: folColor,
        flatShading: true,
        roughness: 0.8,
      });

      if (treeType === 'round') {
        const mainCanopy = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), folMat);
        mainCanopy.position.y = 2.8;
        mainCanopy.castShadow = true;
        singleTree.add(mainCanopy);

        const subCanopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), folMat);
        subCanopy1.position.set(0.6, 2.3, 0.4);
        subCanopy1.castShadow = true;
        singleTree.add(subCanopy1);

        const subCanopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 1), folMat);
        subCanopy2.position.set(-0.5, 3.2, -0.3);
        subCanopy2.castShadow = true;
        singleTree.add(subCanopy2);

        if (Math.random() > 0.4) {
          const appleMat = new THREE.MeshStandardMaterial({ color: 0xff4d4d, roughness: 0.5, flatShading: true });
          for (let a = 0; a < 3; a++) {
            const apple = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), appleMat);
            apple.position.set(
              (Math.random() - 0.5) * 1.6,
              2.2 + Math.random() * 1.2,
              (Math.random() - 0.5) * 1.6
            );
            singleTree.add(apple);
          }
        }
      } else {
        for (let l = 0; l < 3; l++) {
          const coneGeo = new THREE.ConeGeometry(1.7 - l * 0.35, 1.4, 5);
          const cone = new THREE.Mesh(coneGeo, folMat);
          cone.position.y = 2.2 + l * 0.9;
          cone.castShadow = true;
          singleTree.add(cone);
        }
      }

      treeGroup.add(singleTree);
    }

    this.scene.add(treeGroup);
  }

  createFlowers() {
    const flowerGroup = new THREE.Group();
    const colors = [0xff6b8b, 0xffd152, 0xff9ff3, 0x54a0ff, 0xffffff];
    const flowerCount = 120;

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x489635, flatShading: true });

    for (let i = 0; i < flowerCount; i++) {
      const fX = (Math.random() - 0.5) * 120;
      const fZ = (Math.random() - 0.5) * 120;
      const fY = getTerrainHeight(fX, fZ);

      const flower = new THREE.Group();
      flower.position.set(fX, fY, fZ);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 4), stemMat);
      stem.position.y = 0.22;
      flower.add(stem);

      const col = colors[Math.floor(Math.random() * colors.length)];
      const petalMat = new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 0.7 });
      const petalGeo = new THREE.DodecahedronGeometry(0.16, 0);
      const head = new THREE.Mesh(petalGeo, petalMat);
      head.position.y = 0.45;
      flower.add(head);

      const centerMat = new THREE.MeshStandardMaterial({ color: 0xffea00, flatShading: true });
      const center = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07, 0), centerMat);
      center.position.y = 0.5;
      flower.add(center);

      const fScale = 0.7 + Math.random() * 0.6;
      flower.scale.set(fScale, fScale, fScale);
      flowerGroup.add(flower);
    }

    this.scene.add(flowerGroup);
  }

  createRocks() {
    const rockGroup = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x9fa8a3,
      flatShading: true,
      roughness: 0.9,
    });

    const rockCount = 40;
    for (let i = 0; i < rockCount; i++) {
      const rX = (Math.random() - 0.5) * 130;
      const rZ = (Math.random() - 0.5) * 130;
      if (Math.hypot(rX, rZ) < 5) continue;
      const rY = getTerrainHeight(rX, rZ);

      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), rockMat);
      const sx = 0.6 + Math.random() * 0.8;
      const sy = 0.4 + Math.random() * 0.5;
      const sz = 0.6 + Math.random() * 0.8;
      rock.scale.set(sx, sy, sz);
      rock.position.set(rX, rY + sy * 0.4, rZ);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      rock.castShadow = true;
      rock.receiveShadow = true;
      rockGroup.add(rock);
    }

    this.scene.add(rockGroup);
  }

  createFences() {
    const fenceGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xbd8b57, flatShading: true });

    const startX = 6;
    const startZ = 4;
    for (let i = 0; i < 7; i++) {
      const x = startX + i * 1.5;
      const z = startZ + Math.sin(i * 0.4) * 0.5;
      const y = getTerrainHeight(x, z);

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.2), woodMat);
      post.position.set(x, y + 0.45, z);
      post.castShadow = true;
      fenceGroup.add(post);

      if (i < 6) {
        const nextX = startX + (i + 1) * 1.5;
        const nextZ = startZ + Math.sin((i + 1) * 0.4) * 0.5;
        const nextY = getTerrainHeight(nextX, nextZ);

        const midX = (x + nextX) / 2;
        const midY = (y + nextY) / 2 + 0.5;
        const midZ = (z + nextZ) / 2;

        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.08), woodMat);
        rail.position.set(midX, midY, midZ);
        rail.lookAt(nextX, (y + nextY) / 2 + 0.5, nextZ);
        rail.castShadow = true;
        fenceGroup.add(rail);

        const railLower = rail.clone();
        railLower.position.y -= 0.25;
        fenceGroup.add(railLower);
      }
    }

    this.scene.add(fenceGroup);
  }

  createClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.9,
      transparent: true,
      opacity: 0.92,
    });

    const cloudCount = 18;
    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const numPuffs = 5 + Math.floor(Math.random() * 4);

      for (let j = 0; j < numPuffs; j++) {
        const puffSize = 2.5 + Math.random() * 2.0;
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(puffSize, 1), cloudMat);
        puff.position.set(
          (j - numPuffs / 2) * 2.2 + (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 1.0,
          (Math.random() - 0.5) * 1.5
        );
        cloud.add(puff);
      }

      cloud.position.set(
        (Math.random() - 0.5) * 180,
        22 + Math.random() * 12,
        (Math.random() - 0.5) * 180
      );
      cloud.userData.speed = 0.8 + Math.random() * 1.2;

      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  update(delta, time) {
    if (this.grassUniforms) {
      this.grassUniforms.uTime.value = time;
    }

    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * delta;
      if (cloud.position.x > 110) {
        cloud.position.x = -110;
        cloud.position.z = (Math.random() - 0.5) * 180;
      }
    }
  }
}
