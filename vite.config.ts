import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the build works at https://<user>.github.io/LOOKUP/ (any casing)
// and from the Home Screen. No router, so no server rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { sourcemap: false, chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
