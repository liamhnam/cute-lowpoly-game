import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- THẦN LONG PHƯƠNG ĐÔNG (CHINESE DRAGON) ---
// Model "Lowpoly textured Chinese Dragon" của Khyoocumber (Sketchfab, CC BY 4.0) đặt tại public/models/chinese_dragon.glb.
// Chưa có file thì dùng rồng low-poly dựng bằng code. Quy ước chung: đầu rồng hướng +z ở gốc toạ độ,
// thân kéo dài về -z, dài DRAGON_LENGTH. Gọi update(time) mỗi khung hình để thân uốn lượn.

const DRAGON_MODEL_URL = `${import.meta.env.BASE_URL}models/chinese_dragon.glb`;
export const DRAGON_LENGTH = 6.0;

// Chỉnh tay khi model nạp vào bị ngược đầu
const MODEL_FIX = { flip: false };

// Sóng uốn thân: tần số theo thời gian, số bước sóng dọc thân, biên độ ở đuôi
const WAVE_SPEED = 5.0;
const WAVE_COUNT = 1.2;
const WAVE_AMP = 0.7;

let dragonTemplate = null;

export function loadDragonModel() {
  new GLTFLoader().load(
    DRAGON_MODEL_URL,
    (gltf) => {
      dragonTemplate = normalizeModel(gltf.scene);
    },
    undefined,
    () => {
      console.info(`[dragon] Không tìm thấy ${DRAGON_MODEL_URL}, dùng thần long dựng sẵn.`);
    }
  );
}

// Nướng toàn bộ phép biến đổi vào hình học: trục dài nhất thành z, đầu ở +z tại gốc, dài DRAGON_LENGTH.
// Nhờ vậy shader uốn thân dùng thẳng toạ độ đỉnh, không phụ thuộc cây node của file GLB.
function normalizeModel(scene) {
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((obj) => {
    if (obj.isMesh) meshes.push(obj);
  });

  const box = new THREE.Box3();
  for (const m of meshes) {
    m.geometry = m.geometry.clone();
    m.geometry.applyMatrix4(m.matrixWorld);
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox);
  }

  const size = box.getSize(new THREE.Vector3());
  const align = new THREE.Matrix4();
  if (size.x >= size.y && size.x >= size.z) align.makeRotationY(-Math.PI / 2);
  else if (size.y >= size.z) align.makeRotationX(Math.PI / 2);
  if (MODEL_FIX.flip) align.premultiply(new THREE.Matrix4().makeRotationY(Math.PI));

  const aligned = box.clone().applyMatrix4(align);
  const scale = DRAGON_LENGTH / aligned.getSize(new THREE.Vector3()).z;
  const center = aligned.getCenter(new THREE.Vector3());
  const toOrigin = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -aligned.max.z);
  const transform = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(toOrigin).multiply(align);

  const root = new THREE.Group();
  for (const m of meshes) {
    m.geometry.applyMatrix4(transform);
    const mesh = new THREE.Mesh(m.geometry, m.material);
    mesh.castShadow = true;
    root.add(mesh);
  }
  return root;
}

// Gắn sóng uốn vào vertex shader: điểm càng xa đầu (z càng âm) càng lệch ngang/dọc theo sóng chạy về đuôi
function applyWaveShader(material, uniforms) {
  const mat = material.clone();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDragonTime = uniforms.uDragonTime;
    shader.vertexShader = 'uniform float uDragonTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float dragonS = clamp(-position.z / ${DRAGON_LENGTH.toFixed(1)}, 0.0, 1.0);
      float dragonPhase = uDragonTime * ${WAVE_SPEED.toFixed(1)} - dragonS * ${(WAVE_COUNT * Math.PI * 2).toFixed(3)};
      transformed.x += sin(dragonPhase) * ${WAVE_AMP.toFixed(2)} * dragonS;
      transformed.y += cos(dragonPhase) * ${(WAVE_AMP * 0.4).toFixed(2)} * dragonS;`
    );
  };
  return mat;
}

// Vật liệu rồng dựng sẵn: bạch ngọc, kim sừng, xích bờm
const scaleMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.5, flatShading: true });
const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf6e58d, roughness: 0.6, flatShading: true });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.3, metalness: 0.5, flatShading: true });
const maneMat = new THREE.MeshStandardMaterial({ color: 0xe84118, roughness: 0.6, flatShading: true });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

const SEGMENTS = 14;
const SEGMENT_SPACING = (DRAGON_LENGTH - 0.6) / SEGMENTS;

function buildProceduralDragon() {
  const root = new THREE.Group();

  // Đầu rồng
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), scaleMat);
  skull.scale.set(0.95, 0.75, 1.15);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.5), scaleMat);
  snout.position.set(0, -0.04, 0.5);
  head.add(snout);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.42), maneMat);
  jaw.position.set(0, -0.22, 0.45);
  head.add(jaw);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    eye.position.set(side * 0.24, 0.14, 0.3);
    head.add(eye);

    // Sừng vàng vểnh ra sau
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.6, 4), goldMat);
    horn.position.set(side * 0.18, 0.32, -0.2);
    horn.rotation.x = -0.9;
    horn.rotation.z = -side * 0.25;
    head.add(horn);

    // Râu rồng dài
    const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.008, 0.9, 4), maneMat);
    whisker.position.set(side * 0.3, -0.08, 0.55);
    whisker.rotation.z = side * 1.2;
    whisker.rotation.y = side * 0.5;
    head.add(whisker);
  }
  // Bờm đỏ toả quanh gáy
  for (let k = 0; k < 6; k++) {
    const a = (k / 5 - 0.5) * Math.PI * 1.2;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 4), maneMat);
    tuft.position.set(Math.sin(a) * 0.3, Math.cos(a) * 0.25, -0.35);
    tuft.rotation.set(-1.2, 0, -a);
    head.add(tuft);
  }
  root.add(head);

  // Thân rồng: chuỗi đốt bạch ngọc thu nhỏ dần, vây lưng đỏ, bụng vàng
  const segments = [];
  for (let i = 1; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const r = THREE.MathUtils.lerp(0.36, 0.1, t);
    const seg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), scaleMat);
    body.castShadow = true;
    seg.add(body);
    const belly = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.75, 0), bellyMat);
    belly.position.y = -r * 0.35;
    seg.add(belly);
    if (i % 2 === 1) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, r * 1.3, 4), maneMat);
      fin.position.y = r * 0.95;
      fin.rotation.x = -0.4;
      seg.add(fin);
    }
    // Hai cặp chân vàng ở đốt 3 và đốt 8
    if (i === 3 || i === 8) {
      for (const side of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 4), goldMat);
        claw.position.set(side * r * 1.1, -r * 0.6, 0);
        claw.rotation.z = side * 0.9;
        seg.add(claw);
      }
    }
    root.add(seg);
    segments.push(seg);
  }
  // Chùm lông đuôi đỏ
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 5), maneMat);
  tail.rotation.x = -Math.PI / 2;
  segments[SEGMENTS - 1].add(tail);
  tail.position.z = -0.3;

  return { root, head, segments };
}

// Tạo một con rồng: { object, update(time) }. time tính bằng giây, mỗi con nên lệch pha để không uốn giống hệt nhau
export function createDragon(scale = 1.0) {
  if (dragonTemplate) {
    const uniforms = { uDragonTime: { value: 0 } };
    const object = dragonTemplate.clone(true);
    object.traverse((obj) => {
      if (obj.isMesh) obj.material = Array.isArray(obj.material)
        ? obj.material.map((m) => applyWaveShader(m, uniforms))
        : applyWaveShader(obj.material, uniforms);
    });
    object.scale.setScalar(scale);
    return {
      object,
      update: (time) => {
        uniforms.uDragonTime.value = time;
      },
    };
  }

  const { root, head, segments } = buildProceduralDragon();
  root.scale.setScalar(scale);
  return {
    object: root,
    update: (time) => {
      head.rotation.y = Math.sin(time * WAVE_SPEED) * 0.15;
      for (let i = 0; i < segments.length; i++) {
        const s = (i + 1) / SEGMENTS;
        const phase = time * WAVE_SPEED - s * WAVE_COUNT * Math.PI * 2;
        segments[i].position.set(
          Math.sin(phase) * WAVE_AMP * s,
          Math.cos(phase) * WAVE_AMP * 0.4 * s,
          -0.3 - (i + 1) * SEGMENT_SPACING
        );
      }
    },
  };
}
