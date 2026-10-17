// Utilidades comunes de las pruebas de interfaz.
// En máquinas sin GPU (CI, contenedores) WebGL corre por software y la escena 3D satura la CPU:
// las pruebas pausan la reproducción y usan el estilo Esquemático, que es más liviano.
export async function openWorkload(page, { light = true } = {}) {
  await page.addInitScript(() => localStorage.setItem('hv-mode', 'workload'))
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/404|favicon/.test(m.text()) && errors.push(m.text()))
  await page.goto(light ? '/?look=schem' : '/')
  await page.getByText('Fuente', { exact: true }).waitFor()
  await page.locator('canvas').first().waitFor()
  await pause(page)
  return errors
}

export async function useSimulator(page) {
  await page.getByRole('button', { name: 'Simulador', exact: true }).click()
  await page.getByText(/Simulado en \d+ ms/).waitFor({ timeout: 60_000 })
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
