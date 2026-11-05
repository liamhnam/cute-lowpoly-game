# 🐻 Đồng Cỏ Thơ Mộng (Cozy Low-Poly 3rd-Person Game) 🌱⚡

> Một tựa game góc nhìn thứ 3 (Third-Person) phong cách **Low-Poly dễ thương** kết hợp hiệu ứng **Pixel Art Procedural VFX** lấy cảm hứng từ [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx), nơi bé gấu thám hiểm sử dụng súng Blaster và các siêu kỹ năng nguyên tố tàn phá quái vật & địa hình!

![Three.js](https://img.shields.io/badge/Three.js-r187-black?style=for-the-badge&logo=three.js)
![PixelFX](https://img.shields.io/badge/PixelFX-Procedural_VFX-ff4757?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite)
![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=for-the-badge&logo=javascript)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🌟 Điểm nổi bật & Tính năng chính

### 1. ⚡ Bộ Kỹ Năng Nguyên Tố PixelFX (Phím số [1], [2], [3], [4])
Lấy cảm hứng từ thư viện mã nguồn mở **PixelFX** ([patch-gg/pixelfx](https://github.com/patch-gg/pixelfx)), các hiệu ứng kỹ năng được render procedural bằng thuật toán pixel art kết hợp canvas nearest-neighbor với đồ họa 3D Low-Poly:

- **[1] ☄️ Thiên Thạch Hỏa Ngục (*Meteor Strike*)**:
  - Quả cầu thiên thạch rực lửa lao từ trên trời xuống, tạo vụ nổ pixel fireball nhiều nấc cực đại.
  - **Sát thương**: 110 AOE.
  - **Tàn phá địa hình**: Tạo hố va chạm lõm sâu 1.8m, biến đổi màu đất thành than đen và viền dung nham đỏ rực.
- **[2] ⚡ Sấm Sét Giáng Trần (*Thunder Strike*)**:
  - Cột sét sáng chói đánh thẳng từ mây xuống đất, tỏa các tia hồ quang pixel xanh tím lan tỏa.
  - **Sát thương**: 140 AOE.
  - **Tàn phá địa hình**: Nứt nẻ địa hình sâu 1.1m, cháy xém sấm sét.
- **[3] ❄️ Bão Băng Địa Cực (*Frost Nova*)**:
  - Sóng hoa tuyết dithered pixel nở bung trên mặt đất, nhô lên các tinh thể trụ băng nhọn hoắt low-poly.
  - **Sát thương**: 80 AOE, đóng băng và làm chậm bước quái vật.
  - **Tàn phá địa hình**: Đóng băng mặt đất thành tuyết trắng vĩnh cửu.
- **[4] 🌍 Địa Chấn Long Trời (*Earth Stomp*)**:
  - Cú dậm chấn động tạo các vòng sóng địa chấn xé toác mặt đất, hất tung các tảng đá vụn bay lơ lửng.
  - **Sát thương**: 170 AOE cực đại.
  - **Tàn phá địa hình**: Lõm sâu sụt lún địa hình 2.2m.

### 2. 💥 Tàn Phá & Biến Dạng Địa Hình Thật (Dynamic Terrain Deformation)
- Mỗi kỹ năng nguyên tố khi giáng xuống sẽ **biến dạng trực tiếp lưới đa giác của mặt đất** (*Vertex Position & Vertex Colors*).
- Mặt đất lõm thành các hố sâu (*craters*), đất đá cháy xém / đóng băng / nứt nẻ.
- Tọa độ địa hình được cập nhật động: khi nhân vật hoặc quái vật di chuyển vào hố thiên thạch hay hố địa chấn, họ sẽ **bị rơi tụt xuống lòng hố chân thực**!
- Cỏ trong bán kính va chạm bị sóng xung kích thổi bay hoàn toàn.

### 3. 🔢 Số Sát Thương Nhảy Lên (Retro Pixel Floating Damage)
- Hiển thị số sát thương nhảy lên kiểu Retro Arcade khi quái vật trúng chiêu (`-110 🔥 CRIT!`, `-140 ⚡ SHOCK!`, `-80 ❄️ FROZEN!`, `-170 💥 SMASH!`).

### 4. 🐻 Bé Gấu Du Mục & Súng Blaster Chibi
- Mô hình bé gấu low-poly đáng yêu, đầu tròn mắt long lanh má hồng kawaii, mũ beret và ba lô thám hiểm.
- Súng **Mega Blaster** màu cam rực rỡ bắn đạn năng lượng băng giá với hiệu ứng giật nòng (*recoil*).
- Procedural Animation: Nhún thở, bước đi lạch bạch (*waddle*), chạy nước rút, bật nhảy co chân, đàn hồi (*squash & stretch*).
- 4 bảng màu trang phục thay đổi linh hoạt bằng phím `C`.

### 5. 🎥 Góc nhìn thứ 3 với Pointer Lock
- **Di chuột tự do**: Camera xoay mượt 360° theo hướng nhìn.
- **Phím `ESC`**: Nhả con trỏ chuột tức thì để thao tác giao diện hoặc cài đặt.
- **Tâm ngắm (*Crosshair*)**: Hỗ trợ định hướng ngắm bắn chuẩn xác.

### 6. 🗿 Quái vật Khổng lồ & AI Tự Động
- **Người Đá Rêu Phong (*Moss Golem*)**: Cao hơn 6.5m, vai phủ rêu và hoa dại, mắt sáng cam.
- **Khủng Long Béo Ngai Vàng (*King Chomper*)**: Thân tím múp míp, đội vương miện nhỏ xíu, đuôi ngoe nguẩy.
- Thanh máu 3D Billboard luôn hướng về camera; quái tự động hồi sinh sau 9s khi bị hạ.

---

## 🎮 Bảng điều khiển chi tiết

| Thao tác | Phím tắt | Tác dụng |
| :--- | :---: | :--- |
| **KỸ NĂNG PIXELFX** | **`1` `2` `3` `4`** | Kích hoạt Thiên Thạch, Sấm Sét, Bão Băng, Địa Chấn |
| **BẮN SÚNG** | **Click Chuột Trái** hoặc **`F` / `J`** | Bắn đạn Blaster năng lượng |
| **XOAY CAMERA** | **Di chuyển chuột** | Xoay 360° tự do quanh nhân vật |
| **HIỆN CON TRỎ CHUỘT** | **`ESC`** | Nhả chuột để bấm các nút trên giao diện |
| **KHÓA CHUỘT LẠI** | **Nhấp chuột vào màn hình** | Tiếp tục di chuột xoay camera |
| **Di chuyển** | **`W` `A` `S` `D`** | Chạy khắp đồng cỏ |
| **Nhảy cao** | **`Space`** hoặc **Nút NHẢY 🦘** | Bật nhảy né đòn |
| **Chạy nhanh** | **`Shift`** | Chạy nước rút (Sprint) |
| **Đổi Trang Phục** | **`C`** | Đổi 4 màu áo & mũ |
| **Zoom Camera** | **Cuộn chuột (Wheel)** | Thu phóng gần / xa |

---

## 🚀 Cài đặt & Khởi chạy

```bash
# 1. Clone repository
git clone https://github.com/liamhnam/cute-lowpoly-game.git
cd cute-lowpoly-game

# 2. Cài đặt dependencies
npm install

# 3. Chạy môi trường phát triển
npm run dev
```

Mở trình duyệt truy cập: `http://localhost:5173/` hoặc `http://localhost:5174/`.

---

## 📜 Giấy phép

Phát hành theo giấy phép [MIT License](LICENSE).
Ý tưởng hiệu ứng Pixel Art lấy cảm hứng từ [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx) (MIT).
