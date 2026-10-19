import { useId } from 'react'
export const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
export const ACT_COLOR = { ground: '#16a34a', ladder: '#8b5cf6', picker: '#ff8a1f' }
export const f0 = (v) => Math.round(v).toLocaleString('es-CL')
export const f1 = (v) => v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Botones excluyentes. `label` (o el Field que lo envuelve) nombra el grupo para lectores de pantalla. */
export function Seg({ value, options, onChange, size, label }) {
  return (
    <div className={`seg ${size || ''}`} role="group" aria-label={label}>
      {options.map(([k, l, dis, title]) => (
        <button key={String(k)} className={value === k ? 'on' : ''} aria-pressed={value === k} disabled={dis} title={title} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  )
}

/** Campo con título: el grupo queda nombrado por el título (role=group + aria-labelledby). */
export function Field({ label, children }) {
  const id = useId()
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <label id={id}>{label}</label>
      {children}
    </div>
  )
}

/** Pestañas accesibles (role=tablist/tab, aria-selected, flechas izquierda/derecha). */
export function Tabs({ value, options, onChange, label, className = 'tabs' }) {
  const keys = options.map(([k]) => k)
  const onKey = (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const k = keys[(keys.indexOf(value) + d + keys.length) % keys.length]
    onChange(k)
    e.currentTarget.querySelector(`[data-tab="${k}"]`)?.focus()
  }
  return (
    <div className={className} role="tablist" aria-label={label} onKeyDown={onKey}>
      {options.map(([k, l]) => (
        <button
          key={k}
          role="tab"
          data-tab={k}
          aria-selected={value === k}
          tabIndex={value === k ? 0 : -1}
          className={value === k ? 'on' : ''}
          onClick={() => onChange(k)}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

/** Aviso flotante: los errores se anuncian de inmediato (role=alert), con botón para cerrar. */
export function Toast({ kind = 'err', children, onClose }) {
  return (
    <div className={`toast ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button className="toast-x" aria-label="Cerrar aviso" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )
}
