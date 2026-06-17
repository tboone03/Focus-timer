import 'react'

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

declare global {
  interface Window {
    electronAPI: {
      platform: string
      minimize: () => void
      close: () => void
    }
  }
}
