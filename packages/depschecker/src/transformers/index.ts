import type { Transformer } from '../types'
import { packageJsonToSh } from './packageJsonToSh'
import { toJsAst } from './toJsAst'
import { toShAst } from './toShAst'
import { ymlToJs } from './ymlToJs'

export const builtinTransformers: Record<string, Transformer> = {
  packageJsonToSh,
  toJsAst,
  toShAst,
  ymlToJs,
}
