import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.js', 'src/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': '/mnt/d/软件项目/Videos/course-distribute/frontend/src',
    },
  },
});
