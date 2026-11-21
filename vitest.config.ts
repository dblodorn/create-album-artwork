import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // Next provides `server-only` at build time; under test it's a no-op.
      'server-only': fileURLToPath(new URL('./test/serverOnly.ts', import.meta.url)),
    },
  },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'e2e/**'],
    setupFiles: ['./test/canvasStub.ts'],
  },
})
