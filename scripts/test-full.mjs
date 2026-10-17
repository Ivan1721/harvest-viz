// Corre la regresión completa (720 configuraciones de MATLAB) en cualquier sistema: npm run test:full
import { spawnSync } from 'node:child_process'
const r = spawnSync(process.execPath, ['--test', 'tests/**/*.test.mjs'], { stdio: 'inherit', env: { ...process.env, FULL: '1' } })
process.exit(r.status ?? 1)
