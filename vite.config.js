import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Đường dẫn tương đối giúp chạy hoàn hảo trên cả Vercel, GitHub Pages và mọi nền tảng
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
});
