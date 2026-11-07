import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/feed.xml': 'http://localhost:3001',
      '/sitemap.xml': 'http://localhost:3001'
    }
  }
});