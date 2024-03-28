const { defaultConfig } = require('depschecker')

/** @type {import('depschecker').RcConfig} */
const config = {
  ignoreFolders: defaultConfig.ignoreFolders.concat(['dist', '.vscode']),
  parsers: [
    'js',

    [
      'configs',
      {
        importObjectKeys: ['extends'],
        configs: {
          'tsconfig\\.json$': { tool: 'typescript', deps: ['typescript'] },
        },
      },
    ],

    [
      'sh',
      {
        tsup: 'tsup',
      },
    ],
  ],
}

module.exports = config
