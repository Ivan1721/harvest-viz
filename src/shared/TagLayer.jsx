// Etiquetas HTML sobre la escena 3D (H1…, RB-01) en una sola capa por lienzo.
// Reemplaza a <Html> de drei, que crea una raíz de React por etiqueta y con React 19 falla al desmontarse
// ("removeChild: the node to be removed is not a child"). Aquí las etiquetas son divs manejados a mano.
//
// Cualquier objeto con `userData.videoTag` (texto o función) recibe una etiqueta, igual que en el video.
// Opcionales: `tagSub` (texto o función, en gris), `tagClass` (clase extra, texto o función) y `tagColor` (borde).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const v = new THREE.Vector3()
const val = (x) => (typeof x === 'function' ? x() : x)

export function TagLayer() {
  const gl = useThree((s) => s.gl)
  const layer = useMemo(() => {
    const d = document.createElement('div')
    d.className = 'tag-layer'
    d.setAttribute('aria-hidden', 'true') // decorativas: la información está en los paneles
    return d
  }, [])
  const pool = useRef(new Map()) // objeto 3D → { el, main, sub, key }
  useEffect(() => {
    const parent = gl.domElement.parentNode
    parent?.appendChild(layer)
    const map = pool.current
    return () => {
      layer.remove()
      map.clear()
    }
  }, [gl, layer])

  useFrame(({ scene, camera, size }) => {
    const map = pool.current,
      seen = new Set()
    scene.traverseVisible((o) => {
      const u = o.userData
      if (u.videoTag == null) return
      seen.add(o)
      let t = map.get(o)
      if (!t) {
        const el = document.createElement('div'),
          main = document.createElement('b'),
          sub = document.createElement('span')
        el.append(main, sub)
        layer.appendChild(el)
        t = { el, main, sub, cls: '', text: '', subText: '' }
        map.set(o, t)
      }
      v.setFromMatrixPosition(o.matrixWorld).project(camera)
      const off = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2
      t.el.style.display = off ? 'none' : ''
      if (off) return
      t.el.style.transform = `translate3d(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px, 0) translate(-50%, -50%)`
      const text = String(val(u.videoTag)),
        subText = u.tagSub ? String(val(u.tagSub)) : '',
        cls = 'tag' + (u.tagClass ? ' ' + val(u.tagClass) : '')
      // con `tagSub`, el texto del video (completo) se reparte: nombre en negrita + detalle en gris
      const mainText = subText && text.endsWith(subText) ? text.slice(0, -subText.length) : text
      if (t.text !== mainText) t.main.textContent = t.text = mainText
      if (t.subText !== subText) t.sub.textContent = t.subText = subText
      if (t.cls !== cls) t.el.className = t.cls = cls
      if (u.tagColor && t.el.style.borderColor !== u.tagColor) t.el.style.borderColor = u.tagColor
    })
    for (const [o, t] of map)
      if (!seen.has(o)) {
        t.el.remove()
        map.delete(o)
      }
  })
  return null
}
