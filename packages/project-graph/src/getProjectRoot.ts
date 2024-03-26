import path from 'path'
import fs from 'fs'
import type { PackageJson } from './types'

const getProjectRootImpl = (cwd: string, firstFoundRoot?: string): string => {
  const packageJsonPath = path.join(cwd, 'package.json')
  const packageJsonExists = fs.existsSync(packageJsonPath)

  if (packageJsonExists) {
    const packageJson = require(packageJsonPath) as PackageJson
    if (packageJson.workspaces) return cwd
  }

  const parentFolder = path.dirname(cwd)
  const root = firstFoundRoot || (packageJsonExists ? cwd : undefined)

  if (parentFolder === cwd) {
    if (root) return root
    throw new Error(
      'There is no package.json up to the root of the filesystem.',
    )
  }

  return getProjectRootImpl(parentFolder, root)
}

export const getProjectRoot = (cwd = process.cwd()): string =>
  getProjectRootImpl(cwd)
