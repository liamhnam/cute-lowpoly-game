import * as THREE from 'three';

// Cache các texture procedural dùng chung để tái sử dụng tối ưu bộ nhớ VRAM
const textureCache = new Map();

/**
 * 1. Texture Gạch Lát Đá Cổ Kính (Flagstone / Granite Pavers)
 * Dùng cho mặt sàn kinh thành 300m, đại lộ Chu Tước, đường phố và sân đình
 */
export function getGroundPavingTexture() {
  if (textureCache.has('groundPaving')) return textureCache.get('groundPaving');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Nền mạch vữa xám đậm
  ctx.fillStyle = '#636e72';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const rowH = 512 / rows;
  const stonePalette = ['#f5f6fa', '#dfe4ea', '#ced6e0', '#f1f2f6', '#e4e7eb', '#dcdde1'];

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    let x = (r % 2 === 0 ? 0 : -rowH * 0.55);

    while (x < 512 + rowH) {
      const stoneW = rowH * (1.1 + ((r * 11 + Math.abs(x)) % 5) * 0.18);
      const margin = 2.5;

      const colIdx = Math.abs(Math.floor((r * 7 + x * 3) % stonePalette.length));
      ctx.fillStyle = stonePalette[colIdx];

      const sx = x + margin;
      const sy = y + margin;
      const sw = stoneW - margin * 2;
      const sh = rowH - margin * 2;

      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, [3]);
      ctx.fill();

      // Vát cạnh sáng mép trên trái
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy + sh - 2);
      ctx.lineTo(sx + 2, sy + 2);
      ctx.lineTo(sx + sw - 2, sy + 2);
      ctx.stroke();

      // Vát cạnh tối mép dưới phải
      ctx.strokeStyle = 'rgba(47, 53, 66, 0.38)';
      ctx.beginPath();
      ctx.moveTo(sx + sw - 2, sy + 2);
      ctx.lineTo(sx + sw - 2, sy + sh - 2);
      ctx.lineTo(sx + 2, sy + sh - 2);
      ctx.stroke();

      // Hạt rỗ li ti bề mặt đá granite
      for (let s = 0; s < 10; s++) {
        const px = sx + 4 + ((s * 37) % Math.max(4, sw - 8));
        const py = sy + 4 + ((s * 53) % Math.max(4, sh - 8));
        ctx.fillStyle = (s % 2 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.22)');
        ctx.fillRect(px, py, 2, 2);
      }

      x += stoneW;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(75, 75);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('groundPaving', texture);
  return texture;
}

/**
 * 2. Texture Gạch Đá Tường Thành & Pháo Đài Cổ (Ashlar Stone Masonry)
 */
export function getFortressStoneTexture() {
  if (textureCache.has('fortressStone')) return textureCache.get('fortressStone');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2f3542';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const rowH = 512 / rows;
  const blockW = 128;
  const stonePalette = ['#747d8c', '#57606f', '#4b6584', '#636e72', '#485460'];

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const offset = (r % 2 === 0 ? 0 : blockW * 0.5);

    for (let x = -offset; x < 512 + blockW; x += blockW) {
      const colIdx = Math.abs((r * 5 + Math.floor(x / blockW) * 7) % stonePalette.length);
      ctx.fillStyle = stonePalette[colIdx];

      const sx = x + 2;
      const sy = y + 2;
      const sw = blockW - 4;
      const sh = rowH - 4;

      ctx.fillRect(sx, sy, sw, sh);

      // Vát khối đá 3D nhẹ
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(sx, sy, sw, 2.5);
      ctx.fillRect(sx, sy, 2.5, sh);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(sx, sy + sh - 2.5, sw, 2.5);
      ctx.fillRect(sx + sw - 2.5, sy, 2.5, sh);

      // Vết rêu xanh ở các hàng chân tường
      if (r >= rows - 3) {
        ctx.fillStyle = 'rgba(46, 213, 115, 0.24)';
        ctx.fillRect(sx, sy + sh - 6, sw, 5);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('fortressStone', texture);
  return texture;
}

/**
 * 3. Texture Ngói Âm Dương / Ngói Lưu Ly Ống (Curved Eave Roof Tiles)
 */
export function getRoofTileTexture(colorType = 'gold') {
  const cacheKey = `roofTile_${colorType}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  let baseColor, lightColor, darkColor, grooveColor;
  if (colorType === 'gold') {
    baseColor = '#f39c12';
    lightColor = '#fcd575';
    darkColor = '#c97808';
    grooveColor = '#5e3703';
  } else if (colorType === 'jade') {
    baseColor = '#16a085';
    lightColor = '#48c9b0';
    darkColor = '#0e6655';
    grooveColor = '#08332b';
  } else if (colorType === 'red') {
    baseColor = '#c0392b';
    lightColor = '#e74c3c';
    darkColor = '#922b21';
    grooveColor = '#4a1510';
  } else {
    // dark slate
    baseColor = '#2c3e50';
    lightColor = '#4b6584';
    darkColor = '#1e272e';
    grooveColor = '#0f141a';
  }

  ctx.fillStyle = grooveColor;
  ctx.fillRect(0, 0, 512, 512);

  const cols = 8;
  const colW = 512 / cols;
  const rows = 12;
  const rowH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;

    for (let c = 0; c < cols; c++) {
      const x = c * colW;

      // Gradient cong hình trụ ống ngói dương
      const grad = ctx.createLinearGradient(x, y, x + colW, y);
      grad.addColorStop(0, darkColor);
      grad.addColorStop(0.32, lightColor);
      grad.addColorStop(0.65, baseColor);
      grad.addColorStop(1, grooveColor);

      ctx.fillStyle = grad;
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 3);

      // Gờ mí đầu ngói tròn
      ctx.fillStyle = lightColor;
      ctx.fillRect(x + 2, y + rowH - 3, colW - 4, 3);

      // Đầu ngói hoa văn giọt nước / hoa cúc tròn
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(x + colW / 2, y + rowH - 2, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 4. Texture Thớ Gỗ & Ván Gỗ Lim / Gỗ Tuyết Tùng (Wood Plank & Grain)
 */
export function getWoodGrainTexture(isDark = false) {
  const cacheKey = `woodGrain_${isDark}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const baseColor = isDark ? '#3d2714' : '#8d5b36';
  const lightGrain = isDark ? '#5c3a1e' : '#a76d41';
  const darkGrain = isDark ? '#231508' : '#5f3a20';

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // Thớ gỗ sợi dọc
  for (let i = 0; i < 65; i++) {
    const gx = (i * 21.7) % 512;
    const gw = 2 + (i % 4);
    ctx.fillStyle = (i % 2 === 0 ? lightGrain : darkGrain);
    ctx.globalAlpha = 0.22 + (i % 4) * 0.08;
    ctx.fillRect(gx, 0, gw, 512);
  }
  ctx.globalAlpha = 1.0;

  // Rãnh ghép ván gỗ dọc
  const planks = 4;
  const plankW = 512 / planks;
  ctx.strokeStyle = darkGrain;
  ctx.lineWidth = 3;
  for (let p = 1; p < planks; p++) {
    ctx.beginPath();
    ctx.moveTo(p * plankW, 0);
    ctx.lineTo(p * plankW, 512);
    ctx.stroke();
  }

  // Đinh tán đồng cổ cố định 2 đầu ván
  for (let p = 0; p < planks; p++) {
    const px = p * plankW + plankW / 2;
    for (const py of [24, 488]) {
      ctx.fillStyle = '#1e272e';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 5. Texture Gợn Sóng Nước & Caustic Kênh Đào (Flowing Water Caustics)
 */
export function getWaterFlowTexture() {
  if (textureCache.has('waterFlow')) return textureCache.get('waterFlow');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0abde3';
  ctx.fillRect(0, 0, 512, 512);

  // Sóng nước dập dềnh
  ctx.strokeStyle = 'rgba(72, 219, 251, 0.75)';
  ctx.lineWidth = 3.5;

  for (let y = 0; y < 512; y += 28) {
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const waveY = y + Math.sin(x * 0.06 + y * 0.04) * 7 + Math.cos(x * 0.08) * 3.5;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  // Đốm sáng bọt nước lấp lánh
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (let i = 0; i < 45; i++) {
    const cx = (i * 43) % 512;
    const cy = (i * 79) % 512;
    ctx.beginPath();
    ctx.arc(cx, cy, 3 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('waterFlow', texture);
  return texture;
}

/**
 * 6. Texture Biển Hiệu Thư Pháp Thếp Vàng (Traditional Imperial Calligraphy Plaque)
 */
export function getCalligraphySignTexture(title, subtitle = '', style = 'gold') {
  const cacheKey = `sign_${title}_${style}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  // Nền sơn mài đen hoặc sơn son
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 160);
  if (style === 'vermilion') {
    bgGrad.addColorStop(0, '#781414');
    bgGrad.addColorStop(0.5, '#991b1b');
    bgGrad.addColorStop(1, '#5c0f0f');
  } else {
    bgGrad.addColorStop(0, '#111827');
    bgGrad.addColorStop(0.5, '#1f2937');
    bgGrad.addColorStop(1, '#0f172a');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 160);

  // Viền chỉ vàng đôi hoàng gia
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 148);

  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 132);

  // Hoa văn mây 4 góc
  for (const [cx, cy] of [[20, 20], [492, 20], [20, 140], [492, 140]]) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chữ thư pháp dát vàng
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Bóng đổ chữ
  ctx.font = 'bold 54px "Noto Serif", "Songti SC", "SimSun", "Times New Roman", serif';
  ctx.fillStyle = '#78350f';
  ctx.fillText(title, 258, 76);

  // Chữ vàng kim 24k
  const textGrad = ctx.createLinearGradient(0, 30, 0, 110);
  textGrad.addColorStop(0, '#fef08a');
  textGrad.addColorStop(0.5, '#facc15');
  textGrad.addColorStop(1, '#ca8a04');
  ctx.fillStyle = textGrad;
  ctx.fillText(title, 256, 73);

  if (subtitle) {
    ctx.font = 'bold 18px "Noto Serif", "Songti SC", serif';
    ctx.fillStyle = '#fef3c7';
    ctx.fillText(subtitle, 256, 126);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 7. Texture Phù Điêu Cửu Long Bích (Nine Dragon Screen Mural)
 */
export function getDragonScreenTexture() {
  if (textureCache.has('dragonScreen')) return textureCache.get('dragonScreen');

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Nền trời mây ngọc bích & sóng đại dương
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
  bgGrad.addColorStop(0, '#1a365d');
  bgGrad.addColorStop(0.65, '#2b6cb0');
  bgGrad.addColorStop(1, '#065666');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 256);

  // Lớp sóng đại dương cuộn trào chân tường
  ctx.fillStyle = '#e2e8f0';
  for (let x = 0; x < 1024; x += 48) {
    ctx.beginPath();
    ctx.arc(x + 24, 235, 20, Math.PI, 0);
    ctx.fill();
  }

  // 9 Con Rồng Châu Ngọc thiêng liêng
  const dragonColors = [
    '#3182ce', '#ecc94b', '#38a169', '#e53e3e', '#805ad5',
    '#edf2f7', '#dd6b20', '#319795', '#d69e2e'
  ];

  for (let d = 0; d < 9; d++) {
    const cx = 60 + d * 105;
    const cy = 110 + (d % 2 === 0 ? -22 : 22);

    ctx.fillStyle = dragonColors[d];
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;

    // Thân rồng uốn lượn S-curve
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 1.5);
    ctx.stroke();

    // Đầu rồng ngậm ngọc châu
    ctx.beginPath();
    ctx.arc(cx + 25, cy - 15, 14, 0, Math.PI * 2);
    ctx.fill();

    // Hạt minh châu rực sáng
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(cx + 42, cy - 15, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mây ngũ sắc vần vũ
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let m = 0; m < 16; m++) {
    const mx = (m * 68) % 1024;
    const my = 40 + (m % 3) * 20;
    ctx.beginPath();
    ctx.arc(mx, my, 16, 0, Math.PI * 2);
    ctx.arc(mx + 14, my - 6, 20, 0, Math.PI * 2);
    ctx.arc(mx + 28, my, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('dragonScreen', texture);
  return texture;
}

/**
 * 8. Texture Mặt Trống Chiến Trận & Thái Cực Bát Quái (War Drum Skin)
 */
export function getBattleDrumSkinTexture() {
  if (textureCache.has('battleDrumSkin')) return textureCache.get('battleDrumSkin');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Nền da trâu già màu ngà vellum
  ctx.fillStyle = '#f5f6fa';
  ctx.fillRect(0, 0, 512, 512);

  // Vòng đai hoa văn mây đỏ viền trống
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(256, 256, 230, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(256, 256, 208, 0, Math.PI * 2);
  ctx.stroke();

  // Biểu tượng Thái Cực Âm Dương trung tâm
  const cx = 256, cy = 256, r = 85;
  ctx.fillStyle = '#2c3e50';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.arc(cx, cy + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false);
  ctx.arc(cx, cy - r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  ctx.fill();

  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2, false);
  ctx.arc(cx, cy + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false);
  ctx.arc(cx, cy - r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  ctx.fill();

  // 2 Mắt thái cực
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(cx, cy - r / 2, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2c3e50';
  ctx.beginPath();
  ctx.arc(cx, cy + r / 2, 12, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('battleDrumSkin', texture);
  return texture;
}

/**
 * 9. Texture Bia Bắn Cung Rơm & Hồng Tâm (Archery Target Straw Rings)
 */
export function getArcheryTargetTexture() {
  if (textureCache.has('archeryTarget')) return textureCache.get('archeryTarget');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Nền rơm bện xoắn ốc
  ctx.fillStyle = '#f5cd79';
  ctx.fillRect(0, 0, 512, 512);

  const cx = 256, cy = 256;
  const rings = [
    { r: 240, color: '#f5f6fa' },
    { r: 190, color: '#2f3542' },
    { r: 140, color: '#0984e3' },
    { r: 90, color: '#d63031' },
    { r: 40, color: '#fdcb6e' }
  ];

  rings.forEach(ring => {
    ctx.fillStyle = ring.color;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('archeryTarget', texture);
  return texture;
}

/**
 * 10. Texture Cờ Rượu "TỬU" (酒) Vải Lụa Đỏ Thêu Chữ Vàng
 */
export function getWineFlagTexture() {
  if (textureCache.has('wineFlag')) return textureCache.get('wineFlag');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  // Nền vải lụa đỏ thắm
  const bgGrad = ctx.createLinearGradient(0, 0, 512, 360);
  bgGrad.addColorStop(0, '#c0392b');
  bgGrad.addColorStop(0.5, '#e74c3c');
  bgGrad.addColorStop(1, '#962d22');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 360);

  // Viền răng cưa tua rua vàng mép cờ
  ctx.fillStyle = '#f1c40f';
  for (let y = 0; y < 360; y += 30) {
    ctx.beginPath();
    ctx.moveTo(512, y);
    ctx.lineTo(485, y + 15);
    ctx.lineTo(512, y + 30);
    ctx.fill();
  }

  // Khung viền chỉ vàng
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, 460, 328);

  // Chữ "TỬU" (酒) thư pháp lớn màu vàng kim
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 150px "Noto Serif", "Songti SC", "SimSun", "Times New Roman", serif';
  ctx.fillStyle = '#78350f';
  ctx.fillText('酒', 246, 184);

  const textGrad = ctx.createLinearGradient(0, 80, 0, 260);
  textGrad.addColorStop(0, '#fffbeb');
  textGrad.addColorStop(0.5, '#fef08a');
  textGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = textGrad;
  ctx.fillText('酒', 242, 180);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('wineFlag', texture);
  return texture;
}

/**
 * 11. Texture Vò Rượu Gốm Nữ Nhi Hồng (Ceramic Wine Urn with Paper Label)
 */
export function getWineUrnTexture() {
  if (textureCache.has('wineUrn')) return textureCache.get('wineUrn');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Nền đất nung nung men nâu đỏ
  const clayGrad = ctx.createLinearGradient(0, 0, 512, 512);
  clayGrad.addColorStop(0, '#a0522d');
  clayGrad.addColorStop(0.5, '#8b4513');
  clayGrad.addColorStop(1, '#5c2c16');
  ctx.fillStyle = clayGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Vân men gốm rạn tự nhiên
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 30; i++) {
    const y = (i * 19) % 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y - 10, 340, y + 15, 512, y);
    ctx.stroke();
  }

  // Tờ giấy điều đỏ hình thoi dán nhãn "Nữ Nhi Hồng" (女兒紅)
  ctx.save();
  ctx.translate(256, 256);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-90, -90, 180, 180);
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 4;
  ctx.strokeRect(-80, -80, 160, 160);
  ctx.restore();

  // Chữ thư pháp "TỬU" màu vàng
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 78px "Noto Serif", "Songti SC", "SimSun", serif';
  ctx.fillStyle = '#fef08a';
  ctx.fillText('酒', 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('wineUrn', texture);
  return texture;
}

/**
 * 12. Texture Bia Đá Rùa Cõng (Bixi Stele Inscribed Tablet)
 */
export function getBixiSteleTexture() {
  if (textureCache.has('bixiStele')) return textureCache.get('bixiStele');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Nền đá hoa cương xám đen mài bóng
  const stoneGrad = ctx.createLinearGradient(0, 0, 512, 1024);
  stoneGrad.addColorStop(0, '#2f3542');
  stoneGrad.addColorStop(0.5, '#1e272e');
  stoneGrad.addColorStop(1, '#0f141a');
  ctx.fillStyle = stoneGrad;
  ctx.fillRect(0, 0, 512, 1024);

  // Viền hoa văn hồi văn chạm khắc chìm
  ctx.strokeStyle = '#dcdde1';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 472, 984);
  ctx.strokeRect(30, 30, 452, 964);

  // Trán bia chạm Lưỡng Long Triều Nhật
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(256, 90, 28, 0, Math.PI * 2);
  ctx.fill();

  // Các cột chữ văn bia chữ Hán/Nôm thếp vàng
  ctx.font = 'bold 28px "Noto Serif", "Songti SC", "SimSun", serif';
  ctx.fillStyle = '#f5f6fa';
  ctx.textAlign = 'center';
  ctx.fillText('天朝聖德碑', 256, 170); // Tiêu đề: Thiên Triều Thánh Đức Bi

  // Các dòng chữ khắc văn bia cổ kính
  const inscriptions = [
    '大越盛世 萬象更新',
    '天門高聳 帝闕森嚴',
    '朱雀横空 玄武鎮北',
    '文韜武略 威靈四海',
    '千秋盛德 萬古流芳',
    '風調雨順 國泰民安',
    '龍興之地 皇圖永固',
    '四方納貢 百姓熙皞'
  ];

  ctx.font = '22px "Noto Serif", "Songti SC", "SimSun", serif';
  ctx.fillStyle = '#bdc3c7';
  for (let i = 0; i < inscriptions.length; i++) {
    ctx.fillText(inscriptions[i], 256, 260 + i * 58);
  }

  // Dấu triện đỏ của triều đình ở góc dưới
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(206, 820, 100, 100);
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.strokeRect(212, 826, 88, 88);
  ctx.font = 'bold 26px "Noto Serif", "Songti SC", serif';
  ctx.fillStyle = '#fef08a';
  ctx.fillText('御寶', 256, 874);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('bixiStele', texture);
  return texture;
}

/**
 * 13. Texture Vảy Hắc Long Ma Đế & Long Giáp Hoàng Gia (Imperial Dragon Scales)
 */
export function getDragonScalesTexture() {
  if (textureCache.has('dragonScales')) return textureCache.get('dragonScales');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Nền hắc ngọc huyền bí
  ctx.fillStyle = '#110d18';
  ctx.fillRect(0, 0, 512, 512);

  const scaleRows = 12;
  const rowH = 512 / scaleRows;
  const scaleW = rowH * 1.35;

  for (let r = 0; r < scaleRows + 1; r++) {
    const y = r * (rowH * 0.85);
    const offsetX = (r % 2 === 0) ? 0 : scaleW * 0.5;

    for (let x = -scaleW; x < 512 + scaleW; x += scaleW) {
      const cx = x + offsetX;
      const cy = y;

      // Thân vảy rồng hình giọt ngọc / móng rồng uốn cong
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.bezierCurveTo(cx - scaleW * 0.52, cy + rowH * 0.45, cx - scaleW * 0.45, cy + rowH * 1.15, cx, cy + rowH * 1.25);
      ctx.bezierCurveTo(cx + scaleW * 0.45, cy + rowH * 1.15, cx + scaleW * 0.52, cy + rowH * 0.45, cx, cy);

      // Gradient chuyển sắc từ hắc ngọc sang huyết diễm hoàng kim
      const grad = ctx.createLinearGradient(cx, cy, cx, cy + rowH * 1.25);
      grad.addColorStop(0, '#1e162a');
      grad.addColorStop(0.5, '#781c1c');
      grad.addColorStop(0.85, '#a82c2c');
      grad.addColorStop(1, '#d63031');
      ctx.fillStyle = grad;
      ctx.fill();

      // Viền vảy rồng dát vàng rực lửa
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Sống lưng vảy rồng nổi gân phản quang
      ctx.strokeStyle = 'rgba(255, 234, 167, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + rowH * 0.2);
      ctx.lineTo(cx, cy + rowH * 1.1);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('dragonScales', texture);
  return texture;
}

/**
 * 14. Texture Cổ Phù Văn Thạch Anh & Nham Thạch (Rune Stone & Magma Fissures)
 * Dành cho Thái Cổ Thạch Yêu (Moss Golem)
 */
export function getCrackedRuneStoneTexture() {
  if (textureCache.has('runeStone')) return textureCache.get('runeStone');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Nền đá hoa cương xám cổ
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(0, 0, 512, 512);

  // Vân rạn đá tự nhiên
  ctx.fillStyle = '#374151';
  for (let i = 0; i < 400; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillRect(rx, ry, 2 + Math.random() * 6, 2 + Math.random() * 6);
  }

  // Mạch ma thạch & phù văn cổ ngàn năm phát sáng rực rỡ
  ctx.shadowColor = '#f39c12';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 3.5;

  const fissurePaths = [
    [[50, 40], [120, 110], [90, 190], [170, 260], [210, 380]],
    [[320, 30], [270, 130], [330, 220], [300, 340], [380, 460]],
    [[140, 240], [240, 250], [330, 220]],
    [[60, 420], [150, 380], [240, 440], [360, 410], [460, 460]],
    [[400, 90], [470, 180], [440, 290]]
  ];

  for (const path of fissurePaths) {
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let p = 1; p < path.length; p++) {
      ctx.lineTo(path[p][0], path[p][1]);
    }
    ctx.stroke();
  }

  // Lõi nham thạch rực sáng ở tâm vết nứt
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  for (const path of fissurePaths) {
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let p = 1; p < path.length; p++) {
      ctx.lineTo(path[p][0], path[p][1]);
    }
    ctx.stroke();
  }

  // Các cổ phù văn triện ngữ viền phát quang
  ctx.font = 'bold 24px "Noto Serif", "Songti SC", serif';
  ctx.fillStyle = '#ffbe76';
  ctx.shadowColor = '#e67e22';
  ctx.shadowBlur = 6;
  ctx.fillText('震', 140, 160);
  ctx.fillText('坤', 340, 170);
  ctx.fillText('艮', 210, 320);
  ctx.fillText('乾', 360, 360);
  ctx.fillText('泰', 110, 450);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('runeStone', texture);
  return texture;
}

/**
 * 15. Texture Bích Ngọc Thụy Vân Dát Vàng (Imperial Nephrite Jade & Cloud Inlay)
 * Dành cho Thanh Ngọc Thần Sư (Jade Guardian Lion)
 */
export function getCarvedJadeTexture() {
  if (textureCache.has('carvedJade')) return textureCache.get('carvedJade');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Nền ngọc bích Phỉ Thúy mượt mà
  const jadeGrad = ctx.createRadialGradient(256, 256, 20, 256, 256, 360);
  jadeGrad.addColorStop(0, '#26de81');
  jadeGrad.addColorStop(0.5, '#10ac84');
  jadeGrad.addColorStop(1, '#0e7054');
  ctx.fillStyle = jadeGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Vân mây thụy vân truyền thống dát kim ngân
  ctx.strokeStyle = '#f6e58d';
  ctx.lineWidth = 2.2;
  ctx.shadowColor = '#ffeaa7';
  ctx.shadowBlur = 4;

  const drawCloudSwirl = (cx, cy, r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.2, Math.PI * 1.8);
    ctx.arc(cx + r * 0.7, cy - r * 0.4, r * 0.65, Math.PI * 0.8, Math.PI * 2.1);
    ctx.arc(cx + r * 1.4, cy, r * 0.5, Math.PI * 0.9, Math.PI * 2.2);
    ctx.stroke();
  };

  for (let gy = 60; gy < 512; gy += 140) {
    for (let gx = 50; gx < 512; gx += 170) {
      drawCloudSwirl(gx + (gy % 280 === 0 ? 0 : 50), gy, 24);
    }
  }

  // Tinh thể ngọc mờ óng ánh
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  for (let i = 0; i < 200; i++) {
    const jx = Math.random() * 512;
    const jy = Math.random() * 512;
    ctx.beginPath();
    ctx.arc(jx, jy, 1 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('carvedJade', texture);
  return texture;
}

/**
 * 16. Texture Giáp Xác Xích Diễm Hạt Vương (Flame Scorpion Chitin & Molten Veins)
 */
export function getScorpionCarapaceTexture() {
  if (textureCache.has('scorpionCarapace')) return textureCache.get('scorpionCarapace');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Nền vỏ giáp chitin màu huyết dụ đen
  ctx.fillStyle = '#4a0e17';
  ctx.fillRect(0, 0, 512, 512);

  // Mảng giáp đốt sừng bóng
  ctx.fillStyle = '#800e13';
  for (let y = 0; y < 512; y += 64) {
    ctx.beginPath();
    ctx.roundRect(16, y + 8, 480, 52, [12]);
    ctx.fill();

    // Rãnh magma rực lửa giữa các đốt giáp
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#ffa502';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(30, y + 62);
    ctx.lineTo(482, y + 62);
    ctx.stroke();

    // Lõi nham thạch vàng rực
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fed330';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(35, y + 62);
    ctx.lineTo(477, y + 62);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('scorpionCarapace', texture);
  return texture;
}

/**
 * 17. Texture Gấm Cung Đình Cửu Vĩ Hồ & Pháp Y (Celestial Fox Silk & Kimono Brocade)
 */
export function getCelestialSilkTexture(theme = 'fox') {
  const cacheKey = `celestialSilk_${theme}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (theme === 'fox') {
    // Lụa tơ tằm trắng hồng thanh nhã
    const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.5, '#fff0f5');
    bgGrad.addColorStop(1, '#ffccd5');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Hoa văn cánh hoa đào & ngọn lửa hồ ly cách điệu
    ctx.fillStyle = '#ff758f';
    for (let y = 30; y < 512; y += 80) {
      for (let x = 30; x < 512; x += 80) {
        ctx.beginPath();
        ctx.ellipse(x, y, 12, 6, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 10, y + 10, 10, 5, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Viền kim tuyến vàng óng
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.8;
    for (let d = -512; d < 1024; d += 90) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + 512, 512);
      ctx.stroke();
    }
  } else {
    // Áo choàng U Minh Kiếm Linh: Vải dạ quang u ám đêm đen
    ctx.fillStyle = '#181628';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#2ed573';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#2ed573';
    ctx.shadowBlur = 7;

    for (let y = 40; y < 512; y += 95) {
      ctx.beginPath();
      ctx.arc(120, y, 18, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(360, y, 18, Math.PI * 0.5, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00d2d3';
    ctx.font = 'bold 22px serif';
    ctx.fillText('幽', 80, 200);
    ctx.fillText('冥', 240, 260);
    ctx.fillText('劍', 400, 200);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 18. Texture Vảy Khủng Long Hắc Diễm (Dino Scales & Tiger Stripes)
 * Dành cho Hắc Diễm Linh Thú (King Chomper)
 */
export function getDinoScalesTexture() {
  if (textureCache.has('dinoScales')) return textureCache.get('dinoScales');

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#6c5ce7';
  ctx.fillRect(0, 0, 512, 512);

  // Vảy bò sát dạng hạt sỏi đa giác
  ctx.fillStyle = '#574b90';
  for (let i = 0; i < 600; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    ctx.beginPath();
    ctx.arc(px, py, 2.5 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sọc vằn vương giả màu cam kim hổ
  ctx.fillStyle = '#f39c12';
  for (let y = 40; y < 512; y += 90) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(160, y + 25);
    ctx.lineTo(110, y + 45);
    ctx.lineTo(0, y + 35);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(512, y + 30);
    ctx.lineTo(350, y + 55);
    ctx.lineTo(390, y + 75);
    ctx.lineTo(512, y + 65);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  textureCache.set('dinoScales', texture);
  return texture;
}
