import React from 'react'

/** Aísla errores de render: si una vista falla, muestra un aviso en vez de dejar la página en blanco. */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary] ${this.props.label || ''}`, error, info.componentStack)
  }
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="panel" role="alert" style={{ margin: 16, padding: 16 }}>
        <h4>No se pudo mostrar {this.props.label || 'esta vista'}</h4>
        <div className="note">{String(this.state.error.message || this.state.error)}</div>
        <button className="btn" style={{ marginTop: 8 }} onClick={() => this.setState({ error: null })}>
          Reintentar
        </button>
      </div>
    )
  }
}
