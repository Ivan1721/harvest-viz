export const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
export const ACT_COLOR = { ground: '#16a34a', ladder: '#8b5cf6', picker: '#ff8a1f' }
export const f0 = (v) => Math.round(v).toLocaleString('es-CL')
export const f1 = (v) => v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function Seg({ value, options, onChange, size }) {
  return (
    <div className={`seg ${size || ''}`}>
      {options.map(([k, l, dis]) => (
        <button key={String(k)} className={value === k ? 'on' : ''} disabled={dis} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}
