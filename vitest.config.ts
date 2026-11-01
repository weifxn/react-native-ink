import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@weifxn/react-native-ink': src,
      'react-native': src,
    },
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 15_000,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'html'],
      thresholds: {
        'src/style/**': { lines: 95, functions: 95, branches: 85, statements: 95 },
        lines: 85,
      },
    },
  },
});
