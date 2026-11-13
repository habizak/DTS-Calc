import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const nvmrcPath = fileURLToPath(new URL('./.nvmrc', import.meta.url))

export default defineConfig({
  define: { __STARTER_NVMRC_PATH__: JSON.stringify(nvmrcPath) },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.node-version.setup.ts', './vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'e2e/**'],
  },
})
