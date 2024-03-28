import { cosmiconfigSync } from 'cosmiconfig'
import { builtinParsers } from './parsers'
import path from 'path'
import { builtinTransformers } from './transformers'
import type { Parser, ParserCreator, Transformer } from './types'
import { defaultConfig } from './defaultConfig'

type Config = {
  ignoreUnspecified: string[]
  ignoreFolders: string[]
  ignoreFiles: string[]
  read: string[]
  baseUrl: Record<string, string | null>
  transformers: Transformer[]
  parsers: Parser[]
}

type ParserConfig = Record<string, unknown>
export type RcConfig = Omit<
  Partial<Config>,
  'baseUrl' | 'transformers' | 'parsers'
> & {
  baseUrl?: string | Record<string, string | null>
  transformers?: string[]
  parsers?: Array<string | [string, ParserConfig]>
}

const buildConfig = (configFolder: string, config: RcConfig = {}): Config => {
  const relativePathRe = /^\.\.?\//
  const requireRelative = (name: string): unknown =>
    relativePathRe.test(name)
      ? require(path.join(configFolder, name))
      : require(name)

  const parsers = (config.parsers || []).map(parser => {
    const parserConfig = typeof parser === 'string' ? {} : parser[1]
    const name = typeof parser === 'string' ? parser : parser[0]
    const createParser = builtinParsers[name]
    if (createParser) return createParser(parserConfig)
    return (requireRelative(name) as ParserCreator)(parserConfig)
  })

  const transformers = (config.transformers || defaultConfig.transformers).map(
    name => builtinTransformers[name] || (requireRelative(name) as Transformer),
  )

  return {
    ignoreUnspecified:
      config.ignoreUnspecified || defaultConfig.ignoreUnspecified,
    ignoreFolders: config.ignoreFolders || defaultConfig.ignoreFolders,
    ignoreFiles: config.ignoreFiles || defaultConfig.ignoreFiles,
    read: config.read || defaultConfig.read,
    baseUrl:
      typeof config.baseUrl === 'string'
        ? { default: config.baseUrl }
        : { ...config.baseUrl },
    transformers,
    parsers,
  }
}

const explorer = cosmiconfigSync('depschecker', {
  packageProp: 'depschecker.config',
})
const { filepath, config: rcConfig } = (explorer.search() || {}) as {
  filepath?: string
  config?: RcConfig
}

export const config = buildConfig(
  filepath ? path.dirname(filepath) : process.cwd(),
  rcConfig,
)
