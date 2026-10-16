import { Suspense, lazy, useState } from 'react'
import { ErrorBoundary } from './shared/ErrorBoundary.jsx'

// cada modo se descarga solo cuando se abre (code splitting)
const OcclusionApp = lazy(() => import('./OcclusionApp.jsx'))
const WorkloadApp = lazy(() => import('./workload/WorkloadApp.jsx'))

function ModeSwitch({ mode, setMode }) {
  return (
    <div className="seg modes">
      <button className={mode === 'workload' ? 'on' : ''} onClick={() => setMode('workload')}>
        Workload
      </button>
      <button className={mode === 'occlusion' ? 'on' : ''} onClick={() => setMode('occlusion')}>
        Oclusión
      </button>
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('hv-mode') || 'workload'
    } catch {
      return 'workload'
    }
  })
  const change = (m) => {
    setMode(m)
    try {
      localStorage.setItem('hv-mode', m)
    } catch {
      /* sin almacenamiento: se usa el modo por defecto */
    }
  }
  const sw = <ModeSwitch mode={mode} setMode={change} />
  return (
    <ErrorBoundary label="la aplicación" resetKey={mode}>
      <Suspense fallback={<div className="loading-mode">Cargando…</div>}>
        {mode === 'workload' ? <WorkloadApp modeSwitch={sw} /> : <OcclusionApp modeSwitch={sw} />}
      </Suspense>
    </ErrorBoundary>
  )
}
