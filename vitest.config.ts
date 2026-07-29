import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    coverage: {
      include: ['src/main/**/*.ts', 'src/main/**/*.tsx'],
    },
  },
});
