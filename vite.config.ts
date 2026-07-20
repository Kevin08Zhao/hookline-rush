import { defineConfig } from 'vite';

export default defineConfig({
  base: '/hookline-rush/',
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
