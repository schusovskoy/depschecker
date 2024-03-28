import type { ParserCreator } from '../types'

type Config = Record<string, string[]>

export const extensions: ParserCreator = rc => {
  const config = rc as Config
  return (file, modules) =>
    modules
      .flatMap(dep => config[dep] || [])
      .filter(dep => modules.includes(dep))
}
