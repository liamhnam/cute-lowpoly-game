import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- TIÊN KIẾM NGỌC BÍCH (JADE GREEN JIAN) ---
// Model "Jade Green Jian" của Foxx Assets (Sketchfab, CC BY 4.0) đặt tại public/models/jade_green_jian.glb.
// Chưa có file thì dùng kiếm ngọc dựng bằng code. Mọi thanh kiếm đều theo một quy ước:
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
    if (obj.isMesh) obj.castShadow = true;
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

// Vật liệu dùng chung cho kiếm dựng sẵn
const jadeBladeMat = new THREE.MeshStandardMaterial({
  color: 0x7bed9f,
  emissive: 0x1dd1a1,
  emissiveIntensity: 0.35,
  metalness: 0.3,
  roughness: 0.25,
  flatShading: true,
});
const ridgeMat = new THREE.MeshBasicMaterial({ color: 0xd4ffe8 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.3, metalness: 0.5, flatShading: true });
const gripMat = new THREE.MeshStandardMaterial({ color: 0x0b6e4f, roughness: 0.8, flatShading: true });
const tasselMat = new THREE.MeshBasicMaterial({ color: 0xee5253 });

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

  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), jadeBladeMat);
  gem.position.set(0, 0.13, 0.05);
  g.add(gem);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.03), jadeBladeMat);
  blade.position.y = 0.61;
  blade.castShadow = true;
  g.add(blade);

  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.064, 0.16, 4), jadeBladeMat);
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
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.6, flatShading: true });

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
