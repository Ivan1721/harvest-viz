// Utilidades comunes de las pruebas de interfaz.
// En máquinas sin GPU (CI, contenedores) WebGL corre por software y la escena 3D satura la CPU:
// las pruebas pausan la reproducción y usan el estilo Esquemático, que es más liviano.

/** Abre un modo de la cabecera ('replica' por defecto: corridas de MATLAB incluidas, sin simular). */
export async function openWorkload(page, { light = true, mode = 'replica' } = {}) {
  await page.addInitScript((m) => localStorage.setItem('hv-mode', m), mode)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/404|favicon/.test(m.text()) && errors.push(m.text()))
  await page.goto(light ? '/?look=schem' : '/')
  await page.getByRole('heading', { name: /Escenario/ }).waitFor()
  if (mode === 'sim') await waitSim(page, 0)
  await page.locator('canvas').first().waitFor()
  await pause(page)
  return errors
}

const simDone = (page) => page.locator('.wb').getAttribute('data-sim-done').then(Number)
/** Espera a que terminen más de `before` simulaciones. */
async function waitSim(page, before) {
  await page.waitForFunction((b) => Number(document.querySelector('.wb')?.dataset.simDone) > b, before, { timeout: 60_000 })
}

/** Cambia al modo Simulador (que simula al entrar) y espera el resultado. */
export async function useSimulator(page) {
  const before = await simDone(page)
  await page.getByRole('button', { name: 'Simulador', exact: true }).click()
  await waitSim(page, before)
  await pause(page)
}

/** Pulsa «Simular» y espera el resultado. */
export async function simulate(page) {
  const before = await simDone(page)
  await page.getByTestId('sim-run').click()
  await waitSim(page, before)
  await pause(page)
}

export async function pause(page) {
  const btn = page.getByRole('button', { name: 'Pausar' })
  if (await btn.count()) await btn.click()
}

export async function play(page) {
  const btn = page.getByRole('button', { name: 'Reproducir' })
  if (await btn.count()) await btn.click()
}

/** Mueve un <input type=range> controlado por React (fill() no dispara su onChange). */
export async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}
