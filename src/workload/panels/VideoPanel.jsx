import { useRef, useState } from 'react'
import { recordVideo, pickCodec } from '../recorder.jsx'
import { NumField } from './SimPanel.jsx'
import { Field, Seg } from '../ui.jsx'

const RES = { 720: [1280, 720], 1080: [1920, 1080], 1440: [2560, 1440], 2160: [3840, 2160] }

/** Exportar la reproducción como video MP4 fluido (tiempo fijo por cuadro, independiente del equipo). */
export function VideoPanel({ tmax, title, fileStem, disabled }) {
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(null)
  const [speed, setSpeed] = useState(30)
  const [fps, setFps] = useState(60)
  const [res, setRes] = useState(1080)
  const [job, setJob] = useState(null) // { p, msg } mientras graba
  const ctrl = useRef(null)
  const end = Math.min(tmax, to == null ? tmax / 60 : to) // minutos
  const secs = Math.max(0, ((end - from) * 60) / speed)

  async function run() {
    const [w, h] = RES[res]
    const codec = await pickCodec(w, h)
    if (!codec) {
      setJob({ p: 0, msg: 'Este navegador no puede codificar video a esta resolución. Usa Chrome o Edge, o baja la resolución.', done: true })
      return
    }
    ctrl.current = new AbortController()
    setJob({ p: 0, msg: codec === 'avc' ? 'Grabando (H.264)…' : `Grabando (${codec.toUpperCase()}; este navegador no tiene H.264)…` })
    try {
      const blob = await recordVideo(
        {
          t0: from * 60,
          t1: end * 60,
          speed,
          fps,
          width: w,
          height: h,
          title,
          labels: { 'Solo humano': 'Solo humano', 'Humano-robot': 'Humano-robot' },
          order: ['Solo humano', 'Humano-robot'],
        },
        (p) => setJob((j) => j && { ...j, p }),
        ctrl.current.signal,
      )
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `${fileStem}_${Math.round(from)}-${Math.round(end)}min_x${speed}_${h}p${fps}.mp4`,
      })
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setJob(null)
    } catch (e) {
      setJob(e.name === 'AbortError' ? null : { p: 0, msg: String(e.message || e), done: true })
    }
  }

  return (
    <section className="panel">
      <h4>Video</h4>
      <div className="params">
        <label>
          <span>Desde (min)</span>
          <NumField value={from} step="1" min={0} onCommit={(v) => setFrom(Math.min(v, end))} />
        </label>
        <label>
          <span>Hasta (min)</span>
          <NumField value={Math.round(end * 100) / 100} step="1" min={0} onCommit={(v) => setTo(Math.max(from, Math.min(v, tmax / 60)))} />
        </label>
      </div>
      <Field label="Velocidad">
        <Seg size="mini" value={speed} onChange={setSpeed} options={[1, 5, 10, 30, 60, 120].map((s) => [s, `×${s}`])} />
      </Field>
      <Field label="Resolución">
        <Seg
          size="mini"
          value={res}
          onChange={setRes}
          options={[
            [720, '720p'],
            [1080, '1080p'],
            [1440, '1440p'],
            [2160, '4K'],
          ]}
        />
      </Field>
      <Field label="Cuadros por segundo">
        <Seg
          size="mini"
          value={fps}
          onChange={setFps}
          options={[
            [30, '30'],
            [60, '60'],
          ]}
        />
      </Field>
      <div className="note">
        Duración del video: {Math.floor(secs / 60)} min {Math.round(secs % 60)} s · {Math.round(secs * fps).toLocaleString('es-CL')} cuadros. Se graba lo que
        muestra la vista (Solo humano, Humano-robot o Comparar) con la cámara y las capas activas.
      </div>
      <button className="btn" style={{ marginTop: 6 }} onClick={run} disabled={disabled || !!job || secs <= 0}>
        Exportar video (MP4)
      </button>
      {job && (
        <div className="rec-modal" role="dialog" aria-modal="true" aria-label="Exportando video">
          <div className="panel">
            <h4>Exportar video</h4>
            <div className="note">{job.msg}</div>
            {!job.done && (
              <>
                <progress max="1" value={job.p} style={{ width: '100%' }} aria-label="Progreso de la grabación" />
                <div className="note">{Math.round(job.p * 100)} %</div>
                <button className="btn" onClick={() => ctrl.current?.abort()}>
                  Cancelar
                </button>
              </>
            )}
            {job.done && (
              <button className="btn" onClick={() => setJob(null)}>
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
