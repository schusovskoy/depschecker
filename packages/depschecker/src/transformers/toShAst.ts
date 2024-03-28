import type { Transformer } from '../types'
import shParser from 'mvdan-sh'

export const toShAst: Transformer = file => {
  const { path, content, shSource, extension } = file
  if (!shSource && (!content || extension !== 'sh')) return file

  const source = (shSource || content) as string
  const parser = shParser.syntax.NewParser()
  const sh = parser.Parse(source, path)
  file.sh = sh
  return file
}
