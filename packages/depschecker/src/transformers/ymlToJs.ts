import type { Transformer } from '../types'
import { parse } from 'yaml'

export const ymlToJs: Transformer = file => {
  if (!file.content || !/\.ya?ml$/.test(file.path)) return file
  const content = parse(file.content) as Record<string, unknown>
  file.jsSource = 'module.exports=' + JSON.stringify(content)
  return file
}
