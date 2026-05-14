import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@arco-design/web-react/dist/css/arco.css'
import './styles/globals.css'

// Suppress non-fatal Electron/Chromium internal errors (e.g. dragEvent from drag handling)
window.addEventListener('error', (e) => {
  if (e.message?.includes('dragEvent') || e.error?.message?.includes('dragEvent')) {
    e.preventDefault()
    console.warn('[Renderer] Suppressed non-fatal dragEvent error')
    return false
  }
})

window.addEventListener('unhandledrejection', (e) => {
  const msg =
    typeof e.reason === 'string'
      ? e.reason
      : e.reason instanceof Error
        ? e.reason.message
        : ''
  if (msg.includes('dragEvent')) {
    e.preventDefault()
    console.warn('[Renderer] Suppressed dragEvent rejection')
  }
})

console.log('[Renderer] main.tsx loading...')

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      console.error('[Renderer] ErrorBoundary caught:', this.state.error)
      return (
        <div style={{ padding: 20, color: '#EF4444', background: '#0F1117', minHeight: '100vh' }}>
          <h2>Renderer Error</h2>
          <pre style={{ color: '#F87171', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.stack || String(this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

console.log('[Renderer] Rendering App...')
const root = document.getElementById('root')
if (!root) {
  console.error('[Renderer] #root element not found!')
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
  console.log('[Renderer] App rendered successfully')
}
