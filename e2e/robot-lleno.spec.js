// Motor 0.9.0: recogida parcial en huertos generados (el robot carga las cajas que caben y vuelve por el resto).
import { test, expect } from '@playwright/test'
import { openWorkload, setRange } from './helpers.js'

// huerto chico (6 hileras × 20 árboles) y un robot de 2 cajas: a los 45 min todas las pilas superan su capacidad
const ajustes = Buffer.from(JSON.stringify({ capacityBoxes: 2, huertoParams: { hileras: 6, arbolesPorHilera: 20 } })).toString('base64url')

test('robot lleno: con pilas mayores que su capacidad, el robot sigue recogiendo y descargando (recogida parcial)', async ({ page }) => {
  const errors = await openWorkload(page, { mode: 'sim', query: `huerto=palta-alta-densidad&nw=12&act=mixed&perfil=hri&dur=3600&ajustes=${ajustes}` })
  await expect(page.getByTestId('robot-info')).toContainText('2 cajas de 15 kg por viaje')
  await page.getByRole('tab', { name: 'Personas' }).click()
  await page.locator('.wl .li', { hasText: 'Transportador' }).click()
  const num = async (texto) => Number((await page.locator('.detail .row', { hasText: texto }).locator('b').innerText()).replace(/\D/g, ''))
  const linea = page.locator('.timeline2 input[type=range]')
  await setRange(linea, 2700)
  await expect.poll(() => num('Descargas en zona de carga')).toBeGreaterThan(0)
  const a45 = { descargas: await num('Descargas en zona de carga'), recogidas: await num('Cajas recogidas') }
  expect(await num('A bordo ahora')).toBeLessThanOrEqual(30)
  await setRange(linea, 3600)
  // con la regla anterior (todo o nada) el robot no recogía nada más desde los 45 min
  await expect.poll(() => num('Descargas en zona de carga')).toBeGreaterThan(a45.descargas)
  expect(await num('Cajas recogidas')).toBeGreaterThan(a45.recogidas)
  expect(await num('A bordo ahora')).toBeLessThanOrEqual(30)
  if (process.env.SHOT_LLENO) await page.screenshot({ path: process.env.SHOT_LLENO })
  expect(errors).toEqual([])
})
