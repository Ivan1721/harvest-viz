// R3: paltos con racimos de hojas (calidad Alta). La geometría de cada variante se prueba sin dibujar.
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { variantePalto } from '../../src/shared/paltoHojas.jsx'

const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3

describe('variantePalto', () => {
  const v = variantePalto(3, { racimos: 700, frutos: 90 })

  it('racimos, interior, esferas de lejos, corteza y frutos, dentro del presupuesto de triángulos', () => {
    expect(tri(v.hojas)).toBe(700 * 2) // una tarjeta = 2 triángulos
    const total = tri(v.hojas) + tri(v.interior) + tri(v.corteza) + tri(v.frutos)
    expect(total).toBeLessThan(15000) // el prototipo: ~6.900 por árbol con 1.125 árboles a ~58 cuadros/s
    expect(v.lejos.getAttribute('color')).toBeTruthy()
    expect(tri(v.frutos)).toBeGreaterThan(0)
  })

  it('la copa mide lo del palto modelo: radio ~3,25 m y alto ~5,6 m', () => {
    const bb = new THREE.Box3().setFromBufferAttribute(v.hojas.attributes.position)
    const s = bb.getSize(new THREE.Vector3())
    expect(Math.max(s.x, s.z) / 2).toBeGreaterThan(2.8)
    expect(Math.max(s.x, s.z) / 2).toBeLessThan(4.5)
    expect(bb.max.y).toBeGreaterThan(4.8)
    expect(bb.max.y).toBeLessThan(7)
  })

  it('el orden de los racimos es al azar: los primeros (opacidad baja) son una muestra pareja de toda la copa', () => {
    const p = v.hojas.attributes.position,
      idx = v.hojas.index.array
    const centro = (desde, hasta) => {
      const c = new THREE.Vector3()
      for (let i = desde; i < hasta; i++) c.add(new THREE.Vector3().fromBufferAttribute(p, idx[i]))
      return c.divideScalar(hasta - desde)
    }
    const n = idx.length
    const pocos = centro(0, Math.floor((n * 0.25) / 6) * 6),
      todos = centro(0, n)
    expect(pocos.distanceTo(todos)).toBeLessThan(0.5)
  })

  it('la misma semilla da el mismo palto; otra, uno distinto', () => {
    const a = variantePalto(3, { racimos: 50, frutos: 10 }),
      b = variantePalto(3, { racimos: 50, frutos: 10 }),
      c = variantePalto(11, { racimos: 50, frutos: 10 })
    expect(Array.from(a.hojas.attributes.position.array.slice(0, 30))).toEqual(Array.from(b.hojas.attributes.position.array.slice(0, 30)))
    expect(Array.from(a.hojas.attributes.position.array.slice(0, 30))).not.toEqual(Array.from(c.hojas.attributes.position.array.slice(0, 30)))
  })
})
