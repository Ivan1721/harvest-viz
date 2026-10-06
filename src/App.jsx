import React, { useState } from 'react'
import OcclusionApp from './OcclusionApp'
import WorkloadApp from './workload/WorkloadApp'

function ModeSwitch({ mode, setMode }) {
  return (
    <div className="seg modes">
      <button className={mode === 'workload' ? 'on' : ''} onClick={() => setMode('workload')}>Workload</button>
      <button className={mode === 'occlusion' ? 'on' : ''} onClick={() => setMode('occlusion')}>Oclusión</button>
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('hv-mode') || 'workload' } catch { return 'workload' } })
  const change = (m) => { setMode(m); try { localStorage.setItem('hv-mode', m) } catch {} }
  const sw = <ModeSwitch mode={mode} setMode={change} />
  return mode === 'workload' ? <WorkloadApp modeSwitch={sw} /> : <OcclusionApp modeSwitch={sw} />
}
