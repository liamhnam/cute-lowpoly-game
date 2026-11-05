# 🐻 Đồng Cỏ Thơ Mộng (Cozy Low-Poly 3rd-Person Game) 🌱✨

> Một tựa game góc nhìn thứ 3 (Third-Person) phong cách **Low-Poly dễ thương** được xây dựng hoàn toàn bằng **Three.js** và **Vite**, nơi bé gấu thám hiểm bảo vệ đồng cỏ xanh trước các quái vật khổng lồ!

![Three.js](https://img.shields.io/badge/Three.js-r187-black?style=for-the-badge&logo=three.js)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite)
![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=for-the-badge&logo=javascript)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🌟 Điểm nổi bật & Tính năng chính

### 1. 🐻 Nhân vật Bé Gấu Du Mục (Chibi Low-Poly)
- Thiết kế hình khối đa giác mềm mại, mắt to tròn lấp lánh phản chiếu ánh sáng, má hồng kawaii và mũ Beret quả bông.
- Đeo ba lô thám hiểm và được trang bị khẩu **Mega Blaster** năng lượng màu cam tươi.
- **Hệ thống Procedural Animation sinh động**:
  - **Đứng thở (Idle)**: Cơ thể nhún nhẹ nhàng, đôi tai lắc lư, đầu nghiêng ngó ngàng.
  - **Đi / Chạy (Walk & Sprint)**: Bước so le, tay vung nhịp nhàng, dáng đi lạch bạch (*waddle*) ngộ nghĩnh, chúi người về trước khi chạy nhanh.
  - **Bật nhảy & Tiếp đất (Jump & Land)**: Co chân vươn tay khi bay lên, đàn hồi nảy người (*squash & stretch*) khi đáp đất.
  - **Giật súng (Recoil)**: Cánh tay và nòng súng thụt lùi khi khai hỏa.
  - Hỗ trợ đổi **4 bảng màu trang phục** (Mint, Vàng mật ong, Hồng dâu, Tím lavender).

### 2. 🎥 Góc nhìn thứ 3 với Pointer Lock (Di chuột xoay Camera)
- **Tự do xoay 360°**: Chỉ cần di chuyển chuột là camera xoay quanh nhân vật mượt mà (không cần giữ chuột).
- **Phím ESC**: Dễ dàng nhả con trỏ chuột để thao tác giao diện UI và cài đặt.
- **Tâm ngắm (Crosshair)**: Vòng tròn năng lượng ở chính giữa màn hình giúp canh bắn cực chuẩn.
- Di chuyển nhân vật định hướng theo góc nhìn của Camera (bấm `W` luôn chạy về hướng camera đang ngắm).

### 3. 🌾 Đồng bằng rộng mở & Ngọn cỏ lay động theo gió
- Địa hình đồi uốn lượn tự nhiên với hiệu ứng đổ bóng đa giác (*flat shading*).
- **10.000 ngọn cỏ InstancedMesh** tối ưu 60 FPS mượt mà.
- **Vertex Shader gió**: Từng ngọn cỏ đung đưa nhấp nhô theo từng đợt sóng gió tự nhiên.
- Rừng cây tán tròn kẹo mút có quả táo đỏ chín mọng, cây thông 3 tầng, đá cuội và hàng rào gỗ mộc mạc.
- Đám mây trắng xốp trôi chầm chậm trên nền trời xanh pastel.

### 4. 🗿 Quái vật Khổng lồ Low-Poly
- **Người Đá Rêu Phong (*Moss Golem*)**: Cao hơn 6.5m, vai rộng phủ rêu xanh và hoa dại, mắt phát sáng cam bí ẩn, bước chân dậm đất lừng lững.
- **Khủng Long Béo Hoàng Gia (*King Chomper*)**: Thân hình tím múp míp, bụng vàng, đội vương miện nhỏ xíu, đuôi ngoe nguẩy ngộ nghĩnh.
- **Cơ chế chiến đấu**:
  - Thanh máu 3D Billboard hiển thị trên đầu quái vật, luôn xoay về camera.
  - Quái vật chớp đỏ (*hit flash*) và giật lùi khi bị bắn trúng.
  - Khi cạn máu, quái vật ngã quỵ và nổ tung thành làn khói sao lung linh cùng âm thanh chiến thắng.
  - Tự động hồi sinh ở vị trí ngẫu nhiên trên đồng cỏ sau 9 giây.

### 5. 🎵 Âm thanh Procedural & Hiệu ứng tương tác
- Tích hợp **Web Audio API**: Tiếng bước chân bộp bộp, tiếng nhảy boing, tiếng súng blaster "pew pew", tiếng nổ pop và nhạc nền lofi pentatonic thư giãn.
- Hạt bụi đất (*dust puffs*) tung lên dưới chân khi chạy, cánh hoa bồ công anh lơ lửng theo gió, pháo hoa ngôi sao văng khi trúng đạn.
- Chế độ **Chụp ảnh màn hình lưu niệm (*Photo Mode*)** và Toàn màn hình.

---

## 🎮 Hướng dẫn điều khiển

| Phím / Thao tác | Hành động |
| :--- | :--- |
| **Di chuyển chuột** | **Xoay Camera 360° tự do** (khi con trỏ đã khóa) |
| **Click Chuột Trái** hoặc **`F` / `J`** | **Bắn súng Blaster** về phía tâm ngắm |
| **Phím `ESC`** | **Hiện lại con trỏ chuột** để bấm nút UI |
| **Nhấp vào màn hình** | Ẩn con trỏ và tiếp tục điều khiển Camera |
| **`W` `A` `S` `D`** hoặc **Mũi tên** | Di chuyển bé gấu theo hướng camera |
| **`Shift`** | Chạy nước rút (Sprint) |
| **`Space`** hoặc **Nút NHẢY 🦘** | Nhảy cao |
| **Cuộn chuột (Wheel)** | Zoom gần / xa góc nhìn |
| **Phím `C`** | Đổi 4 bộ trang phục bé gấu |
| **Nút 🔊 / 🔇** | Bật / Tắt âm thanh |
| **Nút 📸** | Chụp và tải ảnh màn hình lưu niệm |

---

## 🚀 Cài đặt & Chạy trên máy cục bộ

### Yêu cầu
- Đã cài đặt [Node.js](https://nodejs.org/) (khuyên dùng Node 18 trở lên).

### Các bước cài đặt:

```bash
# 1. Clone repository về máy
git clone https://github.com/liamhnam/cute-lowpoly-game.git
cd cute-lowpoly-game

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Khởi chạy máy chủ phát triển (Development Server)
npm run dev
```

Mở trình duyệt và truy cập vào đường dẫn hiển thị trên terminal (thường là `http://localhost:5173/` hoặc `http://localhost:5174/`).

### Đóng gói sản phẩm (Build for Production):

```bash
npm run build
npm run preview
```

---

## 📁 Cấu trúc thư mục dự án

```text
cute-lowpoly-game/
├── index.html            # Giao diện HUD chính, Crosshair & CSS Cozy UI
├── standalone.html       # Bản chạy độc lập import Three.js từ CDN
├── package.json          # Cấu hình dự án & dependencies (Three.js, Vite)
├── .gitignore            # Danh sách file loại trừ khỏi git
└── src/
    ├── main.js           # Khởi tạo Scene, Renderer, Ánh sáng, Game loop
    ├── world.js          # Địa hình, 10.000 ngọn cỏ shader gió, cây cối, hoa, mây
    ├── character.js      # Mô hình bé gấu low-poly, súng blaster, procedural animation
    ├── controller.js     # Third-person camera orbit, Pointer Lock API, phím di chuyển
    ├── monsters.js       # Quái vật khổng lồ (Moss Golem, King Chomper), AI, thanh máu 3D
    ├── projectiles.js    # Đạn năng lượng, kiểm tra va chạm, sát thương
    ├── particles.js      # Bụi chân, cánh hoa bay, hạt sao nổ lấp lánh
    └── audio.js          # Hệ thống âm thanh tổng hợp từ Web Audio API
```

---

## 📜 Giấy phép

Phát hành dưới giấy phép [MIT License](LICENSE).
Tự do sử dụng, chỉnh sửa và phát triển tiếp! 🎉
