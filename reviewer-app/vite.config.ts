import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const WEB_PORT = Number(process.env.WEB_PORT) || 0; // 0 = auto-pick free port
const API_PORT = Number(process.env.API_PORT) || 3334;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: WEB_PORT || undefined,
    strictPort: WEB_PORT > 0,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
