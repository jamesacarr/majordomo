import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'commitlint.config.ts',
        'lint-staged.config.ts',
        'vitest.config.ts',
      ],
      provider: 'v8',
    },
    environment: 'node',
    globals: false,
    passWithNoTests: true,
  },
});
