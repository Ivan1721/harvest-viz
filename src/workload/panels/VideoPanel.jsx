import { useEffect, useRef, useState } from 'react'
import { recordVideo, codecCandidates, bitrateFor } from '../recorder.jsx'
import { NumField } from './SimPanel.jsx'
import { Field, Seg } from '../ui.jsx'
import { fmtNum, t, useLang } from '../../i18n/index.js'

// el MP4 se arma en memoria: estos topes evitan que la pestaña se quede sin RAM
export const VIDEO_LIMITS = { maxFrames: 20000, maxMB: 1500 }

const RES = { 720: [1280, 720], 1080: [1920, 1080], 1440: [2560, 1440], 2160: [3840, 2160] }

/** Exportar la reproducción como video MP4 fluido (tiempo fijo por cuadro, independiente del equipo). */
export function VideoPanel({ tmax, title, fileStem, disabled }) {
  useLang()
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(null)
  const [speed, setSpeed] = useState(30)
  const [fps, setFps] = useState(60)
  const [res, setRes] = useState(1080)
  const [job, setJob] = useState(null) // { p, msg } mientras graba
  const ctrl = useRef(null),
    modal = useRef(null),
    opener = useRef(null)
  const open = !!job
  // diálogo: foco al botón (Cancelar/Cerrar) al abrir, Escape lo cancela o cierra, y el foco vuelve al botón que lo abrió
  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement
    modal.current?.querySelector('button')?.focus()
    return () => opener.current?.focus?.()
  }, [open])
  const end = Math.min(tmax / 60, to == null ? tmax / 60 : to) // minutos
  const secs = Math.max(0, ((end - from) * 60) / speed)
  const frames = Math.round(secs * fps)
  const [rw, rh] = RES[res]
  const mb = (bitrateFor(rw, rh, fps) * secs) / 8 / 1e6
  const tooBig = frames > VIDEO_LIMITS.maxFrames || mb > VIDEO_LIMITS.maxMB

  async function run() {
    const [w, h] = RES[res]
    const codecs = await codecCandidates(w, h, fps)
    if (!codecs.length) {
      setJob({ p: 0, msg: t('Este navegador no puede codificar video a esta resolución. Usa Chrome o Edge, o baja la resolución.'), done: true })
      return
    }
    ctrl.current = new AbortController()
    try {
      let blob = null,
        lastErr = null
      // si el navegador anuncia un códec pero rechaza la configuración, se prueba el siguiente
      for (const codec of codecs) {
        setJob({
          p: 0,
          msg: codec === 'avc' ? t('Grabando (H.264)…') : t('Grabando ({codec}; este navegador no codifica H.264)…', { codec: codec.toUpperCase() }),
        })
        try {
          blob = await recordVideo(
            {
              t0: from * 60,
              t1: end * 60,
              speed,
              fps,
              width: w,
              height: h,
              title,
              labels: { 'Solo humano': t('Solo humano'), 'Humano-robot': t('Humano-robot') },
              order: ['Solo humano', 'Humano-robot'],
              codec,
            },
            (p) => setJob((j) => j && { ...j, p }),
            ctrl.current.signal,
          )
          break
        } catch (e) {
          if (e.name === 'AbortError') throw e
          lastErr = e
        }
      }
      if (!blob) throw lastErr
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `${fileStem}_${Math.round(from * 60)}-${Math.round(end * 60)}s_x${speed}_${h}p${fps}.mp4`,
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
      <h4>{t('Video')}</h4>
      <div className="params">
        <label>
          <span>{t('Desde (min)')}</span>
          <NumField value={from} step="1" min={0} onCommit={(v) => setFrom(Math.min(v, end))} />
        </label>
        <label>
          <span>{t('Hasta (min)')}</span>
          <NumField value={Math.round(end * 100) / 100} step="1" min={0} onCommit={(v) => setTo(Math.max(from, Math.min(v, tmax / 60)))} />
        </label>
      </div>
      <Field label={t('Velocidad')}>
        <Seg size="mini" value={speed} onChange={setSpeed} options={[1, 5, 10, 30, 60, 120].map((s) => [s, `×${s}`])} />
      </Field>
      <Field label={t('Resolución')}>
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
      <Field label={t('Cuadros por segundo')}>
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
        {t('Duración del video: {m} min {s} s · {f} cuadros.', { m: Math.floor(secs / 60), s: Math.round(secs % 60), f: fmtNum(Math.round(secs * fps)) })}{' '}
        {t('Se graba lo que muestra la vista (Solo humano, Humano-robot o Comparar) con la cámara y las capas activas.')}
      </div>
      {tooBig && (
        <div className="note" role="alert" style={{ color: 'var(--warn-ink, #b45309)' }}>
          {t(
            'Video demasiado largo para generarlo en el navegador (máx. {f} cuadros y {mb} MB). Sube la velocidad, acorta el rango o baja la resolución o los fps.',
            {
              f: fmtNum(VIDEO_LIMITS.maxFrames),
              mb: fmtNum(VIDEO_LIMITS.maxMB),
            },
          )}
        </div>
      )}
      <button className="btn" style={{ marginTop: 6 }} onClick={run} disabled={disabled || !!job || secs <= 0 || tooBig} data-testid="video-export">
        {t('Exportar video (MP4)')}
      </button>
      {job && (
        <div
          ref={modal}
          className="rec-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t('Exportando video')}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            job.done ? setJob(null) : ctrl.current?.abort()
          }}
        >
          <div className="panel">
            <h4>{t('Exportar video')}</h4>
            <div className="note" role="status">
              {job.msg}
            </div>
            {!job.done && (
              <>
                <progress max="1" value={job.p} style={{ width: '100%' }} aria-label={t('Progreso de la grabación')} />
                <div className="note">{Math.round(job.p * 100)} %</div>
                <button className="btn" onClick={() => ctrl.current?.abort()}>
                  {t('Cancelar')}
                </button>
              </>
            )}
            {job.done && (
              <button className="btn" onClick={() => setJob(null)}>
                {t('Cerrar')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
