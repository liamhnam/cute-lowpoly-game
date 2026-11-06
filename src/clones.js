import * as THREE from 'three';
import { Character } from './character.js';
import { getTerrainHeight } from './world.js';
import { sound } from './audio.js';

// --- NHẤT KHÍ HÓA TAM THANH: ĐẠO ẢNH PHÂN THÂN (Thái Thanh Đạo Gia, chiêu 3) ---
// Hai đạo ảnh, mỗi đạo một vai riêng, sống 20s hoặc tới khi bị đánh hết máu:
//  - Tử Ảnh (áo tím, vai 'sky'): bay lên trời lơ lửng quanh chủ nhân, liên tục phóng sét vàng xuống kẻ địch trong 60m
//  - Bạch Ảnh (áo trắng, vai 'runner'): chạy tốc độ cực cao tới kẻ địch trong 60m rồi chém liên tục, mỗi nhát có vệt chém vàng
// Máy của chủ nhân chạy AI đạo ảnh và gây sát thương; vị trí/máu được gửi kèm gói 'state' để máy khác hiển thị
// bản sao đúng chỗ. Người khác đánh trúng bản sao thì server chuyển sát thương về máy chủ nhân.

const CLONE_DURATION = 20;
const CLONE_RANGE = 60;
const HIT_RADIUS = 0.85;
const GOLD = 0xffd54a;

// Bạch Ảnh
const RUN_SPEED = 46;          // m/s, gấp ~5 lần chạy nước rút của nhân vật
const SLASH_INTERVAL = 0.24;   // giây giữa hai nhát chém
const SLASHES_PER_TARGET = 5;  // chém xong chừng này nhát thì đổi mục tiêu
const SLASH_REACH = 2.6;       // đứng cách rìa mục tiêu bấy nhiêu mét để chém

// Tử Ảnh
const SKY_HEIGHT = 2.8;        // độ cao lơ lửng (m), cao hơn đầu nhân vật và nằm giữa khung hình camera mặc định
const SKY_AHEAD = 5;           // lơ lửng phía trước nhân vật theo hướng camera nhìn (m)
const SKY_SWAY = 2.2;          // biên độ lượn qua lại hai bên (m), nhỏ để không trôi ra mép/ra sau bảng HUD
const RISE_SPEED = 8;
const BOLT_INTERVAL = 0.4;
const BOLT_DAMAGE = 45;
const BOLT_RADIUS = 3.0;
const BOLT_SEGMENTS = 14;

// Hai đạo ảnh: áo tím và áo trắng (chỉ số trang phục theo Character.outfits)
const CLONE_LOOKS = [
  { outfit: 2, label: 'Tử Ảnh', color: 0x8854d0, role: 'sky' },
  { outfit: 4, label: 'Bạch Ảnh', color: 0xf5f6fa, role: 'runner' },
];

const NO_INPUT = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class CloneManager {
  constructor(scene, particles, projectiles) {
    this.scene = scene;
    this.particles = particles;
    this.projectiles = projectiles;
    this.pixelFX = null;        // gắn từ main.js: dùng để gây sát thương và báo PvP
    this.local = [];            // đạo ảnh của chính mình
    this.remote = new Map();    // ownerId -> Map(index -> { index, body, color, targetPos, rotY, target })
    this.fx = [];               // tia sét đang hiển thị
    this.lastBoltSound = 0;
    // (index, origin, dir, attack) → báo đòn của đạo ảnh qua mạng; attack = { kind, step, target }
    this.onAttack = null;
  }

  createBody(look, name) {
    const body = new Character(this.scene, this.particles);
    body.setOutfit(look.outfit);
    body.setName(name);
    return body;
  }

  destroyBody(body, color) {
    this.puff(body.position, color);
    this.scene.remove(body.group);
    this.scene.remove(body.contactShadow);
    if (body.bbTexture) body.bbTexture.dispose();
  }

  puff(pos, color) {
    if (!this.particles) return;
    const p = pos.clone().add(new THREE.Vector3(0, 1.0, 0));
    this.particles.emitElementalParticles(p, 14, [color, 0xffffff, GOLD], [1, 4], 0.4, 0, 0.5);
    this.particles.emitShockwave(pos, color, 2.2, 0.25);
  }

  // Thuấn di tức thì: biến mất ở chỗ cũ, hiện ra ở chỗ mới
  placeAt(body, dest, color, keepY = false) {
    this.puff(body.position, color);
    if (!keepY) dest.y = getTerrainHeight(dest.x, dest.z);
    body.position.copy(dest);
    body.group.position.copy(dest);
    this.puff(dest, color);
  }

  // Cập nhật một thân đạo ảnh: đặt vị trí theo pos, chạy animation của Character rồi ghi đè lại vị trí
  // (Character.update tự di chuyển/ghim xuống đất nên phải đặt lại), không cho tự hồi máu như nhân vật thật.
  stepBody(body, delta, pos, { input = null, sprint = false, keepY = false, sky = false } = {}) {
    const hp = body.hp;
    const y = pos.y;
    body.position.x = pos.x;
    body.position.z = pos.z;
    body.drawSword(); // luôn cầm kiếm, không tự tra vỏ
    body.update(delta, input || NO_INPUT, sprint);
    body.position.x = pos.x;
    body.position.z = pos.z;
    body.position.y = keepY ? y : getTerrainHeight(pos.x, pos.z);
    if (sky) {
      // Tư thế bay: hai tay giương cao, kiếm chỉ trời
      body.body.rotation.x = -0.15;
      body.rightArm.rotation.set(-3.0, 0, 0.1);
      body.leftArm.rotation.set(-2.8, 0, -0.1);
      body.sword.rotation.x = Math.PI - 0.1;
    }
    body.group.position.copy(body.position);
    if (body.hp !== hp) {
      body.hp = hp;
      body.updateBillboard();
    }
  }

  // ---------- Đạo ảnh của chính mình ----------

  spawnLocal(owner) {
    this.clearLocal();
    CLONE_LOOKS.forEach((look, index) => {
      const body = this.createBody(look, `${look.label} · ${owner.name}`);
      body.maxHp = Math.round(owner.maxHp / 2);
      body.hp = body.maxHp;
      body.updateBillboard();
      const side = index === 0 ? -1 : 1;
      const start = owner.position.clone().add(new THREE.Vector3(side * 1.8, 0, 0));
      this.placeAt(body, start, look.color);
      this.local.push({
        body, index, side, life: CLONE_DURATION,
        // Tử Ảnh
        height: 0, orbit: Math.random() * Math.PI * 2, boltTimer: 0.5, bob: 0,
        // Bạch Ảnh
        targetEntity: null, targetRadius: HIT_RADIUS, slashesLeft: 0, slashTimer: 0, slashCount: 0,
      });
    });
  }

  damageLocal(index, amount, hitPos) {
    const c = this.local.find((x) => x.index === index);
    if (!c) return;
    c.body.takeDamage(amount, null, hitPos);
    if (c.body.hp <= 0) this.killLocal(c);
  }

  killLocal(c) {
    this.destroyBody(c.body, CLONE_LOOKS[c.index].color);
    this.local.splice(this.local.indexOf(c), 1);
  }

  clearLocal() {
    for (const c of [...this.local]) this.killLocal(c);
  }

  // Mọi mục tiêu còn sống trong 60m quanh chủ nhân: quái vật và người chơi/đạo ảnh khác
  collectTargets(owner, monsters, enemyTargets) {
    const out = [];
    const c = owner.position;
    const inRange = (p) => Math.hypot(p.x - c.x, p.z - c.z) <= CLONE_RANGE;
    for (const m of monsters) {
      if (!m.isDead && inRange(m.position)) out.push({ entity: m, radius: m.hitRadius, height: m.hitHeight });
    }
    for (const t of enemyTargets) {
      if (!t.isDead && inRange(t.position)) out.push({ entity: t, radius: HIT_RADIUS, height: 1.7 });
    }
    return out;
  }

  // ---------- Bạch Ảnh: chạy siêu tốc và chém liên tục ----------

  updateRunner(c, delta, owner, monsters, enemyTargets) {
    const body = c.body;
    if (body.freezeTimer > 0) {
      this.stepBody(body, delta, body.position, { input: null, sprint: false });
      return;
    }
    const look = CLONE_LOOKS[c.index];
    const targets = this.collectTargets(owner, monsters, enemyTargets);

    const stillValid = c.targetEntity && targets.some((t) => t.entity === c.targetEntity);
    if (!stillValid || c.slashesLeft <= 0) {
      const pickFrom = targets.length > 1 && stillValid
        ? targets.filter((t) => t.entity !== c.targetEntity)
        : targets;
      let chosen = null;
      if (pickFrom.length) {
        // Lần đầu (hoặc mất mục tiêu) chọn con gần nhất; sau khi chém đủ nhát thì đổi sang mục tiêu ngẫu nhiên khác
        chosen = stillValid
          ? pickFrom[Math.floor(Math.random() * pickFrom.length)]
          : pickFrom.reduce((best, t) => (
            body.position.distanceTo(t.entity.position) < body.position.distanceTo(best.entity.position) ? t : best
          ));
      }
      c.targetEntity = chosen ? chosen.entity : null;
      c.targetRadius = chosen ? chosen.radius : HIT_RADIUS;
      c.slashesLeft = SLASHES_PER_TARGET;
    }

    const pos = body.position.clone();
    let input = null;

    // Điểm cần tới: sát mục tiêu, hoặc về cạnh chủ nhân khi không còn ai để chém
    const hasTarget = Boolean(c.targetEntity);
    const goal = hasTarget ? c.targetEntity.position : owner.position.clone().add(new THREE.Vector3(c.side * 1.8, 0, 0));
    const stopDist = hasTarget ? c.targetRadius + SLASH_REACH : 0.5;
    const dx = goal.x - pos.x;
    const dz = goal.z - pos.z;
    const dist = Math.hypot(dx, dz);

    if (dist > stopDist) {
      const dir = new THREE.Vector3(dx / dist, 0, dz / dist);
      const step = Math.min(RUN_SPEED * delta, dist - stopDist);
      pos.addScaledVector(dir, step);
      input = dir;
      if (this.particles && Math.random() < 0.8) {
        // Vệt tàn ảnh vàng-trắng kéo dài theo bước chạy
        this.particles.emitElementalParticles(pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 2, [GOLD, 0xffffff], [0.5, 2], 0.25, 0, 0.35);
      }
    } else if (hasTarget) {
      // Đã áp sát: quay mặt và chém liên tục
      c.slashTimer -= delta;
      if (c.slashTimer <= 0) {
        c.slashTimer = SLASH_INTERVAL;
        c.slashesLeft--;
        this.runnerSlash(c, monsters, enemyTargets);
      }
    }

    this.stepBody(body, delta, pos, { input, sprint: Boolean(input) });
  }

  runnerSlash(c, monsters, enemyTargets) {
    const body = c.body;
    const tp = c.targetEntity.position;
    const dir = new THREE.Vector3(tp.x - body.position.x, 0, tp.z - body.position.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();

    const step = c.slashCount % 3;
    c.slashCount++;
    body.triggerSlashAnimation(Math.atan2(dir.x, dir.z), step);

    const origin = body.position.clone().add(new THREE.Vector3(0, 1.0, 0));
    const onHit = this.pixelFX && this.pixelFX.onHitPlayer;
    this.projectiles.slash(origin, dir, monsters, 'goldSlash', enemyTargets, onHit);
    if (this.onAttack) this.onAttack(c.index, origin, dir, { kind: 'gslash', step });
  }

  // ---------- Tử Ảnh: bay trên trời phóng sét vàng ----------

  updateSkyCaster(c, delta, owner, monsters, enemyTargets, viewYaw) {
    const body = c.body;
    if (body.freezeTimer > 0) {
      this.stepBody(body, delta, body.position, { keepY: true, sky: true });
      return;
    }
    c.height = Math.min(SKY_HEIGHT, c.height + RISE_SPEED * delta);
    c.orbit += delta * 0.8;
    c.bob += delta * 2.2;

    // Lơ lửng phía trước chủ nhân theo hướng camera, lượn chậm qua lại hai bên để luôn nằm trong khung hình
    const fx = -Math.sin(viewYaw);
    const fz = -Math.cos(viewYaw);
    const sway = Math.sin(c.orbit) * SKY_SWAY;
    const hx = owner.position.x + fx * SKY_AHEAD + fz * sway;
    const hz = owner.position.z + fz * SKY_AHEAD - fx * sway;
    const px = THREE.MathUtils.lerp(body.position.x, hx, Math.min(1, delta * 3));
    const pz = THREE.MathUtils.lerp(body.position.z, hz, Math.min(1, delta * 3));
    const py = getTerrainHeight(px, pz) + c.height + Math.sin(c.bob) * 0.5;
    const pos = new THREE.Vector3(px, py, pz);

    if (this.particles && Math.random() < 0.5) {
      this.particles.emitElementalParticles(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 1, [GOLD, 0xfff3b0], [0.5, 1.5], 0.3, 0, 0.5);
    }

    // Chỉ bắt đầu phóng sét khi đã bay gần tới độ cao
    c.boltTimer -= delta;
    if (c.boltTimer <= 0 && c.height > SKY_HEIGHT * 0.6) {
      c.boltTimer = BOLT_INTERVAL * (0.8 + Math.random() * 0.4);
      const targets = this.collectTargets(owner, monsters, enemyTargets);
      if (targets.length) this.strike(c, owner, targets[Math.floor(Math.random() * targets.length)], monsters);
    }

    this.stepBody(body, delta, pos, { keepY: true, sky: true });
  }

  // Một tia sét vàng đánh xuống mục tiêu: hiển thị, gây sát thương diện hẹp và báo qua mạng
  strike(c, owner, target, monsters) {
    const body = c.body;
    const to = target.entity.position.clone();
    to.y += Math.min(1.5, target.height * 0.5);
    const from = body.position.clone().add(new THREE.Vector3(0, 1.4, 0));

    this.spawnBolt(from, to);
    if (this.onAttack) {
      this.onAttack(c.index, from, to.clone().sub(from).normalize(), { kind: 'bolt', target: to });
    }

    const text = `⚡ -${BOLT_DAMAGE}`;
    if (this.pixelFX) {
      for (const m of monsters) {
        if (m.isDead) continue;
        if (Math.hypot(m.position.x - to.x, m.position.z - to.z) <= BOLT_RADIUS + m.hitRadius) {
          this.pixelFX.damageMonster(m, BOLT_DAMAGE, text, '#ffd54a', to);
        }
      }
      this.pixelFX.damagePlayersNear(to, BOLT_RADIUS, BOLT_DAMAGE, text, '#ffd54a', owner);
    }
  }

  // Tia sét: 4 sợi giật zigzag (lõi trắng + viền vàng) quanh một lõi sáng, quầng sáng chói ở điểm đánh
  spawnBolt(from, to) {
    const span = new THREE.Vector3().subVectors(to, from);
    const length = span.length();
    if (length < 0.1) return;
    const dir = span.clone().normalize();
    const side = new THREE.Vector3().crossVectors(dir, UP);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const side2 = new THREE.Vector3().crossVectors(side, dir).normalize();

    const group = new THREE.Group();
    const mats = []; // [material, độ đục gốc]
    const geos = [];
    // Pha màu thường (không cộng sáng) để sét giữ đúng sắc vàng cả trên nền sáng
    const solid = { transparent: true, depthWrite: false };
    const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

    // Lõi mảnh vàng nhạt, ba sợi viền vàng đậm: không dùng trắng tinh để sét giữ sắc vàng trên nền sáng
    [0xfff3b0, 0xffc107, 0xffb300, GOLD].forEach((color, k) => {
      const amp = k === 0 ? 0.35 : 0.8 + k * 0.3;
      const pts = [];
      for (let s = 0; s <= BOLT_SEGMENTS; s++) {
        const t = s / BOLT_SEGMENTS;
        const envelope = Math.sin(Math.PI * t); // hai đầu không giật
        pts.push(from.clone().lerp(to, t)
          .addScaledVector(side, (Math.random() - 0.5) * 2 * amp * envelope)
          .addScaledVector(side2, (Math.random() - 0.5) * 2 * amp * envelope));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, opacity: 1, ...solid });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      group.add(line);
      geos.push(geo);
      mats.push([mat, 1]);
    });

    const coreGeo = new THREE.CylinderGeometry(0.16, 0.16, length, 6, 1, true);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffc107, opacity: 0.85, side: THREE.DoubleSide, ...solid });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(from).lerp(to, 0.5);
    core.quaternion.setFromUnitVectors(UP, dir);
    group.add(core);
    geos.push(coreGeo);
    mats.push([coreMat, 0.85]);

    const flashGeo = new THREE.SphereGeometry(1, 10, 10);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd54a, opacity: 0.8, ...additive });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(to);
    group.add(flash);
    geos.push(flashGeo);
    mats.push([flashMat, 0.8]);

    this.scene.add(group);
    this.fx.push({ group, mats, geos, flash, life: 0.32, maxLife: 0.32 });

    if (this.particles) {
      this.particles.emitHitSparkles(to, 10);
      this.particles.emitShockwave(to, GOLD, BOLT_RADIUS * 1.6, 0.3);
      this.particles.emitElementalParticles(to, 12, [GOLD, 0xfff3b0, 0xffffff], [3, 8], 0.4, 2.0, 0.5);
    }
    const now = performance.now();
    if (now - this.lastBoltSound > 120) {
      this.lastBoltSound = now;
      sound.playHit();
    }
  }

  updateFx(delta) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= delta;
      const k = Math.max(0, f.life / f.maxLife);
      for (const [mat, base] of f.mats) mat.opacity = base * k;
      f.flash.scale.setScalar(1.2 + (1 - k) * 1.8);
      if (f.life <= 0) {
        this.scene.remove(f.group);
        for (const g of f.geos) g.dispose();
        for (const [mat] of f.mats) mat.dispose();
        this.fx.splice(i, 1);
      }
    }
  }

  // ---------- Vòng lặp ----------

  // viewYaw: góc quay ngang của camera (controller.yaw), để Tử Ảnh bay đúng phía camera đang nhìn
  update(delta, owner, monsters, enemyTargets, viewYaw = 0) {
    for (const c of [...this.local]) {
      c.life -= delta;
      if (c.life <= 0 || owner.isDead) {
        this.killLocal(c);
        continue;
      }
      if (CLONE_LOOKS[c.index].role === 'runner') this.updateRunner(c, delta, owner, monsters, enemyTargets);
      else this.updateSkyCaster(c, delta, owner, monsters, enemyTargets, viewYaw);
    }

    this.updateRemote(delta);
    this.updateFx(delta);
  }

  updateRemote(delta) {
    for (const clones of this.remote.values()) {
      for (const r of clones.values()) {
        const body = r.body;
        const sky = CLONE_LOOKS[r.index].role === 'sky';
        if (body.freezeTimer > 0) {
          this.stepBody(body, delta, body.position, { input: null, sprint: false, keepY: sky, sky });
          continue;
        }
        const dx = r.targetPos.x - body.position.x;
        const dz = r.targetPos.z - body.position.z;
        const dy = r.targetPos.y - body.position.y;
        const dist = sky ? Math.hypot(dx, dy, dz) : Math.hypot(dx, dz);

        const next = body.position.clone();
        if (dist > (sky ? 8 : 12)) {
          // Thuấn di xa: nhảy thẳng tới chỗ mới
          this.puff(body.position, r.color);
          next.copy(r.targetPos);
          this.puff(next, r.color);
        } else {
          next.lerp(r.targetPos, Math.min(1, delta * 20));
        }

        // Bạch Ảnh đang chạy: bật animation chạy theo hướng di chuyển
        let input = null;
        if (!sky && dist > 0.6) input = new THREE.Vector3(dx / dist, 0, dz / dist);
        if (!input) body.targetRotationY = r.rotY;

        this.stepBody(body, delta, next, { input, sprint: Boolean(input), keepY: sky, sky });
      }
    }
  }

  // ---------- Đồng bộ mạng ----------

  getNetworkState() {
    return this.local.map((c) => ({
      i: c.index,
      x: c.body.position.x,
      y: c.body.position.y,
      z: c.body.position.z,
      rotY: c.body.rotationY,
      hp: Math.round(c.body.hp),
      maxHp: c.body.maxHp,
    }));
  }

  // Cập nhật bản sao đạo ảnh của người chơi ownerId theo danh sách trong gói 'state'
  syncRemote(ownerId, ownerName, list) {
    let clones = this.remote.get(ownerId);
    if (!clones) {
      clones = new Map();
      this.remote.set(ownerId, clones);
    }
    const seen = new Set();
    for (const s of list || []) {
      const look = CLONE_LOOKS[s.i];
      if (!look) continue;
      seen.add(s.i);
      let r = clones.get(s.i);
      if (!r) {
        const body = this.createBody(look, `${look.label} · ${ownerName}`);
        body.position.set(s.x, s.y, s.z);
        body.group.position.copy(body.position);
        this.puff(body.position, look.color);
        r = { index: s.i, body, color: look.color, targetPos: new THREE.Vector3(), rotY: 0, target: null };
        r.target = {
          id: `${ownerId}#clone${s.i}`,
          isDead: false,
          get position() { return body.position; },
          checkBulletCollision(pos, radius) {
            return pos.distanceTo(body.position.clone().add(new THREE.Vector3(0, 0.85, 0))) <= HIT_RADIUS + radius;
          },
        };
        clones.set(s.i, r);
      }
      r.targetPos.set(s.x, s.y, s.z);
      r.rotY = s.rotY;
      r.body.maxHp = s.maxHp;
      r.body.hp = s.hp;
      r.body.updateBillboard();
    }
    for (const [i, r] of clones) {
      if (!seen.has(i)) {
        this.destroyBody(r.body, r.color);
        clones.delete(i);
      }
    }
  }

  removeRemote(ownerId) {
    this.syncRemote(ownerId, '', []);
    this.remote.delete(ownerId);
  }

  // Đạo ảnh của người khác vừa chém (nhận qua gói 'shoot')
  animateRemote(ownerId, index, facing, step = 0) {
    const r = this.remote.get(ownerId)?.get(index);
    if (r) r.body.triggerSlashAnimation(facing, step);
  }

  // Mục tiêu PvP: đạo ảnh của người chơi khác (dùng chung giao diện với RemotePlayer)
  getRemoteTargets() {
    const list = [];
    for (const clones of this.remote.values()) {
      for (const r of clones.values()) list.push(r.target);
    }
    return list;
  }
}
