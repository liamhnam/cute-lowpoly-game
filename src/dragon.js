import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- THẦN LONG PHƯƠNG ĐÔNG (CHINESE DRAGON) ---
// Model "Lowpoly textured Chinese Dragon" của Khyoocumber (Sketchfab, CC BY 4.0) đặt tại public/models/chinese_dragon.glb.
// Chưa có file thì dùng rồng low-poly dựng bằng code.
// Rồng không có vị trí cố định: mỗi khung hình gọi pose(pathFn) với pathFn(s) trả về toạ độ thế giới
// của điểm trên thân, s = 0 ở đầu và s = 1 ở đuôi. Cả thân sẽ uốn theo đúng đường cong đó.

const DRAGON_MODEL_URL = `${import.meta.env.BASE_URL}models/chinese_dragon.glb`;
const MODEL_LENGTH = 6.0; // chiều dài chuẩn hoá của model GLB (đầu ở z = 0, đuôi ở z = -MODEL_LENGTH)

// Chỉnh tay khi model nạp vào bị ngược đầu
const MODEL_FIX = { flip: false };

// Số điểm mẫu dọc thân dùng để dựng khung toạ độ (cũng là kích thước mảng uniform trong shader)
const PATH_SAMPLES = 24;

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

// Nướng toàn bộ phép biến đổi vào hình học: trục dài nhất thành z, đầu ở +z tại gốc, dài MODEL_LENGTH
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
  const scale = MODEL_LENGTH / aligned.getSize(new THREE.Vector3()).z;
  const center = aligned.getCenter(new THREE.Vector3());
  const toOrigin = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -aligned.max.z);
  const transform = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(toOrigin).multiply(align);

  const root = new THREE.Group();
  for (const m of meshes) {
    m.geometry.applyMatrix4(transform);
    root.add(new THREE.Mesh(m.geometry, m.material));
  }
  return root;
}

// Dựng khung toạ độ dọc đường cong: P (vị trí), R (phải), U (trên), F (hướng về phía đầu), với cross(R, U) = F
const WORLD_UP = new THREE.Vector3(0, 1, 0);
function buildFrames(pathFn, frames) {
  for (let k = 0; k < PATH_SAMPLES; k++) frames.P[k].copy(pathFn(k / (PATH_SAMPLES - 1)));
  for (let k = 0; k < PATH_SAMPLES; k++) {
    const a = frames.P[Math.max(0, k - 1)];
    const b = frames.P[Math.min(PATH_SAMPLES - 1, k + 1)];
    const F = frames.F[k].subVectors(a, b);
    if (F.lengthSq() < 1e-8) F.set(0, 0, 1);
    F.normalize();
    const R = frames.R[k].crossVectors(WORLD_UP, F);
    if (R.lengthSq() < 1e-8) R.set(1, 0, 0);
    R.normalize();
    frames.U[k].crossVectors(F, R);
  }
}

function makeFrames() {
  const arr = () => Array.from({ length: PATH_SAMPLES }, () => new THREE.Vector3());
  return { P: arr(), R: arr(), U: arr(), F: arr() };
}

// Shader uốn model GLB theo khung toạ độ: toạ độ z của đỉnh → vị trí dọc thân, x/y → lệch theo R/U
function applyPathShader(material, uniforms) {
  const mat = material.clone();
  const last = PATH_SAMPLES - 1;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform vec3 uPts[${PATH_SAMPLES}];
uniform vec3 uRgt[${PATH_SAMPLES}];
uniform vec3 uUp[${PATH_SAMPLES}];
uniform vec3 uFwd[${PATH_SAMPLES}];
uniform float uThick;
` + shader.vertexShader
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        float dragonF = clamp(-position.z / ${MODEL_LENGTH.toFixed(1)}, 0.0, 1.0) * ${last.toFixed(1)};
        int dragonI0 = int(floor(dragonF));
        int dragonI1 = min(dragonI0 + 1, ${last});
        float dragonT = dragonF - float(dragonI0);
        vec3 dragonP = mix(uPts[dragonI0], uPts[dragonI1], dragonT);
        vec3 dragonR = normalize(mix(uRgt[dragonI0], uRgt[dragonI1], dragonT));
        vec3 dragonU = normalize(mix(uUp[dragonI0], uUp[dragonI1], dragonT));
        vec3 dragonFw = normalize(mix(uFwd[dragonI0], uFwd[dragonI1], dragonT));
        objectNormal = dragonR * objectNormal.x + dragonU * objectNormal.y + dragonFw * objectNormal.z;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed = dragonP + dragonR * (position.x * uThick) + dragonU * (position.y * uThick);`
      );
  };
  return mat;
}

// Vật liệu rồng dựng sẵn: hắc long vảy đen ánh kim, điểm vàng ở bụng, vây, bờm, sừng móng; mắt đỏ
const scaleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.35, metalness: 0.45, flatShading: true });
const bellyMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.5, metalness: 0.3, flatShading: true });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd32a, roughness: 0.25, metalness: 0.6, flatShading: true });
const maneMat = new THREE.MeshStandardMaterial({ color: 0xf9ca24, roughness: 0.4, metalness: 0.3, flatShading: true });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe84118 });

const SEGMENTS = 22;

// Rồng dựng sẵn: mọi phần (đầu, các đốt) là con trực tiếp của root ở gốc toạ độ, pose() đặt từng phần theo khung
function buildProceduralDragon(thick) {
  const root = new THREE.Group();

  // Đầu rồng (hướng +z)
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), scaleMat);
  skull.scale.set(0.95, 0.75, 1.15);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.55), scaleMat);
  snout.position.set(0, -0.04, 0.52);
  head.add(snout);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.46), maneMat);
  jaw.position.set(0, -0.22, 0.46);
  jaw.rotation.x = 0.25; // há miệng gầm
  head.add(jaw);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    eye.position.set(side * 0.24, 0.14, 0.3);
    head.add(eye);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 4), goldMat);
    horn.position.set(side * 0.18, 0.34, -0.25);
    horn.rotation.x = -1.0;
    horn.rotation.z = -side * 0.25;
    head.add(horn);

    const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.008, 1.1, 4), maneMat);
    whisker.position.set(side * 0.38, -0.08, 0.5);
    whisker.rotation.z = side * 1.25;
    whisker.rotation.y = side * 0.6;
    head.add(whisker);
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 6 - 0.5) * Math.PI * 1.3;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 4), maneMat);
    tuft.position.set(Math.sin(a) * 0.32, Math.cos(a) * 0.26, -0.38);
    tuft.rotation.set(-1.2, 0, -a);
    head.add(tuft);
  }
  head.scale.setScalar(thick);
  head.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(head);

  // Các đốt thân: hình khối kéo dài theo z để đốt nối đốt liền mạch
  const segments = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = (i + 1) / SEGMENTS;
    const r = THREE.MathUtils.lerp(0.36, 0.09, t * t) * thick;
    const seg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), scaleMat);
    body.scale.z = 1.6;
    body.castShadow = true;
    seg.add(body);
    const belly = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.78, 0), bellyMat);
    belly.position.y = -r * 0.32;
    belly.scale.z = 1.5;
    seg.add(belly);
    if (i % 2 === 0) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, r * 1.3, 4), maneMat);
      fin.position.y = r * 0.95;
      fin.rotation.x = -0.6;
      seg.add(fin);
    }
    if (i === 3 || i === 11) {
      for (const side of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.07 * thick, 0.5 * thick, 4), goldMat);
        claw.position.set(side * r * 1.15, -r * 0.6, 0);
        claw.rotation.z = side * 0.9;
        seg.add(claw);
      }
    }
    if (i === SEGMENTS - 1) {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2 * thick, 0.8 * thick, 5), maneMat);
      tail.rotation.x = -Math.PI / 2;
      tail.position.z = -0.4 * thick;
      seg.add(tail);
    }
    root.add(seg);
    segments.push(seg);
  }
  return { root, head, segments };
}

// Tạo một con rồng to thick lần: { object, pose(pathFn) }. Thêm object vào scene (không đặt vị trí/xoay cho nó).
export function createDragon(thick = 1.0) {
  const frames = makeFrames();
  const basis = new THREE.Matrix4();

  if (dragonTemplate) {
    const uniforms = {
      uPts: { value: frames.P },
      uRgt: { value: frames.R },
      uUp: { value: frames.U },
      uFwd: { value: frames.F },
      uThick: { value: thick },
    };
    const object = dragonTemplate.clone(true);
    object.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.frustumCulled = false; // hình học bị dời bằng shader nên khung bao gốc không còn đúng
      obj.castShadow = false;    // bóng đổ dùng shader riêng không có phép uốn, để bật sẽ ra bóng sai chỗ
      obj.material = Array.isArray(obj.material)
        ? obj.material.map((m) => applyPathShader(m, uniforms))
        : applyPathShader(obj.material, uniforms);
    });
    return { object, pose: (pathFn) => buildFrames(pathFn, frames) };
  }

  const { root, head, segments } = buildProceduralDragon(thick);
  const placeOnFrame = (obj, k) => {
    basis.makeBasis(frames.R[k], frames.U[k], frames.F[k]);
    obj.quaternion.setFromRotationMatrix(basis);
    obj.position.copy(frames.P[k]);
  };
  return {
    object: root,
    pose: (pathFn) => {
      buildFrames(pathFn, frames);
      placeOnFrame(head, 0);
      // Các đốt rải đều trên các điểm mẫu sau đầu
      for (let i = 0; i < segments.length; i++) {
        const s = (i + 1) / segments.length;
        const k = Math.round(s * (PATH_SAMPLES - 1));
        basis.makeBasis(frames.R[k], frames.U[k], frames.F[k]);
        segments[i].quaternion.setFromRotationMatrix(basis);
        segments[i].position.copy(pathFn(s));
      }
    },
  };
}
