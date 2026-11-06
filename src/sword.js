import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- HOÀNG KIM TIÊN KIẾM ---
// Model "Jade Green Jian" của Foxx Assets (Sketchfab, CC BY 4.0) đặt tại public/models/jade_green_jian.glb,
// được nhuộm sang tông hoàng kim khi nạp. Chưa có file thì dùng kiếm vàng dựng bằng code. Mọi thanh kiếm đều theo một quy ước:
// gốc toạ độ ở chỗ cầm, lưỡi kiếm hướng +y, mũi kiếm ở y ≈ SWORD_LENGTH.

const SWORD_MODEL_URL = `${import.meta.env.BASE_URL}models/jade_green_jian.glb`;
export const SWORD_LENGTH = 1.25;

// Chỉnh tay khi model nạp vào bị ngược đầu, hoặc muốn ẩn vỏ kiếm có sẵn trong model
const MODEL_FIX = {
  flip: false,
  hideNodes: /sheath|scabbard/i,
};

let swordTemplate = null;
const readyListeners = [];

// Gọi khi model GLB nạp xong (gọi ngay nếu đã có sẵn)
export function onSwordModelReady(callback) {
  if (swordTemplate) callback();
  else readyListeners.push(callback);
}

export function loadSwordModel() {
  new GLTFLoader().load(
    SWORD_MODEL_URL,
    (gltf) => {
      swordTemplate = normalizeModel(gltf.scene);
      for (const cb of readyListeners) cb();
      readyListeners.length = 0;
    },
    undefined,
    () => {
      console.info(`[sword] Không tìm thấy ${SWORD_MODEL_URL}, dùng tiên kiếm dựng sẵn.`);
    }
  );
}

// Đưa model về quy ước chung: trục dài nhất thành +y, dài SWORD_LENGTH, chỗ cầm ở gốc
function normalizeModel(scene) {
  scene.traverse((obj) => {
    if (MODEL_FIX.hideNodes.test(obj.name)) obj.visible = false;
    if (obj.isMesh) {
      obj.castShadow = true;
      // Nhuộm hoàng kim: nhân màu texture gốc với sắc vàng, thêm chút ánh kim
      const tint = (m) => {
        const mat = m.clone();
        if (mat.color) mat.color.multiply(GLB_GOLD_TINT);
        if (mat.metalness !== undefined) mat.metalness = Math.max(mat.metalness, 0.6);
        return mat;
      };
      obj.material = Array.isArray(obj.material) ? obj.material.map(tint) : tint(obj.material);
    }
  });

  // wrapper (đặt vị trí, tỉ lệ) → aligner (lật đầu) → scene (xoay trục dài thành +y)
  const wrapper = new THREE.Group();
  const aligner = new THREE.Group();
  wrapper.add(aligner);
  aligner.add(scene);

  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  if (size.x >= size.y && size.x >= size.z) scene.rotation.z = Math.PI / 2;
  else if (size.z >= size.y) scene.rotation.x = -Math.PI / 2;
  if (MODEL_FIX.flip) aligner.rotation.x = Math.PI;

  wrapper.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(aligner);
  aligner.scale.setScalar(SWORD_LENGTH / box.getSize(new THREE.Vector3()).y);

  wrapper.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(aligner);
  const center = box.getCenter(new THREE.Vector3());
  // Đốc kiếm nằm dưới tay cầm khoảng 10% chiều dài
  aligner.position.set(-center.x, -box.min.y - SWORD_LENGTH * 0.1, -center.z);

  return wrapper;
}

// Vật liệu dùng chung cho kiếm dựng sẵn: hoàng kim kiếm
// Không có bản đồ phản chiếu môi trường nên kim loại cao sẽ bị tối sầm: dùng độ kim loại thấp
// và tự phát sáng để thanh kiếm vẫn đọc được là vàng, kể cả khi phóng to thành cự kiếm
const bladeMat = new THREE.MeshStandardMaterial({
  color: 0xffd54a,
  emissive: 0xe0a800,
  emissiveIntensity: 0.55,
  metalness: 0.2,
  roughness: 0.3,
  flatShading: true,
});
const ridgeMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, emissive: 0x8a6500, emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.25, flatShading: true });
const gripMat = new THREE.MeshStandardMaterial({ color: 0x7b241c, roughness: 0.8, flatShading: true });
const gemMat = new THREE.MeshStandardMaterial({ color: 0xe84118, emissive: 0x8e1c0b, emissiveIntensity: 0.4, roughness: 0.2, flatShading: true });
const tasselMat = new THREE.MeshBasicMaterial({ color: 0xee5253 });

// Model GLB nhuộm cùng tông hoàng kim
const GLB_GOLD_TINT = new THREE.Color(0xffd54a);

function buildProceduralSword() {
  const g = new THREE.Group();

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), gripMat);
  grip.castShadow = true;
  g.add(grip);

  const pommel = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05, 0), goldMat);
  pommel.position.y = -0.13;
  g.add(pommel);

  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.16, 4), tasselMat);
  tassel.position.y = -0.24;
  g.add(tassel);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.09), goldMat);
  guard.position.y = 0.13;
  guard.castShadow = true;
  g.add(guard);

  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), gemMat);
  gem.position.set(0, 0.13, 0.05);
  g.add(gem);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.03), bladeMat);
  blade.position.y = 0.61;
  blade.castShadow = true;
  g.add(blade);

  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.064, 0.16, 4), bladeMat);
  tip.rotation.y = Math.PI / 4;
  tip.scale.z = 0.35;
  tip.position.y = 1.14;
  g.add(tip);

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.86, 0.036), ridgeMat);
  ridge.position.y = 0.6;
  g.add(ridge);

  return g;
}

// Tạo một thanh tiên kiếm (model GLB nếu đã nạp, không thì kiếm dựng sẵn)
export function createSword(scale = 1.0) {
  const sword = swordTemplate ? swordTemplate.clone(true) : buildProceduralSword();
  sword.scale.setScalar(scale);
  return sword;
}

// Vỏ kiếm đeo lưng: miệng vỏ ở gốc toạ độ, thân vỏ kéo về -y
export function createSheath() {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x2d1b0e, roughness: 0.6, flatShading: true });

  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.0, 0.07), shellMat);
  shell.position.y = -0.5;
  shell.castShadow = true;
  g.add(shell);

  for (const y of [-0.04, -0.5, -0.96]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.09), goldMat);
    band.position.y = y;
    g.add(band);
  }
  return g;
}
