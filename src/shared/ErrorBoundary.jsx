import React from 'react'
import { t } from '../i18n/index.js'

/** Aísla errores de render: si una vista falla, muestra un aviso en vez de dejar la página en blanco. */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, resetKey: props.resetKey }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  // un cambio de resetKey (otra corrida, otro modo) limpia el error
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }
  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary] ${this.props.label || ''}`, error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="panel" role="alert" style={{ margin: 16, padding: 16 }}>
        <h4>{t('No se pudo mostrar {label}', { label: this.props.label || t('esta vista') })}</h4>
        <div className="note">{String(this.state.error.message || this.state.error)}</div>
        <button className="btn" style={{ marginTop: 8 }} onClick={() => this.setState({ error: null })}>
          {t('Reintentar')}
        </button>
      </div>
    )
  }
}
