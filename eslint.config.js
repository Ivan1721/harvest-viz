import js from '@eslint/js'
import globals from 'globals'
import eslintReact from '@eslint-react/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'

const jsx = { ecmaVersion: 2023, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } }

export default [
  { ignores: ['dist', 'node_modules', 'reports', 'coverage', '.stryker-tmp'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    ...eslintReact.configs.recommended,
    languageOptions: { ...jsx, globals: { ...globals.browser } },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // reglas clásicas de hooks; las del React Compiler (refs, immutability, purity…) no aplican: no usamos el compilador
      // y la escena 3D muta objetos de three.js en refs a propósito (useFrame), que es el patrón de react-three-fiber
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@eslint-react/exhaustive-deps': 'off', // duplicada con react-hooks/exhaustive-deps
      '@eslint-react/naming-convention-ref-name': 'off', // refs sin sufijo «Ref» (root, body, legL…) por legibilidad de la escena
      '@eslint-react/no-array-index-key': 'off', // listas estáticas (geometría, opciones) que nunca se reordenan
      // estados con un envoltorio que además sincroniza el reloj (setCanopy → play.canopy): el setter crudo lleva otro nombre
      '@eslint-react/use-state': ['warn', { enforceSetterName: false }],
      // poner «cargando» al iniciar una carga asíncrona en un efecto es intencional
      '@eslint-react/set-state-in-effect': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { files: ['src/hrsim/sim.worker.js'], languageOptions: { globals: { ...globals.worker } } },
  { files: ['scripts/bench-visual.mjs', 'scripts/export-video.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // pruebas de interfaz: corren en Node y evalúan funciones dentro del navegador
  { files: ['e2e/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['tests/components/**/*.jsx'],
    ...eslintReact.configs.recommended,
    languageOptions: { ...jsx, globals: { ...globals.browser } },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'tests/**/setup.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
  },
]
