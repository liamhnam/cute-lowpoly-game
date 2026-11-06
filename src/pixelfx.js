import * as THREE from 'three';
import { sound } from './audio.js';
import { getTerrainHeight } from './world.js';
import { createSword, SWORD_LENGTH } from './sword.js';

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
      canvas.width = 180;
      canvas.height = 70;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;

      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(3.4, 1.4, 1);
      sprite.visible = false;
      this.scene.add(sprite);

      this.pool.push({ sprite, canvas, ctx, texture, life: 0, maxLife: 1.3, velY: 2.8 });
    }
  }

  spawn(text, position, color = '#ff4757') {
    for (const item of this.pool) {
      if (!item.sprite.visible) {
        item.sprite.visible = true;
        item.life = item.maxLife;
        item.sprite.position.copy(position);
        item.sprite.position.y += 1.6;
        item.sprite.position.x += (Math.random() - 0.5) * 0.6;

        const ctx = item.ctx;
        ctx.clearRect(0, 0, 180, 70);
        ctx.font = 'bold 28px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 7;
        ctx.strokeText(text, 90, 35);

        ctx.fillStyle = color;
        ctx.fillText(text, 90, 35);

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
// BẢNG 5 MÔN PHÁI TIÊN HIỆP - MỖI PHÁI 3 CHIÊU THỨC ĐỘC NHẤT VỀ CƠ CHẾ
// =========================================================================
export const SECTS = [
  {
    id: 'dao_gia',
    name: 'Thái Thanh Đạo Gia',
    outfitName: 'Hoàng Bào Đạo Sĩ (Kim Hoàng)',
    colorHex: 0xf6c344,
    themeColor: '#f1c40f',
    icon: '🐉',
    desc: 'Đạo gia trận pháp & phòng ngự: Cự Kiếm Phá Thiên 50m, Bát Quái Đại Canh trận hồi máu kèm lốc lôi kiếm, Nhất Khí Hóa Tam Thanh phân thân',
    skills: [
      {
        id: 1,
        name: 'Cự Kiếm Phá Thiên',
        tag: 'CỰ KIẾM',
        icon: '🗡️',
        cd: 6.0,
        mana: 25,
        desc: 'Phóng to thanh kiếm đang cầm thành cự kiếm hơn cả bản thể rồi phóng thẳng 50m: tông trúng 120 ST, cuối đường nổ 80 ST. Nổ trong Bát Quái Trận: Lôi Kiếm +40 ST!'
      },
      {
        id: 2,
        name: 'Bát Quái Đại Canh Trận',
        tag: 'BÁT QUÁI',
        icon: '☯️',
        cd: 14.0,
        mana: 35,
        desc: 'Trải trận Bát Quái 12m (10s): hồi +25 HP/s, giảm 30% ST nhận, địch vào trận bị chậm 50%, kèm 36 lôi kiếm Đại Canh xoáy lốc 30m'
      },
      {
        id: 3,
        name: 'Nhất Khí Hóa Tam Thanh',
        tag: 'PHÂN THÂN',
        icon: '👥',
        cd: 30.0,
        mana: 40,
        desc: 'Phân ra 2 đạo ảnh máu bằng 1/2 bản thân, sống 20s hoặc tới khi bị tiêu diệt: Bạch Ảnh (áo trắng) chạy siêu tốc chém vàng liên tục mọi mục tiêu trong 60m, Tử Ảnh (áo tím) bay lên trời liên tục phóng lôi vàng'
      }
    ]
  },
  {
    id: 'thanh_van',
    name: 'Thanh Vân Tiên Tông',
    outfitName: 'Thanh Vân Tiên Bào (Lam Ngọc)',
    colorHex: 0x54a0ff,
    themeColor: '#00d2d3',
    icon: '❄️',
    desc: 'Tiên gia băng phong: Đóng băng khống chế cứng, ngự phong lướt gió giải khống chế và combo Băng Toái',
    skills: [
      {
        id: 1,
        name: 'Huyền Băng Tuyệt Vực',
        tag: 'BĂNG PHONG',
        icon: '❄️',
        cd: 6.5,
        mana: 25,
        desc: 'Báo hiệu 0.35s rồi cọc băng trồi lên gây 95 ST & ĐÓNG BĂNG 2.2s. Kẻ địch phản xạ tốt có thể né!'
      },
      {
        id: 2,
        name: 'Ngự Phong Thuấn Trảm',
        tag: 'PHONG TRẢM',
        icon: '🌪️',
        cd: 5.0,
        mana: 20,
        desc: 'Lướt gió 16m chém 85 ST, hất dạt địch và GIẢI MỌI HIỆU ỨNG khống chế/làm chậm'
      },
      {
        id: 3,
        name: 'Hàn Băng Vạn Nhận',
        tag: 'BĂNG VŨ',
        icon: '🌧️',
        cd: 10.0,
        mana: 35,
        desc: 'Mưa 28 kiếm băng (20 ST/thanh) rồi nổ tuyết 120 ST. Nếu mục tiêu BỊ ĐÓNG BĂNG: Kích nổ Băng Toái (+55 ST)!'
      }
    ]
  },
  {
    id: 'kiem_tong',
    name: 'Tử Tiêu Kiếm Tông',
    outfitName: 'Tử Tiêu Kiếm Tông (Tử Kim)',
    colorHex: 0x8854d0,
    themeColor: '#a29bfe',
    icon: '⚔️',
    desc: 'Thuần tu kiếm đạo: Thuấn bộ giảm hồi chiêu khi trúng, thế PARRY đỡ đòn hoàn hảo và Vạn Kiếm Quy Tông',
    skills: [
      {
        id: 1,
        name: 'Thuấn Bộ Trảm',
        tag: 'THUẤN BỘ',
        icon: '💨',
        cd: 5.0,
        mana: 20,
        desc: 'Tốc biến 12m chém 85 ST, nổ kiếm ngân 50 ST gây choáng. Chém trúng địch GIẢM NGAY 50% HỒI CHIÊU!'
      },
      {
        id: 2,
        name: 'Kiếm Trận Hộ Thể',
        tag: 'HỘ THÂN',
        icon: '🌀',
        cd: 7.5,
        mana: 25,
        desc: 'Trong 0.8s đầu vào thế PARRY: Đỡ 100% đòn đánh, hồi +80 HP & phản chấn! 6 kiếm xoay 6s chém 20 ST/hit'
      },
      {
        id: 3,
        name: 'Vạn Kiếm Quy Tông',
        tag: 'VẠN KIẾM',
        icon: '⚔️',
        cd: 12.0,
        mana: 40,
        desc: 'Cắm kiếm trận khoanh vùng mục tiêu rồi CỰ ĐẠI THIÊN KIẾM giáng trần nổ hố gây 260 ST cực đại'
      }
    ]
  },
  {
    id: 'ma_tu',
    name: 'Hồng Trần Ma Tu',
    outfitName: 'Hồng Trần Ma Tu (Chu Sa Hắc Bào)',
    colorHex: 0xeb3b5a,
    themeColor: '#ff4757',
    icon: '🩸',
    desc: 'Huyết ma ma đạo: Huyết kiếm hút máu, gom mục tiêu bằng Hắc Động và lật kèo khi máu thấp (Huyết Cuồng)',
    skills: [
      {
        id: 1,
        name: 'Huyết Ma Trảm',
        tag: 'HẤP HUYẾT',
        icon: '🩸',
        cd: 5.0,
        mana: 20,
        desc: 'Đao huyết khí 24m gây 125 ST & hút 60 HP. Khi MÁU < 50% (Huyết Cuồng): Tăng thành 165 ST & hút 120 HP!'
      },
      {
        id: 2,
        name: 'U Minh Ma Vực',
        tag: 'HẮC ĐỘNG',
        icon: '🕳️',
        cd: 7.0,
        mana: 25,
        desc: 'Hắc Động ma xoáy 3.5s hút toàn bộ kẻ địch về tâm hố, thiêu đốt 35 ST/s liên tục'
      },
      {
        id: 3,
        name: 'Hồng Trần Ma Bạo',
        tag: 'MA BẠO',
        icon: '🔥',
        cd: 11.0,
        mana: 35,
        desc: 'Nổ dung nham 250 ST. Nếu nổ vào kẻ địch trong U Minh Ma Vực: Kích hoạt Ma Diễm Cộng Hưởng 325 ST!'
      }
    ]
  },
  {
    id: 'bach_hac',
    name: 'Bạch Hạc Chân Nhân',
    outfitName: 'Bạch Hạc Chân Nhân (Bạch Ngọc)',
    colorHex: 0xf5f6fa,
    themeColor: '#2ed573',
    icon: '🪶',
    desc: 'Thần thú tiên nhân: Thả diều tốc độ cao, sấm sét làm chậm, bay lượn miễn khống chế và đẩy lùi an toàn',
    skills: [
      {
        id: 1,
        name: 'Cửu Thiên Huyền Lôi',
        tag: 'LÔI ĐÌNH',
        icon: '⚡',
        cd: 5.5,
        mana: 25,
        desc: 'Sét đánh bổ xuống mục tiêu 140 ST (làm chậm 45% trong 2.5s), giật lan 4 tia 60 ST sang kẻ xung quanh'
      },
      {
        id: 2,
        name: 'Bạch Hạc Tường Vân',
        tag: 'BẠCH HẠC',
        icon: '🪶',
        cd: 6.0,
        mana: 20,
        desc: 'Hóa Bạch Hạc sải cánh lướt 24m hất tung địch, MIỄN KHỐNG CHẾ trong khi lướt và nhận +45% tốc chạy suốt 4s'
      },
      {
        id: 3,
        name: 'Hám Địa Thần Thông',
        tag: 'ĐỊA CHẤN',
        icon: '🌍',
        cd: 10.0,
        mana: 35,
        desc: 'Giậm sụt mặt đất 230 ST, THỔI BAY KẺ ĐỊCH RA XA 16m để lập tức tái lập cự ly thả diều an toàn'
      }
    ]
  },
  {
    id: 'namcam',
    name: 'Chiến Sĩ NAMCAM',
    outfitName: 'Bộ Đội Cụ Hồ (Nam Cam)',
    colorHex: 0x2e4a2b,
    themeColor: '#2ed573',
    icon: '🇻🇳',
    desc: 'Phái Ẩn Huyền Thoại: Quân nhân Việt Nam, súng trường tác chiến, mưa giông xối xả, Kiosk Dịch Vụ Công tê liệt 5s và Thả Rắm Diệt Thế',
    skills: [
      {
        id: 1,
        name: 'Hồi Chiều Trời Mưa',
        tag: 'MƯA GIÔNG',
        icon: '🌧️',
        cd: 6.0,
        mana: 25,
        desc: 'Hiện bong bóng thoại "Hồi chiều trời mưa" trên đầu, tạo mưa bão ngập lụt gây 28 ST/nhịp (liên tục 4.8s) & làm chậm 50%'
      },
      {
        id: 2,
        name: 'Kiosk Dịch Vụ Công',
        tag: 'THỦ TỤC HÀNH CHÍNH',
        icon: '🖥️',
        cd: 12.0,
        mana: 35,
        desc: 'Triệu hồi máy Kiosk Dịch Vụ Công từ trên trời giáng xuống 160 ST, phát luồng điện từ làm BẤT ĐỘNG TOÀN BỘ ĐỊCH TRONG 5S'
      },
      {
        id: 3,
        name: 'Thả Rắm Diệt Thế',
        tag: 'KHÍ ĐỘC BẤT ĐỘNG',
        icon: '💨',
        cd: 9.0,
        mana: 30,
        desc: 'Chổng mông thả rắm siêu thanh! Nổ khói vàng mù mịt 260 ST, BẤT ĐỘNG TOÀN DIỆN (Người chơi, Quái, Phân thân) trong suốt thời gian hiệu lực & trúng độc rút máu'
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
    this.cloneManager = null;   // quản lý đạo ảnh phân thân (Nhất Khí Hóa Tam Thanh)

    // Quản lý vùng trận pháp & tương tác chiêu thức
    this.lastBaguaPos = null;
    this.baguaTimer = 0;
    this.lastVortexPos = null;
    this.vortexTimer = 0;

    this.setSect(0);
  }

  // ĐẶT MÔN PHÁI CHO NHÂN VẬT & TẢI 3 CHIÊU ĐỘC NHẤT
  setSect(sectIndex) {
    this.currentSectIndex = ((Number(sectIndex) % SECTS.length) + SECTS.length) % SECTS.length;
    const sect = SECTS[this.currentSectIndex];

    this.cooldowns = {
      1: { current: 0, max: sect.skills[0].cd, name: sect.skills[0].name, icon: sect.skills[0].icon, tag: sect.skills[0].tag, desc: sect.skills[0].desc, mana: sect.skills[0].mana },
      2: { current: 0, max: sect.skills[1].cd, name: sect.skills[1].name, icon: sect.skills[1].icon, tag: sect.skills[1].tag, desc: sect.skills[1].desc, mana: sect.skills[1].mana },
      3: { current: 0, max: sect.skills[2].cd, name: sect.skills[2].name, icon: sect.skills[2].icon, tag: sect.skills[2].tag, desc: sect.skills[2].desc, mana: sect.skills[2].mana },
    };

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

  isSkillOnCooldown(skillIndex) {
    const s = this.cooldowns[skillIndex];
    return s && s.current > 0;
  }

  // KÍCH HOẠT KỸ NĂNG THEO MÔN PHÁI (MỖI PHÁI 3 CHIÊU [1], [2], [3])
  castSkill(skillIndex, targetPos, character, monsters) {
    const slotNum = Number(skillIndex);
    if (![1, 2, 3].includes(slotNum)) return false;

    // Xác định môn phái của nhân vật thi triển (bản thân hoặc người chơi khác)
    const sectIdx = ((character?.outfitIndex !== undefined ? character.outfitIndex : this.currentSectIndex) % SECTS.length + SECTS.length) % SECTS.length;

    // Hồi chiêu chỉ áp cho chiêu của chính mình (nhân hệ số hồi chiêu theo môn phái)
    if (character === this.localCharacter) {
      const skill = this.cooldowns[slotNum];
      if (!skill || skill.current > 0) return false;
      const cdMult = character?.sectStats?.cdMult || 1.0;
      skill.current = skill.max * cdMult;
    }

    switch (sectIdx) {
      case 0: // Thái Thanh Đạo Gia
        if (slotNum === 1) this.castFlyingSword(targetPos, character, monsters);
        else if (slotNum === 2) this.castTaiChiBagua(character, monsters);
        else if (slotNum === 3) this.castSplitShadow(character);
        break;

      case 1: // Thanh Vân Tiên Tông
        if (slotNum === 1) this.castFrostNova(targetPos, character, monsters);
        else if (slotNum === 2) this.castWindDash(targetPos, character, monsters);
        else if (slotNum === 3) this.castSwordRain(targetPos, character, monsters);
        break;

      case 2: // Tử Tiêu Kiếm Tông
        if (slotNum === 1) this.castBlinkSlash(targetPos, character, monsters);
        else if (slotNum === 2) this.castSwordBarrier(character, monsters);
        else if (slotNum === 3) this.castWanJianGuiZong(targetPos, character, monsters);
        break;

      case 3: // Hồng Trần Ma Tu
        if (slotNum === 1) this.castBloodSlash(targetPos, character, monsters);
        else if (slotNum === 2) this.castNetherVortex(targetPos, character, monsters);
        else if (slotNum === 3) this.castHellfireCataclysm(targetPos, character, monsters);
        break;

      case 4: // Bạch Hạc Chân Nhân
        if (slotNum === 1) this.castChainLightning(targetPos, character, monsters);
        else if (slotNum === 2) this.castCraneGlide(targetPos, character, monsters);
        else if (slotNum === 3) this.castEarthquakeStomp(targetPos, character, monsters);
        break;

      case 5: // Chiến Sĩ NAMCAM (Phái Ẩn)
        if (slotNum === 1) this.castRainSpeech(targetPos, character, monsters);
        else if (slotNum === 2) this.castKioskStrike(targetPos, character, monsters);
        else if (slotNum === 3) this.castToxicFart(targetPos, character, monsters);
        break;
    }

    return true;
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
    for (const rp of this.remotePlayers) {
      if (rp.isDead || (hitSet && hitSet.has(rp.id))) continue;
      if (!rp.checkBulletCollision(point, radius)) continue;
      if (hitSet) hitSet.add(rp.id);
      const hitPos = rp.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      this.onHitPlayer(rp.id, amount, hitPos, 'sword');
      this.damageTexts.spawn(text, hitPos.clone().add(new THREE.Vector3(0, 0.6, 0)), textColor);
      if (this.particles) this.particles.emitHitSparkles(hitPos, 14);
      hit.push(rp);
    }
    return hit;
  }

  // Gây sát thương lên một con quái kèm số sát thương nhảy lên
  damageMonster(monster, amount, text, textColor, sourcePos) {
    monster.takeDamage(amount, sourcePos);
    const hitPos = monster.position.clone();
    hitPos.y += monster.hitHeight * 0.7;
    this.damageTexts.spawn(text, hitPos, textColor);
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

  // --- KIẾM CHIÊU 2: THUẤN BỘ TRẢM ---
  // Lướt chớp nhoáng 10m chém xuyên mọi quái trên đường, sau đó kiếm ngân nổ thêm một đợt
  castBlinkSlash(targetPos, character, monsters) {
    const dir = PixelFXManager.flatDirection(character.position, targetPos);
    const dashDuration = 0.22;
    const dashDistance = 10;
    const start = character.position.clone();
    character.startDash(dir, dashDistance, dashDuration);
    sound.playSwordSlash();
    if (this.onScreenFlash) this.onScreenFlash('sword');

    // Vệt kiếm quang thẳng tắp nối điểm đầu và điểm cuối
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0x7efff5,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const streak = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, dashDistance), streakMat);
    streak.position.copy(start).addScaledVector(dir, dashDistance / 2);
    streak.position.y += 1.0;
    streak.rotation.y = Math.atan2(dir.x, dir.z);
    streak.scale.z = 0.01;
    this.scene.add(streak);

    const hitMonsters = [];
    const hitPlayerIds = new Set();
    const hitPlayers = [];
    let elapsed = 0;
    let echoed = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        if (elapsed <= dashDuration + 0.02) {
          // Vệt kiếm kéo dài theo bước lướt, bóng ảnh để lại hạt ngọc
          streak.scale.z = Math.min(1, elapsed / dashDuration);
          streak.position.copy(start).addScaledVector(dir, (dashDistance * streak.scale.z) / 2);
          streak.position.y += 1.0;
          if (this.particles) {
            this.particles.emitElementalParticles(character.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 3, [0x7efff5, 0x1dd1a1, 0xffffff], [0.5, 2], 0.35, 0, 0.5);
          }

          for (const monster of monsters) {
            if (monster.isDead || hitMonsters.includes(monster)) continue;
            const d = Math.hypot(monster.position.x - character.position.x, monster.position.z - character.position.z);
            if (d <= monster.hitRadius + 1.4) {
              hitMonsters.push(monster);
              this.damageMonster(monster, 70, '💨 -70', '#7efff5', character.position);
              sound.playHit();
            }
          }
          const bodyPos = character.position.clone().add(new THREE.Vector3(0, 1.0, 0));
          hitPlayers.push(...this.damagePlayersNear(bodyPos, 1.6, 70, '💨 -70', '#7efff5', character, hitPlayerIds));
        } else {
          streakMat.opacity = Math.max(0, 0.9 - (elapsed - dashDuration) * 1.6);
        }

        // Kiếm ngân: đợt nổ trễ trên mọi quái vừa bị chém qua
        if (!echoed && elapsed >= dashDuration + 0.35) {
          echoed = true;
          if (hitMonsters.length > 0 || hitPlayers.length > 0) {
            sound.playSwordSlash();
            if (this.controller) this.controller.addTrauma(0.25);

            // Thưởng kỹ năng: Chém trúng mục tiêu -> Giảm ngay 50% hồi chiêu Thuấn Bộ Trảm!
            if (character === this.localCharacter && this.cooldowns[1]) {
              this.cooldowns[1].current *= 0.5;
              this.damageTexts.spawn('⚡ HỒI CHIÊU -50%!', character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#7efff5');
            }
          }
          // hitPlayers chỉ có phần tử khi chiêu là của chính mình (damagePlayersNear đã kiểm tra)
          for (const rp of hitPlayers) {
            if (rp.isDead) continue;
            const p = rp.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            this.particles.emitShockwave(p, 0x7efff5, 4.0, 0.3);
            this.onHitPlayer(rp.id, 40, p, 'sword');
            this.damageTexts.spawn('✦ -40 KIẾM NGÂN', p.clone().add(new THREE.Vector3(0, 0.6, 0)), '#ffffff');
          }
          for (const monster of hitMonsters) {
            if (monster.isDead) continue;
            const p = monster.position.clone();
            p.y += 1.5;
            this.particles.emitShockwave(p, 0x7efff5, 4.0, 0.3);
            this.particles.emitElementalParticles(p, 14, [0x7efff5, 0xffffff], [3, 7], 0.4, 0, 0.6);
            this.damageMonster(monster, 40, '✦ -40 KIẾM NGÂN', '#ffffff', p);
          }
        }

        if (elapsed >= dashDuration + 0.6) {
          this.scene.remove(streak);
          streak.geometry.dispose();
          streakMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // --- KIẾM CHIÊU 3: KIẾM TRẬN HỘ THỂ ---
  // 6 thanh kiếm xoay quanh người 6 giây cắt mọi quái áp sát, hết giờ thì bắn tung ra bốn phía
  castSwordBarrier(character, monsters) {
    const count = 6;
    const radius = 2.4;
    const duration = 6.0;
    const up = new THREE.Vector3(0, 1, 0);
    const swords = [];

    for (let i = 0; i < count; i++) {
      const sword = createSword(1.1);
      this.scene.add(sword);
      swords.push({ mesh: sword, launched: false, dir: new THREE.Vector3(), hitSet: new Set() });
    }

    // Vòng trận pháp dưới chân
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7bed9f,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringGeo = new THREE.RingGeometry(radius - 0.12, radius + 0.12, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.scene.add(ring);

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
          // Kiếm xoay vòng, mũi chĩa ra ngoài
          for (let i = 0; i < count; i++) {
            const angle = elapsed * 3.2 + (i / count) * Math.PI * 2;
            const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            const s = swords[i].mesh;
            s.position.set(center.x + out.x * radius, center.y + 1.0 + Math.sin(elapsed * 4 + i) * 0.15, center.z + out.z * radius);
            s.quaternion.setFromUnitVectors(up, out);
          }
          ring.position.set(center.x, center.y + 0.06, center.z);
          ring.rotation.y = -elapsed * 1.5;
          ringMat.opacity = 0.35 + Math.sin(elapsed * 6) * 0.15;

          // Mỗi 0.4s cắt mọi quái lọt vào vòng kiếm
          tickTimer -= delta;
          if (tickTimer <= 0) {
            tickTimer = 0.4;
            for (const monster of monsters) {
              if (monster.isDead) continue;
              const d = Math.hypot(monster.position.x - center.x, monster.position.z - center.z);
              if (d <= radius + monster.hitRadius + 0.4) {
                this.damageMonster(monster, 15, '🌀 -15', '#7bed9f', center);
                sound.playHit();
              }
            }
            const ringCenter = center.clone().add(new THREE.Vector3(0, 1.0, 0));
            this.damagePlayersNear(ringCenter, radius + 0.4, 15, '🌀 -15', '#7bed9f', character);
          }
          return true;
        }

        // Hết thời gian: kiếm bắn tung ra bốn phía
        if (!burst) {
          burst = true;
          this.scene.remove(ring);
          ringGeo.dispose();
          ringMat.dispose();
          sound.playSwordSlash();
          if (this.controller) this.controller.addTrauma(0.2);
          for (const s of swords) {
            s.dir.set(s.mesh.position.x - center.x, 0, s.mesh.position.z - center.z).normalize();
          }
        }

        for (const s of swords) {
          s.mesh.position.addScaledVector(s.dir, 30 * delta);
          for (const monster of monsters) {
            if (monster.isDead || s.hitSet.has(monster)) continue;
            if (monster.checkCollision(s.mesh.position, 1.0)) {
              s.hitSet.add(monster);
              this.damageMonster(monster, 35, '🌀 -35', '#7bed9f', s.mesh.position);
            }
          }
          this.damagePlayersNear(s.mesh.position, 1.0, 35, '🌀 -35', '#7bed9f', character, s.hitSet);
          if (this.particles && Math.random() < 0.5) {
            this.particles.emitElementalParticles(s.mesh.position, 1, [0x7bed9f, 0xffffff], [0.2, 0.8], 0.25, 0, 0.35);
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

  // --- KIẾM CHIÊU 4: THIÊN KIẾM LẠC ---
  // Mưa kiếm trút xuống vùng mục tiêu, cuối cùng kiếm khí trấn áp đóng băng yêu ma
  castSwordRain(targetPos, character, monsters) {
    const cx = targetPos.x;
    const cz = targetPos.z;
    const cy = getTerrainHeight(cx, cz);
    const center = new THREE.Vector3(cx, cy, cz);
    const areaRadius = 7.5;
    const swordCount = 28;

    this.spawnTelegraph(center, 0x48dbfb, 2.8, areaRadius);

    const swords = [];
    for (let i = 0; i < swordCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * areaRadius;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      swords.push({
        mesh: null,
        target: new THREE.Vector3(x, getTerrainHeight(x, z), z),
        delay: 0.5 + (i / swordCount) * 2.0,
        state: 'waiting', // waiting → falling → embedded
        embedLife: 0.6,
      });
    }

    let elapsed = 0;
    let sealed = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        let alive = false;

        for (const s of swords) {
          if (s.state === 'waiting') {
            alive = true;
            if (elapsed < s.delay) continue;
            s.mesh = createSword(1.5);
            s.mesh.rotation.x = Math.PI; // Mũi kiếm chĩa xuống đất
            s.mesh.position.set(s.target.x, s.target.y + 16, s.target.z);
            this.scene.add(s.mesh);
            s.state = 'falling';
          } else if (s.state === 'falling') {
            alive = true;
            s.mesh.position.y -= 42 * delta;
            if (this.particles && Math.random() < 0.3) {
              this.particles.emitElementalParticles(s.mesh.position, 1, [0x48dbfb, 0xffffff], [0.2, 0.8], 0.25, 0, 0.35);
            }
            if (s.mesh.position.y <= s.target.y + 0.9) {
              s.mesh.position.y = s.target.y + 0.9;
              s.state = 'embedded';
              sound.playSwordSlash();
              this.particles.emitHitSparkles(s.target, 6);
              this.particles.emitShockwave(s.target, 0x48dbfb, 2.4, 0.2);
              for (const monster of monsters) {
                if (monster.isDead) continue;
                const d = Math.hypot(monster.position.x - s.target.x, monster.position.z - s.target.z);
                if (d <= monster.hitRadius + 2.0) {
                  this.damageMonster(monster, 20, '🌧️ -20', '#48dbfb', s.target);
                }
              }
              this.damagePlayersNear(s.target.clone().add(new THREE.Vector3(0, 0.8, 0)), 2.0, 20, '🌧️ -20', '#48dbfb', character);
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

        // Kiếm khí trấn áp toàn vùng sau đợt kiếm cuối (Bão tuyết nổ)
        if (!sealed && elapsed >= 2.8) {
          sealed = true;
          if (this.onScreenFlash) this.onScreenFlash('sword');
          if (this.controller) this.controller.addTrauma(0.4);
          this.particles.emitShockwave(center, 0x48dbfb, areaRadius * 1.6, 0.6);
          this.particles.emitElementalParticles(center, 35, [0x48dbfb, 0xffffff, 0x7efff5], [4, 10], 0.7, 4, 1.0);

          // Combo Băng Toái: Mục tiêu đang bị ĐÓNG BĂNG nhận thêm +55 ST bạo kích
          if (monsters) {
            for (const m of monsters) {
              if (!m.isDead && m.position.distanceTo(center) <= areaRadius + m.hitRadius) {
                if (m.freezeTimer > 0) {
                  m.takeDamage(55, center);
                  this.damageTexts.spawn('❄️💥 -55 BĂNG TOÁI!', m.position.clone().add(new THREE.Vector3(0, m.hitHeight, 0)), '#00d2d3');
                  this.particles.emitHitSparkles(m.position, 16);
                }
              }
            }
          }
          if (this.canHitPlayers(character) && this.remotePlayers) {
            for (const rp of this.remotePlayers) {
              if (!rp.isDead && rp.position.distanceTo(center) <= areaRadius + 1.0) {
                if (rp.freezeTimer > 0) {
                  this.onHitPlayer(rp.id, 55, rp.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 'ice');
                  this.damageTexts.spawn('❄️💥 -55 BĂNG TOÁI!', rp.position.clone().add(new THREE.Vector3(0, 2.0, 0)), '#00d2d3');
                  this.particles.emitHitSparkles(rp.position, 16);
                }
              }
            }
          }

          this.dealDamageAOE(center, areaRadius, 40, '❄️ -40 TRẤN ÁP', '#48dbfb', monsters, 'freeze', 'ice', null, character);
        }

        return alive || !sealed;
      }
    });
  }

  // --- KIẾM CHIÊU 6: ĐẠI CANH KIẾM TRẬN ---
  // 36 lôi kiếm xoáy vòng liên tục quanh người suốt 10 giây như cơn lốc kiếm.
  // Bán kính quỹ đạo mỗi thanh co giãn từ 3m tới 30m để quét kín cả vùng, kiếm quét trúng quái là gây sát thương.
  castDaiCanhSwordArray(character, monsters) {
    const SWORD_COUNT = 36;
    const RANGE = 30;
    const MIN_RADIUS = 3;
    const DURATION = 10;
    const ORBIT_SPEED = 22; // tốc độ dài trên quỹ đạo (m/s)
    const MAX_SPIN = 4;     // giới hạn tốc độ góc khi kiếm ở gần tâm (rad/s)
    const INTRO = 0.6;      // thời gian kiếm bung từ người ra quỹ đạo
    const DAMAGE = 18;
    const HIT_INTERVAL = 0.5; // một thanh kiếm chém lại cùng một con sau ít nhất 0.5s
    const TRAIL_POINTS = 14;
    const up = new THREE.Vector3(0, 1, 0);

    sound.playSwordSummon();
    if (this.onScreenFlash) this.onScreenFlash('lightning');
    if (this.controller) this.controller.addTrauma(0.5);
    this.spawnTelegraph(character.position.clone(), 0xa29bfe, 1.2, RANGE);

    // Vòng ranh giới kiếm trận 30m đi theo người
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0xa29bfe,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const borderGeo = new THREE.RingGeometry(RANGE - 0.5, RANGE, 96);
    borderGeo.rotateX(-Math.PI / 2);
    const border = new THREE.Mesh(borderGeo, borderMat);
    this.scene.add(border);

    // Vệt sét: hai sợi lập loè (lõi trắng + viền tím) bám theo lịch sử vị trí kiếm
    const coreMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const glowMat = new THREE.LineBasicMaterial({ color: 0x8c7ae6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const makeStrand = (mat) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
      geo.setDrawRange(0, 0);
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.scene.add(line);
      return line;
    };

    const swords = [];
    for (let i = 0; i < SWORD_COUNT; i++) {
      const angle = (i / SWORD_COUNT) * Math.PI * 2;
      const mesh = createSword(1.3);
      mesh.position.copy(character.position);
      mesh.position.y += 1.5;
      this.scene.add(mesh);
      swords.push({
        mesh,
        vel: new THREE.Vector3(),
        angle,
        // Mỗi thanh co giãn bán kính với nhịp và pha riêng để luôn có kiếm ở mọi khoảng cách
        breathe: 0.45 + Math.random() * 0.35,
        radiusPhase: (i * 2.399) % (Math.PI * 2), // góc vàng: rải đều pha giữa các thanh
        hitTimers: new Map(),
        history: [],
        strands: [makeStrand(coreMat), makeStrand(glowMat)],
      });
    }

    const updateTrail = (s) => {
      s.history.unshift(s.mesh.position.clone());
      if (s.history.length > TRAIL_POINTS) s.history.pop();
      for (let k = 0; k < s.strands.length; k++) {
        const attr = s.strands[k].geometry.attributes.position;
        for (let j = 0; j < s.history.length; j++) {
          // Đuôi càng xa càng giật mạnh tạo hình tia sét zigzag
          const amp = j === 0 ? 0 : (0.12 + (j / TRAIL_POINTS) * 0.45) * (k === 0 ? 0.6 : 1.0);
          const p = s.history[j];
          attr.setXYZ(j, p.x + (Math.random() - 0.5) * amp, p.y + (Math.random() - 0.5) * amp, p.z + (Math.random() - 0.5) * amp);
        }
        attr.needsUpdate = true;
        s.strands[k].geometry.setDrawRange(0, s.history.length);
      }
    };

    let elapsed = 0;
    let lastHitSound = -1;
    const prevPos = new THREE.Vector3();

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const center = character.position;
        border.position.set(center.x, center.y + 0.1, center.z);
        borderMat.opacity = 0.2 + Math.sin(elapsed * 8) * 0.08;

        // Hết giờ: lôi kiếm vút lên trời tan biến
        if (elapsed >= DURATION) {
          const t = elapsed - DURATION;
          for (const s of swords) {
            s.vel.lerp(new THREE.Vector3(0, 40, 0), Math.min(1, delta * 6));
            s.mesh.position.addScaledVector(s.vel, delta);
            s.mesh.quaternion.setFromUnitVectors(up, s.vel.clone().normalize());
            s.mesh.scale.multiplyScalar(0.94);
            updateTrail(s);
          }
          coreMat.opacity = glowMat.opacity = Math.max(0, 0.9 - t * 1.5);
          if (t >= 0.6) {
            for (const s of swords) {
              this.scene.remove(s.mesh);
              for (const line of s.strands) {
                this.scene.remove(line);
                line.geometry.dispose();
              }
            }
            coreMat.dispose();
            glowMat.dispose();
            this.scene.remove(border);
            borderGeo.dispose();
            borderMat.dispose();
            return false;
          }
          return true;
        }

        for (let i = 0; i < swords.length; i++) {
          const s = swords[i];
          for (const [m, timer] of s.hitTimers) s.hitTimers.set(m, timer - delta);

          // Bán kính quỹ đạo co giãn giữa MIN_RADIUS và RANGE; lúc mở chiêu thì bung dần từ người ra
          let radius = MIN_RADIUS + (RANGE - MIN_RADIUS) * (0.5 - 0.5 * Math.cos(s.breathe * elapsed + s.radiusPhase));
          if (elapsed < INTRO) radius = THREE.MathUtils.lerp(1.0, radius, elapsed / INTRO);

          // Xoáy cùng chiều, tốc độ dài gần như đều nên kiếm ở xa không bị chậm
          s.angle += Math.min(MAX_SPIN, ORBIT_SPEED / Math.max(radius, 1)) * delta;

          prevPos.copy(s.mesh.position);
          const x = center.x + Math.cos(s.angle) * radius;
          const z = center.z + Math.sin(s.angle) * radius;
          // Bay nhấp nhô ngang tầm thân quái, không cắm xuống đất
          const y = Math.max(getTerrainHeight(x, z) + 0.6, center.y + 1.8 + Math.sin(elapsed * 2.2 + i * 0.7) * 1.2);
          s.mesh.position.set(x, y, z);

          // Mũi kiếm hướng theo chiều bay
          s.vel.subVectors(s.mesh.position, prevPos).divideScalar(Math.max(delta, 0.001));
          if (s.vel.lengthSq() > 0.0001) s.mesh.quaternion.setFromUnitVectors(up, s.vel.clone().normalize());
          updateTrail(s);

          if (this.particles && Math.random() < 0.15) {
            this.particles.emitElementalParticles(s.mesh.position, 1, [0xa29bfe, 0xffffff, 0x74b9ff], [0.3, 1.2], 0.2, 0, 0.3);
          }

          for (const monster of monsters) {
            if (monster.isDead || (s.hitTimers.get(monster) || 0) > 0) continue;
            if (monster.checkCollision(s.mesh.position, 0.9)) {
              s.hitTimers.set(monster, HIT_INTERVAL);
              this.damageMonster(monster, DAMAGE, `⚡ -${DAMAGE}`, '#a29bfe', s.mesh.position);
              if (this.particles) this.particles.emitShockwave(s.mesh.position, 0xa29bfe, 2.2, 0.2);
              if (elapsed - lastHitSound > 0.07) {
                lastHitSound = elapsed;
                sound.playSwordSlash();
                if (this.controller) this.controller.addTrauma(0.03);
              }
            }
          }

          // PvP: người chơi đang trong thời gian chờ của thanh kiếm này thì bỏ qua (hitTimers khoá theo id)
          const cooling = new Set();
          for (const [key, timer] of s.hitTimers) if (timer > 0) cooling.add(key);
          for (const rp of this.damagePlayersNear(s.mesh.position, 0.9, DAMAGE, `⚡ -${DAMAGE}`, '#a29bfe', character, cooling)) {
            s.hitTimers.set(rp.id, HIT_INTERVAL);
          }
        }
        return true;
      }
    });
  }

  // --- KỸ NĂNG 5: VẠN KIẾM QUY TÔNG (WAN JIAN GUI ZONG) ---
  castWanJianGuiZong(targetPos, character, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

    sound.playSwordSummon();

    if (this.onScreenFlash) {
      this.onScreenFlash('sword');
    }

    // 1. Chỉ điểm kiếm trận hoàng kim trên mặt đất
    this.spawnTelegraph(hitPos, 0xffd700, 1.8, 14.0);
    this.spawnGroundDecalEffect('sword', new THREE.Vector3(impactX, impactY + 0.14, impactZ), 20, 2.8);

    // 2. Tiên kiếm ngọc bích dùng chung (dài ~2.4 đơn vị ở scale 1, như kiếm trận cũ)
    const createSwordMesh = (scale = 1.0) => createSword(scale * 1.9);

    // 3. Khởi tạo 32 thanh kiếm bay lơ lửng xoay tròn trên không trung (Sword Mandala Formation)
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
      sword.rotation.x = Math.PI; // Mũi kiếm chĩa xuống đất
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

    // 4. Thanh Thiên Kiếm Khổng Lồ (Colossal Divine Finisher Greatsword)
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

        // Cập nhật 32 thanh kiếm bay
        for (const s of swords) {
          if (elapsed < s.delay) {
            // Đang lơ lửng xoay tròn tụ kiếm khí
            s.mesh.rotation.y += delta * 6;
            s.mesh.position.y += Math.sin(elapsed * 10 + s.delay) * 0.05;
          } else if (!s.plunged) {
            // Lao vút xuống mục tiêu xé gió
            s.mesh.lookAt(s.targetPos);
            s.mesh.rotateX(Math.PI / 2);

            const dist = s.mesh.position.distanceTo(s.targetPos);
            const speed = 48.0;
            s.mesh.position.lerp(s.targetPos, Math.min(1.0, (speed * delta) / Math.max(0.1, dist)));

            // Vệt kiếm khí
            if (Math.random() < 0.4 && this.particles) {
              this.particles.emitElementalParticles(
                s.mesh.position,
                2,
                [0xffd700, 0xffffff],
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

              // Cắm kiếm nổ tia sáng
              if (this.particles) {
                this.particles.emitHitSparkles(s.targetPos, 8);
                this.particles.emitShockwave(s.targetPos, 0xffd700, 3.0, 0.25);
              }

              // Sát thương rỉa liên hoàn nhiều đợt
              this.dealDamageAOE(s.targetPos, 3.5, 25, '⚔️ -25', '#ffd700', monsters, null, 'lightning', null, character);
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

        // Cập nhật Thiên Kiếm Khổng Lồ (Finisher Sword at 1.4s)
        if (elapsed >= 1.4 && !giantPlunged) {
          giantSword.visible = true;
          const giantDist = giantSword.position.y - impactY;
          giantSword.position.y -= 75 * delta;

          if (this.particles) {
            this.particles.emitElementalParticles(
              giantSword.position,
              4,
              [0xffd700, 0xfff0a0, 0xffffff],
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

            // ĐÒN KẾT LIỄU CHẤN ĐỘNG TRỜI ĐẤT!
            sound.playGiantSwordImpact();

            if (this.controller) {
              this.controller.addTrauma(0.92);
            }
            if (this.onScreenFlash) {
              this.onScreenFlash('sword');
            }

            // Tàn phá địa hình & chấn động
            this.world.deformTerrain(impactX, impactZ, 13.0, 2.2, 'lightning');

            // Sóng xung kích kiếm khí khổng lồ
            this.particles.emitShockwave(hitPos, 0xffd700, 22, 0.85);
            this.particles.emitShockwave(hitPos, 0xffffff, 14, 0.5);
            this.particles.emitElementalParticles(hitPos, 50, [0xffd700, 0xffffff, 0xff9f43], [8, 18], 0.95, 6, 1.6);

            // Sát thương cực đại kết liễu
            this.dealDamageAOE(hitPos, 14.5, 240, '⚔️ -240 VẠN KIẾM!', '#ffd700', monsters, 'knockback', 'lightning', null, character);
          }
        }

        // Hết vòng đời thiên kiếm
        if (giantEmbedded) {
          giantLife -= delta;
          giantSword.rotation.z = Math.sin(elapsed * 24) * 0.05;

          if (giantLife <= 0.5) {
            giantSword.scale.multiplyScalar(0.94);
          }

          if (giantLife <= 0) {
            this.scene.remove(giantSword);
            this.scene.remove(swordContainer);
            this.particles.emitElementalParticles(hitPos, 35, [0xffd700, 0xffffff], [4, 10], 0.7, 5, 1.2);
            return false;
          }
        }

        return true;
      }
    });
  }

  // =========================================================================
  // KỸ NĂNG MÔN PHÁI: THÁI THANH ĐẠO GIA
  // =========================================================================

  // [Đạo Gia 2] BÁT QUÁI ĐẠI CANH TRẬN: trận Bát Quái (hồi 250 HP, làm chậm địch)
  // kèm 36 lôi kiếm Đại Canh xoáy quanh người, trận giữ đến khi kiếm trận tan
  castTaiChiBagua(character, monsters) {
    const BAGUA_DURATION = 10.0; // khớp thời gian 36 lôi kiếm của Đại Canh Kiếm Trận
    const center = character.position.clone();
    center.y = getTerrainHeight(center.x, center.z);
    sound.playSwordSummon();

    if (this.onScreenFlash) this.onScreenFlash('sword');

    // 0. Triệu hồi 36 lôi kiếm Đại Canh xoáy quanh trận
    this.castDaiCanhSwordArray(character, monsters);

    // 1. Chỉ điểm Bát Quái trận dưới chân
    this.spawnGroundDecalEffect('bagua', new THREE.Vector3(center.x, center.y + 0.08, center.z), 12, BAGUA_DURATION);

    // 2. Trụ ánh sáng Tiên Thiên Bát Quái xoay tròn
    const arrayGroup = new THREE.Group();
    arrayGroup.position.copy(center);

    const pillarGeo = new THREE.CylinderGeometry(5.2, 5.2, 6.5, 24, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
    pillarMesh.position.y = 3.25;
    arrayGroup.add(pillarMesh);

    // Vòng kim quang bao quanh
    const ringGeo = new THREE.RingGeometry(4.8, 5.2, 32);
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

    // Ghi nhận trận pháp Bát Quái đang hoạt động
    this.lastBaguaPos = center.clone();
    this.baguaTimer = BAGUA_DURATION;

    // 3. Hồi phục 150 HP tức thì cho caster
    if (character && character.hp < character.maxHp) {
      const heal = Math.min(150, character.maxHp - character.hp);
      character.hp += heal;
      if (character.updateBillboard) character.updateBillboard();
      this.damageTexts.spawn(`💚 +${Math.round(heal)} BÁT QUÁI!`, character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#2ed573');
    }

    if (this.particles) {
      this.particles.emitElementalParticles(center, 30, [0xf1c40f, 0x2ed573, 0xffffff], [2, 6], 0.6, 5.0, 1.2);
      this.particles.emitShockwave(center, 0xf1c40f, 10.0, 0.4);
    }

    let elapsed = 0;
    let tickTimer = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        tickTimer += delta;
        arrayGroup.rotation.y += delta * 1.5;
        pillarMesh.material.opacity = (Math.sin(elapsed * 6) * 0.15 + 0.28) * (1.0 - elapsed / BAGUA_DURATION);

        // Hiệu ứng trận địa liên tục mỗi 0.8s
        if (tickTimer >= 0.8) {
          tickTimer = 0;
          // Caster đứng trong trận: Hồi phục liên tục +25 HP và giải làm chậm
          if (character && !character.isDead && character.position.distanceTo(center) <= 6.0) {
            if (character.hp < character.maxHp) {
              character.heal(25);
              this.damageTexts.spawn('💚 +25 TRẬN ĐỒ', character.position.clone().add(new THREE.Vector3(0, 2.0, 0)), '#2ed573');
            }
            if (character.slowTimer > 0) character.slowTimer = 0;
          }

          // Địch đứng trong trận: Chịu 15 ST thánh quang và bị làm chậm 50%
          if (monsters) {
            for (const m of monsters) {
              if (!m.isDead && m.position.distanceTo(center) <= 6.0) {
                m.takeDamage(15, center);
                if (m.freeze) m.freeze(0.6);
                this.damageTexts.spawn('☯️ -15', m.position.clone().add(new THREE.Vector3(0, m.hitHeight, 0)), '#f1c40f');
              }
            }
          }
          if (this.canHitPlayers(character) && this.remotePlayers) {
            for (const rp of this.remotePlayers) {
              if (!rp.isDead && rp.position.distanceTo(center) <= 6.0) {
                this.onHitPlayer(rp.id, 15, rp.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 'lightning');
                this.damageTexts.spawn('☯️ -15 TRẬN ĐỒ', rp.position.clone().add(new THREE.Vector3(0, 1.8, 0)), '#f1c40f');
              }
            }
          }
        }

        if (elapsed >= BAGUA_DURATION) {
          if (this.lastBaguaPos === center) this.lastBaguaPos = null;
          this.scene.remove(arrayGroup);
          pillarMat.dispose();
          ringMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [Đạo Gia 3] NHẤT KHÍ HÓA TAM THANH: phân ra 2 đạo ảnh (xem clones.js).
  // Chỉ máy của người ra chiêu mới tạo đạo ảnh thật; máy khác thấy bản sao qua đồng bộ trạng thái.
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
  // KỸ NĂNG MÔN PHÁI: THANH VÂN TIÊN TÔNG
  // =========================================================================

  // [Thanh Vân 1] HUYỀN BĂNG TUYỆT VỰC (Cảnh báo 0.35s né tránh -> cọc băng trồi lên gây 95 ST & ĐÓNG BĂNG 2.2s)
  castFrostNova(targetPos, character, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const hitPos = new THREE.Vector3(impactX, impactY, impactZ);

    sound.playHit();
    if (this.onScreenFlash) this.onScreenFlash('frost');

    // 1. Chỉ điểm hoa tuyết băng phong (Cảnh báo telegraph 0.35s để người chơi kịp né)
    this.spawnTelegraph(hitPos, 0x00d2d3, 0.45, 14.0);
    this.spawnGroundDecalEffect('ice', new THREE.Vector3(impactX, impactY + 0.1, impactZ), 16, 2.5);

    // 2. Biến đổi địa hình thành tuyết trắng
    if (this.world && this.world.deformTerrain) {
      this.world.deformTerrain(impactX, impactZ, 14.0, 1.4, 'ice');
    }

    // 3. Mọc 12 tinh thể trụ băng nhọn hoắt low-poly
    const iceGroup = new THREE.Group();
    const iceSpikes = [];
    const spikeGeo = new THREE.CylinderGeometry(0.06, 0.42, 2.4, 5);
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x7ed6df,
      emissive: 0x00d2d3,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      flatShading: true,
    });

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 3.0 + Math.random() * 7.5;
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      const sx = impactX + Math.cos(angle) * dist;
      const sz = impactZ + Math.sin(angle) * dist;
      const sy = getTerrainHeight(sx, sz);

      spike.position.set(sx, sy - 2.5, sz); // Ẩn sâu dưới đất chờ 0.35s
      spike.rotation.x = (Math.random() - 0.5) * 0.4;
      spike.rotation.z = (Math.random() - 0.5) * 0.4;
      spike.scale.set(1, 0.1, 1);
      iceGroup.add(spike);
      iceSpikes.push({ mesh: spike, startY: sy - 2.5, targetY: sy + 1.1, baseScale: 0.8 + Math.random() * 0.5 });
    }
    this.scene.add(iceGroup);

    let elapsed = 0;
    let erupted = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        // Đợi 0.35s cảnh báo trước khi cọc băng trồi lên gây ĐÓNG BĂNG
        if (!erupted && elapsed >= 0.35) {
          erupted = true;
          sound.playGiantSwordImpact();
          if (this.particles) {
            this.particles.emitShockwave(hitPos, 0x00d2d3, 14.0, 0.5);
            this.particles.emitElementalParticles(hitPos, 35, [0x00d2d3, 0x7ed6df, 0xffffff], [3, 8], 0.7, 5.0, 1.2);
          }
          // Gây sát thương & ĐÓNG BĂNG CỨNG (cho mục tiêu không né kịp)
          this.dealDamageAOE(hitPos, 14.0, 95, '❄️ -95 ĐÓNG BĂNG!', '#00d2d3', monsters, 'freeze', 'ice', null, character);
        }

        if (erupted) {
          const eruptTime = elapsed - 0.35;
          // Trụ băng trồi lên nhanh trong 0.22s sau khi nổ
          if (eruptTime < 0.22) {
            const p = eruptTime / 0.22;
            for (const s of iceSpikes) {
              s.mesh.position.y = THREE.MathUtils.lerp(s.startY, s.targetY, p);
              s.mesh.scale.y = THREE.MathUtils.lerp(0.1, s.baseScale, p);
            }
          } else if (elapsed > 2.2) {
            // Trụ băng tan chảy co lại
            iceGroup.scale.multiplyScalar(0.96);
            if (elapsed >= 2.8) {
              this.scene.remove(iceGroup);
              spikeMat.dispose();
              return false;
            }
          }
        }
        return true;
      }
    });
  }

  // [Thanh Vân 2] NGỰ PHONG THUẤN TRẢM (Lướt gió tốc độ âm thanh 16m chém 85 ST, giải khống chế)
  castWindDash(targetPos, character, monsters) {
    if (!character) return;

    // Hóa giải mọi trạng thái khống chế & làm chậm
    if (character.freezeTimer > 0) character.freezeTimer = 0;
    if (character.slowTimer > 0) character.slowTimer = 0;
    this.damageTexts.spawn('🌪️ GIẢI KHỐNG CHẾ!', character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#00d2d3');

    const startPos = character.position.clone();
    const dir = PixelFXManager.flatDirection(startPos, targetPos);

    sound.playSwordSlash();
    if (this.controller) this.controller.addTrauma(0.15);

    // Dịch chuyển lướt nhanh 16m
    const dashDistance = 16.0;
    const endPos = startPos.clone().addScaledVector(dir, dashDistance);
    endPos.x = THREE.MathUtils.clamp(endPos.x, -120, 120);
    endPos.z = THREE.MathUtils.clamp(endPos.z, -120, 120);
    endPos.y = getTerrainHeight(endPos.x, endPos.z);

    // Vệt gió phong nhận dọc đường lướt
    if (this.particles) {
      for (let d = 0; d <= dashDistance; d += 2) {
        const p = startPos.clone().addScaledVector(dir, d);
        p.y = getTerrainHeight(p.x, p.z) + 0.6;
        this.particles.emitElementalParticles(p, 4, [0x00d2d3, 0xffffff, 0x7ed6df], [2, 5], 0.4, 3.0, 0.6);
      }
      this.particles.emitShockwave(startPos, 0x00d2d3, 6.0, 0.3);
      this.particles.emitShockwave(endPos, 0x00d2d3, 8.0, 0.35);
    }

    // Lướt gió mượt mà tốc độ cao
    if (character.startDash) {
      character.startDash(dir, dashDistance, 0.22);
    } else {
      character.position.copy(endPos);
      if (character.group) character.group.position.copy(endPos);
    }

    // Chém sát thương diện rộng dọc đường và tại điểm đến
    const midPos = startPos.clone().add(endPos).multiplyScalar(0.5);
    this.dealDamageAOE(midPos, 8.0, 85, '🌪️ -85 PHONG TRẢM!', '#00d2d3', monsters, 'knockback', 'ice', null, character);
    this.dealDamageAOE(endPos, 6.5, 85, '🌪️ -85 PHONG TRẢM!', '#00d2d3', monsters, 'knockback', 'ice', null, character);
  }

  // =========================================================================
  // KỸ NĂNG MÔN PHÁI: HỒNG TRẦN MA TU
  // =========================================================================

  // [Ma Tu 1] HUYẾT MA TRẢM (Phóng lưỡi đao huyết khí 24m, gây 125 ST & HÚT 60 HP; dưới 50% HP gây 165 ST & hút 120 HP)
  castBloodSlash(targetPos, character, monsters) {
    const startPos = character.position.clone();
    startPos.y += 1.1;
    const dir = PixelFXManager.flatDirection(startPos, targetPos);
    sound.playSwordSlash();

    if (this.controller) this.controller.addTrauma(0.18);

    // Kiểm tra trạng thái Huyết Cuồng (máu dưới 50%)
    const isBerserk = Boolean(character && character.hp < character.maxHp * 0.5);
    const slashDmg = isBerserk ? 165 : 125;
    const healAmount = isBerserk ? 120 : 60;
    const slashText = isBerserk ? '🔥🩸 -165 HUYẾT CUỒNG!' : '🩸 -125 HUYẾT MA!';
    const healText = isBerserk ? '🩸 +120 HUYẾT CUỒNG!' : '🩸 +60 HÚT HUYẾT!';

    if (isBerserk && character) {
      this.damageTexts.spawn('🔥 HUYẾT CUỒNG (<50% HP)!', character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#ff3838');
    }

    // Lưỡi đao huyết khí đỏ rực
    const bladeGeo = new THREE.TorusGeometry(1.6, 0.16, 6, 16, Math.PI * 0.9);
    const bladeMat = new THREE.MeshBasicMaterial({ color: isBerserk ? 0xff3838 : 0xff4757, side: THREE.DoubleSide });
    const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);

    bladeMesh.position.copy(startPos);
    bladeMesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2;
    bladeMesh.rotation.z = Math.PI / 2;
    this.scene.add(bladeMesh);

    const SPEED = 40.0;
    const RANGE = 24.0;
    let travelled = 0;
    let hasHealed = false;
    const hitSet = new Set();

    this.activeEffects.push({
      update: (delta) => {
        const step = SPEED * delta;
        travelled += step;
        bladeMesh.position.addScaledVector(dir, step);
        bladeMesh.position.y = getTerrainHeight(bladeMesh.position.x, bladeMesh.position.z) + 1.1;
        bladeMesh.rotation.z += delta * 18;

        if (this.particles && Math.random() < 0.6) {
          this.particles.emitElementalParticles(bladeMesh.position, 2, [0xff4757, 0xeb3b5a, 0x2d3436], [1, 4], 0.3, 0, 0.5);
        }

        // Quét trúng quái vật
        if (monsters) {
          for (const m of monsters) {
            if (!m.isDead && !hitSet.has(m) && m.checkCollision(bladeMesh.position, 1.6)) {
              hitSet.add(m);
              m.takeDamage(slashDmg, bladeMesh.position);
              this.damageTexts.spawn(slashText, m.position.clone().add(new THREE.Vector3(0, m.hitHeight, 0)), '#ff4757');

              // Hút máu hồi phục cho bản thân!
              if (!hasHealed && character && character.hp < character.maxHp) {
                hasHealed = true;
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
          const hitRps = this.damagePlayersNear(bladeMesh.position, 1.8, slashDmg, slashText, '#ff4757', character, hitSet);
          if (hitRps.length > 0 && !hasHealed && character && character.hp < character.maxHp) {
            hasHealed = true;
            const heal = Math.min(healAmount, character.maxHp - character.hp);
            character.hp += heal;
            if (character.updateBillboard) character.updateBillboard();
            this.damageTexts.spawn(healText, character.position.clone().add(new THREE.Vector3(0, 2.0, 0)), '#ff4757');
          }
        }

        if (travelled >= RANGE) {
          this.scene.remove(bladeMesh);
          bladeGeo.dispose();
          bladeMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [Ma Tu 2] U MINH MA VỰC (Hắc Động hút toàn bộ kẻ địch vào tâm hố, thiêu đốt 35 ST/s)
  castNetherVortex(targetPos, character, monsters) {
    const impactX = targetPos.x;
    const impactZ = targetPos.z;
    const impactY = getTerrainHeight(impactX, impactZ);
    const center = new THREE.Vector3(impactX, impactY, impactZ);

    sound.playSwordSummon();
    if (this.controller) this.controller.addTrauma(0.25);

    // Ghi nhận toạ độ Hắc Động ma vực đang hoạt động
    this.lastVortexPos = center.clone();
    this.vortexTimer = 3.5;

    this.spawnGroundDecalEffect('blood', new THREE.Vector3(impactX, impactY + 0.1, impactZ), 12, 3.5);

    // Mô hình Hắc Động xoáy đen tím
    const vortexGroup = new THREE.Group();
    vortexGroup.position.copy(center);

    const vortexGeo = new THREE.RingGeometry(0.8, 4.5, 32);
    vortexGeo.rotateX(-Math.PI / 2);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0x8854d0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
    vortexMesh.position.y = 0.15;
    vortexGroup.add(vortexMesh);

    // Tâm cầu ma lực đen
    const coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x1e272e })
    );
    coreMesh.position.y = 1.0;
    vortexGroup.add(coreMesh);

    this.scene.add(vortexGroup);

    let elapsed = 0;
    let tickTimer = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        tickTimer += delta;

        vortexMesh.rotation.z += delta * 10;
        coreMesh.rotation.y += delta * 6;
        coreMesh.scale.setScalar(1.0 + Math.sin(elapsed * 12) * 0.15);

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

        // Hút người chơi khác trong PvP
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

        // Gây sát thương ma diễm định kỳ mỗi 0.6s
        if (tickTimer >= 0.6) {
          tickTimer = 0;
          this.dealDamageAOE(center, 9.0, 35, '🔥 -35 MA DIỄM!', '#eb3b5a', monsters, null, 'fire', null, character);
          if (this.particles) {
            this.particles.emitElementalParticles(center, 12, [0x8854d0, 0xeb3b5a, 0x1e272e], [1, 4], 0.5, 0, 0.6);
          }
        }

        if (elapsed >= 3.5) {
          if (this.lastVortexPos === center) this.lastVortexPos = null;
          // Nổ bung kết thúc đẩy văng kẻ địch
          this.dealDamageAOE(center, 10.0, 60, '💥 -60 NỔ MA KHÍ!', '#ff4757', monsters, 'knockback', 'fire', 40.0, character);
          this.scene.remove(vortexGroup);
          vortexGeo.dispose();
          vortexMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [Ma Tu 3] HỒNG TRẦN MA BẠO (Vụ nổ Huyết Diễm cực đại 16m; kết hợp U Minh Ma Vực gây 325 ST)
  castHellfireCataclysm(targetPos, character, monsters) {
    const center = character ? character.position.clone() : targetPos.clone();
    center.y = getTerrainHeight(center.x, center.z);

    sound.playGiantSwordImpact();
    if (this.controller) this.controller.addTrauma(0.85);
    if (this.onScreenFlash) this.onScreenFlash('fire');

    // Nung chảy đất đá thành hố than dung nham
    if (this.world && this.world.deformTerrain) {
      this.world.deformTerrain(center.x, center.z, 15.0, 2.4, 'fire');
    }

    if (this.particles) {
      this.particles.emitShockwave(center, 0xff3838, 20.0, 0.7);
      this.particles.emitShockwave(center, 0xeb3b5a, 14.0, 0.5);
      this.particles.emitElementalParticles(center, 60, [0xff3838, 0xeb3b5a, 0xffd32a, 0x2d3436], [6, 16], 0.9, 6.5, 1.8);
    }

    // Combo Ma Diễm Cộng Hưởng: Nếu mục tiêu trúng đòn gần/trong U Minh Ma Vực -> +75 ST (Tổng 325 ST)
    const inVortex = this.lastVortexPos && center.distanceTo(this.lastVortexPos) <= 12.0 && this.vortexTimer > 0;
    const actualDamage = inVortex ? 325 : 250;
    const blastText = inVortex ? '🔥🩸 -325 MA DIỄM CỘNG HƯỞNG!' : '🔥 -250 MA BẠO!';

    // Sát thương bộc phá cực đại
    this.dealDamageAOE(center, 16.0, actualDamage, blastText, '#eb3b5a', monsters, 'knockback', 'fire', 55.0, character);
  }

  // =========================================================================
  // KỸ NĂNG MÔN PHÁI: BẠCH HẠC CHÂN NHÂN
  // =========================================================================

  // [Bạch Hạc 1] CỬU THIÊN HUYỀN LÔI (Sét đánh bổ xuống mục tiêu 140 ST + giật lan 60 ST)
  castChainLightning(targetPos, character, monsters) {
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

    // Sát thương tâm sét & gây TÊ LIỆT (Làm chậm tốc chạy 45% trong 2.5s)
    this.dealDamageAOE(hitPos, 8.5, 140, '⚡ -140 TÊ LIỆT!', '#ffd32a', monsters, null, 'lightning', null, character);

    // Áp dụng hiệu ứng Tê Liệt cho kẻ địch trúng tâm sét
    if (monsters) {
      for (const m of monsters) {
        if (!m.isDead && m.position.distanceTo(hitPos) <= 8.5) {
          if (m.freeze) m.freeze(1.2);
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

    // Sét giật lan (Chain Lightning) sang 4 mục tiêu lân cận trong 14m
    if (monsters) {
      let chained = 0;
      for (const m of monsters) {
        if (!m.isDead && chained < 4) {
          const d = m.position.distanceTo(hitPos);
          if (d > 3.0 && d < 14.0) {
            chained++;
            m.takeDamage(60, hitPos);
            this.damageTexts.spawn('⚡ -60 GIẬT LAN!', m.position.clone().add(new THREE.Vector3(0, m.hitHeight, 0)), '#74b9ff');
            if (this.particles) this.particles.emitHitSparkles(m.position, 12);
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

  // [Bạch Hạc 2] BẠCH HẠC TƯỜNG VÂN (Linh ảnh Bạch Hạc sải cánh lướt 24m hất tung + tăng tốc chạy)
  castCraneGlide(targetPos, character, monsters) {
    const startPos = character.position.clone();
    startPos.y += 1.2;
    const dir = PixelFXManager.flatDirection(startPos, targetPos);
    sound.playSwordSlash();

    if (this.controller) this.controller.addTrauma(0.2);

    // Tăng tốc độ chạy cho caster trong 4 giây & MIỄN KHỐNG CHẾ!
    if (character) {
      if (character.freezeTimer > 0) character.freezeTimer = 0;
      if (character.slowTimer > 0) character.slowTimer = 0;
      character.speedBoostTimer = 4.0;
      this.damageTexts.spawn('🪶 +45% TỐC ĐỘ / MIỄN KHỐNG!', character.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#2ed573');
    }

    // Mô hình Linh Ảnh Bạch Hạc sải cánh
    const craneGroup = new THREE.Group();
    craneGroup.position.copy(startPos);
    craneGroup.rotation.y = Math.atan2(dir.x, dir.z);

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xf5f6fa,
      emissive: 0x2ed573,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      flatShading: true,
    });

    const bodyMesh = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.2, 5), wingMat);
    bodyMesh.rotation.x = Math.PI / 2;
    craneGroup.add(bodyMesh);

    // 2 cánh hạc sải rộng 8m
    for (const side of [1, -1]) {
      const wingGeo = new THREE.BoxGeometry(3.8, 0.1, 1.2);
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(side * 2.2, 0.2, 0);
      wing.rotation.z = side * -0.2;
      craneGroup.add(wing);
    }

    this.scene.add(craneGroup);

    const SPEED = 38.0;
    const RANGE = 24.0;
    let travelled = 0;
    const hitSet = new Set();

    this.activeEffects.push({
      update: (delta) => {
        const step = SPEED * delta;
        travelled += step;
        craneGroup.position.addScaledVector(dir, step);
        craneGroup.position.y = getTerrainHeight(craneGroup.position.x, craneGroup.position.z) + 1.2;

        if (this.particles && Math.random() < 0.6) {
          this.particles.emitElementalParticles(craneGroup.position, 3, [0xf5f6fa, 0x2ed573, 0xffffff], [2, 5], 0.4, 0, 0.6);
        }

        // Quét quái vật hất tung lên trời
        if (monsters) {
          for (const m of monsters) {
            if (!m.isDead && !hitSet.has(m) && m.checkCollision(craneGroup.position, 2.5)) {
              hitSet.add(m);
              m.takeDamage(100, craneGroup.position);
              m.position.y += 3.5; // Hất tung!
              this.damageTexts.spawn('🪶 -100 BẠCH HẠC!', m.position.clone().add(new THREE.Vector3(0, m.hitHeight, 0)), '#2ed573');
              if (this.particles) this.particles.emitHitSparkles(m.position, 14);
            }
          }
        }

        // Quét trúng người chơi khác (PvP)
        if (this.canHitPlayers(character)) {
          this.damagePlayersNear(craneGroup.position, 2.5, 100, '🪶 -100 BẠCH HẠC!', '#2ed573', character, hitSet);
        }

        if (travelled >= RANGE) {
          this.scene.remove(craneGroup);
          wingMat.dispose();
          return false;
        }
        return true;
      }
    });
  }

  // [Bạch Hạc 3] HÁM ĐỊA THẦN THÔNG (Giậm sụp nứt mặt đất chấn động 230 ST, thổi bay mọi vật thể)
  castEarthquakeStomp(targetPos, character, monsters) {
    const center = character ? character.position.clone() : targetPos.clone();
    center.y = getTerrainHeight(center.x, center.z);

    sound.playGiantSwordImpact();
    if (this.controller) this.controller.addTrauma(0.8);
    if (this.onScreenFlash) this.onScreenFlash('earth');

    // Sụp đổ địa hình 2.5m
    if (this.world && this.world.deformTerrain) {
      this.world.deformTerrain(center.x, center.z, 15.0, 2.5, 'earth');
    }

    if (this.particles) {
      this.particles.emitShockwave(center, 0xe67e22, 18.0, 0.7);
      this.particles.emitShockwave(center, 0xffd32a, 12.0, 0.5);
      this.particles.emitElementalParticles(center, 50, [0xe67e22, 0xd35400, 0x7f8c8d], [5, 14], 0.85, 6.0, 1.6);
    }

    // Sát thương cực đại hất tung & phá hủy vật thể
    this.dealDamageAOE(center, 16.0, 230, '🌍 -230 HÁM ĐỊA!', '#e67e22', monsters, 'knockback', 'earth', 60.0, character);
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

  // XỬ LÝ SÁT THƯƠNG DIỆN RỘNG (AOE), TƯƠNG TÁC MÔI TRƯỜNG & HIỆU ỨNG TRẠNG THÁI
  // caster: nhân vật ra chiêu; chỉ chiêu của chính mình mới gây sát thương PvP (xem canHitPlayers)
  dealDamageAOE(epicenter, radius, amount, text, textColor, monsters, statusEffect = null, elementType = 'neutral', customForce = null, caster = null) {
    // 1. Tương tác với Vật thể môi trường (Làm văng, gãy cây, bể đá, bung hàng rào, sập tường, vỡ ngói)
    if (this.world && this.world.interactWithArea) {
      const force = customForce !== null ? customForce : (amount >= 200 ? 55 : (amount >= 150 ? 25 : (amount >= 120 ? 19 : 14)));
      this.world.interactWithArea(epicenter, radius * 1.15, force, elementType);
    }

    // 2. Gây sát thương PvP diện rộng lên người chơi khác
    if (this.canHitPlayers(caster) && this.remotePlayers.length > 0) {
      for (const rp of this.remotePlayers) {
        if (!rp.isDead) {
          const dist = rp.position.distanceTo(epicenter);
          if (dist <= radius + 0.85) {
            if (this.onHitPlayer) {
              this.onHitPlayer(rp.id, amount, rp.position.clone().add(new THREE.Vector3(0, 1.2, 0)), elementType);
            }
            if (statusEffect === 'freeze' && rp.freeze) {
              rp.freeze(2.2);
            }
            if (this.damageTexts) {
              const hitPos = rp.position.clone().add(new THREE.Vector3(0, 1.8, 0));
              this.damageTexts.spawn(text, hitPos, textColor);
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
          monster.takeDamage(amount, epicenter);

          // Áp dụng trạng thái khống chế
          if (statusEffect === 'freeze' && monster.freeze) {
            monster.freeze(2.8);
          } else if (statusEffect === 'knockback' && monster.knockback) {
            monster.knockback(epicenter, 14);
          }

          const hitPos = monster.position.clone();
          hitPos.y += monster.hitHeight * 0.7;
          this.damageTexts.spawn(text, hitPos, textColor);
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

  // [NAMCAM 3] THẢ RẮM DIỆT THẾ (Chổng mông nổ khói vàng mù mịt 260 ST diện rộng + BẤT ĐỘNG TOÀN DIỆN quái, người chơi, phân thân trong suốt thời gian hiệu lực)
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
    const fartRadius = 10.5;

    const cloudPuffs = [];
    const puffCount = 22;
    const puffGeo = new THREE.DodecahedronGeometry(1.3, 1);
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      roughness: 0.95,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    });

    for (let i = 0; i < puffCount; i++) {
      const puff = new THREE.Mesh(puffGeo, puffMat);
      const angle = (i / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 0.5 + Math.random() * 2.5;
      puff.position.set(
        fartPos.x + Math.cos(angle) * dist,
        fartPos.y + 0.4 + Math.random() * 0.9,
        fartPos.z + Math.sin(angle) * dist
      );
      puff.scale.setScalar(0.4);
      puff.userData = {
        maxScale: 2.6 + Math.random() * 1.8,
        vx: Math.cos(angle) * (2.8 + Math.random() * 3.8),
        vz: Math.sin(angle) * (2.8 + Math.random() * 3.8),
        vy: 0.4 + Math.random() * 0.9,
      };
      this.scene.add(puff);
      cloudPuffs.push(puff);
    }

    if (this.canHitPlayers(character)) {
      this.dealDamageAOE(fartPos, fartRadius, 260, '💨 -260 THẢ RẮM DIỆT THẾ!', '#f1c40f', monsters, 'freeze', 'poison', null, character);
    }
    if (this.particles) {
      this.particles.emitShockwave(fartPos, 0xf1c40f, fartRadius, 0.45);
    }

    // Lập tức khống chế bất động toàn bộ mục tiêu (quái vật, người chơi, phân thân) trong vùng!
    this.freezeArea(fartPos, fartRadius, 1.5, monsters, character);
    this.damageTexts.spawn('💨 THÚI QUÁ KHÔNG THỞ ĐƯỢC! BẤT ĐỘNG!', fartPos.clone().add(new THREE.Vector3(0, 2.8, 0)), '#ffd32a');

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
          p.userData.vx *= 0.94;
          p.userData.vz *= 0.94;

          const progress = elapsed / duration;
          p.scale.setScalar(THREE.MathUtils.lerp(0.4, p.userData.maxScale, Math.min(1.0, elapsed * 2.5)));
          puffMat.opacity = Math.max(0, 0.85 * (1.0 - progress));
        }

        // DUY TRÌ BẤT ĐỘNG TOÀN DIỆN (Người chơi, Quái vật, Phân thân) TRONG SUỐT THỜI GIAN KHÓI VÀNG CÒN TỒN TẠI!
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
    for (const key in this.cooldowns) {
      const cd = this.cooldowns[key];
      if (cd.current > 0) {
        cd.current = Math.max(0, cd.current - delta);
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

    // 3. Cập nhật số sát thương nhảy lên
    this.damageTexts.update(delta);
  }
}
