import { defineConfig, devices } from '@playwright/test'

// Navegadores: por defecto solo Chromium; ALL_BROWSERS=1 agrega Firefox y WebKit.
const chromium = {
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1500, height: 900 },
    launchOptions: {
      // PW_CHROMIUM: usar un Chromium ya instalado (p. ej. contenedores sin descarga de navegadores)
      executablePath: process.env.PW_CHROMIUM || undefined,
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
}
const others = [
  { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1500, height: 900 } } },
  { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1500, height: 900 } } },
]

export default defineConfig({
  testDir: 'e2e',
  // WebGL por software (sin GPU) es lento: límites holgados
  timeout: 300_000,
  expect: { timeout: 90_000, toHaveScreenshot: { maxDiffPixelRatio: 0.03, animations: 'disabled' } },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4175', trace: 'retain-on-failure', acceptDownloads: true },
  projects: process.env.ALL_BROWSERS ? [chromium, ...others] : [chromium],
  webServer: { command: 'npx vite preview --port 4175 --strictPort', url: 'http://localhost:4175', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
})
