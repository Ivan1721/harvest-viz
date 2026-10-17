// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// el grabador real necesita WebGL y WebCodecs: aquí se reemplaza por uno falso
const rec = vi.hoisted(() => ({ codecs: ['avc'], record: null }))
vi.mock('../../src/workload/recorder.jsx', () => ({
  codecCandidates: async () => rec.codecs,
  bitrateFor: (w, h, fps) => w * h * fps * 0.1,
  recordVideo: (...a) => rec.record(...a),
}))
const { VideoPanel, VIDEO_LIMITS } = await import('../../src/workload/panels/VideoPanel.jsx')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  rec.codecs = ['avc']
})

const btn = () => screen.getByTestId('video-export')

describe('VideoPanel', () => {
  it('calcula duración y cuadros desde el rango, la velocidad y los fps', () => {
    render(<VideoPanel tmax={2700} title="t" fileStem="run" />)
    // 45 min a ×30 = 90 s; a 60 fps = 5400 cuadros
    expect(screen.getByText(/1 min 30 s · 5\.400 cuadros/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '30', exact: true }))
    expect(screen.getByText(/2\.700 cuadros/)).toBeTruthy()
    expect(btn().disabled).toBe(false)
  })

  it('bloquea videos que no caben en memoria y lo explica', () => {
    render(<VideoPanel tmax={2700} title="t" fileStem="run" />)
    fireEvent.click(screen.getByRole('button', { name: '×1' })) // 45 min × 60 fps = 162 000 cuadros
    expect(162000).toBeGreaterThan(VIDEO_LIMITS.maxFrames)
    expect(screen.getByText(/Video demasiado largo/)).toBeTruthy()
    expect(btn().disabled).toBe(true)
  })

  it('respeta disabled y un rango vacío', () => {
    const { rerender } = render(<VideoPanel tmax={2700} title="t" fileStem="run" disabled />)
    expect(btn().disabled).toBe(true)
    rerender(<VideoPanel tmax={0} title="t" fileStem="run" />)
    expect(btn().disabled).toBe(true)
  })

  it('avisa si el navegador no puede codificar', async () => {
    rec.codecs = []
    render(<VideoPanel tmax={600} title="t" fileStem="run" />)
    fireEvent.click(btn())
    await waitFor(() => expect(screen.getByText(/no puede codificar video/)).toBeTruthy())
  })

  it('si un códec falla prueba el siguiente y descarga el MP4 con nombre descriptivo', async () => {
    rec.codecs = ['avc', 'vp9']
    const tried = []
    rec.record = async (opts, onProgress) => {
      tried.push(opts.codec)
      if (opts.codec === 'avc') throw new Error('config no soportada')
      onProgress(1)
      return new Blob(['mp4'])
    }
    const clicks = []
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    const orig = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this.download)
    }
    try {
      render(<VideoPanel tmax={600} title="t" fileStem="HUMAN_ROBOT_12" />)
      fireEvent.click(btn())
      await waitFor(() => expect(clicks.length).toBe(1))
      expect(tried).toEqual(['avc', 'vp9'])
      expect(clicks[0]).toBe('HUMAN_ROBOT_12_0-600s_x30_1080p60.mp4')
    } finally {
      HTMLAnchorElement.prototype.click = orig
    }
  })

  it('muestra el error si todos los códecs fallan', async () => {
    rec.record = async () => {
      throw new Error('falló el codificador')
    }
    render(<VideoPanel tmax={600} title="t" fileStem="run" />)
    fireEvent.click(btn())
    await waitFor(() => expect(screen.getByText(/falló el codificador/)).toBeTruthy())
  })
})
