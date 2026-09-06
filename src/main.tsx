import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'

class StartupErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('WORREMEMBER startup error', error, info)
  }

  render() {
    if (this.state.error) return <main style={{ padding: 32, fontFamily: 'sans-serif', color: '#292a28' }}><h1>应用启动失败</h1><p>{this.state.error.message}</p></main>
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><StartupErrorBoundary><App /></StartupErrorBoundary></StrictMode>,
)
