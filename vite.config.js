import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Đường dẫn tương đối giúp chạy hoàn hảo trên cả Vercel, GitHub Pages và mọi nền tảng
  server: {
    host: '0.0.0.0', // Mở kết nối cho các thiết bị khác trong cùng mạng LAN
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // Hạ cú pháp JS (vd. khối static {} của three.js chỉ có từ iOS 16.4) để chạy được trên Safari/iOS cũ
    target: ['es2020', 'safari14', 'ios14', 'chrome87', 'firefox78', 'edge88'],
    chunkSizeWarningLimit: 1200,
  },
});
