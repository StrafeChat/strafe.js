import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/index.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
    typecheck: {
      enabled: false,
      tsconfig: './tsconfig.json',
    },
  },
});
