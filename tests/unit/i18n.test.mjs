// Idiomas de la interfaz: el español es la clave; lo que falta en un diccionario cae al español.
import test from 'node:test'
import assert from 'node:assert/strict'
import { t, setLang, getLang, fmtNum, LANGS } from '../../src/i18n/index.js'
import en from '../../src/i18n/en/index.js'
import pt from '../../src/i18n/pt/index.js'

test('español por defecto; traduce, interpola y cae al español si falta', () => {
  assert.equal(getLang(), 'es')
  assert.equal(t('Simular'), 'Simular')
  setLang('en')
  assert.equal(t('Simular'), en.Simular)
  assert.equal(t('texto que no está en ningún diccionario'), 'texto que no está en ningún diccionario')
  assert.equal(t('{n} corridas disponibles.', { n: 3 }), en['{n} corridas disponibles.'].replace('{n}', '3'))
  assert.equal(fmtNum(1234.5, { maximumFractionDigits: 1 }), '1,234.5')
  setLang('es')
  assert.equal(fmtNum(1234.5, { maximumFractionDigits: 1 }), '1.234,5')
  setLang('xx')
  assert.equal(getLang(), 'es', 'un idioma desconocido se ignora')
})

test('los diccionarios conservan los marcadores {var} de cada clave', () => {
  for (const [name, d] of Object.entries({ en, pt })) {
    for (const [k, v] of Object.entries(d)) {
      const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      assert.deepEqual(vars(v), vars(k), `${name}: "${k}"`)
    }
  }
  assert.deepEqual(Object.keys(LANGS), ['es', 'en', 'pt'])
})

test('en el navegador: ?lang= manda, luego lo guardado; avisa a los suscritos al cambiar', async () => {
  const store = { 'hv-lang': 'en' }
  globalThis.window = { location: { search: '?lang=pt' }, localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) } }
  globalThis.document = { documentElement: {} }
  try {
    const m = await import('../../src/i18n/index.js?navegador')
    assert.equal(m.getLang(), 'pt', '?lang= tiene prioridad')
    let calls = 0
    const off = m.subscribe(() => calls++)
    m.setLang('en')
    assert.equal(calls, 1)
    assert.equal(store['hv-lang'], 'en')
    assert.equal(globalThis.document.documentElement.lang, 'en')
    off()
    m.setLang('es')
    assert.equal(calls, 1, 'tras desuscribirse no avisa')
    globalThis.window.location.search = ''
    const m2 = await import('../../src/i18n/index.js?guardado')
    assert.equal(m2.getLang(), 'es', 'sin ?lang= usa lo guardado')
  } finally {
    delete globalThis.window
    delete globalThis.document
  }
})

test('los textos de la estructura de la interfaz (I1) están traducidos al inglés y al portugués', async () => {
  const fs = await import('node:fs')
  const files = [
    'src/App.jsx',
    'src/workload/WorkloadApp.jsx',
    'src/workload/panels/SimPanel.jsx',
    'src/workload/panels/ConfigPanel.jsx',
    'src/workload/panels/ViewBar.jsx',
  ]
  const missing = []
  for (const f of files) {
    const s = fs.readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')
    for (const m of s.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) for (const [n, d] of Object.entries({ en, pt })) if (!(m[1] in d)) missing.push(`${n}: ${m[1]}`)
  }
  assert.deepEqual(missing, [])
})

test('los textos del modelo de agentes (I3) están traducidos: estados, reglas y descripción ODD', async () => {
  const m = await import('../../src/workload/modelo.js')
  const { profileDefaults } = await import('../../src/hrsim/common.js')
  const keys = new Set()
  for (const e of [...m.ESTADOS_HR, ...m.ESTADOS_HO, ...m.ESTADOS_ROBOT]) keys.add(e.label)
  for (const x of [...m.TRANSICIONES_HR, ...m.TRANSICIONES_HO, ...m.ESTADOS_ROBOT]) if (x.regla) keys.add(x.regla)
  for (const p of [profileDefaults('matlab-2026'), { ...profileDefaults('hri', 'palta-ladera', 'burro'), semilla: 3, variacionRitmo: 0.1 }])
    for (const s of m.describirModelo(p)) {
      keys.add(s.titulo)
      for (const x of s.textos || []) keys.add(x)
      for (const f of s.tabla || []) {
        keys.add(f.label)
        if (f.fuente) keys.add(f.fuente)
        if (typeof f.valor === 'string') keys.add(f.valor)
      }
    }
  const missing = []
  for (const k of keys) for (const [n, d] of Object.entries({ en, pt })) if (!(k in d)) missing.push(`${n}: ${k}`)
  assert.deepEqual(missing, [])
})
