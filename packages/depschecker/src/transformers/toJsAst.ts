import type { Transformer } from '../types'
import { parse, type ParserOptions } from '@babel/parser'

export const toJsAst: Transformer = file => {
  const { content, jsSource, path, extension } = file
  if (!jsSource && (!content || !/\.(tsx?|m?jsx?|json)$/.test(path))) {
    return file
  }

  const source =
    (jsSource as string | undefined) ||
    (extension === 'json' ? 'module.exports=' : '') + content
  const plugins: ParserOptions['plugins'] = (() => {
    if (extension === 'tsx') return ['jsx', 'typescript']
    if (extension === 'ts') return ['typescript']
    return ['jsx', 'flow']
  })()
  const js = parse(source, { sourceType: 'module', plugins })
  file.js = js
  return file
}
