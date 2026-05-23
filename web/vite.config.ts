/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';

  return {
    plugins: [react(), tailwindcss()],
    base: '/',
    server: {
      proxy: {
        '/health': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'node',
    },
  };
});
