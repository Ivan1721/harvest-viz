// La imagen de Playwright del job de interfaz (CI) trae navegadores de una versión exacta: debe ser la de @playwright/test.
// Si Dependabot sube el paquete, esta prueba pide subir también la etiqueta y el digest de la imagen en ci.yml.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('CI: la imagen de Playwright del job de interfaz es la misma versión que @playwright/test', () => {
  const ci = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const m = /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble@sha256:[0-9a-f]{64}/.exec(ci)
  assert.ok(m, 'ci.yml usa la imagen de Playwright fijada por digest')
  const instalada = JSON.parse(fs.readFileSync(new URL('../../node_modules/@playwright/test/package.json', import.meta.url), 'utf8')).version
  assert.equal(m[1], instalada, `imagen v${m[1]} y @playwright/test ${instalada}: sube la etiqueta y el digest en ci.yml`)
})
