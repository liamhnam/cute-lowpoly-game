import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Đường dẫn tương đối giúp chạy hoàn hảo trên cả Vercel, GitHub Pages và mọi nền tảng
  server: {
    host: '0.0.0.0', // Mở kết nối cho các thiết bị khác trong cùng mạng LAN
    port: 5173,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
});
