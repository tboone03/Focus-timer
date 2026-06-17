import '@testing-library/jest-dom'

// Stub window.electronAPI for tests
Object.defineProperty(window, 'electronAPI', {
  value: {
    platform: 'win32',
    minimize: vi.fn(),
    close: vi.fn(),
  },
  writable: true,
})
