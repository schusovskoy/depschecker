# depschecker

I developed this utility as part of my role in one of my previous companies. It was used to verify workspace dependencies in a large monorepo within a CI pipeline. The utility ensures that a package contains all necessary dependencies, which could be utilized in source files, configurations, shell scripts, etc.

The execution flow is as follows: parse CLI arguments → compile a list of packages to check → verify peerDependencies requirements → read package files → use a transformers pipeline to convert file content to AST → use parsers to find dependencies → check for unused or unspecified dependencies → generate a report.

This utility is designed for configurability and extendability. You can create new transformers and parsers and utilize configuration files, as shown in the example below.

## Configuration example

```js
module.exports = {
  ignoreFolders: ['node_modules', '.git', '.yarn'], // patterns of folders to ignore
  ignoreFiles: ['*.d.ts'], // patterns of files to ignore
  read: ['\\.(m?jsx?|tsx?|json|sh|ya?ml)$'], // patterns of files to read
  transformers: ['packageJsonToSh', 'ymlToJs', 'toJsAst', 'toShAst'], // here you can use module names or relative paths
  ignoreUnspecified: ['fs', 'path', 'child_process', 'util', 'crypto'],
  parsers: [
    [
      // parser name, it can be a module name or a relative path
      'js',

      // parser config
      {
        types: {
          'styled-components': '@types/styled-components-react-native',
        },
      },
    ],

    [
      'configs',
      {
        importObjectKeys: [
          'extends',
          'plugins',
          'preset',
          'presets',
          'parser',
          'loader',
          'processors',
          'setupFiles',
          'setupFilesAfterEnv',
          'addons',
          'reporters',
          'framework',
          'resolver',
          'customSyntax',
        ],
        replace: {
          eslint: {
            '^eslint:recommended': 'eslint',
            'extends#^@[^/]+(?![^/]*/eslint-config)': '$&/eslint-config',
            'extends#^(?!plugin:|eslint($|-config-))[^@/]+': 'eslint-config-$&',
            '^plugin:(@[^/]+)': '$1/eslint-plugin',
            '^plugin:([^@/]+)': 'eslint-plugin-$1',
            'plugins#^(?!eslint-plugin-)[^@/]+': 'eslint-plugin-$&',
            'plugins#^@[^/]+(?![^/]*/eslint-plugin)': '$&/eslint-plugin',
          },
          babel: {
            'presets#^@babel/(?!preset-)([^/]+)': '@babel/preset-$1',
            'presets#^(@(?!babel)[^/]+)(?![^/]*/babel-preset-)/([^/]+)':
              '$1/babel-preset-$2',
            'presets#^module:(.+)': '$1',
            'plugins#^(?!babel-plugin)[^@/]+(?![^/]*/(plugin|babel))':
              'babel-plugin-$&',
          },
          'semantic-release': {
            '^@semantic-release/commit-analyzer': 'semantic-release',
            '^@semantic-release/release-notes-generator': 'semantic-release',
            '^@semantic-release/npm': 'semantic-release',
            '^conventionalcommits': 'semantic-release',
          },
          wdio: {
            'reporters#^(allure|spec)$': '@wdio/$&-reporter',
            'reporters#^[^@/]+': 'wdio-$&-reporter',
            'framework#^[^/]+': '@wdio/$&-framework',
          },
          'gql-codegen': {
            'preset#^.+': '$&-preset',
            '^[^@]+': '@graphql-codegen/$&',
          },
        },
        configs: {
          'tsconfig\\.json$': { tool: 'typescript', deps: ['typescript'] },
          '\\.eslintrc\\.js$': { tool: 'eslint', deps: ['eslint'] },
          '/\\.husky/pre-commit$': { tool: 'husky', deps: ['husky'] },
          'jest\\.config\\.js$': { tool: 'jest', deps: ['jest'] },
          'rollup\\.config\\.js$': { tool: 'rollup', deps: ['rollup'] },
          'babel\\.config(\\.[^.]+)*\\.js$': {
            tool: 'babel',
            deps: ['@babel/core'],
          },
          'commitlint\\.config\\.js$': {
            tool: 'commitlint',
            deps: ['@commitlint/cli'],
          },
          '\\.releaserc\\.js$': {
            tool: 'semantic-release',
            deps: ['semantic-release'],
          },
          '\\.lintstagedrc\\.js$': {
            tool: 'lint-staged',
            deps: ['lint-staged'],
          },
          '/apps/web/package\\.json$': 'global',
          '/services/rn-service/package\\.json$': 'global',
          '/cypress/support/': { tool: 'cypress', deps: ['cypress'] },
          '/codegen\\.ya?ml$': 'gql-codegen',
        },
      },
    ],
  ],
}
```
