import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'test/*.test.ts',
      'test/api/**/*.test.ts',
      'test/server/**/*.test.ts',
      'src/**/*.test.{ts,tsx}',
    ],
  },
});
