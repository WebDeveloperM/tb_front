import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: '0.0.0.0', // Tashqi kirish uchun ochish
    proxy: {
      '/api': {
        target: 'https://192.168.2.72:8005',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'https://192.168.2.72:8005',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
