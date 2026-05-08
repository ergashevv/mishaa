import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.integration.test.ts'],
    testTimeout: 45_000,
    hookTimeout: 15_000,
    retry: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
