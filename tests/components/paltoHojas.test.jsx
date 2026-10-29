// R3: paltos con racimos de hojas (calidad Alta). La geometría de cada variante se prueba sin dibujar.
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { variantePalto, materialHojas, rasgosArbol, ATLAS, RACIMOS } from '../../src/shared/paltoHojas.jsx'

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

// Follaje de paltos, etapa A: atlas de racimos, normales de copa, tinte por tarjeta y por árbol, y contraluz.
describe('follaje de paltos (etapa A)', () => {
  const v = variantePalto(3, { racimos: 700, frutos: 90 })
  const tarjetas = (attr) => {
    const out = []
    for (let i = 0; i < attr.count; i += 4) out.push([0, 1, 2, 3].map((j) => [attr.getX(i + j), attr.getY(i + j), attr.itemSize > 2 ? attr.getZ(i + j) : 0]))
    return out
  }

  it('cada tarjeta lee una sola celda del atlas, y se usan los cuatro racimos', () => {
    expect(RACIMOS).toHaveLength(ATLAS * ATLAS)
    const celdas = new Set()
    for (const t of tarjetas(v.hojas.attributes.uv)) {
      const cu = Math.floor(Math.min(...t.map((p) => p[0])) * ATLAS + 1e-6),
        cv = Math.floor(Math.min(...t.map((p) => p[1])) * ATLAS + 1e-6)
      for (const [u, w] of t) {
        expect(u).toBeGreaterThanOrEqual(cu / ATLAS - 1e-6)
        expect(u).toBeLessThanOrEqual((cu + 1) / ATLAS + 1e-6)
        expect(w).toBeGreaterThanOrEqual(cv / ATLAS - 1e-6)
        expect(w).toBeLessThanOrEqual((cv + 1) / ATLAS + 1e-6)
      }
      celdas.add(cu + cv * ATLAS)
    }
    expect(celdas.size).toBe(4)
  })

  it('normales de copa: unitarias, iguales en los 4 vértices y hacia arriba en lo alto de la copa', () => {
    const pos = tarjetas(v.hojas.attributes.position),
      nor = tarjetas(v.hojas.attributes.normal)
    let arriba = 0,
      n = 0
    nor.forEach((t, i) => {
      expect(Math.hypot(...t[0])).toBeCloseTo(1, 5)
      expect(t[3]).toEqual(t[0])
      if (pos[i][0][1] > 5) {
        arriba += t[0][1]
        n++
      }
    })
    expect(n).toBeGreaterThan(10)
    expect(arriba / n).toBeGreaterThan(0.5)
  })

  it('tinte por tarjeta: acotado, y más claro arriba que abajo', () => {
    const pos = tarjetas(v.hojas.attributes.position),
      col = tarjetas(v.hojas.attributes.color)
    const media = (f) => {
      const g = col.filter((_, i) => f(pos[i][0][1]))
      return g.reduce((s, t) => s + t[0][1], 0) / g.length
    }
    for (const t of col)
      for (const c of t[0]) {
        expect(c).toBeGreaterThan(0.6)
        expect(c).toBeLessThan(1.35)
      }
    expect(media((y) => y > 4.5)).toBeGreaterThan(media((y) => y < 3) + 0.05)
  })

  it('rasgos de cada árbol: deterministas, ±6 % de tamaño y de brillo', () => {
    expect(rasgosArbol(17)).toEqual(rasgosArbol(17))
    for (let s = -50; s < 200; s++) {
      const r = rasgosArbol(s)
      expect(r.escala).toBeGreaterThanOrEqual(0.94)
      expect(r.escala).toBeLessThanOrEqual(1.06)
      expect(r.tinte[1]).toBeGreaterThanOrEqual(0.94)
      expect(r.tinte[1]).toBeLessThanOrEqual(1.06)
    }
    expect(rasgosArbol(1).escala).not.toBe(rasgosArbol(2).escala)
  })

  it('el material encuentra los trozos del sombreador de three que modifica (normal sin voltear y contraluz)', () => {
    const m = materialHojas(null)
    const sh = { fragmentShader: THREE.ShaderLib.standard.fragmentShader, vertexShader: '', uniforms: {} }
    m.onBeforeCompile(sh)
    expect(sh.fragmentShader).toContain('normal = normalize( vNormal );')
    expect(sh.fragmentShader).toContain('directionalLights[ 0 ].direction')
    expect(sh.fragmentShader).toMatch(/outgoingLight \+= [^\n]+\n[\s\S]*#include <opaque_fragment>/)
    expect(m.vertexColors).toBe(true)
  })
})
