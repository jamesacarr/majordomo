import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['**/*.test.ts'],
      // Logic lives in lib/; the binding files elsewhere are covered by evals.
      include: ['agent/lib/**/*.ts'],
      provider: 'v8',
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
    environment: 'node',
    globals: false,
    passWithNoTests: true,
  },
});
