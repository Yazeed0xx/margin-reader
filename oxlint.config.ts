import { defineConfig } from 'oxlint'

export default defineConfig({
  ignorePatterns: [
    '**/.adonisjs/**',
    '**/.expo/**',
    '**/.turbo/**',
    '**/build/**',
    '**/bundle-audit/**',
    '**/database/schema.ts',
    '**/dist/**',
    '**/dist-*/**',
    '**/node_modules/**',
    '**/public/assets/**',
    '**/tmp/**',
  ],
  plugins: ['typescript', 'react', 'jsx-a11y', 'react-perf'],
  jsPlugins: [{ name: 'adonis', specifier: './tooling/oxlint/adonis.mjs' }],
  overrides: [
    {
      files: ['apps/api/database/migrations/**/*.ts'],
      rules: { 'adonis/no-runtime-models-in-migrations': 'error' },
    },
    {
      files: ['apps/api/app/controllers/**/*.ts'],
      rules: {
        // Starter architecture preference, not a framework prohibition.
        'adonis/no-controller-database': 'error',
        'adonis/require-method-inject': 'error',
      },
    },
    {
      files: ['apps/api/app/{controllers,services,actions}/**/*.ts'],
      rules: { 'adonis/no-controller-import': 'error' },
    },
    {
      files: ['apps/api/app/{controllers,services,actions,policies,validators,exceptions}/**/*.ts'],
      rules: {
        'adonis/no-new-service': 'error',
        'adonis/prefer-static-imports': 'error',
      },
    },
    {
      files: ['apps/api/app/{controllers,services,actions,policies,middleware,listeners}/**/*.ts'],
      rules: {
        'adonis/require-constructor-inject': 'error',
        'adonis/injection-runtime-imports': 'error',
      },
    },
    {
      files: ['apps/api/app/**/*.ts'],
      // Prefer request-aware or framework logging in application code.
      rules: { 'no-console': 'error' },
    },
    {
      files: ['apps/api/app/**/*.ts', 'apps/api/config/**/*.ts'],
      rules: { 'adonis/use-validated-env': 'error' },
    },
  ],
  settings: {
    react: {
      version: '19',
    },
  },
  rules: {
    curly: ['error', 'all'],
    'react/react-in-jsx-scope': 'off',
    'react/rules-of-hooks': 'error',
    'typescript/consistent-type-definitions': ['error', 'interface'],
  },
})
