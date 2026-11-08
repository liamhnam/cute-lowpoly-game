/**
 * "Game feel" — cảm giác đòn đánh đã tay (theo 5 bước: Chớp trắng → Âm thanh → Hạt → Đẩy lùi → Rung + Đóng băng).
 *
 * Hitstop: đóng băng (gần như dừng) thời gian game trong vài khung hình đúng lúc đòn trúng,
 * để não người chơi "cảm" được lực va chạm. main.js đọc qua consumeHitStop() mỗi khung hình.
 */
let hitStopTimer = 0;
let shakeHook = null;

// Đóng băng thời gian game `seconds` giây (không cộng dồn, lấy mức lớn nhất)
export function hitStop(seconds) {
  hitStopTimer = Math.max(hitStopTimer, Math.min(seconds, 0.3));
}

// Trả về hệ số nhân thời gian cho khung hình này (gần 0 khi đang hitstop)
export function consumeHitStop(realDelta) {
  if (hitStopTimer > 0) {
    hitStopTimer -= realDelta;
    return 0.04;
  }
  return 1;
}

// Rung màn hình khi trúng đòn (gắn với controller.addTrauma trong main.js)
export function setShakeHook(fn) {
  shakeHook = fn;
}

export function impactShake(amount) {
  if (shakeHook) shakeHook(amount);
}
