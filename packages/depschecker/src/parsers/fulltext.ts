import type { ParserCreator } from '../types'

type Config = {
  include: RegExp
  patterns: Record<string, string[]>
}
type RcConfig = {
  include?: string[]
  patterns?: Record<string, string[]>
}

export const fulltext: ParserCreator = rc => {
  const rcConfig = rc as RcConfig
  const config: Config = {
    include: new RegExp(rcConfig.include?.join('|') || ''),
    patterns: { ...rcConfig.patterns },
  }

  return ({ path, content }) => {
    if (!content || !config.include.test(path)) return []
    return Object.entries(config.patterns).flatMap(([pattern, deps]) =>
      new RegExp(pattern).test(content) ? deps : [],
    )
  }
}
