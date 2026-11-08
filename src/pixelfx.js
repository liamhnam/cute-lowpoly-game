import * as THREE from 'three';
import { sound } from './audio.js';
import { getTerrainHeight } from './world.js';
import { createSword, SWORD_LENGTH } from './sword.js';
import { getRoleCounterMultiplier } from './character.js';
import { getMonsterRoleIndex } from './projectiles.js';
import { GiantRobot } from './giantRobot.js';
import { NamcamSquad } from './namcamSquad.js';

// --- PIXEL ART PROCEDURAL TEXTURE GENERATOR (Theo cảm hứng từ patch-gg/pixelfx) ---
// Vẽ các frame hiệu ứng pixel art trực tiếp lên canvas 2D nhỏ (nearest-neighbor)
// và bọc vào CanvasTexture để kết hợp 2D Pixel Art VFX vào thế giới 3D Low-Poly!

class PixelCanvasEffect {
  constructor(size = 64) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.size, this.size);
  }

  // Vẽ kiếm trận hoàng kim Pixel Art (Wan Jian Gui Zong Decal)
  drawSwordArray(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const maxR = w / 2 - 2;

    if (progress < 0.92) {
      // Vòng tròn kiếm trận bát quái
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, maxR * 0.9, 0, Math.PI * 2);
      ctx.stroke();

      // Vòng tròn nhỏ bên trong
      ctx.strokeStyle = '#ffa502';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, maxR * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      // 8 thanh kiếm pixel hướng vào tâm
      const blades = 8;
      ctx.fillStyle = '#ffffff';
      for (let b = 0; b < blades; b++) {
        const ang = (b / blades) * Math.PI * 2 + progress * 3;
        const x1 = w / 2 + Math.cos(ang) * (maxR * 0.75);
        const y1 = h / 2 + Math.sin(ang) * (maxR * 0.75);
        ctx.fillRect(Math.floor(x1) - 2, Math.floor(y1) - 2, 4, 4);

        // Hạt kiếm khí
        const x2 = w / 2 + Math.cos(ang + 0.2) * (maxR * 0.5);
        const y2 = h / 2 + Math.sin(ang + 0.2) * (maxR * 0.5);
        ctx.fillStyle = '#ffeaa7';
        ctx.fillRect(Math.floor(x2) - 1, Math.floor(y2) - 1, 2, 2);
      }
    }
    this.texture.needsUpdate = true;
  }

  // Đồ hình Bát Quái Thái Cực (Thái Thanh Đạo Gia)
  drawBagua(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(progress * Math.PI * 4);

    // Vòng Bát Quái ngoài
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    // 8 quẻ Bát Quái
    ctx.strokeStyle = '#ffeaa7';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x1 = Math.cos(a) * (r * 0.76);
      const y1 = Math.sin(a) * (r * 0.76);
      const x2 = Math.cos(a) * (r * 0.9);
      const y2 = Math.sin(a) * (r * 0.9);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Đồ hình Thái Cực Âm Dương ở tâm
    const tr = r * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, tr, -Math.PI / 2, Math.PI / 2);
    ctx.arc(0, tr / 2, tr / 2, Math.PI / 2, -Math.PI / 2);
    ctx.arc(0, -tr / 2, tr / 2, Math.PI / 2, 3 * Math.PI / 2, true);
    ctx.fill();

    ctx.fillStyle = '#1e272e';
    ctx.beginPath();
    ctx.arc(0, 0, tr, Math.PI / 2, 3 * Math.PI / 2);
    ctx.arc(0, -tr / 2, tr / 2, -Math.PI / 2, Math.PI / 2);
    ctx.arc(0, tr / 2, tr / 2, -Math.PI / 2, Math.PI / 2, true);
    ctx.fill();

    // 2 mắt âm dương
    ctx.fillStyle = '#1e272e';
    ctx.beginPath();
    ctx.arc(0, tr / 2, tr * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -tr / 2, tr * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    this.texture.needsUpdate = true;
  }

  // Hoa tuyết Băng Phong (Thanh Vân Tiên Tông)
  drawFrostNova(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const cx = w / 2;
    const cy = h / 2;
    const r = (w / 2 - 2) * Math.min(1.0, progress * 1.5);

    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    // 6 nhánh hoa tuyết
    ctx.strokeStyle = '#7ed6df';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + progress;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    this.texture.needsUpdate = true;
  }

  // Huyết Phù Ma Đạo (Hồng Trần Ma Tu)
  drawBloodRune(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const cx = w / 2;
    const cy = h / 2;
    const r = (w / 2 - 2);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-progress * Math.PI * 3);

    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#2f3542';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    // Ngôi sao huyết ma 5 cánh
    ctx.strokeStyle = '#ff3838';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
      const x = Math.cos(a) * (r * 0.7);
      const y = Math.sin(a) * (r * 0.7);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
    this.texture.needsUpdate = true;
  }

  drawFireExplosion(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const r = (w / 2 - 2) * Math.min(1.0, progress * 1.8);
    ctx.fillStyle = '#ff3838';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd32a';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    this.texture.needsUpdate = true;
  }

  drawLightning(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const r = (w / 2 - 2);
    ctx.strokeStyle = '#ffd32a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    this.texture.needsUpdate = true;
  }

  drawEarthquake(progress) {
    this.clear();
    const ctx = this.ctx;
    const w = this.size;
    const h = this.size;
    const r = (w / 2 - 2);
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    this.texture.needsUpdate = true;
  }
}

// Lớp hiển thị số sát thương nhảy lên kiểu Retro Pixel Art Floating Text
class FloatingDamageText {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];

    for (let i = 0; i < 25; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 70;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;

      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(4.0, 1.25, 1);
      sprite.visible = false;
      this.scene.add(sprite);

      this.pool.push({ sprite, canvas, ctx, texture, life: 0, maxLife: 1.3, velY: 2.8 });
    }
  }

  spawn(text, position, color = '#ff4757') {
    // Chống rối mắt: chữ mới mọc ở cùng chỗ thì xếp tầng lên trên, tối đa 4 dòng (dòng cũ nhất bị thay)
    const nearby = this.pool.filter((it) => it.sprite.visible &&
      Math.abs(it.sprite.position.x - position.x) < 2.5 && Math.abs(it.sprite.position.z - position.z) < 2.5);
    let recycled = null;
    if (nearby.length >= 4) {
      recycled = nearby.reduce((a, b) => (a.life < b.life ? a : b));
      recycled.sprite.visible = false;
    }
    const stack = Math.min(nearby.length, 3);
    for (const item of this.pool) {
      if (!item.sprite.visible) {
        item.sprite.visible = true;
        item.life = item.maxLife;
        item.sprite.position.copy(position);
        item.sprite.position.y += 1.6 + stack * 1.15;
        item.sprite.position.x += (Math.random() - 0.5) * 0.6;

        const ctx = item.ctx;
        ctx.clearRect(0, 0, 240, 70);
        ctx.font = 'bold 22px "Press Start 2P", "VT323", "Be Vietnam Pro", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeText(text, 120, 35);

        ctx.fillStyle = color;
        ctx.fillText(text, 120, 35);

        item.texture.needsUpdate = true;
        break;
      }
    }
  }

  update(delta) {
    for (const item of this.pool) {
      if (item.sprite.visible) {
        item.life -= delta;
        if (item.life <= 0) {
          item.sprite.visible = false;
        } else {
          item.sprite.position.y += item.velY * delta;
          item.sprite.material.opacity = Math.min(1.0, item.life / (item.maxLife * 0.35));
        }
      }
    }
  }
}

// =========================================================================
// HỆ THỐNG 5 VAI TRÒ CHIẾN ĐẤU (COMBAT ROLES) - MỖI VAI TRÒ 4 KỸ NĂNG CÂN BẰNG & KHẮC CHẾ
// =========================================================================
const BAGUA_COOLDOWN_RATE = 1.4;

export const SECTS = [
  {
    id: 'tank',
    name: 'Thiết Giáp Hộ Vệ',
    outfitName: 'Thiết Giáp Hộ Vệ (Đỡ Đòn / Khống Chế)',
    colorHex: 0xf6b93b,
    themeColor: '#f6b93b',
    icon: '🛡️',
    countersText: 'Khắc chế: 🗡️ Sát Thủ & 🏹 Xạ Thủ (+25% ST)',
    weakToText: 'Bị khắc chế: ❄️ Pháp Sư & 🔥 Đấu Sĩ',
    desc: 'Pháo đài tiên phong cầm Đại Khiên & Trọng Kiếm: Máu cao nhất (2600 HP), giảm 20% ST nhận, phản sát thương và gom khống chế diện rộng. Điểm yếu: Tốc chạy chậm, dễ bị thả diều hoặc bổ rìu phá giáp.',
    skills: [
      {
        id: 1,
        name: 'Khiên Kích Xung Phong',
        tag: 'XUNG KÍCH CHOÁNG',
        icon: '🛡️',
        cd: 6.0,
        mana: 20,
        desc: 'Giương Đại Khiên Hoàng Kim húc thẳng 13m tông văng kẻ địch trên đường, gây 115 ST và Làm Choáng 1.4s tại điểm dừng.'
      },
      {
        id: 2,
        name: 'Thiết Giáp Phản Chấn',
        tag: 'KHIÊN PHẢN ĐÒN',
        icon: '🔰',
        cd: 10.0,
        mana: 25,
        desc: 'Hồi ngay +220 HP, vào Thế Parry 0.8s, miễn khống chế 2.5s và dựng Khiên Phản Chấn 5s: Giảm thêm 35% ST nhận & PHẢN LẠI 35% sát thương về kẻ tấn công!'
      },
      {
        id: 3,
        name: 'Địa Chấn Khiêu Khích',
        tag: 'GOM ĐỊCH LÀM CHẬM',
        icon: '🌍',
        cd: 9.0,
        mana: 25,
        desc: 'Nện Đại Khiên chấn động 11m gây 130 ST, HÚT KÉO toàn bộ kẻ địch xung quanh về phía Hộ Vệ và làm chậm 50% trong 3s.'
      },
      {
        id: 4,
        name: 'Bất Diệt Thần Thành',
        tag: 'TUYỆT KỸ PHÁO ĐÀI',
        icon: '🏰',
        cd: 18.0,
        mana: 40,
        desc: 'Dựng Pháo Đài Hoàng Kim 8s: Nổ xung kích 160 ST, hồi ngay +350 HP, miễn khống chế, hồi tiếp +45 HP/nhịp và chấn áp 35 ST/nhịp làm chậm mọi kẻ địch trong thành.'
      }
    ]
  },
  {
    id: 'assassin',
    name: 'Ám Ảnh Sát Thủ',
    outfitName: 'Ám Ảnh Sát Thủ (Cơ Động / Kết Liễu)',
    colorHex: 0xa55eea,
    themeColor: '#c084fc',
    icon: '🗡️',
    countersText: 'Khắc chế: ❄️ Pháp Sư & 🏹 Xạ Thủ (+25% ST)',
    weakToText: 'Bị khắc chế: 🛡️ Hộ Vệ & 🔥 Đấu Sĩ',
    desc: 'Sát thủ song đao tốc độ cao: Đánh thường cực nhanh, Chí Mạng Sau Lưng (+35% ST), áp sát chớp nhoáng kết liễu chủ lực máu giấy. Điểm yếu: Máu mỏng (1750 HP), sợ giáp phản đòn và khống chế cứng.',
    skills: [
      {
        id: 1,
        name: 'Ám Ảnh Đột Kích',
        tag: 'TỐC BIẾN TRẢM',
        icon: '💨',
        cd: 5.0,
        mana: 20,
        desc: 'Tốc biến 10m chém xuyên mục tiêu 95 ST, gắn Ấn Ký Chữ X sau 0.35s phát nổ 65 ST. Chém trúng địch GIẢM NGAY 50% HỒI CHIÊU!'
      },
      {
        id: 2,
        name: 'Màn Sương Ẩn Thân',
        tag: 'HÓA GIẢI & TĂNG TỐC',
        icon: '🌑',
        cd: 7.5,
        mana: 20,
        desc: 'Tung bom khói tím giải mọi khống chế, vào Thế Phản Đòn (Parry 0.8s), nổ bóng tối 115 ST và tăng +45% tốc chạy suốt 3.5s để luồn ra sau lưng địch.'
      },
      {
        id: 3,
        name: 'Toàn Phong Song Nhận',
        tag: 'XOÁY ĐAO HỘ THÂN',
        icon: '🌀',
        cd: 9.0,
        mana: 25,
        desc: 'Triệu hồi 6 lưỡi đao bóng tối xoay quanh thân 6s cắt 32 ST/nhịp, kết thúc phóng tỏa ra 6 hướng (55 ST/lưỡi).'
      },
      {
        id: 4,
        name: 'Tuyệt Mệnh Liên Trảm',
        tag: 'TUYỆT KỸ ÁM SÁT',
        icon: '⚔️',
        cd: 15.0,
        mana: 35,
        desc: 'Hóa thành tàn ảnh bất tử trong 1.1s, liên hoàn trảm 5 nhát ngôi sao 5 cánh (55 ST/nhát) rồi giáng Đại Liêm Chữ X 180 ST (Tổng 455 ST)!'
      }
    ]
  },
  {
    id: 'mage',
    name: 'Nguyên Tố Pháp Sư',
    outfitName: 'Nguyên Tố Pháp Sư (Khống Chế / Phép AoE)',
    colorHex: 0x38bdf8,
    themeColor: '#38bdf8',
    icon: '❄️',
    countersText: 'Khắc chế: 🛡️ Hộ Vệ & 🔥 Đấu Sĩ (+25% ST)',
    weakToText: 'Bị khắc chế: 🗡️ Sát Thủ & 🏹 Xạ Thủ',
    desc: 'Bậc thầy quyền trượng băng tinh & hố đen: Đánh thường bắn cầu phép tầm xa làm chậm, sát thương diện rộng lớn nhất (+15% ST). Điểm yếu: Máu giấy (1700 HP), dễ bị Sát Thủ áp sát hoặc Xạ Thủ bắn tỉa ngoài tầm.',
    skills: [
      {
        id: 1,
        name: 'Băng Phong Tuyệt Vực',
        tag: 'ĐÓNG BĂNG CỨNG',
        icon: '❄️',
        cd: 6.0,
        mana: 25,
        desc: 'Báo hiệu 0.35s rồi 16 cọc băng trồi lên gây 130 ST & ĐÓNG BĂNG 2.2s trong Lồng Băng 3D.'
      },
      {
        id: 2,
        name: 'Tinh Vân Dịch Chuyển',
        tag: 'DỊCH CHUYỂN GIẢI KHỐNG',
        icon: '✨',
        cd: 6.5,
        mana: 20,
        desc: 'Để lại Tượng Gương Băng rồi dịch chuyển tinh vân 16m, GIẢI MỌI KHỐNG CHẾ và nổ băng quang 85 ST đẩy lùi kẻ áp sát.'
      },
      {
        id: 3,
        name: 'Hắc Động Không Gian',
        tag: 'HỐ ĐEN GOM ĐỊCH',
        icon: '🕳️',
        cd: 9.5,
        mana: 30,
        desc: 'Triệu hồi Hắc Động Vũ Trụ 3.5s hút chặt toàn bộ kẻ địch về tâm hố, gây 35 ST/nhịp rồi phát nổ 60 ST.'
      },
      {
        id: 4,
        name: 'Băng Tinh Thiên Phạt',
        tag: 'TUYỆT KỸ BĂNG TOÁI',
        icon: '☄️',
        cd: 14.0,
        mana: 40,
        desc: 'Mưa 28 thương băng (32 ST/mũi) trong 1.8s rồi giáng Đại Thiên Thạch Băng Tinh 150 ST. Mục tiêu ĐANG ĐÓNG BĂNG chịu thêm +75 ST Băng Toái!'
      }
    ]
  },
  {
    id: 'bruiser',
    name: 'Cuồng Chiến Đấu Sĩ',
    outfitName: 'Cuồng Chiến Đấu Sĩ (Hút Máu / Phá Giáp)',
    colorHex: 0xff5252,
    themeColor: '#ff5252',
    icon: '🔥',
    countersText: 'Khắc chế: 🛡️ Hộ Vệ & 🗡️ Sát Thủ (+25% ST)',
    weakToText: 'Bị khắc chế: ❄️ Pháp Sư & 🏹 Xạ Thủ',
    desc: 'Chiến binh Cự Phủ Huyết Diễm: Máu dày (2250 HP), đánh thường & kỹ năng hút máu mạnh (nhân đôi khi máu < 50%), khắc chế cứng Hộ Vệ và Sát Thủ. Điểm yếu: Tay ngắn, sợ bị Pháp Sư và Xạ Thủ thả diều từ xa.',
    skills: [
      {
        id: 1,
        name: 'Phá Giáp Huyết Trảm',
        tag: 'BỔ RÌU HÚT MÁU',
        icon: '🩸',
        cd: 5.0,
        mana: 20,
        desc: 'Bổ chiến phủ phóng sóng huyết diễm 22m gây 125 ST & hút 60 HP. Khi MÁU < 50% (Huyết Cuồng): Tăng thành 165 ST & hút 120 HP!'
      },
      {
        id: 2,
        name: 'Không Kích Địa Liệt',
        tag: 'NHẢY BỔ CHẤN ĐỊA',
        icon: '🪓',
        cd: 7.0,
        mana: 25,
        desc: 'Nhảy vọt lên không rồi bổ mạnh Cự Phủ xuống vị trí chỉ định (tối đa 14m), gây 135 ST, hất tung và làm chậm kẻ địch.'
      },
      {
        id: 3,
        name: 'Huyết Cuồng Chiến Hống',
        tag: 'HÓA CUỒNG HỒI MÁU',
        icon: '😡',
        cd: 10.0,
        mana: 25,
        desc: 'Gầm vang giải mọi làm chậm/đóng băng, hồi ngay +160 HP, nổ lửa 80 ST quanh thân và kích hoạt Huyết Cuồng 5s (+35% tốc chạy & +22% tốc đánh)!'
      },
      {
        id: 4,
        name: 'Dung Nham Hủy Diệt',
        tag: 'TUYỆT KỸ NÚI LỬA',
        icon: '🌋',
        cd: 14.0,
        mana: 35,
        desc: 'Đập vỡ đại địa tạo vụ nổ dung nham 16m gây 250 ST cực đại (hoặc 325 ST nếu kết hợp vùng khống chế / máu thấp).'
      }
    ]
  },
  {
    id: 'marksman',
    name: 'Thần Tiễn Xạ Thủ',
    outfitName: 'Thần Tiễn Xạ Thủ (Bắn Tỉa / Thả Diều)',
    colorHex: 0x2ed573,
    themeColor: '#2ed573',
    icon: '🏹',
    countersText: 'Khắc chế: ❄️ Pháp Sư & 🔥 Đấu Sĩ (+25% ST)',
    weakToText: 'Bị khắc chế: 🛡️ Hộ Vệ & 🗡️ Sát Thủ',
    desc: 'Xạ thủ Đại Cung Quang Ảnh: Tầm bắn xa nhất (28m), tốc chạy nhanh nhất trò chơi, thả diều Đấu Sĩ và bắn vượt tầm Pháp Sư. Điểm yếu: Máu thấp nhất (1650 HP), sợ Khiên Phản Đòn của Hộ Vệ và Sát Thủ áp sát.',
    skills: [
      {
        id: 1,
        name: 'Liên Hoàn Lôi Tiễn',
        tag: 'TIỄN SÉT LÀM CHẬM',
        icon: '⚡',
        cd: 5.5,
        mana: 20,
        desc: 'Bắn Lôi Tiễn nổ 140 ST tại mục tiêu (làm chậm 45% trong 2.5s) và giật sét lan 60 ST sang 4 kẻ địch xung quanh.'
      },
      {
        id: 2,
        name: 'Phi Vũ Thoát Thân',
        tag: 'LƯỚT NHANH THẢ DIỀU',
        icon: '🪶',
        cd: 6.0,
        mana: 20,
        desc: 'Hóa linh ảnh Bạch Hạc lướt nhanh 22m hất tung địch (100 ST), GIẢI KHỐNG CHẾ và nhận +45% tốc chạy suốt 4s.'
      },
      {
        id: 3,
        name: 'Chấn Địa Đẩy Lùi',
        tag: 'ĐẨY LÙI GIỮ CỰ LY',
        icon: '💨',
        cd: 9.5,
        mana: 25,
        desc: 'Phát nổ xung kích bảo vệ quanh thân gây 180 ST, THỔI BAY mọi kẻ địch áp sát ra xa 15m để tái lập cự ly bắn an toàn.'
      },
      {
        id: 4,
        name: 'Thiên Tiễn Phán Quyết',
        tag: 'TUYỆT KỸ ĐẠI TIỄN',
        icon: '🏹',
        cd: 14.0,
        mana: 40,
        desc: 'Khoanh vùng mục tiêu bằng trận địa quang tiễn rồi giáng ĐẠI THẦN TIỄN KHỔNG LỒ từ bầu trời nổ 260 ST diện rộng!'
      }
    ]
  },
  {
    id: 'namcam',
    name: 'Chiến Sĩ NAMCAM',
    outfitName: 'Bộ Đội Cụ Hồ (Vai Trò Ẩn NAMCAM)',
    colorHex: 0x2e4a2b,
    themeColor: '#2ed573',
    icon: '🇻🇳',
    countersText: 'Khắc chế: Mọi thế lực thù địch',
    weakToText: 'Bị khắc chế: Không có',
    desc: 'Vai Trò Ẩn Huyền Thoại: Quân nhân Việt Nam sử dụng súng trường tác chiến, Thả Rắm 31.5m, Kiosk DVC tê liệt 5s, Binh Đoàn 10 Phân Thân Tự Động và Triệu Hồi Binh Đoàn Robot Khổng Lồ x20.',
    skills: [
      {
        id: 1,
        name: 'Thả Rắm Diệt Thế',
        tag: 'KHÍ ĐỘC BẤT ĐỘNG',
        icon: '💨',
        cd: 9.0,
        mana: 30,
        desc: 'Nổ khói vàng bao phủ siêu rộng 31.5m gây 260 ST, BẤT ĐỘNG TOÀN DIỆN suốt thời gian hiệu lực & trúng độc rút máu.'
      },
      {
        id: 2,
        name: 'Kiosk Dịch Vụ Công',
        tag: 'THỦ TỤC HÀNH CHÍNH',
        icon: '🖥️',
        cd: 12.0,
        mana: 35,
        desc: 'Triệu hồi máy Kiosk Dịch Vụ Công từ trên trời giáng xuống 180 ST, phát luồng điện từ làm BẤT ĐỘNG TOÀN BỘ ĐỊCH TRONG 5S.'
      },
      {
        id: 3,
        name: 'Binh Đoàn Phân Thân',
        tag: '10 CHIẾN SĨ TỰ ĐỘNG',
        icon: '👥',
        cd: 20.0,
        mana: 35,
        desc: 'Triệu hồi 10 Phân Thân Chiến Sĩ NAMCAM tự động tác chiến, rượt đuổi và nã súng trường diệt quái! ĐẶC BIỆT: Nếu kích hoạt [4] Chiến Thần Gundam, toàn bộ 10 phân thân sẽ ĐỒNG LOẠT BIẾN THÀNH 10 GUNDAM KHỔNG LỒ cùng xung kích!'
      },
      {
        id: 4,
        name: 'Chiến Thần Gundam Khổng Lồ',
        tag: 'GUNDAM HỢP THỂ',
        icon: '🤖',
        cd: 28.0,
        mana: 40,
        desc: 'Triệu hồi 7 mảnh cơ giáp từ không gian bay vào hợp thể thành Gundam Mobile Suit Khổng Lồ gấp 20 lần! Đòn đánh thường biến thành đạp và nện đại địa chấn động, chậm rãi nhưng sát thương kinh thiên động địa!'
      }
    ]
  }
];

export class PixelFXManager {
  constructor(scene, world, particles) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;
    this.controller = null; // Sẽ được liên kết từ main.js
    this.onScreenFlash = null; // Callback flash hiệu ứng màn hình
    this.activeEffects = [];
    this.damageTexts = new FloatingDamageText(scene);

    this.currentSectIndex = 0;
    this.cooldowns = {};
    this.onCooldownUpdate = null;
    this.onSectChange = null;
    this.remotePlayers = [];
    this.onHitPlayer = null;
    this.localCharacter = null; // nhân vật của chính mình
    this.cloneManager = null;   // quản lý đạo ảnh phân thân

    // Quản lý vùng trận pháp & tương tác chiêu thức
    this.lastBaguaPos = null;
    this.baguaTimer = 0;
    this.lastVortexPos = null;
    this.vortexTimer = 0;

    this.setSect(0);
  }

  // ĐẶT VAI TRÒ CHIẾN ĐẤU CHO NHÂN VẬT & TẢI BỘ 4 KỸ NĂNG
  setSect(sectIndex) {
    this.currentSectIndex = ((Number(sectIndex) % SECTS.length) + SECTS.length) % SECTS.length;
    const sect = SECTS[this.currentSectIndex];

    this.cooldowns = {};
    sect.skills.forEach((s, i) => {
      this.cooldowns[i + 1] = { current: 0, max: s.cd, name: s.name, icon: s.icon, tag: s.tag, desc: s.desc, mana: s.mana };
    });

    if (this.onSectChange) {
      this.onSectChange(sect, this.cooldowns);
    }
    if (this.onCooldownUpdate) {
      this.onCooldownUpdate(this.cooldowns);
    }
  }

  // VÒNG CHỈ ĐIỂM MA PHÁP DƯỚI ĐẤT (TARGETING TELEGRAPH RUNE)
  spawnTelegraph(position, color, duration, radius = 6.0) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y += 0.08;

    // Vòng ngoài xoay thu nhỏ dần
    const ringGeo = new THREE.RingGeometry(radius * 0.9, radius, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    // Tâm ma pháp nhấp nháy
    const coreGeo = new THREE.CircleGeometry(radius * 0.3, 16);
    coreGeo.rotateX(-Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    this.scene.add(group);

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const progress = elapsed / duration;
        if (progress >= 1.0) {
          this.scene.remove(group);
          return false;
        }

        group.rotation.y += delta * 4;
        const scale = THREE.MathUtils.lerp(1.2, 0.85, progress);
        ringMesh.scale.set(scale, scale, scale);
        coreMat.opacity = (Math.sin(elapsed * 16) * 0.25 + 0.5) * (1.0 - progress);
        ringMat.opacity = 0.85 * (1.0 - progress * 0.4);
        return true;
      }
    });
  }

  // VÒNG SAO CHOÁNG 3D XOAY TRÊN ĐẦU MỤC TIÊU BỊ KHỐNG CHẾ (STUN HALO)
  spawnStunHalo(targetEntity, duration = 1.4, color = 0xffd32a) {
    if (!targetEntity || !targetEntity.position) return;
    const haloGroup = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(0.65, 0.045, 6, 20);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    haloGroup.add(new THREE.Mesh(ringGeo, ringMat));

    const starGeo = new THREE.OctahedronGeometry(0.16, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(Math.cos(a) * 0.65, 0, Math.sin(a) * 0.65);
      haloGroup.add(star);
    }
    this.scene.add(haloGroup);

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        if (elapsed >= duration || !targetEntity || targetEntity.isDead) {
          this.scene.remove(haloGroup);
          ringGeo.dispose();
          ringMat.dispose();
          starGeo.dispose();
          starMat.dispose();
          return false;
        }
        const h = (targetEntity.hitHeight || 2.0) + 0.55;
        haloGroup.position.set(targetEntity.position.x, targetEntity.position.y + h, targetEntity.position.z);
        haloGroup.rotation.y += delta * 6.5;
        haloGroup.rotation.z = Math.sin(elapsed * 8) * 0.18;
        return true;
      }
    });
  }

  // LỒNG BĂNG TINH 3D GIAM GIỮ MỤC TIÊU BỊ ĐÓNG BĂNG (ICE PRISON)
  spawnIcePrison(targetEntity, duration = 2.2) {
    if (!targetEntity || !targetEntity.position) return;
    const prisonGroup = new THREE.Group();
    const cageGeo = new THREE.OctahedronGeometry(1.15, 0);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0x7ed6df,
      emissive: 0x00d2d3,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.52,
      roughness: 0.15,
      flatShading: true,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    cageMesh.scale.set(0.95, 1.35, 0.95);
    prisonGroup.add(cageMesh);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const wireMesh = new THREE.Mesh(cageGeo, wireMat);
    wireMesh.scale.set(0.98, 1.38, 0.98);
    prisonGroup.add(wireMesh);
    this.scene.add(prisonGroup);

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        if (elapsed >= duration || !targetEntity || targetEntity.isDead) {
          if (this.particles && targetEntity?.position) {
            this.particles.emitElementalParticles(targetEntity.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 14, [0x00d2d3, 0x7ed6df, 0xffffff], [2, 6], 0.35, 1, 0.5);
          }
          this.scene.remove(prisonGroup);
          cageGeo.dispose();
          cageMat.dispose();
          wireMat.dispose();
          return false;
        }
        prisonGroup.position.set(targetEntity.position.x, targetEntity.position.y + 1.05, targetEntity.position.z);
        prisonGroup.rotation.y += delta * 1.2;
        return true;
      }
    });
  }

  // TIA SÉT / XÍCH NĂNG LƯỢNG 3D NỐI GIỮA 2 ĐIỂM (LIGHTNING / CHAIN ARC)
  spawnLightningArc(fromPos, toPos, color = 0x74b9ff, duration = 0.35) {
    const arcGroup = new THREE.Group();
    const segments = 6;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const geos = [];
    const pPrev = fromPos.clone();
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const pNext = new THREE.Vector3().lerpVectors(fromPos, toPos, t);
      if (i < segments) {
        pNext.x += (Math.random() - 0.5) * 0.9;
        pNext.y += (Math.random() - 0.5) * 0.7;
        pNext.z += (Math.random() - 0.5) * 0.9;
      }
      const segLen = Math.max(0.05, pPrev.distanceTo(pNext));
      const geo = new THREE.BoxGeometry(0.14, 0.14, segLen);
      geos.push(geo);
      const segMesh = new THREE.Mesh(geo, mat);
      segMesh.position.lerpVectors(pPrev, pNext, 0.5);
      segMesh.lookAt(pNext);
      arcGroup.add(segMesh);
      pPrev.copy(pNext);
    }
    this.scene.add(arcGroup);

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        mat.opacity = Math.max(0, 0.95 * (1.0 - elapsed / duration));
        if (elapsed >= duration) {
          this.scene.remove(arcGroup);
          for (const g of geos) g.dispose();
          mat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  isSkillOnCooldown(skillIndex) {
    const s = this.cooldowns[skillIndex];
    return s && s.current > 0;
  }

  // KÍCH HOẠT KỸ NĂNG THEO VAI TRÒ CHIẾN ĐẤU (MỖI VAI TRÒ 4 KỸ NĂNG [1], [2], [3], [4])
  castSkill(skillIndex, targetPos, character, monsters) {
    const slotNum = Number(skillIndex);
    if (![1, 2, 3, 4].includes(slotNum)) return false;

    const sectIdx = ((character?.outfitIndex !== undefined ? character.outfitIndex : this.currentSectIndex) % SECTS.length + SECTS.length) % SECTS.length;
    if (slotNum === 4 && !SECTS[sectIdx].skills[3]) return false;

    if (character === this.localCharacter) {
      const skill = this.cooldowns[slotNum];
      if (!skill || skill.current > 0) return false;
      const cdMult = character?.sectStats?.cdMult || 1.0;
      skill.current = skill.max * cdMult;
    }

    // Kích hoạt động tác vũ khí & hình thể 3D đặc trưng theo từng vai trò và từng ô kỹ năng!
    if (character?.triggerSkillCast) {
      character.triggerSkillCast(slotNum);
    }
    if (character && targetPos && character.position) {
      const dx = targetPos.x - character.position.x;
      const dz = targetPos.z - character.position.z;
      if (dx * dx + dz * dz > 0.04) {
        character.targetRotationY = Math.atan2(dx, dz);
      }
    }

    switch (sectIdx) {
      case 0: // 🛡️ Thiết Giáp Hộ Vệ (Tank)
        if (slotNum === 1) this.castShieldCharge(targetPos, character, monsters);
        else if (slotNum === 2) this.castGuardianBulwark(character, monsters);
        else if (slotNum === 3) this.castTauntQuake(character, monsters);
        else if (slotNum === 4) this.castTaiChiBagua(character, monsters);
        break;

      case 1: // 🗡️ Ám Ảnh Sát Thủ (Assassin)
        if (slotNum === 1) this.castBlinkSlash(targetPos, character, monsters);
        else if (slotNum === 2) this.castShadowVeil(character, monsters);
        else if (slotNum === 3) this.castSwordBarrier(character, monsters);
        else if (slotNum === 4) this.castPhantomOmnislash(targetPos, character, monsters);
        break;

      case 2: // ❄️ Nguyên Tố Pháp Sư (Mage)
        if (slotNum === 1) this.castFrostNova(targetPos, character, monsters);
        else if (slotNum === 2) this.castWindDash(targetPos, character, monsters);
        else if (slotNum === 3) this.castNetherVortex(targetPos, character, monsters);
        else if (slotNum === 4) this.castSwordRain(targetPos, character, monsters);
        break;

      case 3: // 🔥 Cuồng Chiến Đấu Sĩ (Bruiser)
        if (slotNum === 1) this.castBloodSlash(targetPos, character, monsters);
        else if (slotNum === 2) this.castBerserkerLeap(targetPos, character, monsters);
        else if (slotNum === 3) this.castBerserkerRoar(character, monsters);
        else if (slotNum === 4) this.castHellfireCataclysm(targetPos, character, monsters);
        break;

      case 4: // 🏹 Thần Tiễn Xạ Thủ (Marksman)
        if (slotNum === 1) this.castChainLightning(targetPos, character, monsters);
        else if (slotNum === 2) this.castCraneGlide(targetPos, character, monsters);
        else if (slotNum === 3) this.castEarthquakeStomp(targetPos, character, monsters);
        else if (slotNum === 4) this.castWanJianGuiZong(targetPos, character, monsters);
        break;

      case 5: // 🇻🇳 Chiến Sĩ NAMCAM (Vai trò ẩn)
        if (slotNum === 1) this.castToxicFart(targetPos, character, monsters);
        else if (slotNum === 2) this.castKioskStrike(targetPos, character, monsters);
        else if (slotNum === 3) this.castNamcamSquad(targetPos, character, monsters);
        else if (slotNum === 4) this.castGiantRobotSummon(targetPos, character, monsters);
        break;
    }

    return true;
  }

  // --- [Hộ Vệ 1] KHIÊN KÍCH XUNG PHONG ---
  // Giương Đại Khiên Hoàng Kim chữ V húc thẳng 13m để lại 4 tàn ảnh khiên vàng, tông văng mọi kẻ địch, gây 115 ST và Làm Choáng 1.4s
  castShieldCharge(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(1);
    const dir = PixelFXManager.flatDirection(character.position, targetPos);
    const dashDistance = 13.0;
    const dashDuration = 0.34;
    character.startDash(dir, dashDistance, dashDuration);
    sound.playSwordSlash();
    if (this.controller) this.controller.addTrauma(0.35);

    // Dựng Đầu Phá Thành Hoàng Kim chữ V nhiều lớp trước ngực khi húc
    const shieldWall = new THREE.Group();
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0xf6b93b,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wingGeo = new THREE.BoxGeometry(1.75, 2.3, 0.25);
    const leftWing = new THREE.Mesh(wingGeo, wallMat);
    leftWing.position.set(-0.72, 0, -0.22);
    leftWing.rotation.y = 0.38;
    const rightWing = new THREE.Mesh(wingGeo, wallMat);
    rightWing.position.set(0.72, 0, -0.22);
    rightWing.rotation.y = -0.38;

    const crestGeo = new THREE.OctahedronGeometry(0.55, 0);
    const crestMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    const crestMesh = new THREE.Mesh(crestGeo, crestMat);
    crestMesh.position.set(0, 0.1, 0.25);

    const rimGeo = new THREE.RingGeometry(1.2, 1.75, 6);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xffeaa7, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.z = 0.18;
    shieldWall.add(leftWing, rightWing, crestMesh, rimMesh);
    this.scene.add(shieldWall);

    // Tàn ảnh khiên vàng để lại dọc đường húc
    const afterimages = [];
    let nextGhostTime = 0.05;

    const hitSet = new Set();
    const hitPlayersSet = new Set();
    let elapsed = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const cPos = character.position.clone();
        shieldWall.position.copy(cPos).add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(dir, 1.15);
        shieldWall.rotation.y = Math.atan2(dir.x, dir.z);
        crestMesh.rotation.z += delta * 12;

        // Để lại 4 tàn ảnh lá chắn lục giác trên đường xung phong
        if (elapsed >= nextGhostTime && elapsed < dashDuration) {
          nextGhostTime += 0.075;
          const ghostMat = new THREE.MeshBasicMaterial({
            color: 0xf6b93b,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const ghostMesh = new THREE.Mesh(rimGeo, ghostMat);
          ghostMesh.position.copy(shieldWall.position);
          ghostMesh.rotation.y = shieldWall.rotation.y;
          this.scene.add(ghostMesh);
          afterimages.push({ mesh: ghostMesh, mat: ghostMat });
        }

        for (const g of afterimages) {
          g.mat.opacity = Math.max(0, g.mat.opacity - delta * 2.2);
          g.mesh.scale.multiplyScalar(1 + delta * 1.2);
        }

        if (this.particles && Math.random() < 0.9) {
          this.particles.emitElementalParticles(shieldWall.position, 4, [0xf6b93b, 0xffd32a, 0xffffff], [1, 4], 0.25, 0, 0.45);
        }

        // Tông trúng quái vật trên đường húc
        for (const m of monsters || []) {
          if (m.isDead || hitSet.has(m)) continue;
          if (m.checkCollision(cPos, 2.3)) {
            hitSet.add(m);
            this.damageMonster(m, 115, '🛡️ -115 KHIÊN KÍCH!', '#f6b93b', cPos, character);
            if (m.knockback) m.knockback(cPos, 16);
            if (m.freeze) m.freeze(1.4);
            this.spawnStunHalo(m, 1.4, 0xffd32a);
            sound.playHit();
          }
        }

        // Tông trúng người chơi khác trong PvP
        const newlyHit = this.damagePlayersNear(cPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 2.3, 115, '🛡️ -115 KHIÊN KÍCH!', '#f6b93b', character, hitPlayersSet);
        for (const rp of newlyHit) {
          if (rp.freeze) rp.freeze(1.4);
          this.spawnStunHalo(rp, 1.4, 0xffd32a);
        }

        if (elapsed >= dashDuration) {
          // Dậm khiên chấn động tại điểm dừng
          const slamPos = character.position.clone();
          slamPos.y = getTerrainHeight(slamPos.x, slamPos.z);
          if (this.particles) {
            this.particles.emitShockwave(slamPos, 0xf6b93b, 7.0, 0.4);
            this.particles.emitShockwave(slamPos, 0xffffff, 4.2, 0.25);
            this.particles.emitHitSparkles(slamPos, 24);
          }
          this.freezeArea(slamPos, 4.5, 1.2, monsters, character);
          this.scene.remove(shieldWall);
          for (const g of afterimages) {
            this.scene.remove(g.mesh);
            g.mat.dispose();
          }
          wingGeo.dispose();
          wallMat.dispose();
          crestGeo.dispose();
          crestMat.dispose();
          rimGeo.dispose();
          rimMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // --- [Hộ Vệ 2] THIẾT GIÁP PHẢN CHẤN ---
  // Hồi ngay +220 HP, kích hoạt 0.85s Parry, miễn khống chế 2.5s và dựng 6 Khiên Hoàng Kim Xoay + Vòm Phản Đòn 5s
  castGuardianBulwark(character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(2);
    sound.playSwordSummon();
    if (this.controller) this.controller.addTrauma(0.28);

    if (character) {
      character.heal(220);
      if (character.setParry) character.setParry(0.85);
      character.statusResistTimer = Math.max(character.statusResistTimer || 0, 2.5);
      character.shieldReflectTimer = 5.0;
      character.freezeTimer = 0;
      character.slowTimer = 0;
      this.damageTexts.spawn('🔰 +220 HP & KHIÊN PHẢN ĐÒN (5s)!', character.position.clone().add(new THREE.Vector3(0, 2.4, 0)), '#f6b93b');
    }

    // Vòm hào quang lục giác Hoàng Kim + 6 Khiên Tháp 3D xoay quanh Hộ Vệ suốt 5s
    const auraGroup = new THREE.Group();
    const domeGeo = new THREE.IcosahedronGeometry(1.78, 1);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0xf6b93b,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 1.15;
    auraGroup.add(dome);

    const ringGeo = new THREE.RingGeometry(1.7, 2.15, 6);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd32a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.1;
    auraGroup.add(ring);

    // 6 tấm Khiên Tháp Hoàng Kim 3D bay quanh thân
    const orbitShieldGroup = new THREE.Group();
    orbitShieldGroup.position.y = 1.15;
    const miniShieldGeo = new THREE.CylinderGeometry(0.42, 0.34, 0.1, 6);
    miniShieldGeo.rotateX(Math.PI / 2);
    const miniShieldMat = new THREE.MeshStandardMaterial({
      color: 0xf6b93b,
      emissive: 0xe58e26,
      emissiveIntensity: 0.5,
      roughness: 0.25,
      metalness: 0.6,
      flatShading: true,
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sMesh = new THREE.Mesh(miniShieldGeo, miniShieldMat);
      sMesh.position.set(Math.cos(a) * 1.95, 0, Math.sin(a) * 1.95);
      sMesh.lookAt(0, 0, 0);
      orbitShieldGroup.add(sMesh);
    }
    auraGroup.add(orbitShieldGroup);
    this.scene.add(auraGroup);

    if (this.particles && character) {
      this.particles.emitShockwave(character.position, 0xf6b93b, 6.5, 0.38);
      this.particles.emitElementalParticles(character.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 28, [0xf6b93b, 0xffd32a, 0xffffff], [2, 7], 0.45, 2, 0.9);
    }

    const duration = 5.0;
    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        if (!character || character.isDead || elapsed >= duration) {
          this.scene.remove(auraGroup);
          domeGeo.dispose();
          domeMat.dispose();
          ringGeo.dispose();
          ringMat.dispose();
          miniShieldGeo.dispose();
          miniShieldMat.dispose();
          return false;
        }
        auraGroup.position.copy(character.position);
        dome.rotation.y += delta * 2.2;
        orbitShieldGroup.rotation.y -= delta * 3.8;
        orbitShieldGroup.position.y = 1.15 + Math.sin(elapsed * 5) * 0.12;
        ring.rotation.z -= delta * 3.0;
        domeMat.opacity = 0.42 + Math.sin(elapsed * 8) * 0.2;
        return true;
      }
    });
  }

  // --- [Hộ Vệ 3] ĐỊA CHẤN KHIÊU KHÍCH ---
  // Nện Đại Khiên chấn động 11m mọc 10 trụ đá nhọn, phóng Xích Hoàng Kim kéo hút toàn bộ kẻ địch về phía Hộ Vệ
  castTauntQuake(character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(3);
    const center = character.position.clone();
    center.y = getTerrainHeight(center.x, center.z);
    const radius = 11.0;

    sound.playGiantSwordImpact();
    if (this.controller) this.controller.addTrauma(0.58);
    if (this.onScreenFlash) this.onScreenFlash('earth');

    this.spawnGroundDecalEffect('earth', new THREE.Vector3(center.x, center.y + 0.1, center.z), radius * 1.8, 1.8);
    if (this.particles) {
      this.particles.emitShockwave(center, 0xf6b93b, radius, 0.48);
      this.particles.emitShockwave(center, 0xffffff, radius * 0.65, 0.3);
      this.particles.emitElementalParticles(center, 45, [0xf6b93b, 0xe67e22, 0xffffff], [3, 9], 0.6, 3, 1.1);
    }

    // 10 Cọc Đá Địa Chấn trồi lên thành vòng vây quanh Hộ Vệ
    const rockGroup = new THREE.Group();
    const rockGeo = new THREE.ConeGeometry(0.65, 2.6, 5);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xb33939,
      emissive: 0xf6b93b,
      emissiveIntensity: 0.45,
      roughness: 0.7,
      flatShading: true,
    });
    const spikes = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = 4.2 + (i % 2) * 2.4;
      const sx = center.x + Math.cos(a) * r;
      const sz = center.z + Math.sin(a) * r;
      const sy = getTerrainHeight(sx, sz);
      const m = new THREE.Mesh(rockGeo, rockMat);
      m.position.set(sx, sy - 1.5, sz);
      m.rotation.z = Math.cos(a) * 0.25;
      m.rotation.x = -Math.sin(a) * 0.25;
      rockGroup.add(m);
      spikes.push({ mesh: m, targetY: sy + 1.0 });
    }
    this.scene.add(rockGroup);

    let rockElapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        rockElapsed += delta;
        for (const s of spikes) {
          if (rockElapsed < 0.2) {
            s.mesh.position.y = THREE.MathUtils.lerp(s.targetY - 2.2, s.targetY, rockElapsed / 0.2);
          } else if (rockElapsed > 1.1) {
            s.mesh.position.y -= delta * 3.5;
          }
        }
        if (rockElapsed >= 1.5) {
          this.scene.remove(rockGroup);
          rockGeo.dispose();
          rockMat.dispose();
          return false;
        }
        return true;
      }
    });

    this.dealDamageAOE(center, radius, 130, '🛡️ -130 KHIÊU KHÍCH!', '#f6b93b', monsters, null, 'earth', 22.0, character);

    // Phóng Xích Hoàng Kim kéo hút quái vật và người chơi khác trong 11m về gần Hộ Vệ & làm choáng nhẹ
    const tankChest = center.clone().add(new THREE.Vector3(0, 1.2, 0));
    for (const m of monsters || []) {
      if (m.isDead) continue;
      const d = m.position.distanceTo(center);
      if (d <= radius && d > 2.2) {
        this.spawnLightningArc(tankChest, m.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 0xf6b93b, 0.45);
        m.position.lerp(center, 0.55);
        if (m.freeze) m.freeze(0.8);
        this.spawnStunHalo(m, 0.8, 0xf6b93b);
      }
    }
    if (this.canHitPlayers(character) && this.remotePlayers) {
      for (const rp of this.remotePlayers) {
        if (rp.isDead) continue;
        const d = rp.position.distanceTo(center);
        if (d <= radius && d > 2.0) {
          this.spawnLightningArc(tankChest, rp.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xf6b93b, 0.45);
          rp.position.lerp(center, 0.48);
          if (rp.slow) rp.slow(3.0, 0.5);
        }
      }
    }
  }

  // --- [Sát Thủ 2] MÀN SƯƠNG ẨN THÂN ---
  // Bom khói tím 3D giải mọi khống chế, vào Thế Parry 0.8s, nổ bóng tối 85 ST, +45% tốc chạy & choàng Áo Choàng Ám Ảnh 3.5s
  castShadowVeil(character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(2);
    const center = character.position.clone();
    center.y = getTerrainHeight(center.x, center.z);

    sound.playSwordSlash();
    if (character) {
      character.freezeTimer = 0;
      character.slowTimer = 0;
      character.speedBoostTimer = 3.5;
      if (character.setParry) character.setParry(0.8);
      this.damageTexts.spawn('🌑 ẨN THÂN +45% TỐC & PARRY!', center.clone().add(new THREE.Vector3(0, 2.3, 0)), '#c084fc');
    }

    // 1. Bom khói 3D phồng to (14 khối cầu khói tím đen + vòng phi tiêu xoay)
    const smokeGroup = new THREE.Group();
    smokeGroup.position.copy(center);
    const puffGeo = new THREE.DodecahedronGeometry(0.85, 1);
    const puffMat = new THREE.MeshBasicMaterial({
      color: 0x3b1e54,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const puffs = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 0.8 + (i % 3) * 1.1;
      const m = new THREE.Mesh(puffGeo, puffMat);
      m.position.set(Math.cos(a) * r * 0.4, 0.5 + (i % 2) * 0.4, Math.sin(a) * r * 0.4);
      smokeGroup.add(m);
      puffs.push({ mesh: m, vx: Math.cos(a) * (2.5 + (i % 3)), vy: 0.8 + Math.random() * 1.2, vz: Math.sin(a) * (2.5 + (i % 3)) });
    }
    this.scene.add(smokeGroup);

    // 2. Hào quang Ám Ảnh bám theo Sát Thủ suốt 3.5s tăng tốc
    const cloakGroup = new THREE.Group();
    const cloakRingGeo = new THREE.TorusGeometry(1.1, 0.05, 6, 24);
    cloakRingGeo.rotateX(Math.PI / 2);
    const cloakRingMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const cloakRing = new THREE.Mesh(cloakRingGeo, cloakRingMat);
    cloakRing.position.y = 0.9;
    cloakGroup.add(cloakRing);
    this.scene.add(cloakGroup);

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        if (elapsed < 1.1) {
          for (const p of puffs) {
            p.mesh.position.x += p.vx * delta;
            p.mesh.position.y += p.vy * delta;
            p.mesh.position.z += p.vz * delta;
            p.mesh.scale.multiplyScalar(1 + delta * 1.4);
          }
          puffMat.opacity = Math.max(0, 0.72 * (1 - elapsed / 1.1));
        } else if (smokeGroup.parent) {
          this.scene.remove(smokeGroup);
        }

        if (character && !character.isDead && elapsed < 3.5) {
          cloakGroup.position.copy(character.position);
          cloakRing.rotation.z += delta * 8.0;
          cloakRing.position.y = 0.9 + Math.sin(elapsed * 10) * 0.25;
          if (this.particles && Math.random() < 0.45) {
            this.particles.emitElementalParticles(character.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 1, [0xa55eea, 0xc084fc, 0x1e272e], [1, 3], 0.25, 0, 0.4);
          }
          return true;
        }

        if (smokeGroup.parent) this.scene.remove(smokeGroup);
        this.scene.remove(cloakGroup);
        puffGeo.dispose();
        puffMat.dispose();
        cloakRingGeo.dispose();
        cloakRingMat.dispose();
        return false;
      }
    });

    if (this.particles) {
      this.particles.emitShockwave(center, 0xa55eea, 7.5, 0.35);
      this.particles.emitElementalParticles(center, 36, [0xa55eea, 0xc084fc, 0x1e272e], [2, 7], 0.55, 2, 0.9);
    }

    this.dealDamageAOE(center, 6.5, 115, '🌑 -115 ÁM VỤ!', '#c084fc', monsters, null, 'dark', 12.0, character);
  }

  // --- [Sát Thủ 4 - Ult] TUYỆT MỆNH LIÊN TRẢM (OMNISLASH) ---
  // Triệu hồi 5 Phân Thân Ám Ảnh quanh vòng kết giới, liên hoàn trảm 5 nhát ngôi sao 5 cánh (55 ST/nhát) rồi giáng Đại Liêm Chữ X 180 ST!
  castPhantomOmnislash(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(4);
    const center = targetPos ? targetPos.clone() : character.position.clone();
    center.y = getTerrainHeight(center.x, center.z);
    const radius = 8.5;

    sound.playSwordSlash();
    if (this.controller) this.controller.addTrauma(0.5);
    if (this.onScreenFlash) this.onScreenFlash('sword');

    if (character) {
      character.isInvulnerable = true;
      character.statusResistTimer = Math.max(character.statusResistTimer || 0, 1.4);
    }

    // Vòng kết giới Ám Ảnh dưới đất
    const ringGeo = new THREE.RingGeometry(radius - 0.35, radius, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(center.x, center.y + 0.12, center.z);
    this.scene.add(ring);

    // 5 Phân Thân Bóng Tối 3D đứng quanh rìa kết giới
    const phantomGroup = new THREE.Group();
    const phantomGeo = new THREE.ConeGeometry(0.48, 1.75, 5);
    const phantomMat = new THREE.MeshBasicMaterial({
      color: 0xa55eea,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
    });
    const phantoms = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pMesh = new THREE.Mesh(phantomGeo, phantomMat);
      pMesh.position.set(center.x + Math.cos(a) * radius * 0.88, center.y + 0.95, center.z + Math.sin(a) * radius * 0.88);
      pMesh.lookAt(center.x, center.y + 0.95, center.z);
      phantomGroup.add(pMesh);
      phantoms.push(pMesh);
    }
    this.scene.add(phantomGroup);

    const slashLines = [];
    const totalStrikes = 5;
    const strikeInterval = 0.18;
    let strikesDone = 0;
    let strikeTimer = 0;
    let elapsed = 0;
    let finished = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        strikeTimer += delta;
        ring.rotation.z += delta * 5;

        // Liên hoàn 5 nhát chém tàn ảnh tạo hình Ngôi Sao 5 Cánh (Pentagram)
        if (strikesDone < totalStrikes && strikeTimer >= strikeInterval) {
          strikeTimer = 0;
          const idx1 = (strikesDone * 2) % 5;
          const idx2 = ((strikesDone + 1) * 2) % 5;
          strikesDone++;

          const a1 = (idx1 / 5) * Math.PI * 2;
          const a2 = (idx2 / 5) * Math.PI * 2;
          const p1 = new THREE.Vector3(center.x + Math.cos(a1) * radius * 0.88, center.y + 1.2, center.z + Math.sin(a1) * radius * 0.88);
          const p2 = new THREE.Vector3(center.x + Math.cos(a2) * radius * 0.88, center.y + 1.2, center.z + Math.sin(a2) * radius * 0.88);

          // Di chuyển Sát Thủ chớp nhoáng theo nhát chém
          if (character && !character.isDead) {
            character.position.set(p2.x, getTerrainHeight(p2.x, p2.z), p2.z);
            character.targetRotationY = Math.atan2(p2.x - p1.x, p2.z - p1.z);
          }

          // Vệt kiếm quang tím hồng cắt ngang không trung
          const lineLen = p1.distanceTo(p2);
          const beamMat = new THREE.MeshBasicMaterial({
            color: strikesDone % 2 === 0 ? 0xc084fc : 0xff79c6,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
          });
          const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, lineLen), beamMat);
          beam.position.lerpVectors(p1, p2, 0.5);
          beam.lookAt(p2);
          this.scene.add(beam);
          slashLines.push({ mesh: beam, mat: beamMat });

          sound.playSwordSlash();
          if (this.particles) {
            this.particles.emitElementalParticles(center, 16, [0xc084fc, 0xa55eea, 0xffffff], [2, 6], 0.35, 1, 0.5);
          }
          this.dealDamageAOE(center, radius, 55, `🗡️ -55 LIÊN TRẢM (${strikesDone}/${totalStrikes})`, '#c084fc', monsters, null, 'dark', 8.0, character);
        }

        // Nhát kết liễu Chữ X Khổng Lồ giáng vào tâm ở 1.05s
        if (!finished && elapsed >= 1.05) {
          finished = true;
          if (character && !character.isDead) {
            character.position.set(center.x, center.y, center.z);
            character.isInvulnerable = false;
          }
          // Tạo chữ X Tử Thần 3D khổng lồ tại tâm
          for (const crossAngle of [Math.PI / 4, -Math.PI / 4]) {
            const xMat = new THREE.MeshBasicMaterial({
              color: 0xff79c6,
              transparent: true,
              opacity: 1.0,
              blending: THREE.AdditiveBlending,
            });
            const xMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, radius * 2.1), xMat);
            xMesh.position.set(center.x, center.y + 1.1, center.z);
            xMesh.rotation.y = crossAngle;
            this.scene.add(xMesh);
            slashLines.push({ mesh: xMesh, mat: xMat });
          }

          sound.playGiantSwordImpact();
          if (this.controller) this.controller.addTrauma(0.68);
          if (this.particles) {
            this.particles.emitShockwave(center, 0xc084fc, radius * 1.45, 0.48);
            this.particles.emitShockwave(center, 0xffffff, radius * 0.95, 0.32);
            this.particles.emitHitSparkles(center, 40);
          }
          this.dealDamageAOE(center, radius, 180, '💀 -180 TUYỆT MỆNH TRẢM!', '#ff79c6', monsters, 'knockback', 'dark', 35.0, character);
        }

        if (elapsed >= 1.4) {
          if (character) character.isInvulnerable = false;
          this.scene.remove(ring);
          this.scene.remove(phantomGroup);
          ringGeo.dispose();
          ringMat.dispose();
          phantomGeo.dispose();
          phantomMat.dispose();
          for (const sl of slashLines) {
            this.scene.remove(sl.mesh);
            sl.mesh.geometry.dispose();
            sl.mat.dispose();
          }
          return false;
        }
        return true;
      }
    });
  }

  // --- [Đấu Sĩ 2] KHÔNG KÍCH ĐỊA LIỆT ---
  // Nhảy vọt lên không trung kèm vòng lửa Cự Phủ rồi bổ mạnh xuống (tối đa 14m), phun trào 8 cột dung nham gây 135 ST & chấn địa
  castBerserkerLeap(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(2);
    const startPos = character.position.clone();
    const rawDir = new THREE.Vector3(targetPos.x - startPos.x, 0, targetPos.z - startPos.z);
    const dist = Math.min(14.0, rawDir.length());
    const dir = rawDir.lengthSq() > 0.001 ? rawDir.normalize() : new THREE.Vector3(0, 0, -1);
    const landPos = startPos.clone().addScaledVector(dir, dist);
    landPos.y = getTerrainHeight(landPos.x, landPos.z);

    this.spawnTelegraph(landPos, 0xff5252, 0.42, 6.5);
    sound.playSwordSlash();

    // Vòng lửa Cự Phủ xoay quanh Đấu Sĩ khi đang bật nhảy trên không
    const leapHaloGeo = new THREE.TorusGeometry(1.3, 0.12, 6, 20);
    const leapHaloMat = new THREE.MeshBasicMaterial({
      color: 0xff5252,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const leapHalo = new THREE.Mesh(leapHaloGeo, leapHaloMat);
    this.scene.add(leapHalo);

    const duration = 0.42;
    let elapsed = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const t = Math.min(1.0, elapsed / duration);
        if (character && !character.isDead) {
          character.position.x = THREE.MathUtils.lerp(startPos.x, landPos.x, t);
          character.position.z = THREE.MathUtils.lerp(startPos.z, landPos.z, t);
          const baseH = THREE.MathUtils.lerp(startPos.y, landPos.y, t);
          character.position.y = baseH + Math.sin(t * Math.PI) * 5.6;
          leapHalo.position.copy(character.position).add(new THREE.Vector3(0, 1.1, 0));
          leapHalo.rotation.x += delta * 18;
          leapHalo.rotation.y += delta * 12;
        }

        if (this.particles && Math.random() < 0.85) {
          this.particles.emitElementalParticles(character.position, 3, [0xff5252, 0xff793f, 0xffd32a], [1, 4], 0.28, 0, 0.45);
        }

        if (t >= 1.0) {
          this.scene.remove(leapHalo);
          leapHaloGeo.dispose();
          leapHaloMat.dispose();

          if (character && !character.isDead) {
            character.position.copy(landPos);
          }
          sound.playGiantSwordImpact();
          if (this.controller) this.controller.addTrauma(0.6);
          if (this.onScreenFlash) this.onScreenFlash('fire');
          this.spawnGroundDecalEffect('fire', new THREE.Vector3(landPos.x, landPos.y + 0.1, landPos.z), 11.0, 1.6);

          // 8 Cột Lửa Dung Nham 3D phun trào quanh điểm bổ rìu
          const lavaGroup = new THREE.Group();
          const lavaGeo = new THREE.ConeGeometry(0.55, 3.2, 6);
          const lavaMat = new THREE.MeshBasicMaterial({
            color: 0xff5252,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
          });
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r = 3.2;
            const pillar = new THREE.Mesh(lavaGeo, lavaMat);
            pillar.position.set(landPos.x + Math.cos(a) * r, landPos.y + 1.4, landPos.z + Math.sin(a) * r);
            lavaGroup.add(pillar);
          }
          this.scene.add(lavaGroup);
          let lavaTime = 0;
          this.activeEffects.push({
            update: (dt) => {
              lavaTime += dt;
              lavaGroup.position.y += dt * 1.8;
              lavaMat.opacity = Math.max(0, 0.9 * (1 - lavaTime / 0.55));
              if (lavaTime >= 0.55) {
                this.scene.remove(lavaGroup);
                lavaGeo.dispose();
                lavaMat.dispose();
                return false;
              }
              return true;
            }
          });

          if (this.particles) {
            this.particles.emitShockwave(landPos, 0xff5252, 8.8, 0.42);
            this.particles.emitShockwave(landPos, 0xffd32a, 5.2, 0.28);
            this.particles.emitElementalParticles(landPos, 40, [0xff5252, 0xff793f, 0xffd32a], [3, 9], 0.55, 4, 1.0);
          }
          this.dealDamageAOE(landPos, 6.5, 135, '🪓 -135 ĐỊA LIỆT!', '#ff5252', monsters, 'knockback', 'fire', 28.0, character);
          return false;
        }
        return true;
      }
    });
  }

  // --- [Đấu Sĩ 3] HUYẾT CUỒNG CHIẾN HỐNG ---
  // Giải mọi làm chậm/đóng băng, hồi +160 HP, nổ lửa 80 ST quanh thân và dựng Lốc Lửa Huyết Cuồng 5s (+35% tốc chạy & +22% tốc đánh)
  castBerserkerRoar(character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(3);
    const center = character.position.clone();
    center.y = getTerrainHeight(center.x, center.z);

    sound.playGiantSwordImpact();
    if (this.controller) this.controller.addTrauma(0.4);

    if (character) {
      character.freezeTimer = 0;
      character.slowTimer = 0;
      character.statusResistTimer = Math.max(character.statusResistTimer || 0, 2.0);
      character.berserkTimer = 5.0;
      character.heal(160);
      this.damageTexts.spawn('🔥 HUYẾT CUỒNG +160 HP & TĂNG TỐC!', center.clone().add(new THREE.Vector3(0, 2.4, 0)), '#ff5252');
    }

    // Lốc Lửa Huyết Cuồng 3D bám theo Đấu Sĩ suốt 5s
    const rageGroup = new THREE.Group();
    const vortexGeo = new THREE.CylinderGeometry(1.85, 0.95, 2.6, 12, 1, true);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0xff5252,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
    vortexMesh.position.y = 1.3;
    rageGroup.add(vortexMesh);

    const baseRingGeo = new THREE.RingGeometry(1.3, 1.8, 24);
    baseRingGeo.rotateX(-Math.PI / 2);
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: 0xffd32a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.position.y = 0.1;
    rageGroup.add(baseRing);
    this.scene.add(rageGroup);

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        if (!character || character.isDead || elapsed >= 5.0) {
          this.scene.remove(rageGroup);
          vortexGeo.dispose();
          vortexMat.dispose();
          baseRingGeo.dispose();
          baseRingMat.dispose();
          return false;
        }
        rageGroup.position.copy(character.position);
        vortexMesh.rotation.y += delta * 6.5;
        baseRing.rotation.z -= delta * 4.5;
        vortexMat.opacity = 0.45 + Math.sin(elapsed * 10) * 0.2;
        return true;
      }
    });

    if (this.particles) {
      this.particles.emitShockwave(center, 0xff5252, 8.5, 0.42);
      this.particles.emitShockwave(center, 0xffd32a, 5.5, 0.28);
      this.particles.emitElementalParticles(center, 36, [0xff5252, 0xff793f, 0xffd32a], [2, 7], 0.5, 2, 0.8);
    }
    this.dealDamageAOE(center, 6.5, 80, '🔥 -80 CHIẾN HỐNG!', '#ff5252', monsters, 'knockback', 'fire', 18.0, character);
  }

  // --- [Đạo Gia 4] THIÊN LÔI PHẠT THẾ ---
  // 20 giây sấm sét cực mạnh từ trời giáng xuống liên tục trong 60m quanh người ra chiêu: có địch (quái, người chơi,
  // đạo ảnh) thì đánh thẳng vào địch, không có địch thì vẫn giáng xuống mặt đất khắp vùng. Mây giông đen che trời
  // và vòng ranh giới 60m đi theo người ra chiêu. Không phá hoại cảnh vật, chỉ trúng địch.
  // Chỉ máy của người ra chiêu mới báo sát thương PvP (xem canHitPlayers); máy khác chỉ dựng lại hiệu ứng.
  castHeavenlyThunder(character, monsters) {
    const DURATION = 20;
    const RANGE = 60;
    const STRIKE_INTERVAL = 0.25;   // 4 tia mỗi giây
    const DAMAGE = 120;             // mỗi tia: một địch đứng một mình chịu ~480 ST/giây
    const STRIKE_RADIUS = 4.0;
    const CLOUD_HEIGHT = 45;
    const isLocal = character === this.localCharacter;

    sound.playThunder();
    if (isLocal) {
      if (this.onScreenFlash) this.onScreenFlash('lightning');
      if (this.controller) this.controller.addTrauma(0.6);
    }

    // Mây giông và vòng ranh giới 60m
    const cloudGeo = new THREE.CircleGeometry(RANGE, 48);
    cloudGeo.rotateX(-Math.PI / 2);
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0x241b3f, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    this.scene.add(cloud);

    const ringGeo = new THREE.RingGeometry(RANGE - 0.7, RANGE, 96);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xa29bfe, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.scene.add(ring);

    let elapsed = 0;
    let strikeTimer = 0.3;
    let tick = 0;
    let lastSound = 0;
    let lastFlash = 0;

    // Một tia sét giáng xuống điểm to (vector thế giới)
    const strike = (to, damaging) => {
      const from = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 40, (Math.random() - 0.5) * 8));
      if (this.cloneManager) this.cloneManager.spawnBolt(from, to, 'storm');
      if (!damaging) return;
      const text = `⚡ -${DAMAGE}`;
      for (const m of monsters || []) {
        if (m.isDead) continue;
        if (Math.hypot(m.position.x - to.x, m.position.z - to.z) <= STRIKE_RADIUS + m.hitRadius) {
          this.damageMonster(m, DAMAGE, text, '#a29bfe', to);
        }
      }
      this.damagePlayersNear(to, STRIKE_RADIUS, DAMAGE, text, '#a29bfe', character);
    };

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const c = character.position;
        const fade = Math.max(0, Math.min(1, elapsed / 0.6, (DURATION + 0.4 - elapsed) / 0.8));
        const flicker = 0.88 + 0.12 * Math.sin(elapsed * 11);
        cloud.position.set(c.x, c.y + CLOUD_HEIGHT, c.z);
        cloudMat.opacity = 0.5 * fade * flicker;
        ring.position.set(c.x, getTerrainHeight(c.x, c.z) + 0.15, c.z);
        ringMat.opacity = 0.45 * fade * flicker;

        if (elapsed < DURATION && !character.isDead) {
          strikeTimer -= delta;
          let burst = 0;
          while (strikeTimer <= 0 && burst < 3) {
            strikeTimer += STRIKE_INTERVAL;
            burst++;
            tick++;

            // Chọn ngẫu nhiên một kẻ địch còn sống trong 60m
            const targets = [];
            const inRange = (p) => Math.hypot(p.x - c.x, p.z - c.z) <= RANGE;
            for (const m of monsters || []) {
              if (!m.isDead && inRange(m.position)) targets.push(m.position);
            }
            for (const rp of this.remotePlayers || []) {
              if (!rp.isDead && inRange(rp.position)) targets.push(rp.position);
            }

            if (targets.length) {
              const p = targets[Math.floor(Math.random() * targets.length)];
              strike(new THREE.Vector3(p.x, p.y + 1.0, p.z), true);
            } else {
              // Không có địch: sấm vẫn giáng xuống liên tục từ trời tới mặt đất khắp vùng 60m (chỉ là hiệu ứng)
              const a = Math.random() * Math.PI * 2;
              const r = 5 + Math.sqrt(Math.random()) * (RANGE - 8);
              const x = c.x + Math.cos(a) * r;
              const z = c.z + Math.sin(a) * r;
              strike(new THREE.Vector3(x, getTerrainHeight(x, z) + 0.3, z), false);
            }

            const now = performance.now();
            const near = isLocal || (this.localCharacter && this.localCharacter.position.distanceTo(c) <= RANGE);
            if (near && now - lastSound > 350) {
              lastSound = now;
              sound.playThunder();
            }
            if (isLocal && now - lastFlash > 1100) {
              lastFlash = now;
              if (this.onScreenFlash) this.onScreenFlash('lightning');
            }
            if (isLocal && this.controller) this.controller.addTrauma(0.06);
          }
        }

        if (elapsed >= DURATION + 0.5) {
          this.scene.remove(cloud);
          this.scene.remove(ring);
          cloudGeo.dispose();
          cloudMat.dispose();
          ringGeo.dispose();
          ringMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // PvP: chỉ máy của người ra chiêu mới báo sát thương lên người chơi khác,
  // skill của người khác được chạy lại trên máy mình chỉ để hiện hiệu ứng → không báo trùng
  canHitPlayers(caster) {
    return Boolean(caster && caster === this.localCharacter && this.onHitPlayer);
  }

  // Gây sát thương lên mọi người chơi khác trong bán kính radius quanh point.
  // hitSet (tuỳ chọn) chứa id đã trúng để mỗi đòn chỉ tính một lần. Trả về danh sách người bị trúng.
  damagePlayersNear(point, radius, amount, text, textColor, caster, hitSet = null) {
    const hit = [];
    if (!this.canHitPlayers(caster)) return hit;
    const attackerRole = caster?.outfitIndex ?? this.currentSectIndex;
    for (const rp of this.remotePlayers) {
      if (rp.isDead || (hitSet && hitSet.has(rp.id))) continue;
      if (!rp.checkBulletCollision(point, radius)) continue;
      if (hitSet) hitSet.add(rp.id);
      const targetRole = rp.outfitIndex ?? -1;
      const counterMult = getRoleCounterMultiplier(attackerRole, targetRole);
      const finalAmount = Math.round(amount * counterMult);
      const hitPos = rp.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      this.onHitPlayer(rp.id, finalAmount, hitPos, 'sword', counterMult > 1.05, false);
      const finalText = counterMult > 1.05 ? `${text} 💥KHẮC CHẾ` : text;
      this.damageTexts.spawn(finalText, hitPos.clone().add(new THREE.Vector3(0, 0.6, 0)), counterMult > 1.05 ? '#ffd700' : textColor);
      if (this.particles) this.particles.emitHitSparkles(hitPos, 14);
      hit.push(rp);
    }
    return hit;
  }

  // Gây sát thương lên một con quái kèm số sát thương nhảy lên (áp dụng Khắc Chế Vai Trò)
  damageMonster(monster, amount, text, textColor, sourcePos, caster = null) {
    const attackerRole = caster?.outfitIndex ?? this.currentSectIndex;
    const monsterRole = getMonsterRoleIndex(monster);
    const counterMult = getRoleCounterMultiplier(attackerRole, monsterRole);
    const finalAmount = Math.round(amount * counterMult);
    monster.takeDamage(finalAmount, sourcePos);
    const hitPos = monster.position.clone();
    hitPos.y += monster.hitHeight * 0.7;
    const finalText = counterMult > 1.05 ? `${text} 💥KHẮC CHẾ` : text;
    this.damageTexts.spawn(finalText, hitPos, counterMult > 1.05 ? '#ffd700' : textColor);
    if (this.particles) this.particles.emitHitSparkles(hitPos, 10);
  }

  // Hướng ngang từ from tới to (dùng hướng mặc định nếu trùng điểm)
  static flatDirection(from, to) {
    const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
    return dir.lengthSq() > 0.0001 ? dir.normalize() : new THREE.Vector3(0, 0, -1);
  }

  // --- KIẾM CHIÊU 1: CỰ KIẾM PHÁ THIÊN ---
  // Thanh kiếm đang cầm phóng to ra thành cự kiếm lớn hơn cả bản thể rồi phóng thẳng 50m.
  // Cự kiếm (dọc cả lưỡi) tông trúng quái nào là gây sát thương; hết tầm thì nổ ở mũi kiếm,
  // kiếm nhỏ hiện lại trên tay.
  castFlyingSword(targetPos, character, monsters) {
    const RANGE = 50;
    const SPEED = 16;
    const SWORD_DAMAGE = 120;
    const BLAST_RADIUS = 8;
    const BLAST_DAMAGE = 80;
    const SWORD_SCALE = 4.0;                          // kiếm phóng to 4 lần: dài ~5m, gấp ~2.5 lần nhân vật
    const SWORD_WIDEN = 1.8;                          // lưỡi bản rộng hơn 1.8 lần để cự kiếm trông đồ sộ, không chỉ dài
    const BLADE_LEN = SWORD_LENGTH * SWORD_SCALE;
    const BLADE_HIT_RADIUS = 1.6;                     // bán kính va chạm quanh lưỡi cự kiếm
    const GROW_TIME = 0.4;                            // kiếm trên tay phình to trong chừng này giây rồi mới phóng
    const GOLD_SPARK = [0xffd54a, 0xfff3b0, 0xffffff];

    const dir = PixelFXManager.flatDirection(character.position, targetPos);
    const up = new THREE.Vector3(0, 1, 0);

    // Điểm cầm kiếm: ngang ngực, hơi lệch về phía trước. Kiếm nhỏ trên tay ẩn đi, cự kiếm phình ra từ đúng chỗ đó.
    const start = new THREE.Vector3();
    start.copy(character.position).add(new THREE.Vector3(0, 1.8, 0)).addScaledVector(dir, 0.7);
    character.setSwordThrown(true);

    const sword = createSword(1.0);
    sword.position.copy(start);
    sword.quaternion.setFromUnitVectors(up, dir);
    this.scene.add(sword);
    sound.playSwordSummon();
    if (this.particles) this.particles.emitElementalParticles(start, 16, GOLD_SPARK, [2, 6], 0.4, 0, 0.6);

    const pos = new THREE.Vector3();
    const swordHits = new Set();
    let elapsed = 0;
    let flight = 0; // quãng đường kiếm đã bay
    let launched = false;

    // Điểm trên lưỡi cự kiếm cách chuôi t * BLADE_LEN (t = 0 chuôi, 1 mũi)
    const bladePoint = (t) => pos.clone().addScaledVector(dir, BLADE_LEN * t);

    // hitSet chứa cả quái lẫn id người chơi đã trúng để mỗi thứ chỉ trúng một lần
    const hitMonsters = (point, radius, hitSet, damage, text, color) => {
      for (const monster of monsters) {
        if (monster.isDead || hitSet.has(monster)) continue;
        if (monster.checkCollision(point, radius)) {
          hitSet.add(monster);
          this.damageMonster(monster, damage, text, color, point);
          sound.playHit();
          if (this.controller) this.controller.addTrauma(0.06);
        }
      }
      this.damagePlayersNear(point, radius, damage, text, color, character, hitSet);
    };

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        // Giai đoạn phình to: kiếm trên tay lớn dần thành cự kiếm tại chỗ, tia sáng vàng bắn dọc lưỡi
        if (!launched) {
          const t = Math.min(1, elapsed / GROW_TIME);
          const ease = 1 - Math.pow(1 - t, 3);
          const grown = THREE.MathUtils.lerp(1.0, SWORD_SCALE, ease);
          // Trục y là chiều dài lưỡi; x và z (bản rộng, độ dày) phình thêm
          sword.scale.set(grown * THREE.MathUtils.lerp(1.0, SWORD_WIDEN, ease), grown, grown * THREE.MathUtils.lerp(1.0, SWORD_WIDEN, ease));
          // Chuôi bám theo nhân vật nếu đang di chuyển
          start.copy(character.position).add(new THREE.Vector3(0, 1.8, 0)).addScaledVector(dir, 0.7);
          sword.position.copy(start);
          if (this.particles && Math.random() < 0.8) {
            const along = start.clone().addScaledVector(dir, SWORD_LENGTH * sword.scale.y * Math.random());
            this.particles.emitElementalParticles(along, 2, GOLD_SPARK, [1, 4], 0.3, 0, 0.5);
          }
          if (t < 1) return true;
          launched = true;
          elapsed = 0;
          if (this.controller) this.controller.addTrauma(0.2);
        }

        flight = Math.min(RANGE, flight + SPEED * delta);
        pos.copy(start).addScaledVector(dir, flight);
        // Bay thẳng nhưng không cắm vào dốc
        pos.y = Math.max(pos.y, getTerrainHeight(pos.x, pos.z) + 1.2);

        sword.position.copy(pos);
        sword.quaternion.setFromUnitVectors(up, dir);
        sword.rotateY(Math.sin(elapsed * 6) * 0.15); // lắc nhẹ quanh trục lưỡi, nặng nề như cự kiếm
        // Va chạm dọc cả lưỡi cự kiếm: gần chuôi, giữa lưỡi và mũi kiếm
        for (const t of [0.3, 0.65, 1.0]) {
          hitMonsters(bladePoint(t), BLADE_HIT_RADIUS, swordHits, SWORD_DAMAGE, `🗡️ -${SWORD_DAMAGE}`, '#ffd54a');
        }

        if (this.particles && Math.random() < 0.9) {
          // Tia vàng bắn ra dọc theo lưỡi cự kiếm
          this.particles.emitElementalParticles(bladePoint(Math.random()), 2, GOLD_SPARK, [0.3, 1.2], 0.3, 0, 0.4);
        }

        // Hết 50m: cự kiếm cắm xuống nổ ở mũi kiếm
        if (flight >= RANGE) {
          this.scene.remove(sword);
          const tip = bladePoint(0.9);
          sound.playGiantSwordImpact();
          if (this.onScreenFlash) this.onScreenFlash('sword');
          if (this.controller) this.controller.addTrauma(0.6);

          // Combo Lôi Kiếm Trảm: nếu nổ gần hoặc trong Bát Quái Trận thì thêm +40 ST lôi đình!
          const inBagua = this.lastBaguaPos && tip.distanceTo(this.lastBaguaPos) <= 9.0 && this.baguaTimer > 0;
          const finalBlastDamage = inBagua ? BLAST_DAMAGE + 40 : BLAST_DAMAGE;
          const text = inBagua ? `🗡️⚡ -${finalBlastDamage} LÔI KIẾM TRẢM!` : `🗡️ -${BLAST_DAMAGE} CỰ KIẾM`;

          if (this.particles) {
            this.particles.emitShockwave(tip, 0xf1c40f, BLAST_RADIUS * 2.2, 0.6);
            this.particles.emitShockwave(tip, 0xffd54a, BLAST_RADIUS * 1.4, 0.45);
            this.particles.emitElementalParticles(tip, 50, [0xffd54a, 0xf1c40f, 0xfff3b0, 0xffffff], [6, 14], 0.9, 4, 1.2);
          }
          this.dealDamageAOE(tip, BLAST_RADIUS, finalBlastDamage, text, '#f1c40f', monsters, 'knockback', inBagua ? 'lightning' : 'fire', null, character);
          character.setSwordThrown(false);
          return false;
        }
        return true;
      }
    });
  }

  // --- [Sát Thủ 1] ÁM ẢNH ĐỘT KÍCH (BLINK SLASH) ---
  // Lướt chớp nhoáng 10m để lại 4 Tàn Ảnh Bóng Tối 3D, gắn Ấn Ký Song Đao Chữ X trên đầu địch rồi phát nổ 40 ST chuẩn!
  castBlinkSlash(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(1);
    const dir = PixelFXManager.flatDirection(character.position, targetPos);
    const dashDuration = 0.22;
    const dashDistance = 10;
    const start = character.position.clone();
    character.startDash(dir, dashDistance, dashDuration);
    sound.playSwordSlash();
    if (this.onScreenFlash) this.onScreenFlash('sword');

    // Song kiếm quang tím - ngọc cắt song song
    const streakGroup = new THREE.Group();
    const streakMat1 = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const streakMat2 = new THREE.MeshBasicMaterial({
      color: 0x7efff5,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const streakGeo = new THREE.BoxGeometry(0.14, 0.14, dashDistance);
    const s1 = new THREE.Mesh(streakGeo, streakMat1);
    s1.position.x = -0.32;
    const s2 = new THREE.Mesh(streakGeo, streakMat2);
    s2.position.x = 0.32;
    streakGroup.add(s1, s2);
    streakGroup.position.copy(start).addScaledVector(dir, dashDistance / 2);
    streakGroup.position.y += 1.05;
    streakGroup.rotation.y = Math.atan2(dir.x, dir.z);
    streakGroup.scale.z = 0.01;
    this.scene.add(streakGroup);

    // 4 Tàn Ảnh Bóng Tối 3D dọc đường lướt
    const ghostClones = [];
    const ghostGeo = new THREE.ConeGeometry(0.42, 1.65, 5);
    let nextGhostDist = 2.0;

    // Ấn ký chữ X xoay trên đầu các mục tiêu bị chém qua
    const xMarks = [];
    const markGeo = new THREE.BoxGeometry(0.12, 0.12, 0.95);
    const markMat = new THREE.MeshBasicMaterial({ color: 0xff79c6, blending: THREE.AdditiveBlending });

    const spawnXMark = (entity) => {
      const g = new THREE.Group();
      const b1 = new THREE.Mesh(markGeo, markMat);
      b1.rotation.y = Math.PI / 4;
      const b2 = new THREE.Mesh(markGeo, markMat);
      b2.rotation.y = -Math.PI / 4;
      g.add(b1, b2);
      this.scene.add(g);
      xMarks.push({ group: g, entity });
    };

    const hitMonsters = [];
    const hitPlayerIds = new Set();
    const hitPlayers = [];
    let elapsed = 0;
    let echoed = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        if (elapsed <= dashDuration + 0.02) {
          streakGroup.scale.z = Math.min(1, elapsed / dashDuration);
          streakGroup.position.copy(start).addScaledVector(dir, (dashDistance * streakGroup.scale.z) / 2);
          streakGroup.position.y += 1.05;

          const curDist = dashDistance * streakGroup.scale.z;
          if (curDist >= nextGhostDist && ghostClones.length < 4) {
            nextGhostDist += 2.2;
            const gMat = new THREE.MeshBasicMaterial({
              color: 0xa55eea,
              transparent: true,
              opacity: 0.65,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const gMesh = new THREE.Mesh(ghostGeo, gMat);
            gMesh.position.copy(character.position).add(new THREE.Vector3(0, 0.9, 0));
            gMesh.rotation.x = 0.35;
            gMesh.rotation.y = Math.atan2(dir.x, dir.z);
            this.scene.add(gMesh);
            ghostClones.push({ mesh: gMesh, mat: gMat });
          }

          if (this.particles) {
            this.particles.emitElementalParticles(character.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 3, [0xc084fc, 0x7efff5, 0xffffff], [0.5, 2], 0.35, 0, 0.5);
          }

          for (const monster of monsters) {
            if (monster.isDead || hitMonsters.includes(monster)) continue;
            const d = Math.hypot(monster.position.x - character.position.x, monster.position.z - character.position.z);
            if (d <= monster.hitRadius + 1.4) {
              hitMonsters.push(monster);
              spawnXMark(monster);
              this.damageMonster(monster, 95, '💨 -95 ĐỘT KÍCH', '#c084fc', character.position, character);
              sound.playHit();
            }
          }
          const bodyPos = character.position.clone().add(new THREE.Vector3(0, 1.0, 0));
          const newlyHitRps = this.damagePlayersNear(bodyPos, 1.6, 95, '💨 -95 ĐỘT KÍCH', '#c084fc', character, hitPlayerIds);
          for (const rp of newlyHitRps) {
            hitPlayers.push(rp);
            spawnXMark(rp);
          }
        } else {
          const op = Math.max(0, 0.92 - (elapsed - dashDuration) * 1.6);
          streakMat1.opacity = op;
          streakMat2.opacity = op;
        }

        for (const gc of ghostClones) {
          gc.mat.opacity = Math.max(0, gc.mat.opacity - delta * 1.4);
        }
        for (const xm of xMarks) {
          if (xm.entity && xm.entity.position) {
            const h = (xm.entity.hitHeight || 1.8) + 0.45;
            xm.group.position.set(xm.entity.position.x, xm.entity.position.y + h, xm.entity.position.z);
            xm.group.rotation.y += delta * 12;
          }
        }

        // Ấn ký Song Đao phát nổ trễ trên mọi mục tiêu vừa bị chém qua (65 ST + áp dụng hệ số Khắc Chế)
        if (!echoed && elapsed >= dashDuration + 0.35) {
          echoed = true;
          for (const xm of xMarks) {
            xm.group.scale.setScalar(2.2);
          }
          if (hitMonsters.length > 0 || hitPlayers.length > 0) {
            sound.playSwordSlash();
            if (this.controller) this.controller.addTrauma(0.25);

            // Thưởng kỹ năng: Chém trúng mục tiêu -> Giảm ngay 50% hồi chiêu Ám Ảnh Đột Kích!
            if (character === this.localCharacter && this.cooldowns[1]) {
              this.cooldowns[1].current *= 0.5;
              this.damageTexts.spawn('⚡ HỒI CHIÊU -50%!', character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#7efff5');
            }
          }
          const attackerRole = character?.outfitIndex ?? this.currentSectIndex;
          for (const rp of hitPlayers) {
            if (rp.isDead) continue;
            const p = rp.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            const counterMult = getRoleCounterMultiplier(attackerRole, rp.outfitIndex ?? -1);
            const finalEchoDmg = Math.round(65 * counterMult);
            this.particles.emitShockwave(p, 0xc084fc, 4.2, 0.3);
            this.onHitPlayer(rp.id, finalEchoDmg, p, 'sword', counterMult > 1.05, false);
            const echoTxt = counterMult > 1.05 ? `✦ -${finalEchoDmg} ẤN KÝ NỔ 💥KHẮC CHẾ` : `✦ -${finalEchoDmg} ẤN KÝ NỔ`;
            this.damageTexts.spawn(echoTxt, p.clone().add(new THREE.Vector3(0, 0.6, 0)), counterMult > 1.05 ? '#ffd700' : '#ff79c6');
          }
          for (const monster of hitMonsters) {
            if (monster.isDead) continue;
            const p = monster.position.clone();
            p.y += 1.5;
            this.particles.emitShockwave(p, 0xc084fc, 4.2, 0.3);
            this.particles.emitElementalParticles(p, 16, [0xc084fc, 0x7efff5, 0xffffff], [3, 7], 0.4, 0, 0.6);
            this.damageMonster(monster, 65, '✦ -65 ẤN KÝ NỔ', '#ff79c6', p, character);
          }
        }

        if (elapsed >= dashDuration + 0.6) {
          this.scene.remove(streakGroup);
          streakGeo.dispose();
          streakMat1.dispose();
          streakMat2.dispose();
          for (const gc of ghostClones) {
            this.scene.remove(gc.mesh);
            gc.mat.dispose();
          }
          ghostGeo.dispose();
          for (const xm of xMarks) {
            this.scene.remove(xm.group);
          }
          markGeo.dispose();
          markMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // --- [Sát Thủ 3] TOÀN PHONG SONG NHẬN ---
  // 6 thanh đoản kiếm + Lốc Xoáy Lưỡi Đao Tím 3D xoay quanh người 6 giây cắt 32 ST/nhịp, hết giờ bắn tung ra 6 hướng (55 ST/đao)
  castSwordBarrier(character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(3);
    const count = 6;
    const radius = 2.6;
    const duration = 6.0;
    const up = new THREE.Vector3(0, 1, 0);
    const swords = [];

    for (let i = 0; i < count; i++) {
      const sword = createSword(1.1);
      this.scene.add(sword);
      swords.push({ mesh: sword, launched: false, dir: new THREE.Vector3(), hitSet: new Set() });
    }

    // Vòng trận pháp + Phễu Lốc Xoáy Lưỡi Đao 3D bao quanh Sát Thủ
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ringGeo = new THREE.RingGeometry(radius - 0.14, radius + 0.14, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.scene.add(ring);

    const cycloneGeo = new THREE.CylinderGeometry(radius * 1.05, radius * 0.55, 2.2, 16, 1, true);
    const cycloneMat = new THREE.MeshBasicMaterial({
      color: 0xa55eea,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const cyclone = new THREE.Mesh(cycloneGeo, cycloneMat);
    this.scene.add(cyclone);

    sound.playSwordSummon();

    // Cơ chế PARRY (Phản Kiếm Quyết): Vào thế đỡ đòn hoàn hảo trong 0.8s đầu!
    if (character?.setParry) {
      character.setParry(0.8);
      this.damageTexts.spawn('⚔️ THẾ PARRY (0.8s)!', character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#ffd700');
    }

    let elapsed = 0;
    let tickTimer = 0;
    let burst = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const center = character.position;

        if (elapsed < duration) {
          // Kiếm xoay vòng tốc độ cao, mũi chĩa ra ngoài
          for (let i = 0; i < count; i++) {
            const angle = elapsed * 4.2 + (i / count) * Math.PI * 2;
            const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            const s = swords[i].mesh;
            s.position.set(center.x + out.x * radius, center.y + 1.0 + Math.sin(elapsed * 5 + i) * 0.18, center.z + out.z * radius);
            s.quaternion.setFromUnitVectors(up, out);
          }
          ring.position.set(center.x, center.y + 0.08, center.z);
          ring.rotation.y = -elapsed * 2.5;
          ringMat.opacity = 0.45 + Math.sin(elapsed * 8) * 0.2;

          cyclone.position.set(center.x, center.y + 1.1, center.z);
          cyclone.rotation.y = elapsed * 6.5;
          cycloneMat.opacity = 0.32 + Math.sin(elapsed * 10) * 0.14;

          // Mỗi 0.35s cắt mọi quái lọt vào vòng kiếm (32 ST/nhịp ~ 91 DPS)
          tickTimer -= delta;
          if (tickTimer <= 0) {
            tickTimer = 0.35;
            for (const monster of monsters) {
              if (monster.isDead) continue;
              const d = Math.hypot(monster.position.x - center.x, monster.position.z - center.z);
              if (d <= radius + monster.hitRadius + 0.5) {
                this.damageMonster(monster, 32, '🌀 -32 TOÀN PHONG', '#c084fc', center, character);
                sound.playHit();
              }
            }
            const ringCenter = center.clone().add(new THREE.Vector3(0, 1.0, 0));
            this.damagePlayersNear(ringCenter, radius + 0.5, 32, '🌀 -32 TOÀN PHONG', '#c084fc', character);
          }
          return true;
        }

        // Hết thời gian: kiếm bắn tung ra bốn phía
        if (!burst) {
          burst = true;
          this.scene.remove(ring);
          this.scene.remove(cyclone);
          ringGeo.dispose();
          ringMat.dispose();
          cycloneGeo.dispose();
          cycloneMat.dispose();
          sound.playSwordSlash();
          if (this.controller) this.controller.addTrauma(0.22);
          for (const s of swords) {
            s.dir.set(s.mesh.position.x - center.x, 0, s.mesh.position.z - center.z).normalize();
          }
        }

        for (const s of swords) {
          s.mesh.position.addScaledVector(s.dir, 30 * delta);
          for (const monster of monsters) {
            if (monster.isDead || s.hitSet.has(monster)) continue;
            if (monster.checkCollision(s.mesh.position, 1.1)) {
              s.hitSet.add(monster);
              this.damageMonster(monster, 55, '🌀 -55 PHI NHẬN', '#c084fc', s.mesh.position, character);
            }
          }
          this.damagePlayersNear(s.mesh.position, 1.1, 55, '🌀 -55 PHI NHẬN', '#c084fc', character, s.hitSet);
          if (this.particles && Math.random() < 0.5) {
            this.particles.emitElementalParticles(s.mesh.position, 1, [0xc084fc, 0xffffff], [0.2, 0.8], 0.25, 0, 0.35);
          }
        }

        if (elapsed >= duration + 0.5) {
          for (const s of swords) this.scene.remove(s.mesh);
          return false;
        }
        return true;
      }
    });
  }

  // --- [Pháp Sư 4 - Ult] BĂNG TINH THIÊN PHẠT ---
  // Mở Pháp Trận Bầu Trời 3D, trút 28 thương băng trong 1.8s (32 ST/mũi, nổ rộng 3.2m) rồi giáng Đại Thiên Thạch Băng Tinh 150 ST (+75 ST Băng Toái)!
  castSwordRain(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(4);
    const cx = targetPos.x;
    const cz = targetPos.z;
    const cy = getTerrainHeight(cx, cz);
    const center = new THREE.Vector3(cx, cy, cz);
    const areaRadius = 7.5;
    const swordCount = 28;
    const totalRainDuration = 1.8;

    this.spawnTelegraph(center, 0x48dbfb, totalRainDuration, areaRadius);

    // Pháp Trận Bầu Trời 3D xoay lơ lửng ở độ cao 16m
    const skyCircle = new THREE.Group();
    skyCircle.position.set(cx, cy + 16.0, cz);
    const skyRingGeo = new THREE.RingGeometry(areaRadius * 0.82, areaRadius * 0.95, 36);
    skyRingGeo.rotateX(Math.PI / 2);
    const skyRingMat = new THREE.MeshBasicMaterial({
      color: 0x48dbfb,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const skyStarGeo = new THREE.RingGeometry(areaRadius * 0.45, areaRadius * 0.55, 6);
    skyStarGeo.rotateX(Math.PI / 2);
    skyCircle.add(new THREE.Mesh(skyRingGeo, skyRingMat), new THREE.Mesh(skyStarGeo, skyRingMat));
    this.scene.add(skyCircle);

    // Đại Thiên Thạch Băng Tinh rơi xuống ở cuối chiêu
    const meteorGeo = new THREE.OctahedronGeometry(2.2, 1);
    const meteorMat = new THREE.MeshStandardMaterial({
      color: 0x7ed6df,
      emissive: 0x00d2d3,
      emissiveIntensity: 0.7,
      roughness: 0.15,
      flatShading: true,
    });
    const frostMeteor = new THREE.Mesh(meteorGeo, meteorMat);
    frostMeteor.position.set(cx, cy + 26, cz);
    frostMeteor.visible = false;
    this.scene.add(frostMeteor);

    const swords = [];
    for (let i = 0; i < swordCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * areaRadius;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      swords.push({
        mesh: null,
        target: new THREE.Vector3(x, getTerrainHeight(x, z), z),
        delay: 0.25 + (i / swordCount) * 1.25,
        state: 'waiting', // waiting → falling → embedded
        embedLife: 0.5,
      });
    }

    let elapsed = 0;
    let sealed = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        let alive = false;

        skyCircle.rotation.y += delta * 2.8;

        // Thiên thạch băng lao xuống từ 1.25s -> 1.8s
        if (elapsed >= 1.25 && !sealed) {
          frostMeteor.visible = true;
          const mProg = Math.min(1.0, (elapsed - 1.25) / 0.55);
          frostMeteor.position.y = THREE.MathUtils.lerp(cy + 22, cy + 1.2, mProg);
          frostMeteor.rotation.x += delta * 8;
          frostMeteor.rotation.y += delta * 10;
        }

        for (const s of swords) {
          if (s.state === 'waiting') {
            alive = true;
            if (elapsed < s.delay) continue;
            s.mesh = createSword(1.5);
            s.mesh.rotation.x = Math.PI; // Mũi thương băng chĩa xuống đất
            s.mesh.position.set(s.target.x, s.target.y + 16, s.target.z);
            this.scene.add(s.mesh);
            s.state = 'falling';
          } else if (s.state === 'falling') {
            alive = true;
            s.mesh.position.y -= 48 * delta;
            if (this.particles && Math.random() < 0.3) {
              this.particles.emitElementalParticles(s.mesh.position, 1, [0x48dbfb, 0xffffff], [0.2, 0.8], 0.25, 0, 0.35);
            }
            if (s.mesh.position.y <= s.target.y + 0.9) {
              s.mesh.position.y = s.target.y + 0.9;
              s.state = 'embedded';
              sound.playSwordSlash();
              this.particles.emitHitSparkles(s.target, 6);
              this.particles.emitShockwave(s.target, 0x48dbfb, 3.2, 0.22);
              for (const monster of monsters) {
                if (monster.isDead) continue;
                const d = Math.hypot(monster.position.x - s.target.x, monster.position.z - s.target.z);
                if (d <= monster.hitRadius + 3.2) {
                  this.damageMonster(monster, 32, '🌧️ -32 BĂNG TIỄN', '#48dbfb', s.target, character);
                }
              }
              this.damagePlayersNear(s.target.clone().add(new THREE.Vector3(0, 0.8, 0)), 3.2, 32, '🌧️ -32 BĂNG TIỄN', '#48dbfb', character);
            }
          } else if (s.state === 'embedded') {
            s.embedLife -= delta;
            if (s.embedLife < 0.25) s.mesh.scale.multiplyScalar(0.9);
            if (s.embedLife <= 0) {
              this.scene.remove(s.mesh);
              s.state = 'done';
            } else {
              alive = true;
            }
          }
        }

        // Thiên thạch băng chạm đất phát nổ 150 ST & đóng băng toàn vùng ở 1.8s
        if (!sealed && elapsed >= totalRainDuration) {
          sealed = true;
          this.scene.remove(skyCircle);
          this.scene.remove(frostMeteor);
          skyRingGeo.dispose();
          skyStarGeo.dispose();
          skyRingMat.dispose();
          meteorGeo.dispose();
          meteorMat.dispose();

          if (this.onScreenFlash) this.onScreenFlash('frost');
          if (this.controller) this.controller.addTrauma(0.58);
          sound.playGiantSwordImpact();
          this.particles.emitShockwave(center, 0x48dbfb, areaRadius * 1.7, 0.65);
          this.particles.emitShockwave(center, 0xffffff, areaRadius * 1.1, 0.4);
          this.particles.emitElementalParticles(center, 45, [0x48dbfb, 0xffffff, 0x7efff5], [4, 11], 0.75, 4, 1.1);

          // Combo Băng Toái: Mục tiêu đang bị ĐÓNG BĂNG nhận thêm +75 ST bạo kích (có tính Khắc Chế)
          const attackerRole = character?.outfitIndex ?? this.currentSectIndex;
          if (monsters) {
            for (const m of monsters) {
              if (!m.isDead && m.position.distanceTo(center) <= areaRadius + m.hitRadius) {
                if (m.freezeTimer > 0) {
                  this.damageMonster(m, 75, '❄️💥 -75 BĂNG TOÁI!', '#00d2d3', center, character);
                  this.particles.emitHitSparkles(m.position, 16);
                }
                this.spawnIcePrison(m, 2.2);
              }
            }
          }
          if (this.canHitPlayers(character) && this.remotePlayers) {
            for (const rp of this.remotePlayers) {
              if (!rp.isDead && rp.position.distanceTo(center) <= areaRadius + 1.0) {
                if (rp.freezeTimer > 0) {
                  const counterMult = getRoleCounterMultiplier(attackerRole, rp.outfitIndex ?? -1);
                  const shatterDmg = Math.round(75 * counterMult);
                  this.onHitPlayer(rp.id, shatterDmg, rp.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 'ice', counterMult > 1.05, false);
                  this.damageTexts.spawn(`❄️💥 -${shatterDmg} BĂNG TOÁI!`, rp.position.clone().add(new THREE.Vector3(0, 2.0, 0)), '#00d2d3');
                  this.particles.emitHitSparkles(rp.position, 16);
                }
                this.spawnIcePrison(rp, 2.2);
              }
            }
          }

          this.dealDamageAOE(center, areaRadius, 150, '☄️ -150 THIÊN PHẠT!', '#48dbfb', monsters, 'freeze', 'ice', null, character);
        }

        return alive || !sealed;
      }
    });
  }

  // --- ĐẠI CANH KIẾM TRẬN (kèm Bát Quái, chiêu 2 của Đạo Gia) ---
  // 1000 phi kiếm xoáy cuồng phong trong phạm vi 100m quanh người suốt 10 giây.
  // Vẽ bằng InstancedMesh (một lần draw cho cả 1000 thanh). Mỗi nhịp HIT_TICK, mục tiêu nào có kiếm quét qua
  // thì chịu DAMAGE cho mỗi thanh kiếm đang chạm (tối đa MAX_BLADES thanh mỗi nhịp).
  castDaiCanhSwordArray(character, monsters) {
    const SWORD_COUNT = 1000;
    const RANGE = 100;
    const MIN_RADIUS = 3;
    const DURATION = 10;
    const ORBIT_SPEED = 70;  // tốc độ dài trên quỹ đạo (m/s)
    const MAX_SPIN = 7;      // giới hạn tốc độ góc khi kiếm ở gần tâm (rad/s)
    const INTRO = 0.8;       // thời gian kiếm bung từ người ra quỹ đạo
    const OUTRO = 0.6;       // thời gian kiếm vút lên trời khi hết giờ
    const DAMAGE = 12;       // sát thương mỗi thanh kiếm chạm mục tiêu trong một nhịp
    const MAX_BLADES = 10;   // trần số thanh kiếm được tính cho một mục tiêu trong một nhịp
    const HIT_TICK = 0.2;
    const HIT_REACH = 1.6;   // kiếm cách rìa mục tiêu trong khoảng này là trúng
    const BLADE_LENGTH = 3.4;
    const TAIL_LENGTH = 7;
    const up = new THREE.Vector3(0, 1, 0);

    sound.playSwordSummon();
    if (this.onScreenFlash) this.onScreenFlash('lightning');
    if (this.controller) this.controller.addTrauma(0.5);
    this.spawnTelegraph(character.position.clone(), 0xa29bfe, 1.2, RANGE);

    // Vòng ranh giới kiếm trận 100m đi theo người
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0xa29bfe,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const borderGeo = new THREE.RingGeometry(RANGE - 0.8, RANGE, 128);
    borderGeo.rotateX(-Math.PI / 2);
    const border = new THREE.Mesh(borderGeo, borderMat);
    this.scene.add(border);

    // Thân kiếm dẹt + đuôi sáng mờ kéo dài phía sau (chung ma trận và màu với thân kiếm)
    const bladeGeo = new THREE.ConeGeometry(0.24, BLADE_LENGTH, 4);
    bladeGeo.scale(1, 1, 0.3);
    const tailGeo = new THREE.ConeGeometry(0.2, TAIL_LENGTH, 4);
    tailGeo.rotateX(Math.PI);
    tailGeo.translate(0, -BLADE_LENGTH / 2 - TAIL_LENGTH / 2, 0);
    tailGeo.scale(1, 1, 0.3);
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, SWORD_COUNT);
    const tails = new THREE.InstancedMesh(tailGeo, tailMat, SWORD_COUNT);
    blades.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    blades.frustumCulled = false;
    tails.frustumCulled = false;
    const palette = [0xffffff, 0xa29bfe, 0x74b9ff, 0xf6e58d].map((c) => new THREE.Color(c));
    for (let i = 0; i < SWORD_COUNT; i++) blades.setColorAt(i, palette[i % palette.length]);
    tails.instanceMatrix = blades.instanceMatrix;
    tails.instanceColor = blades.instanceColor;
    this.scene.add(blades);
    this.scene.add(tails);

    // Trạng thái từng thanh kiếm
    const baseR = new Float32Array(SWORD_COUNT);
    const breathe = new Float32Array(SWORD_COUNT);
    const phase = new Float32Array(SWORD_COUNT);
    const angle = new Float32Array(SWORD_COUNT);
    const px = new Float32Array(SWORD_COUNT);
    const py = new Float32Array(SWORD_COUNT);
    const pz = new Float32Array(SWORD_COUNT);
    const groundY = new Float32Array(SWORD_COUNT);
    for (let i = 0; i < SWORD_COUNT; i++) {
      // Rải đều theo diện tích đĩa tròn: không dồn hết vào tâm
      baseR[i] = MIN_RADIUS + (RANGE - MIN_RADIUS - 8) * Math.sqrt((i + 0.5) / SWORD_COUNT);
      breathe[i] = 0.4 + Math.random() * 0.5;
      phase[i] = (i * 2.399) % (Math.PI * 2); // góc vàng
      angle[i] = (i * 2.399) % (Math.PI * 2);
      groundY[i] = character.position.y;
    }

    const dummy = new THREE.Object3D();
    const tangent = new THREE.Vector3();
    let elapsed = 0;
    let frame = 0;
    let hitClock = 0;
    let lastHitSound = -1;

    const countNear = (pos, reach, yMin, yMax) => {
      let n = 0;
      const r2 = reach * reach;
      for (let i = 0; i < SWORD_COUNT; i++) {
        const dx = px[i] - pos.x;
        const dz = pz[i] - pos.z;
        if (dx * dx + dz * dz <= r2 && py[i] >= yMin && py[i] <= yMax) {
          if (++n >= MAX_BLADES) break;
        }
      }
      return n;
    };

    const strikeTargets = () => {
      const c = character.position;
      let struck = false;
      for (const monster of monsters) {
        if (monster.isDead) continue;
        const near = Math.hypot(monster.position.x - c.x, monster.position.z - c.z);
        if (near > RANGE + monster.hitRadius) continue;
        const n = countNear(monster.position, monster.hitRadius + HIT_REACH, monster.position.y - 1.0, monster.position.y + monster.hitHeight + 1.0);
        if (!n) continue;
        const dmg = n * DAMAGE;
        this.damageMonster(monster, dmg, `⚡ -${dmg}`, '#a29bfe', monster.position);
        struck = true;
      }
      if (this.canHitPlayers(character)) {
        for (const rp of this.remotePlayers) {
          if (rp.isDead) continue;
          const n = countNear(rp.position, 0.9 + HIT_REACH, rp.position.y - 1.0, rp.position.y + 3.0);
          if (!n) continue;
          const dmg = n * DAMAGE;
          const hitPos = rp.position.clone().add(new THREE.Vector3(0, 1.2, 0));
          this.onHitPlayer(rp.id, dmg, hitPos, 'sword');
          this.damageTexts.spawn(`⚡ -${dmg}`, hitPos.clone().add(new THREE.Vector3(0, 0.6, 0)), '#a29bfe');
          if (this.particles) this.particles.emitHitSparkles(hitPos, 14);
          struck = true;
        }
      }
      if (struck && elapsed - lastHitSound > 0.15) {
        lastHitSound = elapsed;
        sound.playSwordSlash();
        if (this.controller) this.controller.addTrauma(0.05);
      }
    };

    const cleanup = () => {
      this.scene.remove(blades);
      this.scene.remove(tails);
      bladeGeo.dispose();
      tailGeo.dispose();
      bladeMat.dispose();
      tailMat.dispose();
      blades.dispose();
      this.scene.remove(border);
      borderGeo.dispose();
      borderMat.dispose();
    };

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        frame++;
        const center = character.position;
        border.position.set(center.x, center.y + 0.1, center.z);
        borderMat.opacity = 0.2 + Math.sin(elapsed * 8) * 0.08;

        const outro = Math.max(0, elapsed - DURATION);
        if (outro >= OUTRO) {
          cleanup();
          return false;
        }
        const shrink = 1 - outro / OUTRO;

        for (let i = 0; i < SWORD_COUNT; i++) {
          // Bán kính quỹ đạo co giãn quanh baseR; lúc mở chiêu thì bung dần từ người ra
          let radius = THREE.MathUtils.clamp(baseR[i] + Math.sin(breathe[i] * elapsed + phase[i]) * 7, MIN_RADIUS, RANGE);
          if (elapsed < INTRO) radius = THREE.MathUtils.lerp(1.0, radius, elapsed / INTRO);

          // Xoáy cùng chiều, tốc độ dài gần như đều nên kiếm ở xa vẫn quét rất nhanh
          angle[i] += Math.min(MAX_SPIN, ORBIT_SPEED / Math.max(radius, 1)) * delta;
          const a = angle[i];
          const x = center.x + Math.cos(a) * radius;
          const z = center.z + Math.sin(a) * radius;

          // Độ cao mặt đất chỉ làm tươi dần (mỗi thanh 1 lần / 4 khung hình) cho nhẹ
          if ((i + frame) % 4 === 0) groundY[i] = getTerrainHeight(x, z);
          let y = Math.max(groundY[i] + 0.8, center.y + 1.8 + Math.sin(elapsed * 2.2 + i * 0.7) * 1.4);
          if (outro > 0) y += outro * 60;

          px[i] = x;
          py[i] = y;
          pz[i] = z;

          // Mũi kiếm hướng theo chiều bay
          tangent.set(-Math.sin(a), outro > 0 ? 1.5 : 0, Math.cos(a)).normalize();
          dummy.position.set(x, y, z);
          dummy.quaternion.setFromUnitVectors(up, tangent);
          dummy.scale.setScalar(shrink);
          dummy.updateMatrix();
          blades.setMatrixAt(i, dummy.matrix);
        }
        blades.instanceMatrix.needsUpdate = true;

        if (outro === 0) {
          hitClock += delta;
          if (hitClock >= HIT_TICK) {
            hitClock -= HIT_TICK;
            strikeTargets();
          }
        } else {
          tailMat.opacity = 0.35 * shrink;
        }
        return true;
      }
    });
  }

  // --- [Xạ Thủ 4 - Ult] THIÊN TIỄN PHÁN QUYẾT (WAN JIAN GUI ZONG) ---
  // Triệu hồi ĐẠI THẦN CUNG HOÀNG KIM 3D trên bầu trời, bắn mưa 32 quang tiễn rồi giáng ĐẠI THẦN TIỄN KHỔNG LỒ nổ 260 ST!
  castWanJianGuiZong(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(4);
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

    sound.playSwordSummon();

    if (this.onScreenFlash) {
      this.onScreenFlash('sword');
    }

    // 1. Chỉ điểm trận địa Quang Tiễn trên mặt đất
    this.spawnTelegraph(hitPos, 0xffd700, 1.8, 14.0);
    this.spawnGroundDecalEffect('sword', new THREE.Vector3(impactX, impactY + 0.14, impactZ), 20, 2.8);

    // 2. ĐẠI THẦN CUNG 3D KHỔNG LỒ lơ lửng trên bầu trời nhắm thẳng xuống mục tiêu
    const skyBowGroup = new THREE.Group();
    skyBowGroup.position.set(impactX, impactY + 26, impactZ);
    const bowArcGeo = new THREE.TorusGeometry(6.5, 0.35, 8, 28, Math.PI);
    const bowArcMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const bowArc = new THREE.Mesh(bowArcGeo, bowArcMat);
    bowArc.rotation.x = Math.PI / 2;
    const bowHaloGeo = new THREE.RingGeometry(7.2, 8.0, 36);
    bowHaloGeo.rotateX(Math.PI / 2);
    const bowHalo = new THREE.Mesh(bowHaloGeo, bowArcMat);
    skyBowGroup.add(bowArc, bowHalo);
    this.scene.add(skyBowGroup);

    const createSwordMesh = (scale = 1.0) => createSword(scale * 1.9);

    // 3. Khởi tạo 32 thanh Quang Tiễn bay lơ lửng xoay tròn trên không trung
    const swordCount = 32;
    const swords = [];
    const swordContainer = new THREE.Group();
    this.scene.add(swordContainer);

    for (let i = 0; i < swordCount; i++) {
      const sword = createSwordMesh(0.9);
      const tier = i % 2;
      const ringRadius = tier === 0 ? 5.0 + Math.random() * 2.0 : 9.5 + Math.random() * 3.0;
      const angle = (i / swordCount) * Math.PI * 4;
      const height = impactY + 18 + Math.random() * 8;

      sword.position.set(
        impactX + Math.cos(angle) * ringRadius,
        height,
        impactZ + Math.sin(angle) * ringRadius
      );
      sword.rotation.x = Math.PI;
      sword.rotation.z = (Math.random() - 0.5) * 0.3;

      swordContainer.add(sword);

      swords.push({
        mesh: sword,
        initPos: sword.position.clone(),
        targetPos: new THREE.Vector3(
          impactX + (Math.random() - 0.5) * 11,
          impactY,
          impactZ + (Math.random() - 0.5) * 11
        ),
        delay: 0.3 + (i / swordCount) * 1.1,
        plunged: false,
        embedded: false,
        embedLife: 0.6,
      });
    }

    // 4. ĐẠI THẦN TIỄN KHỔNG LỒ (Colossal Divine Finisher Arrow/Greatsword)
    const giantSword = createSwordMesh(4.8);
    giantSword.position.set(impactX, impactY + 55, impactZ);
    giantSword.rotation.x = Math.PI;
    giantSword.visible = false;
    this.scene.add(giantSword);

    let elapsed = 0;
    let giantPlunged = false;
    let giantEmbedded = false;
    let giantLife = 2.0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        skyBowGroup.rotation.y += delta * 2.5;

        // Cập nhật 32 mũi Quang Tiễn bay
        for (const s of swords) {
          if (elapsed < s.delay) {
            s.mesh.rotation.y += delta * 6;
            s.mesh.position.y += Math.sin(elapsed * 10 + s.delay) * 0.05;
          } else if (!s.plunged) {
            s.mesh.lookAt(s.targetPos);
            s.mesh.rotateX(Math.PI / 2);

            const dist = s.mesh.position.distanceTo(s.targetPos);
            const speed = 48.0;
            s.mesh.position.lerp(s.targetPos, Math.min(1.0, (speed * delta) / Math.max(0.1, dist)));

            if (Math.random() < 0.4 && this.particles) {
              this.particles.emitElementalParticles(
                s.mesh.position,
                2,
                [0xffd700, 0x2ed573, 0xffffff],
                [1, 3],
                0.25,
                0,
                0.5
              );
            }

            if (dist < 1.0) {
              s.plunged = true;
              s.embedded = true;
              s.mesh.position.copy(s.targetPos);

              sound.playSwordSlash();
              if (this.controller) this.controller.addTrauma(0.06);

              if (this.particles) {
                this.particles.emitHitSparkles(s.targetPos, 8);
                this.particles.emitShockwave(s.targetPos, 0xffd700, 3.0, 0.25);
              }

              this.dealDamageAOE(s.targetPos, 3.5, 25, '🏹 -25 QUANG TIỄN', '#ffd700', monsters, null, 'lightning', null, character);
            }
          } else if (s.embedded) {
            s.embedLife -= delta;
            s.mesh.scale.multiplyScalar(0.95);
            if (s.embedLife <= 0) {
              s.embedded = false;
              swordContainer.remove(s.mesh);
            }
          }
        }

        // Cập nhật Đại Thần Tiễn Khổng Lồ (Finisher at 1.4s)
        if (elapsed >= 1.4 && !giantPlunged) {
          giantSword.visible = true;
          const giantDist = giantSword.position.y - impactY;
          giantSword.position.y -= 75 * delta;

          if (this.particles) {
            this.particles.emitElementalParticles(
              giantSword.position,
              4,
              [0xffd700, 0x2ed573, 0xffffff],
              [2, 6],
              0.3,
              0,
              1.2
            );
          }

          if (giantDist <= 2.5) {
            giantPlunged = true;
            giantEmbedded = true;
            giantSword.position.y = impactY + 1.5;

            sound.playGiantSwordImpact();

            if (this.controller) {
              this.controller.addTrauma(0.92);
            }
            if (this.onScreenFlash) {
              this.onScreenFlash('sword');
            }

            this.world.deformTerrain(impactX, impactZ, 13.0, 2.2, 'lightning');

            this.particles.emitShockwave(hitPos, 0xffd700, 22, 0.85);
            this.particles.emitShockwave(hitPos, 0x2ed573, 15, 0.55);
            this.particles.emitElementalParticles(hitPos, 55, [0xffd700, 0x2ed573, 0xffffff], [8, 18], 0.95, 6, 1.6);

            this.dealDamageAOE(hitPos, 14.5, 260, '🏹 -260 THIÊN TIỄN!', '#ffd700', monsters, 'knockback', 'lightning', null, character);
          }
        }

        if (giantEmbedded) {
          giantLife -= delta;
          giantSword.rotation.z = Math.sin(elapsed * 24) * 0.05;
          bowArcMat.opacity = Math.max(0, giantLife * 0.45);

          if (giantLife <= 0.5) {
            giantSword.scale.multiplyScalar(0.94);
          }

          if (giantLife <= 0) {
            this.scene.remove(giantSword);
            this.scene.remove(swordContainer);
            this.scene.remove(skyBowGroup);
            bowArcGeo.dispose();
            bowHaloGeo.dispose();
            bowArcMat.dispose();
            this.particles.emitElementalParticles(hitPos, 35, [0xffd700, 0xffffff], [4, 10], 0.7, 5, 1.2);
            return false;
          }
        }

        return true;
      }
    });
  }

  // =========================================================================
  // TUYỆT KỸ HỘ VỆ: BẤT DIỆT THẦN THÀNH
  // =========================================================================

  // [Hộ Vệ 4 - Ult] BẤT DIỆT THẦN THÀNH: Dựng 8 Trụ Pháo Đài Hoàng Kim + Vòm Thành Lũy 7.5m (8s)
  // Nổ xung kích 160 ST, hồi ngay +350 HP, miễn khống chế, mỗi 0.8s hồi +45 HP và chấn áp 35 ST làm chậm kẻ địch trong pháo đài!
  castTaiChiBagua(character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(4);
    const BAGUA_DURATION = 8.0;
    const FORTRESS_RADIUS = 7.5;
    const center = character.position.clone();
    center.y = getTerrainHeight(center.x, center.z);
    sound.playGiantSwordImpact();

    if (this.controller) this.controller.addTrauma(0.55);
    if (this.onScreenFlash) this.onScreenFlash('sword');

    // 1. Chỉ điểm Thần Thành dưới chân + chấn động mở màn 160 ST
    this.spawnGroundDecalEffect('bagua', new THREE.Vector3(center.x, center.y + 0.08, center.z), FORTRESS_RADIUS * 1.9, BAGUA_DURATION);
    this.dealDamageAOE(center, FORTRESS_RADIUS, 160, '🏰 -160 THẦN THÀNH CHẤN!', '#f6b93b', monsters, 'knockback', 'earth', 22.0, character);

    // 2. Pháo Đài Hoàng Kim 3D (Vòm Thành Lũy Lục Giác + Trụ Sáng + 8 Cột Đá Thần Thành quanh rìa)
    const arrayGroup = new THREE.Group();
    arrayGroup.position.copy(center);

    const pillarGeo = new THREE.CylinderGeometry(FORTRESS_RADIUS, FORTRESS_RADIUS, 5.5, 24, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
    pillarMesh.position.y = 2.75;
    arrayGroup.add(pillarMesh);

    const domeGeo = new THREE.IcosahedronGeometry(FORTRESS_RADIUS, 1);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0xf6b93b,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.scale.y = 0.65;
    domeMesh.position.y = 0.5;
    arrayGroup.add(domeMesh);

    // 8 Cột Thần Thành Hoàng Kim đứng sừng sững quanh chu vi
    const bastionGeo = new THREE.CylinderGeometry(0.38, 0.48, 4.8, 6);
    const bastionMat = new THREE.MeshStandardMaterial({
      color: 0xf6b93b,
      emissive: 0xe58e26,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      flatShading: true,
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(bastionGeo, bastionMat);
      col.position.set(Math.cos(a) * (FORTRESS_RADIUS - 0.2), 2.4, Math.sin(a) * (FORTRESS_RADIUS - 0.2));
      arrayGroup.add(col);
    }

    // Vòng kim quang bao quanh
    const ringGeo = new THREE.RingGeometry(FORTRESS_RADIUS - 0.4, FORTRESS_RADIUS + 0.15, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.12;
    arrayGroup.add(ringMesh);

    this.scene.add(arrayGroup);

    // Ghi nhận trận pháp đang hoạt động
    this.lastBaguaPos = center.clone();
    this.baguaTimer = BAGUA_DURATION;

    if (character) {
      character.statusResistTimer = BAGUA_DURATION;
      character.shieldReflectTimer = Math.max(character.shieldReflectTimer || 0, 4.0);
      character.freezeTimer = 0;
      character.slowTimer = 0;
      if (this.damageTexts) {
        this.damageTexts.spawn('🏰 BẤT DIỆT THẦN THÀNH · MIỄN KHỐNG CHẾ!', character.position.clone().add(new THREE.Vector3(0, 2.8, 0)), '#f1c40f');
      }
    }

    // 3. Hồi phục 350 HP tức thì cho Hộ Vệ
    if (character && character.hp < character.maxHp) {
      const heal = Math.min(350, character.maxHp - character.hp);
      character.hp += heal;
      if (character.updateBillboard) character.updateBillboard();
      this.damageTexts.spawn(`💚 +${Math.round(heal)} THẦN THÀNH!`, character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#2ed573');
    }

    if (this.particles) {
      this.particles.emitElementalParticles(center, 40, [0xf1c40f, 0x2ed573, 0xffffff], [2, 7], 0.65, 5.0, 1.2);
      this.particles.emitShockwave(center, 0xf1c40f, FORTRESS_RADIUS * 1.4, 0.45);
    }

    let elapsed = 0;
    let tickTimer = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        tickTimer += delta;
        arrayGroup.rotation.y += delta * 0.9;
        pillarMesh.material.opacity = (Math.sin(elapsed * 6) * 0.12 + 0.25) * (1.0 - elapsed / BAGUA_DURATION);
        domeMat.opacity = (Math.sin(elapsed * 5) * 0.1 + 0.24) * (1.0 - elapsed / BAGUA_DURATION);

        // Hiệu ứng trận địa liên tục mỗi 0.8s
        if (tickTimer >= 0.8) {
          tickTimer = 0;
          if (character && !character.isDead && character.position.distanceTo(center) <= FORTRESS_RADIUS + 0.5) {
            if (character.hp < character.maxHp) {
              character.heal(45);
              this.damageTexts.spawn('💚 +45 THẦN THÀNH', character.position.clone().add(new THREE.Vector3(0, 2.0, 0)), '#2ed573');
            }
            if (character.slowTimer > 0) character.slowTimer = 0;
          }

          if (monsters) {
            for (const m of monsters) {
              if (!m.isDead && m.position.distanceTo(center) <= FORTRESS_RADIUS + m.hitRadius) {
                this.damageMonster(m, 35, '🏰 -35 TRẤN ÁP', '#f1c40f', center, character);
                if (m.freeze) m.freeze(0.5);
              }
            }
          }
          if (this.canHitPlayers(character) && this.remotePlayers) {
            const hitRps = this.damagePlayersNear(center.clone().add(new THREE.Vector3(0, 1.0, 0)), FORTRESS_RADIUS, 35, '🏰 -35 TRẤN ÁP', '#f1c40f', character);
            for (const rp of hitRps) {
              if (rp.slow) rp.slow(1.2, 0.5);
            }
          }
        }

        if (elapsed >= BAGUA_DURATION) {
          if (this.lastBaguaPos === center) this.lastBaguaPos = null;
          this.scene.remove(arrayGroup);
          pillarGeo.dispose();
          pillarMat.dispose();
          domeGeo.dispose();
          domeMat.dispose();
          bastionGeo.dispose();
          bastionMat.dispose();
          ringGeo.dispose();
          ringMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [Đạo Gia 3] NHẤT KHÍ HÓA TAM THANH: phân ra 2 đạo ảnh (xem clones.js).
  castSplitShadow(character) {
    sound.playSwordSummon();
    if (this.onScreenFlash) this.onScreenFlash('sword');
    if (this.particles) {
      const center = character.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      this.particles.emitElementalParticles(center, 30, [0x8854d0, 0xf5f6fa, 0xffd54a], [2, 6], 0.6, 3.0, 1.0);
      this.particles.emitShockwave(character.position, 0xffd54a, 6.0, 0.35);
    }
    if (character === this.localCharacter && this.cloneManager) {
      this.cloneManager.spawnLocal(character);
    }
  }

  // =========================================================================
  // KỸ NĂNG PHÁP SƯ: BĂNG PHONG & TINH VÂN
  // =========================================================================

  // [Pháp Sư 1] BĂNG PHONG TUYỆT VỰC (Cảnh báo 0.35s -> Trụ Băng Trung Tâm + 16 Cọc Băng trồi lên gây 130 ST & giam địch trong Lồng Băng 3D 2.2s)
  castFrostNova(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(1);
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

    sound.playHit();
    if (this.onScreenFlash) this.onScreenFlash('frost');

    // 1. Chỉ điểm hoa tuyết băng phong (Cảnh báo telegraph 0.35s)
    this.spawnTelegraph(hitPos, 0x00d2d3, 0.45, 14.0);
    this.spawnGroundDecalEffect('ice', new THREE.Vector3(impactX, impactY + 0.1, impactZ), 16, 2.5);

    if (this.world && this.world.deformTerrain) {
      this.world.deformTerrain(impactX, impactZ, 14.0, 1.4, 'ice');
    }

    // 2. Đại Trụ Băng Trung Tâm + 16 tinh thể trụ băng nhọn hoắt low-poly
    const iceGroup = new THREE.Group();
    const iceSpikes = [];
    const spikeGeo = new THREE.CylinderGeometry(0.06, 0.45, 2.6, 5);
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x7ed6df,
      emissive: 0x00d2d3,
      emissiveIntensity: 0.45,
      roughness: 0.15,
      flatShading: true,
    });

    // Đại trụ băng ở ngay tâm
    const centerSpire = new THREE.Mesh(spikeGeo, spikeMat);
    centerSpire.position.set(impactX, impactY - 3.5, impactZ);
    centerSpire.scale.set(2.4, 0.1, 2.4);
    iceGroup.add(centerSpire);
    iceSpikes.push({ mesh: centerSpire, startY: impactY - 3.5, targetY: impactY + 2.2, baseScale: 2.2 });

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.25;
      const dist = (i % 2 === 0 ? 3.5 : 7.2) + Math.random() * 2.5;
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      const sx = impactX + Math.cos(angle) * dist;
      const sz = impactZ + Math.sin(angle) * dist;
      const sy = getTerrainHeight(sx, sz);

      spike.position.set(sx, sy - 2.5, sz);
      spike.rotation.x = (Math.random() - 0.5) * 0.45;
      spike.rotation.z = (Math.random() - 0.5) * 0.45;
      spike.scale.set(1.1, 0.1, 1.1);
      iceGroup.add(spike);
      iceSpikes.push({ mesh: spike, startY: sy - 2.5, targetY: sy + 1.2, baseScale: 0.9 + Math.random() * 0.55 });
    }
    this.scene.add(iceGroup);

    let elapsed = 0;
    let erupted = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        if (!erupted && elapsed >= 0.35) {
          erupted = true;
          sound.playGiantSwordImpact();
          if (this.particles) {
            this.particles.emitShockwave(hitPos, 0x00d2d3, 14.0, 0.5);
            this.particles.emitShockwave(hitPos, 0xffffff, 9.0, 0.35);
            this.particles.emitElementalParticles(hitPos, 42, [0x00d2d3, 0x7ed6df, 0xffffff], [3, 9], 0.7, 5.0, 1.2);
          }
          // Gây sát thương & ĐÓNG BĂNG CỨNG + Tạo Lồng Băng Tinh 3D trên từng mục tiêu trúng chiêu
          this.dealDamageAOE(hitPos, 14.0, 130, '❄️ -130 ĐÓNG BĂNG!', '#00d2d3', monsters, 'freeze', 'ice', null, character);
          for (const m of monsters || []) {
            if (!m.isDead && m.position.distanceTo(hitPos) <= 14.0 + m.hitRadius) {
              this.spawnIcePrison(m, 2.2);
            }
          }
          if (this.canHitPlayers(character) && this.remotePlayers) {
            for (const rp of this.remotePlayers) {
              if (!rp.isDead && rp.position.distanceTo(hitPos) <= 14.85) {
                this.spawnIcePrison(rp, 2.2);
              }
            }
          }
        }

        if (erupted) {
          const eruptTime = elapsed - 0.35;
          if (eruptTime < 0.22) {
            const p = eruptTime / 0.22;
            for (const s of iceSpikes) {
              s.mesh.position.y = THREE.MathUtils.lerp(s.startY, s.targetY, p);
              s.mesh.scale.y = THREE.MathUtils.lerp(0.1, s.baseScale, p);
            }
          } else if (elapsed > 2.2) {
            iceGroup.scale.multiplyScalar(0.96);
            if (elapsed >= 2.8) {
              this.scene.remove(iceGroup);
              spikeGeo.dispose();
              spikeMat.dispose();
              return false;
            }
          }
        }
        return true;
      }
    });
  }

  // [Pháp Sư 2] TINH VÂN DỊCH CHUYỂN (Để lại Phân Thân Gương Băng nổ vỡ tại chỗ cũ, mở Cổng Tinh Vân lướt 16m gây 85 ST & giải khống chế)
  castWindDash(targetPos, character, monsters) {
    if (!character) return;
    if (character?.triggerSkillCast) character.triggerSkillCast(2);

    if (character.freezeTimer > 0) character.freezeTimer = 0;
    if (character.slowTimer > 0) character.slowTimer = 0;
    this.damageTexts.spawn('✨ TINH VÂN GIẢI KHỐNG!', character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#00d2d3');

    const startPos = character.position.clone();
    const dir = PixelFXManager.flatDirection(startPos, targetPos);

    sound.playSwordSlash();
    if (this.controller) this.controller.addTrauma(0.18);

    const dashDistance = 16.0;
    const endPos = startPos.clone().addScaledVector(dir, dashDistance);
    endPos.x = THREE.MathUtils.clamp(endPos.x, -120, 120);
    endPos.z = THREE.MathUtils.clamp(endPos.z, -120, 120);
    endPos.y = getTerrainHeight(endPos.x, endPos.z);

    // 1. Tượng Gương Băng 3D để lại tại vị trí cũ + 5 Vòng Cổng Không Gian dọc đường dịch chuyển
    const warpGroup = new THREE.Group();
    const decoyGeo = new THREE.OctahedronGeometry(0.85, 0);
    const decoyMat = new THREE.MeshBasicMaterial({
      color: 0x48dbfb,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const decoyMesh = new THREE.Mesh(decoyGeo, decoyMat);
    decoyMesh.position.copy(startPos).add(new THREE.Vector3(0, 1.15, 0));
    decoyMesh.scale.set(0.8, 1.4, 0.8);
    warpGroup.add(decoyMesh);

    const ringGeo = new THREE.TorusGeometry(1.15, 0.06, 6, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d2d3,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 1; i <= 5; i++) {
      const p = startPos.clone().addScaledVector(dir, (dashDistance * i) / 5);
      p.y = getTerrainHeight(p.x, p.z) + 1.1;
      const rMesh = new THREE.Mesh(ringGeo, ringMat);
      rMesh.position.copy(p);
      rMesh.lookAt(p.clone().add(dir));
      warpGroup.add(rMesh);
    }
    this.scene.add(warpGroup);

    let warpElapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        warpElapsed += delta;
        decoyMesh.rotation.y += delta * 6.0;
        decoyMat.opacity = Math.max(0, 0.85 * (1 - warpElapsed / 0.65));
        ringMat.opacity = Math.max(0, 0.8 * (1 - warpElapsed / 0.65));
        if (warpElapsed >= 0.65) {
          if (this.particles) {
            this.particles.emitElementalParticles(decoyMesh.position, 14, [0x48dbfb, 0xffffff], [2, 6], 0.35, 0, 0.5);
          }
          this.scene.remove(warpGroup);
          decoyGeo.dispose();
          decoyMat.dispose();
          ringGeo.dispose();
          ringMat.dispose();
          return false;
        }
        return true;
      }
    });

    if (this.particles) {
      for (let d = 0; d <= dashDistance; d += 2) {
        const p = startPos.clone().addScaledVector(dir, d);
        p.y = getTerrainHeight(p.x, p.z) + 0.6;
        this.particles.emitElementalParticles(p, 4, [0x00d2d3, 0xffffff, 0x7ed6df], [2, 5], 0.4, 3.0, 0.6);
      }
      this.particles.emitShockwave(startPos, 0x00d2d3, 6.0, 0.3);
      this.particles.emitShockwave(endPos, 0x00d2d3, 8.0, 0.35);
    }

    if (character.startDash) {
      character.startDash(dir, dashDistance, 0.22);
    } else {
      character.position.copy(endPos);
      if (character.group) character.group.position.copy(endPos);
    }

    const midPos = startPos.clone().add(endPos).multiplyScalar(0.5);
    this.dealDamageAOE(midPos, 8.0, 85, '✨ -85 TINH VÂN!', '#00d2d3', monsters, 'knockback', 'ice', null, character);
    this.dealDamageAOE(endPos, 6.5, 85, '✨ -85 TINH VÂN!', '#00d2d3', monsters, 'knockback', 'ice', null, character);
  }

  // =========================================================================
  // KỸ NĂNG ĐẤU SĨ & PHÁP SƯ: HUYẾT PHỦ, HẮC ĐỘNG & NÚI LỬA
  // =========================================================================

  // [Đấu Sĩ 1] HUYẾT PHỦ TRẢM (Phóng Cự Phủ Huyết Khí Xoay 3D + 2 cánh sóng máu 24m, gây 125 ST & phóng Cầu Máu hút 60 HP; dưới 50% HP gây 165 ST & hút 120 HP)
  castBloodSlash(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(1);
    const startPos = character.position.clone();
    startPos.y += 1.1;
    const dir = PixelFXManager.flatDirection(startPos, targetPos);
    sound.playSwordSlash();

    if (this.controller) this.controller.addTrauma(0.22);

    const isBerserk = Boolean(character && character.hp < character.maxHp * 0.5);
    const slashDmg = isBerserk ? 165 : 125;
    const healAmount = isBerserk ? 120 : 60;
    const slashText = isBerserk ? '🔥🩸 -165 HUYẾT CUỒNG!' : '🩸 -125 HUYẾT PHỦ!';
    const healText = isBerserk ? '🩸 +120 HUYẾT CUỒNG!' : '🩸 +60 HÚT HUYẾT!';

    if (isBerserk && character) {
      this.damageTexts.spawn('🔥 HUYẾT CUỒNG (<50% HP)!', character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#ff3838');
    }

    // Lưỡi Cự Phủ Huyết Khí 3D nhiều lớp (vòng đao chính + vòng lửa phụ)
    const slashGroup = new THREE.Group();
    const bladeGeo = new THREE.TorusGeometry(1.75, 0.2, 6, 20, Math.PI * 1.15);
    const bladeMat = new THREE.MeshBasicMaterial({
      color: isBerserk ? 0xff3838 : 0xff4757,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
    bladeMesh.rotation.z = Math.PI / 2;
    slashGroup.add(bladeMesh);

    const innerGeo = new THREE.TorusGeometry(1.25, 0.12, 6, 16, Math.PI * 1.4);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffd32a,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.rotation.x = Math.PI / 2;
    slashGroup.add(innerMesh);

    slashGroup.position.copy(startPos);
    slashGroup.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2;
    this.scene.add(slashGroup);

    const SPEED = 40.0;
    const RANGE = 24.0;
    let travelled = 0;
    let hasHealed = false;
    const hitSet = new Set();

    this.activeEffects.push({
      update: (delta) => {
        const step = SPEED * delta;
        travelled += step;
        slashGroup.position.addScaledVector(dir, step);
        slashGroup.position.y = getTerrainHeight(slashGroup.position.x, slashGroup.position.z) + 1.1;
        bladeMesh.rotation.z += delta * 22;
        innerMesh.rotation.z -= delta * 18;

        if (this.particles && Math.random() < 0.75) {
          this.particles.emitElementalParticles(slashGroup.position, 3, [0xff4757, 0xffd32a, 0x2d3436], [1, 4], 0.32, 0, 0.5);
        }

        // Quét trúng quái vật
        if (monsters) {
          for (const m of monsters) {
            if (!m.isDead && !hitSet.has(m) && m.checkCollision(slashGroup.position, 1.8)) {
              hitSet.add(m);
              this.damageMonster(m, slashDmg, slashText, '#ff4757', slashGroup.position, character);

              if (!hasHealed && character && character.hp < character.maxHp) {
                hasHealed = true;
                this.spawnLightningArc(m.position.clone().add(new THREE.Vector3(0, 1.0, 0)), character.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xff4757, 0.4);
                const heal = Math.min(healAmount, character.maxHp - character.hp);
                character.hp += heal;
                if (character.updateBillboard) character.updateBillboard();
                this.damageTexts.spawn(healText, character.position.clone().add(new THREE.Vector3(0, 2.0, 0)), '#ff4757');
              }
            }
          }
        }

        // Quét trúng người chơi khác (PvP)
        if (this.canHitPlayers(character)) {
          const hitRps = this.damagePlayersNear(slashGroup.position, 1.9, slashDmg, slashText, '#ff4757', character, hitSet);
          if (hitRps.length > 0 && !hasHealed && character && character.hp < character.maxHp) {
            hasHealed = true;
            this.spawnLightningArc(hitRps[0].position.clone().add(new THREE.Vector3(0, 1.1, 0)), character.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xff4757, 0.4);
            const heal = Math.min(healAmount, character.maxHp - character.hp);
            character.hp += heal;
            if (character.updateBillboard) character.updateBillboard();
            this.damageTexts.spawn(healText, character.position.clone().add(new THREE.Vector3(0, 2.0, 0)), '#ff4757');
          }
        }

        if (travelled >= RANGE) {
          this.scene.remove(slashGroup);
          bladeGeo.dispose();
          bladeMat.dispose();
          innerGeo.dispose();
          innerMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [Pháp Sư 3] HẮC ĐỘNG KHÔNG GIAN (Quả cầu Chân Không + 2 Đĩa Bồi Tụ nghiêng + 8 thiên thạch xoáy hút toàn bộ kẻ địch vào tâm)
  castNetherVortex(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(3);
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const center = new THREE.Vector3(impactX, impactY, impactZ);

    sound.playSwordSummon();
    if (this.controller) this.controller.addTrauma(0.28);

    this.lastVortexPos = center.clone();
    this.vortexTimer = 3.5;

    this.spawnGroundDecalEffect('blood', new THREE.Vector3(impactX, impactY + 0.1, impactZ), 12, 3.5);

    // Mô hình Hắc Động Vũ Trụ 3D (Tâm Chân Không + 2 Đĩa Bồi Tụ nghiêng + 8 Mảnh Sao Băng Xoáy)
    const vortexGroup = new THREE.Group();
    vortexGroup.position.copy(center);

    const vortexGeo = new THREE.RingGeometry(0.8, 4.8, 36);
    vortexGeo.rotateX(-Math.PI / 2);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0x8854d0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
    vortexMesh.position.y = 0.15;
    vortexGroup.add(vortexMesh);

    // Tâm cầu chân không + Vỏ hào quang tím lam
    const coreGeo = new THREE.SphereGeometry(0.95, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x0a0612 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 1.25;
    vortexGroup.add(coreMesh);

    const accretionGeo = new THREE.TorusGeometry(2.1, 0.12, 8, 32);
    const accretionMat = new THREE.MeshBasicMaterial({
      color: 0x48dbfb,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const disk1 = new THREE.Mesh(accretionGeo, accretionMat);
    disk1.position.y = 1.25;
    disk1.rotation.x = Math.PI / 3;
    const disk2 = new THREE.Mesh(accretionGeo, vortexMat);
    disk2.position.y = 1.25;
    disk2.rotation.x = -Math.PI / 3;
    vortexGroup.add(disk1, disk2);

    this.scene.add(vortexGroup);

    let elapsed = 0;
    let tickTimer = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        tickTimer += delta;

        vortexMesh.rotation.z += delta * 10;
        disk1.rotation.z += delta * 8;
        disk2.rotation.y -= delta * 7;
        coreMesh.scale.setScalar(1.0 + Math.sin(elapsed * 14) * 0.16);

        // Lực hút chân không (Vortex Pull): Kéo quái vật về tâm
        if (monsters) {
          for (const m of monsters) {
            if (!m.isDead) {
              const d = m.position.distanceTo(center);
              if (d < 12.0 && d > 0.8) {
                m.position.lerp(center, delta * 3.5);
              }
            }
          }
        }

        if (this.canHitPlayers(character) && this.remotePlayers) {
          for (const rp of this.remotePlayers) {
            if (!rp.isDead) {
              const d = rp.position.distanceTo(center);
              if (d < 12.0 && d > 0.8) {
                rp.position.lerp(center, delta * 3.2);
              }
            }
          }
        }

        if (tickTimer >= 0.6) {
          tickTimer = 0;
          this.dealDamageAOE(center, 9.0, 35, '🌌 -35 HẮC ĐỘNG!', '#a55eea', monsters, null, 'fire', null, character);
          if (this.particles) {
            this.particles.emitElementalParticles(center, 14, [0x8854d0, 0x48dbfb, 0x1e272e], [1, 4], 0.5, 0, 0.6);
          }
        }

        if (elapsed >= 3.5) {
          if (this.lastVortexPos === center) this.lastVortexPos = null;
          if (this.particles) {
            this.particles.emitShockwave(center, 0x8854d0, 11.0, 0.45);
          }
          this.dealDamageAOE(center, 10.0, 60, '💥 -60 SỤP ĐỔ KHÔNG GIAN!', '#c084fc', monsters, 'knockback', 'fire', 40.0, character);
          this.scene.remove(vortexGroup);
          vortexGeo.dispose();
          vortexMat.dispose();
          coreGeo.dispose();
          coreMat.dispose();
          accretionGeo.dispose();
          accretionMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [Đấu Sĩ 4 - Ult] DUNG NHAM HỦY DIỆT (Đập vỡ đại địa dựng Núi Lửa Phun Trào 3D + 8 Vết Nứt Dung Nham 16m gây 250–325 ST)
  castHellfireCataclysm(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(4);
    const center = character ? character.position.clone() : targetPos.clone();
    center.y = getTerrainHeight(center.x, center.z);

    sound.playGiantSwordImpact();
    if (this.controller) this.controller.addTrauma(0.88);
    if (this.onScreenFlash) this.onScreenFlash('fire');

    if (this.world && this.world.deformTerrain) {
      this.world.deformTerrain(center.x, center.z, 15.0, 2.4, 'fire');
    }

    this.spawnGroundDecalEffect('fire', new THREE.Vector3(center.x, center.y + 0.12, center.z), 22.0, 2.4);

    // Miệng Núi Lửa 3D + 8 Khe Nứt Dung Nham Rực Sáng tỏa ra 8 hướng
    const volcanoGroup = new THREE.Group();
    volcanoGroup.position.copy(center);
    const coneGeo = new THREE.CylinderGeometry(1.8, 4.6, 3.2, 10, 1, true);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      emissive: 0xff3838,
      emissiveIntensity: 0.75,
      roughness: 0.8,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.y = 1.4;
    volcanoGroup.add(coneMesh);

    const fissureGeo = new THREE.BoxGeometry(0.45, 0.25, 13.5);
    const fissureMat = new THREE.MeshBasicMaterial({
      color: 0xffd32a,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 4; i++) {
      const fMesh = new THREE.Mesh(fissureGeo, fissureMat);
      fMesh.position.y = 0.15;
      fMesh.rotation.y = (i / 4) * Math.PI;
      volcanoGroup.add(fMesh);
    }
    this.scene.add(volcanoGroup);

    let vElapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        vElapsed += delta;
        if (vElapsed < 0.25) {
          coneMesh.scale.y = vElapsed / 0.25;
        } else if (vElapsed > 1.4) {
          volcanoGroup.position.y -= delta * 2.5;
          fissureMat.opacity = Math.max(0, 0.95 * (1 - (vElapsed - 1.4) / 0.8));
        }
        if (this.particles && Math.random() < 0.7) {
          this.particles.emitElementalParticles(center.clone().add(new THREE.Vector3(0, 2.2, 0)), 3, [0xff3838, 0xffd32a, 0xff793f], [3, 9], 0.5, 2, 0.8);
        }
        if (vElapsed >= 2.2) {
          this.scene.remove(volcanoGroup);
          coneGeo.dispose();
          coneMat.dispose();
          fissureGeo.dispose();
          fissureMat.dispose();
          return false;
        }
        return true;
      }
    });

    if (this.particles) {
      this.particles.emitShockwave(center, 0xff3838, 20.0, 0.7);
      this.particles.emitShockwave(center, 0xffd32a, 14.0, 0.5);
      this.particles.emitElementalParticles(center, 65, [0xff3838, 0xeb3b5a, 0xffd32a, 0x2d3436], [6, 16], 0.9, 6.5, 1.8);
    }

    const inVortex = (this.lastVortexPos && center.distanceTo(this.lastVortexPos) <= 12.0 && this.vortexTimer > 0) || (character && character.hp < character.maxHp * 0.5);
    const actualDamage = inVortex ? 325 : 250;
    const blastText = inVortex ? '🌋🔥 -325 DUNG NHAM BẠO PHÁT!' : '🌋 -250 DUNG NHAM HỦY DIỆT!';

    this.dealDamageAOE(center, 16.0, actualDamage, blastText, '#ff5252', monsters, 'knockback', 'fire', 55.0, character);
  }

  // =========================================================================
  // KỸ NĂNG XẠ THỦ: LÔI TIỄN, PHI VŨ & CHẤN ĐỊA
  // =========================================================================

  // [Xạ Thủ 1] LIÊN HOÀN LÔI TIỄN (Sét đánh bổ xuống mục tiêu 140 ST + phóng Tia Sét 3D giật lan 60 ST sang 4 mục tiêu)
  castChainLightning(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(1);
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

    if (sound.playThunder) {
      sound.playThunder();
    } else if (sound.playGiantSwordImpact) {
      sound.playGiantSwordImpact();
    }

    if (this.controller) this.controller.addTrauma(0.35);
    if (this.onScreenFlash) this.onScreenFlash('lightning');

    this.spawnTelegraph(hitPos, 0xffd32a, 0.8, 8.0);
    this.spawnGroundDecalEffect('lightning', new THREE.Vector3(impactX, impactY + 0.1, impactZ), 12, 2.0);

    // Đường tên sét nối từ Xạ Thủ tới điểm nổ
    if (character && character.position) {
      this.spawnLightningArc(character.position.clone().add(new THREE.Vector3(0, 1.3, 0)), hitPos.clone().add(new THREE.Vector3(0, 1.0, 0)), 0xffd32a, 0.35);
    }

    // Cột sét giáng từ trời xuống (2 lớp: Lõi trắng + Vỏ vàng kim quang)
    const boltGroup = new THREE.Group();
    boltGroup.position.set(impactX, impactY, impactZ);

    const innerGeo = new THREE.CylinderGeometry(0.35, 0.65, 50, 8);
    innerGeo.translate(0, 25, 0);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const innerBolt = new THREE.Mesh(innerGeo, innerMat);
    boltGroup.add(innerBolt);

    const outerGeo = new THREE.CylinderGeometry(1.1, 1.6, 50, 8);
    outerGeo.translate(0, 25, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xffd32a,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const outerBolt = new THREE.Mesh(outerGeo, outerMat);
    boltGroup.add(outerBolt);

    this.scene.add(boltGroup);

    if (this.particles) {
      this.particles.emitShockwave(hitPos, 0xffd32a, 14.0, 0.45);
      this.particles.emitShockwave(hitPos, 0xffffff, 8.0, 0.3);
      this.particles.emitElementalParticles(hitPos, 45, [0xffd32a, 0xffffff, 0x74b9ff], [3, 9], 0.75, 6.0, 1.2);
    }

    this.dealDamageAOE(hitPos, 8.5, 140, '⚡ -140 LÔI TIỄN!', '#ffd32a', monsters, null, 'lightning', null, character);

    if (monsters) {
      for (const m of monsters) {
        if (!m.isDead && m.position.distanceTo(hitPos) <= 8.5) {
          if (m.freeze) m.freeze(1.2);
          this.spawnStunHalo(m, 1.2, 0xffd32a);
        }
      }
    }
    if (this.canHitPlayers(character) && this.remotePlayers) {
      for (const rp of this.remotePlayers) {
        if (!rp.isDead && rp.position.distanceTo(hitPos) <= 8.5) {
          if (rp.slow) rp.slow(2.5, 0.45);
        }
      }
    }

    // Sét giật lan 3D (Chain Lightning Arcs) sang 4 mục tiêu lân cận trong 14m
    const arcOrigin = hitPos.clone().add(new THREE.Vector3(0, 1.2, 0));
    if (monsters) {
      let chained = 0;
      for (const m of monsters) {
        if (!m.isDead && chained < 4) {
          const d = m.position.distanceTo(hitPos);
          if (d > 3.0 && d < 14.0) {
            chained++;
            this.spawnLightningArc(arcOrigin, m.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0x74b9ff, 0.45);
            this.damageMonster(m, 60, '⚡ -60 GIẬT LAN!', '#74b9ff', hitPos, character);
          }
        }
      }
    }

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const progress = elapsed / 0.38;
        boltGroup.scale.x = Math.max(0, 1.0 - progress);
        boltGroup.scale.z = boltGroup.scale.x;
        outerMat.opacity = Math.max(0, 0.65 * (1.0 - progress));

        if (elapsed >= 0.38) {
          this.scene.remove(boltGroup);
          innerGeo.dispose();
          innerMat.dispose();
          outerGeo.dispose();
          outerMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [Xạ Thủ 2] PHI VŨ THOÁT THÂN (Linh ảnh Bạch Hạc vỗ cánh lướt 24m + 5 Vòng Gió Tăng Tốc 3D + tăng 45% tốc chạy)
  castCraneGlide(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(2);
    const startPos = character.position.clone();
    startPos.y += 1.2;
    const dir = PixelFXManager.flatDirection(startPos, targetPos);
    sound.playSwordSlash();

    if (this.controller) this.controller.addTrauma(0.2);

    if (character) {
      if (character.freezeTimer > 0) character.freezeTimer = 0;
      if (character.slowTimer > 0) character.slowTimer = 0;
      character.speedBoostTimer = 4.0;
      this.damageTexts.spawn('🪶 +45% TỐC ĐỘ / MIỄN KHỐNG!', character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#2ed573');
    }

    // Mô hình Linh Ảnh Bạch Hạc sải cánh vỗ nhịp nhàng
    const craneGroup = new THREE.Group();
    craneGroup.position.copy(startPos);
    craneGroup.rotation.y = Math.atan2(dir.x, dir.z);

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xf5f6fa,
      emissive: 0x2ed573,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      flatShading: true,
    });

    const bodyMesh = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.4, 5), wingMat);
    bodyMesh.rotation.x = Math.PI / 2;
    craneGroup.add(bodyMesh);

    const wings = [];
    for (const side of [1, -1]) {
      const wingGeo = new THREE.BoxGeometry(4.0, 0.1, 1.3);
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(side * 2.2, 0.2, 0);
      wing.rotation.z = side * -0.2;
      craneGroup.add(wing);
      wings.push({ mesh: wing, side });
    }
    this.scene.add(craneGroup);

    // 5 Vòng Gió Siêu Thanh (Wind Tunnel Rings) để lại dọc đường lướt
    const hoopGeo = new THREE.TorusGeometry(1.4, 0.06, 6, 24);
    const hoopMat = new THREE.MeshBasicMaterial({
      color: 0x2ed573,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
    });
    const hoops = [];
    let nextHoopDist = 3.0;

    const SPEED = 38.0;
    const RANGE = 24.0;
    let travelled = 0;
    let elapsed = 0;
    const hitSet = new Set();

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const step = SPEED * delta;
        travelled += step;
        craneGroup.position.addScaledVector(dir, step);
        craneGroup.position.y = getTerrainHeight(craneGroup.position.x, craneGroup.position.z) + 1.2;

        // Vỗ cánh linh hạc mượt mà
        for (const w of wings) {
          w.mesh.rotation.z = w.side * Math.sin(elapsed * 28) * 0.42;
        }

        if (travelled >= nextHoopDist && hoops.length < 5) {
          nextHoopDist += 4.2;
          const hMesh = new THREE.Mesh(hoopGeo, hoopMat);
          hMesh.position.copy(craneGroup.position);
          hMesh.lookAt(craneGroup.position.clone().add(dir));
          this.scene.add(hMesh);
          hoops.push(hMesh);
        }

        for (const h of hoops) {
          h.scale.multiplyScalar(1 + delta * 1.5);
        }

        if (this.particles && Math.random() < 0.7) {
          this.particles.emitElementalParticles(craneGroup.position, 3, [0xf5f6fa, 0x2ed573, 0xffffff], [2, 5], 0.4, 0, 0.6);
        }

        if (monsters) {
          for (const m of monsters) {
            if (!m.isDead && !hitSet.has(m) && m.checkCollision(craneGroup.position, 2.6)) {
              hitSet.add(m);
              this.damageMonster(m, 100, '🪶 -100 PHI VŨ!', '#2ed573', craneGroup.position, character);
              m.position.y += 3.5;
            }
          }
        }

        if (this.canHitPlayers(character)) {
          this.damagePlayersNear(craneGroup.position, 2.6, 100, '🪶 -100 PHI VŨ!', '#2ed573', character, hitSet);
        }

        if (travelled >= RANGE) {
          this.scene.remove(craneGroup);
          for (const h of hoops) this.scene.remove(h);
          hoopGeo.dispose();
          hoopMat.dispose();
          wingMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [Xạ Thủ 3] CHẤN ĐỊA ĐẨY LÙI (Bung Vòm Phong Áp Ngọc Lục Bảo + 12 Lưỡi Đao Gió 3D đẩy văng mọi kẻ địch áp sát 180 ST)
  castEarthquakeStomp(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(3);
    const center = character ? character.position.clone() : targetPos.clone();
    center.y = getTerrainHeight(center.x, center.z);

    sound.playGiantSwordImpact();
    if (this.controller) this.controller.addTrauma(0.75);
    if (this.onScreenFlash) this.onScreenFlash('earth');

    if (this.world && this.world.deformTerrain) {
      this.world.deformTerrain(center.x, center.z, 15.0, 2.2, 'earth');
    }

    // Vòm Phong Áp 3D + 12 Lưỡi Đao Gió bung tỏa ra 12 hướng đẩy lùi kẻ địch
    const repulseGroup = new THREE.Group();
    repulseGroup.position.copy(center);
    const domeGeo = new THREE.SphereGeometry(1.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x2ed573,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    repulseGroup.add(domeMesh);

    const windBladeGeo = new THREE.TorusGeometry(0.9, 0.1, 6, 14, Math.PI);
    const windBladeMat = new THREE.MeshBasicMaterial({
      color: 0xffd32a,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const blades = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const bMesh = new THREE.Mesh(windBladeGeo, windBladeMat);
      bMesh.position.set(Math.cos(a) * 1.5, 0.9, Math.sin(a) * 1.5);
      bMesh.rotation.x = Math.PI / 2;
      bMesh.rotation.z = -a;
      repulseGroup.add(bMesh);
      blades.push({ mesh: bMesh, dx: Math.cos(a), dz: Math.sin(a) });
    }
    this.scene.add(repulseGroup);

    let rElapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        rElapsed += delta;
        const p = Math.min(1.0, rElapsed / 0.45);
        const s = 1.0 + p * 8.5;
        domeMesh.scale.set(s, 1.0 + p * 2.5, s);
        domeMat.opacity = Math.max(0, 0.85 * (1 - p));
        windBladeMat.opacity = Math.max(0, 0.9 * (1 - p));
        for (const b of blades) {
          b.mesh.position.x += b.dx * 28 * delta;
          b.mesh.position.z += b.dz * 28 * delta;
        }
        if (rElapsed >= 0.45) {
          this.scene.remove(repulseGroup);
          domeGeo.dispose();
          domeMat.dispose();
          windBladeGeo.dispose();
          windBladeMat.dispose();
          return false;
        }
        return true;
      }
    });

    if (this.particles) {
      this.particles.emitShockwave(center, 0x2ed573, 18.0, 0.65);
      this.particles.emitShockwave(center, 0xffd32a, 12.0, 0.45);
      this.particles.emitElementalParticles(center, 50, [0x2ed573, 0xffd32a, 0xffffff], [5, 14], 0.85, 6.0, 1.5);
    }

    this.dealDamageAOE(center, 15.0, 180, '💨 -180 CHẤN ĐỊA ĐẨY LÙI!', '#2ed573', monsters, 'knockback', 'earth', 60.0, character);
  }

  // TẠO HIỆU ỨNG PIXEL ART VẼ BẰNG CANVAS ĐẶT NẰM TRÊN MẶT ĐẤT
  spawnGroundDecalEffect(type, position, size, duration) {
    const pixelCanvas = new PixelCanvasEffect(64);
    const planeGeo = new THREE.PlaneGeometry(size, size);
    planeGeo.rotateX(-Math.PI / 2);

    const planeMat = new THREE.MeshBasicMaterial({
      map: pixelCanvas.texture,
      transparent: true,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.position.copy(position);
    this.scene.add(mesh);

    let elapsed = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const progress = Math.min(1.0, elapsed / duration);

        if (type === 'fire') pixelCanvas.drawFireExplosion(progress);
        else if (type === 'lightning') pixelCanvas.drawLightning(progress);
        else if (type === 'ice') pixelCanvas.drawFrostNova(progress);
        else if (type === 'earth') pixelCanvas.drawEarthquake(progress);
        else if (type === 'sword') pixelCanvas.drawSwordArray(progress);
        else if (type === 'bagua') pixelCanvas.drawBagua(progress);
        else if (type === 'blood') pixelCanvas.drawBloodRune(progress);

        if (progress >= 1.0) {
          this.scene.remove(mesh);
          return false;
        }
        return true;
      }
    });
  }

  // XỬ LÝ SÁT THƯƠNG DIỆN RỘNG (AOE), TƯƠNG TÁC MÔI TRƯỜNG & HIỆU ỨNG TRẠNG THÁI (ÁP DỤNG KHẮC CHẾ VAI TRÒ)
  dealDamageAOE(epicenter, radius, amount, text, textColor, monsters, statusEffect = null, elementType = 'neutral', customForce = null, caster = null) {
    if (this.world && this.world.interactWithArea) {
      const force = customForce !== null ? customForce : (amount >= 200 ? 55 : (amount >= 150 ? 25 : (amount >= 120 ? 19 : 14)));
      this.world.interactWithArea(epicenter, radius * 1.15, force, elementType);
    }

    const attackerRole = caster?.outfitIndex ?? this.currentSectIndex;

    // 2. Gây sát thương PvP diện rộng lên người chơi khác
    if (this.canHitPlayers(caster) && this.remotePlayers.length > 0) {
      for (const rp of this.remotePlayers) {
        if (!rp.isDead) {
          const dist = rp.position.distanceTo(epicenter);
          if (dist <= radius + 0.85) {
            const targetRole = rp.outfitIndex ?? -1;
            const counterMult = getRoleCounterMultiplier(attackerRole, targetRole);
            const finalAmount = Math.round(amount * counterMult);
            if (this.onHitPlayer) {
              this.onHitPlayer(rp.id, finalAmount, rp.position.clone().add(new THREE.Vector3(0, 1.2, 0)), elementType, counterMult > 1.05, false);
            }
            if (statusEffect === 'freeze' && rp.freeze) {
              rp.freeze(2.2);
            }
            if (this.damageTexts) {
              const hitPos = rp.position.clone().add(new THREE.Vector3(0, 1.8, 0));
              const finalText = counterMult > 1.05 ? `${text} 💥KHẮC CHẾ` : text;
              this.damageTexts.spawn(finalText, hitPos, counterMult > 1.05 ? '#ffd700' : textColor);
            }
            if (this.particles) {
              this.particles.emitHitSparkles(rp.position, 16);
            }
          }
        }
      }
    }

    if (!monsters) return;

    for (const monster of monsters) {
      if (!monster.isDead) {
        const dist = monster.position.distanceTo(epicenter);
        if (dist <= radius + monster.hitRadius) {
          const monsterRole = getMonsterRoleIndex(monster);
          const counterMult = getRoleCounterMultiplier(attackerRole, monsterRole);
          const finalAmount = Math.round(amount * counterMult);
          monster.takeDamage(finalAmount, epicenter);

          // Áp dụng trạng thái khống chế
          if (statusEffect === 'freeze' && monster.freeze) {
            monster.freeze(2.8);
          } else if (statusEffect === 'knockback' && monster.knockback) {
            monster.knockback(epicenter, 14);
          }

          const hitPos = monster.position.clone();
          hitPos.y += monster.hitHeight * 0.7;
          const finalText = counterMult > 1.05 ? `${text} 💥KHẮC CHẾ` : text;
          this.damageTexts.spawn(finalText, hitPos, counterMult > 1.05 ? '#ffd700' : textColor);
          this.particles.emitHitSparkles(hitPos, 16);
        }
      }
    }
  }

  // [NAMCAM 1] HỒI CHIỀU TRỜI MƯA (Bong bóng thoại trên đầu + Mưa bão ngập lụt 28 ST/nhịp & chậm 50%)
  spawnSpeechBubble(character, text = 'Hồi chiều trời mưa 🌧️', duration = 3.8) {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');

    // Nền bong bóng thoại hoạt hình bo tròn
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(12, 12, 336, 90, 18);
    ctx.fill();
    ctx.stroke();

    // Mũi nhọn bong bóng chỉ xuống đầu nhân vật
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(160, 102);
    ctx.lineTo(180, 134);
    ctx.lineTo(200, 102);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(162, 100, 36, 6);

    // Chữ trong bong bóng
    ctx.fillStyle = '#1e272e';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 180, 56);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.4, 1.3, 1.0);
    this.scene.add(sprite);

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        if (!character || character.isDead || elapsed >= duration) {
          this.scene.remove(sprite);
          spriteMat.dispose();
          texture.dispose();
          return false;
        }
        const headY = character.position.y + 2.65 + Math.sin(elapsed * 4) * 0.08;
        sprite.position.set(character.position.x, headY, character.position.z);
        if (elapsed > duration - 0.5) {
          spriteMat.opacity = Math.max(0, (duration - elapsed) / 0.5);
        }
        return true;
      }
    });
  }

  castRainSpeech(targetPos, character, monsters) {
    if (character.triggerSkillCast) character.triggerSkillCast(1);
    this.spawnSpeechBubble(character, 'Hồi chiều trời mưa 🌧️', 4.0);

    const center = targetPos ? targetPos.clone() : character.position.clone().add(new THREE.Vector3(0, 0, 7));
    center.y = getTerrainHeight(center.x, center.z);

    if (sound.playThunder) sound.playThunder();
    if (sound.playWaterSplash) sound.playWaterSplash();

    // Mây đen tích điện trên cao
    const cloudGroup = new THREE.Group();
    cloudGroup.position.set(center.x, center.y + 7.5, center.z);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x34495e,
      roughness: 0.9,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 7; i++) {
      const cMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + Math.random() * 0.8, 1), cloudMat);
      cMesh.position.set((Math.random() - 0.5) * 5.0, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 5.0);
      cloudGroup.add(cMesh);
    }
    this.scene.add(cloudGroup);

    // Vệt mưa rơi xối xả
    const rainCount = 42;
    const rainGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0x74b9ff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rainMeshes = [];
    for (let i = 0; i < rainCount; i++) {
      const rMesh = new THREE.Mesh(rainGeo, rainMat);
      rMesh.position.set(
        center.x + (Math.random() - 0.5) * 9.0,
        center.y + 0.5 + Math.random() * 7.0,
        center.z + (Math.random() - 0.5) * 9.0
      );
      this.scene.add(rMesh);
      rainMeshes.push(rMesh);
    }

    const duration = 4.8;
    let elapsed = 0;
    let tickTimer = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        tickTimer += delta;

        for (const rm of rainMeshes) {
          rm.position.y -= delta * 18;
          if (rm.position.y < center.y + 0.2) {
            rm.position.y = center.y + 7.0 + Math.random() * 1.5;
            rm.position.x = center.x + (Math.random() - 0.5) * 9.0;
            rm.position.z = center.z + (Math.random() - 0.5) * 9.0;
          }
        }
        cloudGroup.rotation.y += delta * 0.2;

        if (tickTimer >= 0.35) {
          tickTimer = 0;
          if (this.canHitPlayers(character)) {
            this.dealDamageAOE(center, 7.5, 28, '🌧️ -28 MƯA NGẬP', '#0984e3', monsters, 'slow', 'water', null, character);
          }
          if (this.particles) {
            this.particles.emitElementalParticles(center, 4, [0x74b9ff, 0x0984e3, 0xffffff], [1, 3], 0.2, 0, 0.3);
          }
        }

        if (elapsed >= duration) {
          this.scene.remove(cloudGroup);
          for (const rm of rainMeshes) {
            this.scene.remove(rm);
            rm.geometry.dispose();
          }
          cloudMat.dispose();
          rainMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [NAMCAM] Dựng mô hình 3D Kiosk Dịch Vụ Công chân thực theo ảnh mẫu (Tỉ lệ chuẩn x3 khổng lồ)
  createKiosk3DModel() {
    const root = new THREE.Group();

    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      roughness: 0.25,
      metalness: 0.08,
    });
    const blackTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1b1c1e,
      roughness: 0.35,
      metalness: 0.2,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      roughness: 0.45,
      metalness: 0.4,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xdfe6e9,
      roughness: 0.15,
      metalness: 0.85,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0a192f,
      roughness: 0.1,
      metalness: 0.5,
      emissive: 0x00cec9,
      emissiveIntensity: 0.25,
    });

    // 1. CHÂN ĐẾ NẶNG (BASE PEDESTAL x3)
    const baseBottom = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.26, 3.0),
      blackTrimMat
    );
    baseBottom.position.y = 0.13;
    root.add(baseBottom);

    const baseStep = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.16, 2.7),
      darkMetalMat
    );
    baseStep.position.y = 0.32;
    root.add(baseStep);

    // 4 chân cao su dưới đế
    const footGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.08, 12);
    [
      [-1.7, 0.04, -1.3],
      [1.7, 0.04, -1.3],
      [-1.7, 0.04, 1.3],
      [1.7, 0.04, 1.3]
    ].forEach(([fx, fy, fz]) => {
      const foot = new THREE.Mesh(footGeo, blackTrimMat);
      foot.position.set(fx, fy, fz);
      root.add(foot);
    });

    // 2. THÂN DƯỚI DẠNG KHỐI TRỤ (LOWER CABINET TOWER)
    // Cao 4.2m, rộng 3.1m, sâu 1.8m
    const lowerHeight = 4.2;
    const lowerY = 0.4 + lowerHeight / 2; // 2.5
    const bodyMain = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, lowerHeight, 1.8),
      whiteMat
    );
    bodyMain.position.set(0, lowerY, 0);
    root.add(bodyMain);

    // Ốp viền đen 2 bên sườn máy (đặc trưng từ ảnh mẫu)
    const trimLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, lowerHeight, 1.84),
      blackTrimMat
    );
    trimLeft.position.set(-1.55, lowerY, 0);
    root.add(trimLeft);

    const trimRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, lowerHeight, 1.84),
      blackTrimMat
    );
    trimRight.position.set(1.55, lowerY, 0);
    root.add(trimRight);

    // Cánh cửa kỹ thuật bảo trì phía dưới (Front maintenance door)
    const frontDoor = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.0, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.35 })
    );
    frontDoor.position.set(0, 1.5, 0.92);
    root.add(frontDoor);

    // Ổ khoá và chìa khóa cắm ở cửa dưới
    const lockCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.06, 16),
      chromeMat
    );
    lockCylinder.rotation.x = Math.PI / 2;
    lockCylinder.position.set(-1.0, 1.7, 0.95);
    root.add(lockCylinder);

    const keyRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.02, 8, 16),
      chromeMat
    );
    keyRing.position.set(-1.0, 1.62, 0.98);
    root.add(keyRing);

    // Khay xuất giấy tờ A4 (A4 Document dispenser tray bên trái)
    const docBayOuter = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.95, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xdfdfdf, roughness: 0.4 })
    );
    docBayOuter.position.set(-0.55, 3.25, 0.94);
    root.add(docBayOuter);

    const docSlotInner = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.7, 0.14),
      darkMetalMat
    );
    docSlotInner.position.set(-0.55, 3.25, 0.97);
    root.add(docSlotInner);

    const docTrayLip = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.08, 0.22),
      whiteMat
    );
    docTrayLip.position.set(-0.55, 2.85, 1.02);
    root.add(docTrayLip);

    // Hốc máy in phiếu số thứ tự (Receipt printer bên phải)
    const printerSlot = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.45, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.3 })
    );
    printerSlot.position.set(0.8, 3.45, 0.94);
    root.add(printerSlot);

    // Mẩu giấy in số thứ tự thò ra ngoài
    const receiptPaper = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.2, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    receiptPaper.position.set(0.8, 3.37, 0.99);
    receiptPaper.rotation.x = 0.22;
    root.add(receiptPaper);

    // Cửa kính quét mã QR / Barcode / CCCD
    const scannerWindow = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.42, 0.06),
      glassMat
    );
    scannerWindow.position.set(0.8, 2.85, 0.94);
    root.add(scannerWindow);

    // Khe cắm căn cước công dân gắn chip (CCCD slot)
    const cardSlot = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.06, 0.08),
      darkMetalMat
    );
    cardSlot.position.set(0.8, 3.85, 0.94);
    root.add(cardSlot);

    // Bảng tên thương hiệu "KIOSK DỊCH VỤ CÔNG"
    let badgeTex = null;
    if (typeof document !== 'undefined') {
      const badgeCanvas = document.createElement('canvas');
      badgeCanvas.width = 512;
      badgeCanvas.height = 100;
      const bctx = badgeCanvas.getContext('2d');
      bctx.fillStyle = '#dfe4ea';
      bctx.beginPath();
      bctx.roundRect(10, 10, 492, 80, 24);
      bctx.fill();
      bctx.strokeStyle = '#b2bec3';
      bctx.lineWidth = 4;
      bctx.stroke();

      bctx.fillStyle = '#0984e3';
      bctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
      bctx.textAlign = 'center';
      bctx.textBaseline = 'middle';
      bctx.fillText('KIOSK DỊCH VỤ CÔNG', 256, 50);

      badgeTex = new THREE.CanvasTexture(badgeCanvas);
      const badgeMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 0.48),
        new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true })
      );
      badgeMesh.position.set(0, 4.18, 0.92);
      root.add(badgeMesh);
    }

    // 3. ĐẦU MÁY VÁT NGHIÊNG & MÀN HÌNH CẢM ỨNG (UPPER TILTED HEAD & SCREEN)
    // Nghiêng về sau ~18 độ (-0.32 rad) như thiết kế công thái học trong ảnh
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 4.5, 0.15);
    headGroup.rotation.x = -0.32;
    root.add(headGroup);

    const headHeight = 3.6;
    const headDepth = 1.4;
    const headBox = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, headHeight, headDepth),
      whiteMat
    );
    headBox.position.set(0, headHeight / 2, 0);
    headGroup.add(headBox);

    // Viền đen 2 bên đầu máy
    const headTrimLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, headHeight, headDepth + 0.04),
      blackTrimMat
    );
    headTrimLeft.position.set(-1.55, headHeight / 2, 0);
    headGroup.add(headTrimLeft);

    const headTrimRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, headHeight, headDepth + 0.04),
      blackTrimMat
    );
    headTrimRight.position.set(1.55, headHeight / 2, 0);
    headGroup.add(headTrimRight);

    // Mái che đỉnh đầu máy vát đen
    const topCap = new THREE.Mesh(
      new THREE.BoxGeometry(3.35, 0.18, headDepth + 0.1),
      blackTrimMat
    );
    topCap.position.set(0, headHeight + 0.08, 0);
    headGroup.add(topCap);

    // Màn hình cảm ứng lớn phát sáng (Windows 10/11 Desktop + Cổng DVC)
    let screenTex = null;
    if (typeof document !== 'undefined') {
      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 640;
      screenCanvas.height = 420;
      const sctx = screenCanvas.getContext('2d');

      // Gradient nền xanh Windows huyền thoại
      const grad = sctx.createLinearGradient(0, 0, 640, 420);
      grad.addColorStop(0, '#0052d4');
      grad.addColorStop(0.5, '#4364f7');
      grad.addColorStop(1, '#6fb1fc');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 640, 420);

      // Chùm sáng vệt kính Windows bloom
      sctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      sctx.beginPath();
      sctx.moveTo(320, 0);
      sctx.lineTo(640, 420);
      sctx.lineTo(160, 420);
      sctx.closePath();
      sctx.fill();

      // Logo Windows 4 ô vuông
      sctx.fillStyle = '#ffffff';
      const logoX = 320, logoY = 165, size = 44, gap = 8;
      sctx.fillRect(logoX - size - gap / 2, logoY - size - gap / 2, size, size);
      sctx.fillRect(logoX + gap / 2, logoY - size - gap / 2, size, size);
      sctx.fillRect(logoX - size - gap / 2, logoY + gap / 2, size, size);
      sctx.fillRect(logoX + gap / 2, logoY + gap / 2, size, size);

      // Tiêu đề Cổng Dịch Vụ Công
      sctx.fillStyle = '#ffffff';
      sctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
      sctx.textAlign = 'center';
      sctx.fillText('CỔNG DỊCH VỤ CÔNG QUỐC GIA', 320, 270);

      sctx.fillStyle = '#ffd32a';
      sctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
      sctx.fillText('--- CHẠM MÀN HÌNH ĐỂ BỐC SỐ ---', 320, 310);

      // Thanh Taskbar dưới cùng
      sctx.fillStyle = 'rgba(15, 20, 35, 0.9)';
      sctx.fillRect(0, 375, 640, 45);
      sctx.fillStyle = '#00a8ff';
      sctx.fillRect(16, 386, 22, 22); // Nút Start
      sctx.fillStyle = '#ffffff';
      sctx.font = '16px monospace';
      sctx.textAlign = 'right';
      sctx.fillText('12:00 PM | 🇻🇳', 620, 403);

      screenTex = new THREE.CanvasTexture(screenCanvas);
    }

    const screenMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.1,
      emissive: 0x0078d7,
      emissiveIntensity: 0.5,
    });

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.7, 1.9),
      screenMat
    );
    screenMesh.position.set(0, 1.9, headDepth / 2 + 0.02);
    headGroup.add(screenMesh);

    // Cụm Camera nhận diện khuôn mặt / eKYC phía trên màn hình
    const cameraBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.16, 0.04),
      blackTrimMat
    );
    cameraBar.position.set(0, 3.15, headDepth / 2 + 0.02);
    headGroup.add(cameraBar);

    const lensDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.04, 16),
      new THREE.MeshBasicMaterial({ color: 0x00d2d3 })
    );
    lensDot.position.set(-0.15, 3.15, headDepth / 2 + 0.05);
    headGroup.add(lensDot);

    const irDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.03, 16),
      new THREE.MeshBasicMaterial({ color: 0xff3838 })
    );
    irDot.position.set(0.15, 3.15, headDepth / 2 + 0.05);
    headGroup.add(irDot);

    return { root, screenMat, badgeTex, screenTex };
  }

  // [NAMCAM 2] KIOSK DỊCH VỤ CÔNG (Dựng mô hình 3D Kiosk thực tế gấp 3 lần, rớt từ trời cao 42m, giáng 180 ST, khống chế điện từ 5s toàn vùng 12m)
  castKioskStrike(targetPos, character, monsters) {
    if (character.triggerSkillCast) character.triggerSkillCast(2);
    const center = targetPos ? targetPos.clone() : character.position.clone().add(new THREE.Vector3(0, 0, 8));
    center.y = getTerrainHeight(center.x, center.z);

    // Bán kính cảnh báo mở rộng theo kích thước x3 (12.0m)
    this.spawnTelegraph(center, 0x00d2d3, 0.9, 12.0);

    const { root: kioskGroup, screenMat, badgeTex, screenTex } = this.createKiosk3DModel();

    // Hướng mặt trước màn hình Kiosk về phía người chơi
    if (character && character.position) {
      kioskGroup.lookAt(character.position.x, kioskGroup.position.y, character.position.z);
    }

    // Khởi đầu rơi từ trời cao 42m
    kioskGroup.position.set(center.x, center.y + 42.0, center.z);
    this.scene.add(kioskGroup);

    let state = 'falling';
    const fallSpeed = 58;
    let groundedTime = 0;
    const stunDuration = 5.0;

    // Vành đai điện từ xung quanh Kiosk (bán kính 12m)
    const lightningGeo = new THREE.RingGeometry(11.2, 12.0, 36);
    lightningGeo.rotateX(-Math.PI / 2);
    const lightningMat = new THREE.MeshBasicMaterial({
      color: 0x00d2d3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const lightningRing = new THREE.Mesh(lightningGeo, lightningMat);
    lightningRing.position.set(center.x, center.y + 0.12, center.z);
    lightningRing.visible = false;
    this.scene.add(lightningRing);

    this.activeEffects.push({
      update: (delta) => {
        if (state === 'falling') {
          kioskGroup.position.y -= fallSpeed * delta;
          if (this.particles) {
            this.particles.emitElementalParticles(kioskGroup.position, 3, [0x00d2d3, 0xffffff, 0x74b9ff], [0.4, 1.2], 0.3, 0, 0.4);
          }

          if (kioskGroup.position.y <= center.y) {
            kioskGroup.position.y = center.y;
            state = 'grounded';
            lightningRing.visible = true;

            if (sound.playGiantSwordImpact) sound.playGiantSwordImpact();
            if (sound.playThunder) sound.playThunder();
            if (this.controller) this.controller.addTrauma(0.45);

            if (this.particles) {
              this.particles.emitShockwave(center, 0x00d2d3, 13.5, 0.45);
              this.particles.emitHitSparkles(center, 36);
            }

            if (this.canHitPlayers(character)) {
              this.dealDamageAOE(center, 12.0, 180, '🏛️ -180 KIOSK THIÊN PHẠT!', '#00d2d3', monsters, 'freeze', 'electric', null, character);
            }

            // Bất động toàn bộ địch trong 5 giây trong bán kính 12.5m!
            this.freezeArea(center, 12.5, 5.0, monsters, character);
            this.damageTexts.spawn('🏛️ BỐC SỐ LÀM DỊCH VỤ CÔNG! BẤT ĐỘNG 5S!', center.clone().add(new THREE.Vector3(0, 8.5, 0)), '#ffd700');
          }
          return true;
        }

        if (state === 'grounded') {
          groundedTime += delta;
          lightningRing.rotation.y += delta * 6;
          lightningMat.opacity = Math.sin(groundedTime * 18) * 0.3 + 0.65;

          if (this.particles && Math.random() < 0.6) {
            const zapPos = center.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * 12.0,
              0.5 + Math.random() * 4.0,
              (Math.random() - 0.5) * 12.0
            ));
            this.particles.emitElementalParticles(zapPos, 5, [0x00d2d3, 0xf1c40f, 0xffffff], [0.6, 1.8], 0.4, 0, 0.4);
          }

          // Giữ trạng thái bất động trong suốt 5s
          if (groundedTime < stunDuration) {
            this.freezeArea(center, 12.5, 1.0, monsters, character);
          }

          if (groundedTime >= stunDuration) {
            this.scene.remove(kioskGroup);
            this.scene.remove(lightningRing);
            kioskGroup.traverse((child) => {
              if (child.isMesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) child.material.forEach((m) => m?.dispose());
                else child.material?.dispose();
              }
            });
            lightningGeo.dispose();
            lightningMat.dispose();
            badgeTex?.dispose();
            screenTex?.dispose();
            return false;
          }
          return true;
        }
        return true;
      }
    });
  }

  // [NAMCAM 3] THẢ RẮM DIỆT THẾ (Chổng mông nổ khói vàng mù mịt phạm vi siêu rộng 31.5m gấp 3 lần, 260 ST + BẤT ĐỘNG TOÀN DIỆN quái, người chơi, phân thân)
  castToxicFart(targetPos, character, monsters) {
    if (character.triggerFartAnimation) {
      character.triggerFartAnimation();
    }
    if (sound.playFartSound) sound.playFartSound();

    const origin = character.position.clone();
    origin.y = getTerrainHeight(origin.x, origin.z);

    const backDir = new THREE.Vector3(
      Math.sin(character.rotationY || 0),
      0,
      Math.cos(character.rotationY || 0)
    ).normalize();
    const fartPos = origin.clone().addScaledVector(backDir, 0.8);
    // Tăng phạm vi gấp 3 lần: 10.5m -> 31.5m
    const fartRadius = 31.5;

    const cloudPuffs = [];
    const puffCount = 56;
    const puffGeo = new THREE.DodecahedronGeometry(2.2, 1);
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      roughness: 0.95,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    });

    for (let i = 0; i < puffCount; i++) {
      const puff = new THREE.Mesh(puffGeo, puffMat);
      const angle = (i / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const dist = 1.0 + Math.random() * 6.5;
      puff.position.set(
        fartPos.x + Math.cos(angle) * dist,
        fartPos.y + 0.5 + Math.random() * 1.6,
        fartPos.z + Math.sin(angle) * dist
      );
      puff.scale.setScalar(0.4);
      puff.userData = {
        maxScale: 5.5 + Math.random() * 4.2,
        vx: Math.cos(angle) * (6.5 + Math.random() * 9.5),
        vz: Math.sin(angle) * (6.5 + Math.random() * 9.5),
        vy: 0.6 + Math.random() * 1.8,
      };
      this.scene.add(puff);
      cloudPuffs.push(puff);
    }

    if (this.canHitPlayers(character)) {
      this.dealDamageAOE(fartPos, fartRadius, 260, '💨 -260 THẢ RẮM DIỆT THẾ!', '#f1c40f', monsters, 'freeze', 'poison', null, character);
    }
    if (this.particles) {
      this.particles.emitShockwave(fartPos, 0xf1c40f, fartRadius, 0.55);
    }

    // Lập tức khống chế bất động toàn bộ mục tiêu (quái vật, người chơi, phân thân) trong vùng 31.5m!
    this.freezeArea(fartPos, fartRadius, 1.5, monsters, character);
    this.damageTexts.spawn('💨 THÚI QUÁ KHÔNG THỞ ĐƯỢC! BẤT ĐỘNG 31.5M!', fartPos.clone().add(new THREE.Vector3(0, 3.5, 0)), '#ffd32a');

    const duration = 4.0;
    let elapsed = 0;
    let tickTimer = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        tickTimer += delta;

        for (const p of cloudPuffs) {
          p.position.x += p.userData.vx * delta;
          p.position.z += p.userData.vz * delta;
          p.position.y += p.userData.vy * delta;
          p.userData.vx *= 0.95;
          p.userData.vz *= 0.95;

          const progress = elapsed / duration;
          p.scale.setScalar(THREE.MathUtils.lerp(0.4, p.userData.maxScale, Math.min(1.0, elapsed * 2.2)));
          puffMat.opacity = Math.max(0, 0.85 * (1.0 - progress));
        }

        // DUY TRÌ BẤT ĐỘNG TOÀN DIỆN (Người chơi, Quái vật, Phân thân) TRONG SUỐT VÙNG 31.5M KHI KHÓI VÀNG CÒN TỒN TẠI!
        this.freezeArea(fartPos, fartRadius, 1.2, monsters, character);

        // Độc rút máu định kỳ
        if (tickTimer >= 0.4) {
          tickTimer = 0;
          if (this.canHitPlayers(character)) {
            this.dealDamageAOE(fartPos, fartRadius, 25, '☣️ -25 ĐỘC RẮM', '#badc58', monsters, 'freeze', 'poison', null, character);
          }
        }

        if (elapsed >= duration) {
          for (const p of cloudPuffs) {
            this.scene.remove(p);
          }
          puffGeo.dispose();
          puffMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [NAMCAM 4] CHIẾN THẦN ROBOT KHỔNG LỒ X20 (GIANT TITAN MECHA NAMCAM)
  // Triệu hồi 7 mảnh cơ giáp từ không gian bay vào hợp thể thành Robot Khổng Lồ x20 (~36.5m).
  // Đòn đánh thường biến thành Đạp Chân Đại Địa & Nện Thiết Quyền Thủy Lực tạo hố sụt lún địa hình và sát thương cực lớn!
  castGiantRobotSummon(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(4);

    const target = targetPos ? targetPos.clone() : character.position.clone();
    target.y = getTerrainHeight(target.x, target.z);

    // ĐẶC BIỆT: Nếu đang có Binh Đoàn Phân Thân NAMCAM, biến TOÀN BỘ 10 phân thân thành 10 Robot Khổng Lồ!
    if (this.namcamSquad && this.namcamSquad.hasActiveClones()) {
      this.namcamSquad.transformAllToRobots(monsters);
    }

    // Không triệu hồi thêm nếu robot của nhân vật vẫn đang hoạt động hoặc đang hợp thể
    if (character?.giantRobot && character.giantRobot.state !== 'dead') {
      return false;
    }

    // Tạo thực thể GiantRobot
    const robot = new GiantRobot(
      this.scene,
      this.world,
      this.particles,
      this.damageTexts,
      this.controller,
      this
    );

    if (character) {
      character.giantRobot = robot;
    }

    // Đưa robot vào danh sách hiệu ứng cần cập nhật hàng frame
    this.activeEffects.push(robot);

    // Bắt đầu quy trình bay vào hợp thể từ tầng bình lưu
    robot.startAssembly(target, character, monsters, () => {
      if (character === this.localCharacter && this.controller) {
        this.controller.addTrauma(0.75);
      }
    });

    return true;
  }

  // [NAMCAM 3] BINH ĐOÀN 10 PHÂN THÂN TỰ ĐỘNG CHIẾN ĐẤU & BIẾN HÌNH ROBOT
  castNamcamSquad(targetPos, character, monsters) {
    if (character?.triggerSkillCast) character.triggerSkillCast(3);

    if (!this.namcamSquad) {
      this.namcamSquad = new NamcamSquad(
        this.scene,
        this.world,
        this.particles,
        this.projectiles,
        this.damageTexts,
        this.controller,
        this
      );
    } else {
      this.namcamSquad.projectiles = this.projectiles;
      this.namcamSquad.controller = this.controller;
    }

    this.namcamSquad.spawnSquad(character, monsters);
    return true;
  }

  // Khống chế đóng băng / bất động vùng chỉ định (áp dụng lên quái vật, người chơi, phân thân)
  freezeArea(center, radius, duration, monsters, caster = null) {
    // 1. Quái vật
    for (const m of monsters || []) {
      if (m.isDead) continue;
      if (m.position.distanceTo(center) <= radius + (m.hitRadius || 1.0)) {
        if (m.freeze) m.freeze(duration);
      }
    }

    // 2. Người chơi khác (Remote Players)
    for (const rp of this.remotePlayers || []) {
      if (rp.isDead) continue;
      if (caster && rp.id === caster.id) continue;
      if (rp.position.distanceTo(center) <= radius + 0.85) {
        if (rp.freeze) rp.freeze(duration);
      }
    }

    // 3. Người chơi chính (nếu bị dính chiêu của kẻ khác)
    if (this.localCharacter && !this.localCharacter.isDead && caster !== this.localCharacter) {
      if (this.localCharacter.position.distanceTo(center) <= radius + 0.85) {
        if (this.localCharacter.freeze) this.localCharacter.freeze(duration);
      }
    }

    // 4. Phân thân (Đạo ảnh Nhất Khí Hóa Tam Thanh: cả local lẫn remote)
    if (this.cloneManager) {
      for (const c of this.cloneManager.local || []) {
        if (c.body && !c.body.isDead) {
          if (caster && c.body === caster) continue;
          if (c.body.position.distanceTo(center) <= radius + 0.85) {
            if (c.body.freeze) c.body.freeze(duration);
          }
        }
      }
      for (const clones of (this.cloneManager.remote ? this.cloneManager.remote.values() : [])) {
        for (const r of clones.values()) {
          if (r.body && !r.body.isDead) {
            if (caster && r.body === caster) continue;
            if (r.body.position.distanceTo(center) <= radius + 0.85) {
              if (r.body.freeze) r.body.freeze(duration);
            }
          }
        }
      }
    }
  }

  update(delta) {
    if (this.baguaTimer > 0) this.baguaTimer -= delta;
    if (this.vortexTimer > 0) this.vortexTimer -= delta;

    // 1. Cập nhật thời gian hồi chiêu
    // Hoàng Bào Đạo Sĩ đang trong Bát Quái Đại Canh Trận: chiêu 1 và 3 hồi nhanh hơn.
    // Chiêu 2 (chính trận pháp) không được tăng tốc, nếu không có thể tự duy trì trận mãi mãi.
    const resistActive = this.currentSectIndex === 0 && this.localCharacter && this.localCharacter.statusResistTimer > 0;
    for (const key in this.cooldowns) {
      const cd = this.cooldowns[key];
      if (cd.current > 0) {
        const rate = resistActive && key !== '2' ? BAGUA_COOLDOWN_RATE : 1;
        cd.current = Math.max(0, cd.current - delta * rate);
      }
    }

    if (this.onCooldownUpdate) {
      this.onCooldownUpdate(this.cooldowns);
    }

    // 2. Cập nhật các hiệu ứng PixelFX đang diễn ra
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const alive = this.activeEffects[i].update(delta);
      if (!alive) {
        this.activeEffects.splice(i, 1);
      }
    }

    // 3. Cập nhật Binh Đoàn Phân Thân NAMCAM (10 Chiến Sĩ / 10 Robot Khổng Lồ)
    if (this.namcamSquad) {
      if (this.projectiles && !this.namcamSquad.projectiles) this.namcamSquad.projectiles = this.projectiles;
      if (this.controller && !this.namcamSquad.controller) this.namcamSquad.controller = this.controller;
      this.namcamSquad.update(delta, this.localCharacter, this.monsters);
    }

    // 4. Cập nhật số sát thương nhảy lên
    this.damageTexts.update(delta);
  }
}
