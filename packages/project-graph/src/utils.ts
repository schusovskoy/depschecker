import fs from 'fs'
import type { Package } from './types'

export const fileExists = (path: string): boolean => {
  try {
    fs.accessSync(path)
    return true
  } catch {
    return false
  }
}

export const getPackage = (
  name: string,
  graph: Record<string, Package>,
): Package => {
  const pkg = graph[name]
  if (pkg) return pkg
  throw new Error(`There is no package with the name ${name}`)
}

export const resolvePackageJson = (
  module: string,
  from: string,
): string | undefined => {
  try {
    return require.resolve(`${module}/package.json`, { paths: [from] })
  } catch (error) {
    if (isNotExportedError(error)) return getPathFromNotExported(error)
    if (isNotFoundError(error)) return error.path
    // eslint-disable-next-line no-console
    console.log(error)
  }
}

export const loadJson = (path: string): unknown => {
  const content = fs.readFileSync(path, { encoding: 'utf-8' })
  return JSON.parse(content)
}

type NotExportedError = {
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
  message: string
}

const isNotExportedError = (error: unknown): error is NotExportedError =>
  typeof error === 'object' &&
  !!error &&
  'code' in error &&
  error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED'

const notExportedPathRe = /is not defined by "exports" in (.+package\.json)$/

const getPathFromNotExported = (error: NotExportedError) =>
  notExportedPathRe.exec(error.message)?.[1]

type NotFoundError = {
  code: 'MODULE_NOT_FOUND'
  message: string
  path: string
}

const isNotFoundError = (error: unknown): error is NotFoundError =>
  typeof error === 'object' &&
  !!error &&
  'code' in error &&
  error.code === 'MODULE_NOT_FOUND'
