import path from 'path'
import { config } from './config'
import { dedup } from './utils'
import type { File } from './types'

type DepFilesMap = Record<string, string[]>

export const getDepFilesMap = (
  files: File[],
  modules: string[],
  baseUrl?: string,
): DepFilesMap => {
  const fileDeps = files
    .map(file => ({
      file: file.path,
      deps: findDependencies(file, modules),
    }))
    .filter(({ deps }) => deps.length)
  const baseUrlModules = getBaseUrlModules(files, baseUrl)

  return fileDeps.reduce<DepFilesMap>((acc, { file, deps }) => {
    deps.forEach(dep => {
      if (baseUrlModules.includes(dep)) return
      if (acc[dep]) return acc[dep]?.push(file)
      acc[dep] = [file]
    })
    return acc
  }, {})
}

const findDependencies = (file: File, modules: string[]): string[] => {
  const transformed = config.transformers.reduce(
    (acc, transformer) => transformer(acc),
    file,
  )
  const result = config.parsers.reduce<string[]>(
    (acc, parser) => acc.concat(parser(transformed, modules)),
    [],
  )
  return dedup(result)
}

const getBaseUrlModules = (files: File[], baseUrl?: string): string[] => {
  if (!baseUrl) return []

  const scriptExtRe = /\.(m?js|ts)x?$/
  const baseUrlRe = new RegExp(`^${path.join(baseUrl, '([^/]+)')}`)
  const modules = files.map(file =>
    baseUrlRe.exec(file.path)?.[1]?.replace(scriptExtRe, ''),
  )
  return dedup(modules).filter(<T>(a: T | undefined): a is T => !!a)
}
