import { fmtNum, t, useLang } from '../i18n/index.js'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
export const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
export const ACT_COLOR = { ground: '#16a34a', ladder: '#8b5cf6', picker: '#ff8a1f' }
export const f0 = (v) => fmtNum(Math.round(v))
export const f1 = (v) => fmtNum(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// La ayuda abierta: solo una a la vez en toda la página
let cerrarAbierta = null

/**
 * Ayuda accesible en lugar de `title`: se abre al pasar el ratón (con una pausa), al recibir el foco (teclado o toque)
 * y se cierra con Esc o al salir; al desplazar se recoloca. La burbuja va en posición fija para que no la corten las columnas con
 * scroll, y queda enlazada con `aria-describedby` al primer control de dentro (o al envoltorio, que entonces es enfocable).
 */
export function Ayuda({ texto, as: Tag = 'span', className = '', children, ...rest }) {
  const id = useId()
  const ref = useRef(null)
  const burbuja = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const timer = useRef(0)
  const [propio, setPropio] = useState(false)
  const cerrar = () => {
    clearTimeout(timer.current)
    setOpen(false)
  }
  const abrir = () => {
    clearTimeout(timer.current)
    if (cerrarAbierta && cerrarAbierta !== cerrar) cerrarAbierta()
    cerrarAbierta = cerrar
    setOpen(true)
  }
  useEffect(() => {
    const c = ref.current?.querySelector('input, button, select, textarea, a[href]')
    if (!c) return setPropio(true)
    const prev = c.getAttribute('aria-describedby')
    c.setAttribute('aria-describedby', prev ? `${prev} ${id}` : id)
    return () => (prev ? c.setAttribute('aria-describedby', prev) : c.removeAttribute('aria-describedby'))
  }, [id])
  useEffect(() => () => clearTimeout(timer.current), [])
  // A la derecha del ancla si cabe (no tapa los campos siguientes de la columna); si no, debajo, o arriba si tampoco
  const colocar = () => {
    if (!ref.current || !burbuja.current) return
    const a = ref.current.getBoundingClientRect()
    const b = burbuja.current.getBoundingClientRect()
    const W = window.innerWidth,
      H = window.innerHeight
    if (a.right + 8 + b.width <= W - 8) return setPos({ left: a.right + 8, top: Math.max(8, Math.min(a.top, H - b.height - 8)) })
    const left = Math.max(8, Math.min(a.left, W - b.width - 8))
    const top = a.bottom + 6 + b.height > H - 8 ? Math.max(8, a.top - 6 - b.height) : a.bottom + 6
    setPos({ left, top })
  }
  useLayoutEffect(() => (open ? colocar() : setPos(null)), [open, texto])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && cerrar()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', colocar, true)
    window.addEventListener('resize', colocar)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', colocar, true)
      window.removeEventListener('resize', colocar)
      if (cerrarAbierta === cerrar) cerrarAbierta = null
    }
  }, [open])
  if (!texto)
    return (
      <Tag className={className || undefined} {...rest}>
        {children}
      </Tag>
    )
  return (
    <Tag
      ref={ref}
      className={`ayuda ${className}`.trim()}
      tabIndex={propio ? 0 : undefined}
      aria-describedby={propio ? id : undefined}
      onMouseEnter={() => {
        clearTimeout(timer.current)
        timer.current = setTimeout(abrir, 350)
      }}
      onMouseLeave={cerrar}
      onFocus={abrir}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && cerrar()}
      {...rest}
    >
      {children}
      <span
        ref={burbuja}
        id={id}
        role="tooltip"
        className="ayuda-burbuja"
        hidden={!open}
        style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      >
        {texto}
      </span>
    </Tag>
  )
}

/**
 * Botones excluyentes. `label` (o el Field que lo envuelve) nombra el grupo para lectores de pantalla.
 * Cada opción es [clave, etiqueta, deshabilitada, ayuda]: la ayuda de una opción deshabilitada es su motivo y se
 * escribe visible bajo el control; la de una habilitada va en una <Ayuda>. Las deshabilitadas siguen enfocables.
 */
export function Seg({ value, options, onChange, size, label }) {
  const id = useId()
  // Motivo visible por grupo de opciones deshabilitadas: «Otro robot, Otra cantidad de robots: solo en …»
  const porMotivo = new Map()
  for (const [, l, dis, ayuda] of options) if (dis && ayuda) porMotivo.set(ayuda, [...(porMotivo.get(ayuda) || []), l])
  const motivos = [...porMotivo].map(([m, ls]) => `${ls.join(', ')}: ${m.charAt(0).toLowerCase()}${m.slice(1)}.`)
  return (
    <>
      <div className={`seg ${size || ''}`} role="group" aria-label={label}>
        {options.map(([k, l, dis, ayuda]) => {
          const boton = (
            <button
              key={String(k)}
              className={value === k ? 'on' : ''}
              aria-pressed={value === k}
              aria-disabled={dis || undefined}
              aria-describedby={dis && ayuda ? id : undefined}
              onClick={() => !dis && onChange(k)}
            >
              {l}
            </button>
          )
          return !dis && ayuda ? (
            <Ayuda key={String(k)} texto={ayuda} className="seg-ayuda">
              {boton}
            </Ayuda>
          ) : (
            boton
          )
        })}
      </div>
      {motivos.length > 0 && (
        <div className="note seg-motivo" id={id}>
          {motivos.join(' ')}
        </div>
      )}
    </>
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
  const ref = useRef(null)
  const [borde, setBorde] = useState('')
  // Si no caben, la fila se desplaza: degradado mientras quede algo a la derecha y la activa siempre a la vista
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const desborda = el.scrollWidth > el.clientWidth + 1
      setBorde(desborda ? (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 ? ' desborda al-final' : ' desborda') : '')
    }
    medir()
    el.addEventListener('scroll', medir)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', medir)
      ro?.disconnect()
    }
  }, [])
  useEffect(() => {
    ref.current?.querySelector(`[data-tab="${value}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [value])
  const onKey = (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const k = keys[(keys.indexOf(value) + d + keys.length) % keys.length]
    onChange(k)
    e.currentTarget.querySelector(`[data-tab="${k}"]`)?.focus()
  }
  return (
    <div ref={ref} className={className + borde} role="tablist" aria-label={label} onKeyDown={onKey}>
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
  useLang()
  return (
    <div className={`toast ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button className="toast-x" aria-label={t('Cerrar aviso')} onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )
}
