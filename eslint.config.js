import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser }, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/no-unknown-property': 'off', // props de react-three-fiber (position, args, …)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { files: ['src/hrsim/sim.worker.js'], languageOptions: { globals: { ...globals.worker } } },
  { files: ['scripts/bench-visual.mjs', 'scripts/export-video.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // pruebas de interfaz: corren en Node y evalúan funciones dentro del navegador
  { files: ['e2e/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['tests/components/**/*.jsx'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser }, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: '18.3' } },
    plugins: { react },
    rules: { ...react.configs['jsx-runtime'].rules, 'react/jsx-uses-vars': 'error' },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'tests/**/setup.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
  },
]
