const eslint = require('@eslint/js')
const tseslint = require('typescript-eslint')
const packageJson = require('./package.json')

const workspaces = packageJson.workspaces

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-var-requires': 'off',
    },
    languageOptions: {
      parserOptions: {
        project: workspaces.map(workspace => `${workspace}/tsconfig.json`),
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    ignores: [
      '**/*.*',
      ...workspaces.map(workspace => `!${workspace}/src/**/*.ts`),
    ],
  },
)
