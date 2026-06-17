import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/renderer/src/**'],
      exclude: ['src/renderer/src/main.tsx'],
    },
  },
  resolve: {
    alias: {
      // stub Electron APIs that aren't available in jsdom
      electron: '/src/test/__mocks__/electron.ts',
    },
  },
})
