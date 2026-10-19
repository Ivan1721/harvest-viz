// Exportación de video: renderiza la reproducción cuadro a cuadro con tiempo fijo (no depende de los FPS del equipo)
// y la codifica a MP4 (H.264) en el navegador con WebCodecs (biblioteca mediabunny).
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { play, anim } from './playback.js'
import { t } from '../i18n/index.js'

const scenes = new Map()

/** Dentro de cada <Canvas>: registra la escena para poder grabarla. */
export function RecorderProbe({ name }) {
  const get = useThree((s) => s.get)
  useEffect(() => {
    scenes.set(name, get)
    return () => scenes.delete(name)
  }, [name, get])
  return null
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const v3 = new THREE.Vector3()

/** Etiquetas (H1…, RB-01) dibujadas sobre el cuadro: proyecta las anclas `userData.videoTag` de la escena. */
function drawTags(ctx, st, x0, y0, w, h, px) {
  const tags = []
  st.scene.traverse((o) => o.userData?.videoTag && o.visible && tags.push(o))
  ctx.font = `600 ${Math.round(px)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const o of tags) {
    v3.setFromMatrixPosition(o.matrixWorld).project(st.camera)
    if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) continue
    const x = x0 + ((v3.x + 1) / 2) * w,
      y = y0 + ((1 - v3.y) / 2) * h
    const text = typeof o.userData.videoTag === 'function' ? o.userData.videoTag() : o.userData.videoTag
    const tw = ctx.measureText(text).width + px * 0.9,
      th = px * 1.5
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    ctx.strokeStyle = o.userData.videoAccent ? '#1f56e8' : '#1c2540'
    ctx.lineWidth = Math.max(1, px / 9)
    ctx.beginPath()
    ctx.roundRect(x - tw / 2, y - th / 2, tw, th, th / 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#1c2540'
    ctx.fillText(text, x, y + px * 0.05)
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/** Tasa de bits objetivo: ~0,1 bit por píxel y cuadro (1080p a 60 fps ≈ 12 Mbit/s). */
export const bitrateFor = (w, h, fps) => Math.round(w * h * fps * 0.1)

/** Códecs que este navegador dice poder codificar, en orden de preferencia: H.264 (máxima compatibilidad), VP9, AV1. */
export async function codecCandidates(width, height, fps = 60) {
  if (typeof VideoEncoder === 'undefined') return []
  const { canEncodeVideo } = await import('mediabunny')
  const out = []
  for (const c of ['avc', 'vp9', 'av1']) if (await canEncodeVideo(c, { width, height, bitrate: bitrateFor(width, height, fps) })) out.push(c)
  return out
}

/**
 * Graba [t0, t1] (s de simulación) a `speed`× y `fps` cuadros por segundo, en un video de width×height.
 * labels: { [nombre de escena]: texto }; title: texto del encabezado. Devuelve un Blob MP4.
 */
export async function recordVideo({ t0, t1, speed, fps, width, height, title, labels = {}, order = [], codec = 'avc' }, onProgress, signal) {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import('mediabunny')
  const list = [...scenes.entries()].sort((a, b) => {
    const ia = order.indexOf(a[0]),
      ib = order.indexOf(b[0])
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  if (!list.length) throw new Error(t('No hay escenas para grabar.'))
  const n = list.length,
    head = Math.round(height * 0.07),
    cellW = Math.floor(width / n / 2) * 2,
    cellH = height - head
  const comp = document.createElement('canvas')
  comp.width = width
  comp.height = height
  const ctx = comp.getContext('2d')
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const source = new CanvasSource(comp, { codec, bitrate: bitrateFor(width, height, fps), keyFrameInterval: 2 })
  output.addVideoTrack(source, { frameRate: fps })
  await output.start()

  const saved = list.map(([, get]) => {
    const st = get()
    return { w: st.size.width, h: st.size.height, dpr: st.viewport.dpr, frameloop: st.frameloop }
  })
  const before = { t: play.t, playing: play.playing, anim: anim.t }
  play.playing = false
  list.forEach(([, get]) => {
    const st = get()
    st.setFrameloop('never')
    st.setDpr(1)
    st.setSize(cellW, cellH)
  })
  await wait(120) // deja que la cámara se reencuadre al nuevo tamaño
  const frames = Math.max(1, Math.round(((t1 - t0) / speed) * fps))
  const font = (px, w = 600) => `${w} ${Math.round(px)}px Inter, system-ui, sans-serif`
  try {
    for (let k = 0; k < frames; k++) {
      if (signal?.aborted) throw Object.assign(new Error(t('Grabación cancelada')), { name: 'AbortError' })
      play.t = Math.min(t1, t0 + (k * speed) / fps)
      anim.t = before.anim + k / fps
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      list.forEach(([name, get], i) => {
        const st = get()
        st.advance((k * 1000) / fps)
        ctx.drawImage(st.gl.domElement, i * cellW, head, cellW, cellH)
        drawTags(ctx, st, i * cellW, head, cellW, cellH, Math.max(11, height / 72))
        if (labels[name]) {
          ctx.font = font(head * 0.32)
          ctx.fillStyle = '#1c2540'
          ctx.fillText(t(labels[name]), i * cellW + head * 0.35, head + head * 0.55)
        }
      })
      // encabezado: título y reloj de la simulación
      ctx.fillStyle = '#1c2540'
      ctx.font = font(head * 0.36)
      ctx.fillText(title ? t(title) : '', head * 0.35, head * 0.62)
      ctx.textAlign = 'right'
      ctx.font = font(head * 0.36, 500)
      ctx.fillText(`${fmt(play.t)}  ·  ×${speed}`, width - head * 0.35, head * 0.62)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#1f56e8'
      ctx.fillRect(0, head - 3, width * ((play.t - t0) / Math.max(1e-9, t1 - t0)), 3)
      await source.add(k / fps, 1 / fps)
      if (k % 10 === 0) onProgress?.(k / frames)
    }
    await output.finalize()
    onProgress?.(1)
    return new Blob([output.target.buffer], { type: 'video/mp4' })
  } catch (e) {
    await output.cancel?.()
    throw e
  } finally {
    list.forEach(([, get], i) => {
      const st = get(),
        s = saved[i]
      st.setSize(s.w, s.h)
      st.setDpr(s.dpr)
      st.setFrameloop(s.frameloop || 'always')
    })
    play.t = before.t
    play.playing = before.playing
    anim.t = before.anim
  }
}
