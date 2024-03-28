import type { ParserCreator } from '../types'
import { configs } from './configs'
import { extensions } from './extensions'
import { fulltext } from './fulltext'
import { js } from './js'
import { sh } from './sh'

export const builtinParsers: Record<string, ParserCreator> = {
  js,
  configs,
  extensions,
  sh,
  fulltext,
}
